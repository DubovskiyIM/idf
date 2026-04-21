import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { makeStudioAuthoringRouter } = req("./studio-authoring.js");

function makeMockClaude(responseSequence) {
  const responses = Array.isArray(responseSequence) ? [...responseSequence] : [responseSequence];
  return {
    messages: {
      create: vi.fn(async () => {
        const next = responses.shift() || { userFacing: "ok", patch: {}, nextState: "entities" };
        return { content: [{ type: "text", text: JSON.stringify(next) }] };
      }),
    },
  };
}

function makeApp({ claudeClient }) {
  const app = express();
  app.use(express.json());
  const router = makeStudioAuthoringRouter({ claudeClient });
  app.use("/api/studio/domain", router);
  app._routerInstance = router;
  return app;
}

function parseSSE(rawText) {
  const events = [];
  const chunks = rawText.split("\n\n").map(c => c.trim()).filter(Boolean);
  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const event = lines.find(l => l.startsWith("event: "))?.slice(7);
    const data = lines.find(l => l.startsWith("data: "))?.slice(6);
    if (event && data) {
      try {
        events.push({ event, data: JSON.parse(data) });
      } catch {
        events.push({ event, data });
      }
    }
  }
  return events;
}

describe("POST /api/studio/domain/:id/author/turn — SSE", () => {
  it("streamит pending → response → done events на валидный turn", async () => {
    const claude = makeMockClaude({
      userFacing: "Понял",
      patch: { meta: { description: "Retro tool" } },
      nextState: "kickoff",
      nextPrompt: "Кто пользуется?",
    });
    const app = makeApp({ claudeClient: claude });

    const res = await request(app)
      .post("/api/studio/domain/retro-test-1/author/turn")
      .send({ userText: "retro инструмент" })
      .buffer(true)
      .parse((r, cb) => {
        let data = "";
        r.on("data", c => { data += c.toString(); });
        r.on("end", () => cb(null, data));
      });

    expect(res.status).toBe(200);
    const events = parseSSE(res.body);
    const types = events.map(e => e.event);
    expect(types).toEqual(["pending", "response", "done"]);
    const resp = events.find(e => e.event === "response");
    expect(resp.data.userFacing).toBe("Понял");
    expect(resp.data.state).toBe("kickoff");
    expect(resp.data.spec.meta.description).toBe("Retro tool");
  });

  it("persistит session между turns", async () => {
    const claude = makeMockClaude([
      { userFacing: "1", patch: { meta: { description: "D1" } }, nextState: "kickoff" },
      { userFacing: "2",
        patch: { ONTOLOGY: { entities: { Card: { fields: { title: { type: "text" } } } } } },
        nextState: "entities" },
    ]);
    const app = makeApp({ claudeClient: claude });

    await request(app).post("/api/studio/domain/persist-1/author/turn").send({ userText: "a" }).buffer(true).parse((r,cb)=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>cb(null,d));});
    const res2 = await request(app).post("/api/studio/domain/persist-1/author/turn").send({ userText: "b" }).buffer(true).parse((r,cb)=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>cb(null,d));});

    const events = parseSSE(res2.body);
    const resp = events.find(e => e.event === "response");
    expect(resp.data.spec.meta.description).toBe("D1");
    expect(resp.data.spec.ONTOLOGY.entities.Card).toBeDefined();
  });

  it("SSE error event если Claude упал", async () => {
    const claude = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error("claude-upstream-503")),
      },
    };
    const app = makeApp({ claudeClient: claude });

    const res = await request(app)
      .post("/api/studio/domain/err-1/author/turn")
      .send({ userText: "x" })
      .buffer(true).parse((r,cb)=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>cb(null,d));});

    const events = parseSSE(res.body);
    const err = events.find(e => e.event === "error");
    expect(err).toBeTruthy();
    expect(err.data.message).toMatch(/claude-upstream/);
  });

  it("400 если нет userText", async () => {
    const app = makeApp({ claudeClient: makeMockClaude({}) });
    const res = await request(app)
      .post("/api/studio/domain/missing/author/turn")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_userText");
  });
});

describe("GET /api/studio/domain/:id/author/state", () => {
  it("404 если нет session", async () => {
    const app = makeApp({ claudeClient: makeMockClaude({}) });
    const res = await request(app).get("/api/studio/domain/no-such/author/state");
    expect(res.status).toBe(404);
  });

  it("возвращает snapshot после одного turn'а", async () => {
    const claude = makeMockClaude({
      userFacing: "ok",
      patch: { meta: { description: "X" } },
      nextState: "kickoff",
    });
    const app = makeApp({ claudeClient: claude });
    await request(app).post("/api/studio/domain/snap-1/author/turn").send({ userText: "a" }).buffer(true).parse((r,cb)=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>cb(null,d));});
    const res = await request(app).get("/api/studio/domain/snap-1/author/state");
    expect(res.status).toBe(200);
    expect(res.body.spec.meta.description).toBe("X");
    expect(res.body.state).toBe("kickoff");
    expect(res.body.turnIndex).toBe(1);
  });
});

describe("POST /api/studio/domain/:id/author/undo", () => {
  it("возвращает state к предыдущему turn'у", async () => {
    const claude = makeMockClaude([
      { userFacing: "1", patch: { meta: { description: "D1" } }, nextState: "kickoff" },
      { userFacing: "2", patch: { meta: { description: "D2" } }, nextState: "kickoff" },
    ]);
    const app = makeApp({ claudeClient: claude });

    await request(app).post("/api/studio/domain/undo-1/author/turn").send({ userText: "a" }).buffer(true).parse((r,cb)=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>cb(null,d));});
    await request(app).post("/api/studio/domain/undo-1/author/turn").send({ userText: "b" }).buffer(true).parse((r,cb)=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>cb(null,d));});

    const undoRes = await request(app).post("/api/studio/domain/undo-1/author/undo");
    expect(undoRes.status).toBe(200);
    expect(undoRes.body.spec.meta.description).toBe("D1");
    expect(undoRes.body.turnIndex).toBe(1);
  });

  it("400 если nothing_to_undo", async () => {
    const app = makeApp({ claudeClient: makeMockClaude({}) });
    const res = await request(app).post("/api/studio/domain/empty-1/author/undo");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("nothing_to_undo");
  });
});

describe("POST /api/studio/domain/:id/author/reset", () => {
  it("очищает session", async () => {
    const claude = makeMockClaude({ userFacing: "ok", patch: {}, nextState: "kickoff" });
    const app = makeApp({ claudeClient: claude });

    await request(app).post("/api/studio/domain/reset-1/author/turn").send({ userText: "a" }).buffer(true).parse((r,cb)=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>cb(null,d));});
    const resetRes = await request(app).post("/api/studio/domain/reset-1/author/reset");
    expect(resetRes.status).toBe(200);

    const stateRes = await request(app).get("/api/studio/domain/reset-1/author/state");
    expect(stateRes.status).toBe(404);
  });
});
