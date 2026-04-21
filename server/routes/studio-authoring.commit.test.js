/**
 * Commit-endpoint integration test.
 *
 * Гоняет серию turn'ов до state=preview, потом POST /author/commit
 * проверяет что:
 *   - файл создан во временной директории
 *   - ontology + intents зарегистрированы в runtime (hot-reload)
 *   - session state = committed
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { makeStudioAuthoringRouter } = req("./studio-authoring.js");
const { getOntology } = req("../ontologyRegistry.cjs");
const intentsModule = req("../intents.js");

function makeMockClaude(responses) {
  const queue = [...responses];
  return {
    messages: {
      create: vi.fn(async () => {
        const next = queue.shift() || { userFacing: "ok", patch: {}, nextState: "preview" };
        return { content: [{ type: "text", text: JSON.stringify(next) }] };
      }),
    },
  };
}

async function postTurn(app, id, userText) {
  return request(app)
    .post(`/api/studio/domain/${id}/author/turn`)
    .send({ userText })
    .buffer(true)
    .parse((r, cb) => {
      let d = "";
      r.on("data", c => { d += c.toString(); });
      r.on("end", () => cb(null, d));
    });
}

function makeApp(claudeClient) {
  const app = express();
  app.use(express.json());
  app.use("/api/studio/domain", makeStudioAuthoringRouter({ claudeClient }));
  return app;
}

describe("POST /api/studio/domain/:id/author/commit", () => {
  let tmpDir;
  const DOMAIN_ID = `commit-test-${Date.now()}`;

  beforeEach(() => { tmpDir = mkdtempSync(path.join(tmpdir(), "idf-studio-commit-")); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it("404 если нет session", async () => {
    const app = makeApp(makeMockClaude([]));
    const res = await request(app).post(`/api/studio/domain/nope/author/commit`);
    expect(res.status).toBe(404);
  });

  it("400 если state не в preview/ontology_detail", async () => {
    const claude = makeMockClaude([
      { userFacing: "1", patch: { meta: { description: "D" } }, nextState: "kickoff" },
    ]);
    const app = makeApp(claude);
    await postTurn(app, "too-early", "x");
    const res = await request(app).post(`/api/studio/domain/too-early/author/commit`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("not_finalizable");
  });

  it("пишет domain.js + hot-reload ontology + intents", async () => {
    const claude = makeMockClaude([
      { userFacing: "1", patch: { meta: { description: "D" } }, nextState: "kickoff" },
      { userFacing: "2", patch: { ONTOLOGY: { entities: { Card: { fields: { title: { type: "text" } } } } } }, nextState: "entities" },
      { userFacing: "3", patch: { INTENTS: { create_card: { α: "create", target: "Card" } } }, nextState: "preview" },
    ]);
    const app = makeApp(claude);

    await postTurn(app, DOMAIN_ID, "a");
    await postTurn(app, DOMAIN_ID, "b");
    await postTurn(app, DOMAIN_ID, "c");

    const res = await request(app)
      .post(`/api/studio/domain/${DOMAIN_ID}/author/commit`)
      .send({ targetDir: tmpDir });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.entityCount).toBe(1);
    expect(res.body.intentCount).toBe(1);
    expect(existsSync(path.join(tmpDir, "domain.js"))).toBe(true);

    // Hot-reload проверки:
    const registered = getOntology(DOMAIN_ID);
    expect(registered).toBeTruthy();
    expect(registered.entities.Card).toBeDefined();

    const intent = intentsModule.getIntent("create_card", DOMAIN_ID);
    expect(intent).toBeTruthy();
    expect(intent.α).toBe("create");
  });

  it("state после commit = committed", async () => {
    const claude = makeMockClaude([
      { userFacing: "1", patch: { ONTOLOGY: { entities: { X: {} } }, INTENTS: { a: { α: "create", target: "X" } }, meta: { description: "D" } }, nextState: "preview" },
    ]);
    const app = makeApp(claude);
    const DID = `committed-state-${Date.now()}`;
    await postTurn(app, DID, "x");

    await request(app).post(`/api/studio/domain/${DID}/author/commit`).send({ targetDir: tmpDir });
    const stateRes = await request(app).get(`/api/studio/domain/${DID}/author/state`);
    expect(stateRes.status).toBe(200);
    expect(stateRes.body.state).toBe("committed");
  });
});
