/**
 * Multi-domain audit для agent-router.
 *
 * Монтирует makeAgentRouter в тестовый Express app без запуска полного
 * server/index.js (там server.listen на top-level). Регистрирует 2 фиктивных
 * домена в ontologyRegistry и intents и проверяет, что один роутер отдаёт
 * разные schemas под разный :domain.
 */

import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import { createRequire } from "node:module";

// Используем require через createRequire, чтобы попасть в тот же module-cache, который
// использует agent.js (CJS require). Vitest ESM-import vs CJS-require могут создавать
// две изолированные копии singleton-реестра — это здесь нежелательно.
const req = createRequire(import.meta.url);
const { makeAgentRouter } = req("./agent.js");
const { registerOntology } = req("../ontologyRegistry.cjs");
const intentsModule = req("../intents.js");
const authModule = req("../auth.js");

const DOMAIN_A = {
  id: "testdomain-a",
  ontology: {
    entities: {
      Widget: { fields: { title: { type: "text" } } },
    },
    roles: {
      agent: {
        base: "agent",
        canExecute: ["create_widget"],
        visibleFields: { Widget: ["title"] },
      },
    },
  },
  intents: {
    create_widget: {
      id: "create_widget",
      α: "create", target: "Widget",
      parameters: [{ name: "title", type: "text", required: true }],
    },
  },
};

const DOMAIN_B = {
  id: "testdomain-b",
  ontology: {
    entities: {
      Gadget: { fields: { name: { type: "text" } } },
    },
    roles: {
      agent: {
        base: "agent",
        canExecute: ["create_gadget"],
        visibleFields: { Gadget: ["name"] },
      },
    },
  },
  intents: {
    create_gadget: {
      id: "create_gadget",
      α: "create", target: "Gadget",
      parameters: [{ name: "name", type: "text", required: true }],
    },
  },
};

function makeTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/agent/:domain", makeAgentRouter(() => {}));
  return app;
}

describe("Agent router — multi-domain", () => {
  let token;

  beforeAll(() => {
    registerOntology(DOMAIN_A.id, DOMAIN_A.ontology);
    registerOntology(DOMAIN_B.id, DOMAIN_B.ontology);
    intentsModule.registerIntents(DOMAIN_A.intents, DOMAIN_A.id);
    intentsModule.registerIntents(DOMAIN_B.intents, DOMAIN_B.id);

    const email = `multi-domain-agent-${Date.now()}@local`;
    try {
      const reg = authModule.register(email, "test-pw-123", "agent-multi-test");
      token = reg.token;
    } catch (e) {
      const log = authModule.login(email, "test-pw-123");
      token = log.token;
    }
  });

  it("GET /api/agent/testdomain-a/schema возвращает intents домена A", async () => {
    const app = makeTestApp();
    const res = await request(app)
      .get("/api/agent/testdomain-a/schema")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const ids = (res.body.intents || []).map(i => i.intentId);
    expect(ids).toContain("create_widget");
    expect(ids).not.toContain("create_gadget");
  });

  it("GET /api/agent/testdomain-b/schema возвращает intents домена B", async () => {
    const app = makeTestApp();
    const res = await request(app)
      .get("/api/agent/testdomain-b/schema")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const ids = (res.body.intents || []).map(i => i.intentId);
    expect(ids).toContain("create_gadget");
    expect(ids).not.toContain("create_widget");
  });

  it("GET /api/agent/<unknown>/schema → 404 или 503 с domain-info", async () => {
    const app = makeTestApp();
    const res = await request(app)
      .get("/api/agent/nonexistent-domain-xyz/schema")
      .set("Authorization", `Bearer ${token}`);
    expect([404, 503]).toContain(res.status);
    expect(String(res.body.error || res.text)).toMatch(/ontology|domain|not.?found/i);
  });

  it("handler не содержит хардкодов конкретного домена в коде", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(new URL("./agent.js", import.meta.url), "utf8");
    const codeOnly = source
      .split("\n")
      .filter(l => !l.trim().startsWith("*") && !l.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/["']booking["']/);
    expect(codeOnly).not.toMatch(/["']sales["']/);
    expect(codeOnly).not.toMatch(/["']freelance["']/);
  });
});
