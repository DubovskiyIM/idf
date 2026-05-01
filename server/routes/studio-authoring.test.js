import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function makeApp({ claudeClient, targetDirOverride, anthropicClientFactory } = {}) {
  const app = express();
  app.use(express.json());
  const router = makeStudioAuthoringRouter({ claudeClient, targetDirOverride, anthropicClientFactory });
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

describe("GET /api/studio/domain/:id/author/spec", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = mkdtempSync(path.join(tmpdir(), "spec-get-")); });

  it("возвращает spec из committed файла, если сессии нет", async () => {
    const file = path.join(tmpDir, "domain.js");
    writeFileSync(file,
      `export const META = { id: "ghost-test", description: "x" };\n` +
      `export const INTENTS = { create_x: { α: "create", target: "X" } };\n` +
      `export const ONTOLOGY = { entities: { X: { fields: {} } }, roles: {}, invariants: [] };\n` +
      `export const PROJECTIONS = {};\n` +
      `export default { META, INTENTS, ONTOLOGY, PROJECTIONS };\n`,
      "utf8"
    );
    const app = makeApp({ claudeClient: makeMockClaude({}), targetDirOverride: tmpDir });
    const res = await request(app).get(`/api/studio/domain/ghost-test/author/spec`);
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("file");
    expect(res.body.spec.INTENTS.create_x).toBeDefined();
  });

  it("возвращает spec из активной сессии, если она есть", async () => {
    const claude = makeMockClaude({
      userFacing: "ok",
      patch: { meta: { description: "session-spec" } },
      nextState: "kickoff",
    });
    const app = makeApp({ claudeClient: claude });
    const id = `sess-spec-${Date.now()}`;
    await request(app).post(`/api/studio/domain/${id}/author/turn`).send({ userText: "hi" }).buffer(true).parse((r,cb)=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>cb(null,d));});
    const res = await request(app).get(`/api/studio/domain/${id}/author/spec`);
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("session");
    expect(res.body.spec.meta.description).toBe("session-spec");
  });

  it("404 если ни сессии, ни committed файла", async () => {
    const app = makeApp({ claudeClient: makeMockClaude({}), targetDirOverride: "/tmp/idf-nonexistent-xxx" });
    const res = await request(app).get(`/api/studio/domain/ghost-${Date.now()}/author/spec`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("no_spec");
  });
});

describe("PUT /api/studio/domain/:id/author/spec", () => {
  let tmpDir;
  beforeEach(() => { tmpDir = mkdtempSync(path.join(tmpdir(), "spec-put-")); });

  it("заменяет spec в сессии и валидирует — переход в preview", async () => {
    const app = makeApp({ claudeClient: makeMockClaude({}) });
    const id = `put-spec-${Date.now()}`;
    const newSpec = {
      meta: { id },
      INTENTS: { create_x: { α: "create", target: "X" } },
      ONTOLOGY: { entities: { X: { fields: {} } }, roles: {}, invariants: [] },
      PROJECTIONS: {},
    };
    const res = await request(app).put(`/api/studio/domain/${id}/author/spec`).send({ spec: newSpec });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.canFinalize).toBe(true);
    expect(res.body.state).toBe("preview");
    expect(res.body.committed).toBe(false);
    expect(res.body.validationIssues).toEqual([]);
  });

  it("400 если spec не объект", async () => {
    const app = makeApp({ claudeClient: makeMockClaude({}) });
    const res = await request(app).put(`/api/studio/domain/bad/author/spec`).send({ spec: "not-an-object" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_spec");
  });

  it("400 если commit=true но spec не finalizable", async () => {
    const app = makeApp({ claudeClient: makeMockClaude({}) });
    const id = `put-empty-${Date.now()}`;
    const emptySpec = {
      meta: { id }, INTENTS: {}, ONTOLOGY: { entities: {}, roles: {}, invariants: [] }, PROJECTIONS: {},
    };
    const res = await request(app).put(`/api/studio/domain/${id}/author/spec`).send({ spec: emptySpec, commit: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("not_finalizable");
  });

  it("если commit=true — пишет файл и hot-reload'ит", async () => {
    const app = makeApp({ claudeClient: makeMockClaude({}) });
    const id = `put-commit-${Date.now()}`;
    const newSpec = {
      meta: { id },
      INTENTS: { create_x: { α: "create", target: "X" } },
      ONTOLOGY: { entities: { X: { fields: {} } }, roles: {}, invariants: [] },
      PROJECTIONS: {},
    };
    const res = await request(app)
      .put(`/api/studio/domain/${id}/author/spec`)
      .send({ spec: newSpec, commit: true, targetDir: tmpDir });
    expect(res.status).toBe(200);
    expect(res.body.committed).toBe(true);
    expect(res.body.path).toBeTruthy();
    const nodeFs = require("node:fs");
    const written = nodeFs.readFileSync(res.body.path, "utf8");
    expect(written).toContain("create_x");
  });
});

describe("POST /api/studio/domain/:id/author/attach", () => {
  it("принимает multipart YAML, регистрирует на сессии, переводит state в import_openapi", async () => {
    const fakeUpload = vi.fn().mockResolvedValue({ id: "file_xx", filename: "pet.yaml" });
    const app = makeApp({
      anthropicClientFactory: () => ({ beta: { files: { upload: fakeUpload } } }),
    });
    const fixture = await fs.readFile(path.resolve(__dirname, "../__fixtures__/openapi/petstore-mini.yaml"));
    const res = await request(app)
      .post(`/api/studio/domain/attach-${Date.now()}/author/attach`)
      .attach("file", fixture, "petstore-mini.yaml");
    expect(res.status).toBe(200);
    expect(res.body.fileId).toBe("file_xx");
    expect(res.body.name).toBe("petstore-mini.yaml");
    expect(res.body.state).toBe("import_openapi");
    expect(fakeUpload).toHaveBeenCalledOnce();
  });

  it("400 без файла", async () => {
    const app = makeApp({ claudeClient: makeMockClaude({}) });
    const res = await request(app).post(`/api/studio/domain/no-file/author/attach`);
    expect(res.status).toBe(400);
  });

  it("400 на bad extension", async () => {
    const app = makeApp({
      anthropicClientFactory: () => ({ beta: { files: { upload: vi.fn() } } }),
    });
    const res = await request(app)
      .post(`/api/studio/domain/bad-ext/author/attach`)
      .attach("file", Buffer.from("x"), "evil.exe");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/extension/);
  });

  it("следующий /turn проносит attachment как document content-block", async () => {
    const fakeUpload = vi.fn().mockResolvedValue({ id: "file_yy", filename: "pet.yaml" });
    const messagesCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"userFacing":"ok","patch":{},"nextState":"entities","nextPrompt":""}' }],
    });
    const app = makeApp({
      anthropicClientFactory: () => ({
        beta: { files: { upload: fakeUpload } },
        messages: { create: messagesCreate },
      }),
    });
    const id = `attach-flow-${Date.now()}`;
    const fixture = await fs.readFile(path.resolve(__dirname, "../__fixtures__/openapi/petstore-mini.yaml"));
    await request(app)
      .post(`/api/studio/domain/${id}/author/attach`)
      .attach("file", fixture, "petstore-mini.yaml");
    await request(app)
      .post(`/api/studio/domain/${id}/author/turn`)
      .send({ userText: "Импортируй" })
      .buffer(true).parse((r,cb)=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>cb(null,d));});
    expect(messagesCreate).toHaveBeenCalled();
    const callArg = messagesCreate.mock.calls[0][0];
    const lastMsg = callArg.messages[callArg.messages.length - 1];
    expect(Array.isArray(lastMsg.content)).toBe(true);
    expect(lastMsg.content.find((b) => b.type === "document")).toBeDefined();

    // Attachment одноразовый — следующий /turn не проносит его
    messagesCreate.mockClear();
    await request(app)
      .post(`/api/studio/domain/${id}/author/turn`)
      .send({ userText: "ещё что-нибудь" })
      .buffer(true).parse((r,cb)=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>cb(null,d));});
    const secondCall = messagesCreate.mock.calls[0][0];
    const secondLast = secondCall.messages[secondCall.messages.length - 1];
    expect(typeof secondLast.content).toBe("string");
  });
});
