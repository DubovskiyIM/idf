import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import {
  ALLOWED_INTENTS,
  buildToolDef,
  loadIntents,
  makeHandlers,
  dispatch,
  executeIntent,
} from "./mcp-meta.mjs";

let tmpDir;
let dbPath;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "mcp-meta-"));
  dbPath = join(tmpDir, "idf.db");
  process.env.IDF_DB_PATH = dbPath;
});

afterEach(() => {
  delete process.env.IDF_DB_PATH;
  delete process.env.IDF_MCP_MODE;
  delete process.env.IDF_TOKEN;
  delete process.env.IDF_SERVER;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("mcp-meta · tool definitions", () => {
  it("ALLOWED_INTENTS = роли agent.canExecute (4 propose-only)", async () => {
    const { ONTOLOGY } = await import("../src/domains/meta/ontology.js");
    expect([...ALLOWED_INTENTS].sort()).toEqual(
      [...ONTOLOGY.roles.agent.canExecute].sort()
    );
  });

  it("buildToolDef переводит select.options в JSON-Schema enum, required → required[]", async () => {
    const intents = await loadIntents();
    const def = buildToolDef("add_backlog_item", intents.add_backlog_item);
    expect(def.name).toBe("meta_add_backlog_item");
    expect(def.inputSchema.type).toBe("object");
    expect(def.inputSchema.required).toEqual(expect.arrayContaining(["section", "title"]));
    expect(def.inputSchema.required).not.toContain("description");
    expect(def.inputSchema.properties.section.enum).toEqual([
      "P0", "P1", "P2", "research", "deferred",
    ]);
    expect(def.inputSchema.properties.description.type).toBe("string");
    expect(def.inputSchema.additionalProperties).toBe(false);
  });

  it("buildToolDef помечает intent с __irr в description", async () => {
    const intents = await loadIntents();
    // ship_pattern_promotion имеет __irr.high, но его нет в ALLOWED.
    // Проверим на propose_meta_intent (medium) — он тоже не в ALLOWED, но
    // buildToolDef работает на любом intent'е.
    const def = buildToolDef("propose_meta_intent", intents.propose_meta_intent);
    expect(def.description).toMatch(/irreversibility=medium/);
  });
});

describe("mcp-meta · handlers", () => {
  it("initialize → protocolVersion + tools capability + serverInfo", async () => {
    const intents = await loadIntents();
    const h = makeHandlers(intents);
    const res = await h.initialize({});
    expect(res.protocolVersion).toBe("2024-11-05");
    expect(res.capabilities).toHaveProperty("tools");
    expect(res.serverInfo.name).toBe("idf-meta");
  });

  it("tools/list → 4 propose-only tools, отсортированных по name", async () => {
    const intents = await loadIntents();
    const h = makeHandlers(intents);
    const res = await h["tools/list"]();
    expect(res.tools).toHaveLength(4);
    const names = res.tools.map(t => t.name);
    expect(names).toEqual([
      "meta_add_backlog_item",
      "meta_propose_intent_salience",
      "meta_propose_witness",
      "meta_request_pattern_promotion",
    ]);
    // None of state-transition intents and не expose'нут request_changeset
    // (он остаётся за formatAuthor — release pipeline требует human review).
    expect(names).not.toContain("meta_approve_pattern_promotion");
    expect(names).not.toContain("meta_ship_pattern_promotion");
    expect(names).not.toContain("meta_propose_meta_intent");
    expect(names).not.toContain("meta_request_changeset");
  });

  it("tools/call meta_add_backlog_item — пишет confirmed effect в IDF_DB_PATH", async () => {
    const intents = await loadIntents();
    const h = makeHandlers(intents);
    const result = await h["tools/call"]({
      name: "meta_add_backlog_item",
      arguments: {
        section: "P1",
        title: "Via MCP",
        description: "Tested via mcp-meta tools/call",
      },
    });
    expect(result.isError).toBe(false);
    expect(result.content[0].type).toBe("text");
    const db = new Database(dbPath);
    const row = db.prepare("SELECT * FROM effects WHERE intent_id = 'add_backlog_item'").get();
    db.close();
    expect(row).toBeTruthy();
    expect(row.alpha).toBe("create");
    // Source-of-truth: intent.particles.effects[0].target в src/domains/meta/intents.js
    // (множественное "BacklogItems" — соответствует registry-collection name).
    expect(row.target).toBe("BacklogItems");
    expect(row.status).toBe("confirmed");
    const ctx = JSON.parse(row.context);
    expect(ctx.title).toBe("Via MCP");
    expect(ctx.section).toBe("P1");
  });

  it("tools/call с не-allowed intent → isError + сообщение", async () => {
    const intents = await loadIntents();
    const h = makeHandlers(intents);
    const result = await h["tools/call"]({
      name: "meta_ship_pattern_promotion",
      arguments: { id: "x", sdkPrUrl: "https://x" },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not allowed/);
  });

  it("tools/call с unknown tool name → isError", async () => {
    const intents = await loadIntents();
    const h = makeHandlers(intents);
    const result = await h["tools/call"]({
      name: "meta_unknown_intent",
      arguments: {},
    });
    expect(result.isError).toBe(true);
  });
});

describe("mcp-meta · dispatch (JSON-RPC)", () => {
  it("dispatch с unknown method → error -32601 и id сохранён", async () => {
    const intents = await loadIntents();
    const h = makeHandlers(intents);
    const res = await dispatch(h, { jsonrpc: "2.0", id: 7, method: "made/up" });
    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe(7);
    expect(res.error.code).toBe(-32601);
  });

  it("dispatch с notification (id=null) → не возвращает response", async () => {
    const intents = await loadIntents();
    const h = makeHandlers(intents);
    const res = await dispatch(h, { jsonrpc: "2.0", method: "made/up" });
    expect(res).toBe(null);
  });

  it("dispatch initialize → result.protocolVersion", async () => {
    const intents = await loadIntents();
    const h = makeHandlers(intents);
    const res = await dispatch(h, { jsonrpc: "2.0", id: 1, method: "initialize" });
    expect(res.result.protocolVersion).toBe("2024-11-05");
  });

  it("notifications/initialized — handler возвращает null → нет response", async () => {
    const intents = await loadIntents();
    const h = makeHandlers(intents);
    const res = await dispatch(h, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(res).toBe(null);
  });
});

describe("mcp-meta · online mode", () => {
  let origFetch;
  let fetchCalls;

  beforeEach(() => {
    origFetch = globalThis.fetch;
    fetchCalls = [];
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("executeIntent с IDF_MCP_MODE=online — POST через fetch с Bearer", async () => {
    process.env.IDF_MCP_MODE = "online";
    process.env.IDF_TOKEN = "tok-abc";
    process.env.IDF_SERVER = "http://srv:9999";
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "eff-77", status: "confirmed", effects: [] }),
      };
    };
    const result = await executeIntent("add_backlog_item", {
      section: "P0", title: "via online",
    });
    expect(result.id).toBe("eff-77");
    expect(fetchCalls[0].url).toBe("http://srv:9999/api/agent/meta/exec/add_backlog_item");
    expect(fetchCalls[0].init.headers.Authorization).toBe("Bearer tok-abc");
  });

  it("executeIntent online без IDF_TOKEN → throws", async () => {
    process.env.IDF_MCP_MODE = "online";
    delete process.env.IDF_TOKEN;
    await expect(
      executeIntent("add_backlog_item", { section: "P0", title: "x" })
    ).rejects.toThrow(/IDF_TOKEN required/);
  });

  it("executeIntent online на 403 → throws с message сервера", async () => {
    process.env.IDF_MCP_MODE = "online";
    process.env.IDF_TOKEN = "t";
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        error: "intent_not_allowed",
        message: "agent role can't do this",
      }),
    });
    await expect(
      executeIntent("add_backlog_item", { section: "P0", title: "x" })
    ).rejects.toThrow(/HTTP 403/);
  });
});
