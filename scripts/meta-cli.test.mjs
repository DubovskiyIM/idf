import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { run } from "./meta-cli.mjs";

let tmpDir;
let dbPath;
let logs;
let restore;

function captureConsole() {
  const origLog = console.log;
  const origErr = console.error;
  const buf = { out: [], err: [] };
  console.log = (...a) => buf.out.push(a.map(String).join(" "));
  console.error = (...a) => buf.err.push(a.map(String).join(" "));
  return {
    buf,
    restore: () => { console.log = origLog; console.error = origErr; },
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "meta-cli-"));
  dbPath = join(tmpDir, "idf.db");
  const cap = captureConsole();
  logs = cap.buf;
  restore = cap.restore;
});

afterEach(() => {
  restore();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("meta-cli", () => {
  it("list — печатает все 12 intents мета-домена", async () => {
    await run(["list"]);
    const out = logs.out.join("\n");
    expect(out).toMatch(/Meta intents \(12\)/);
    expect(out).toMatch(/add_backlog_item/);
    expect(out).toMatch(/propose_witness/);
    expect(out).toMatch(/ship_pattern_promotion/);
    expect(out).toMatch(/request_changeset/);
  });

  it("schema add_backlog_item — выводит параметры с required-флагами", async () => {
    await run(["schema", "add_backlog_item"]);
    const out = logs.out.join("\n");
    expect(out).toMatch(/section\s+select.*\[REQUIRED\]/);
    expect(out).toMatch(/title\s+text\s+\[REQUIRED\]/);
    expect(out).toMatch(/description\s+textarea/);
    expect(out).not.toMatch(/description.*\[REQUIRED\]/);
  });

  it("exec add_backlog_item — пишет confirmed effect, который меta-compile fold'ит", async () => {
    await run([
      "exec", "add_backlog_item",
      "--section=P1",
      "--title=Begin DSL dogfooding",
      "--description=Switch authoring to intents",
      `--db=${dbPath}`,
    ]);
    const db = new Database(dbPath);
    const rows = db.prepare("SELECT * FROM effects WHERE intent_id = ?").all("add_backlog_item");
    db.close();
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.alpha).toBe("create");
    expect(r.target).toBe("BacklogItem");
    expect(r.status).toBe("confirmed");
    const ctx = JSON.parse(r.context);
    expect(ctx.section).toBe("P1");
    expect(ctx.title).toBe("Begin DSL dogfooding");
    expect(ctx.status).toBe("open");
    expect(ctx.id).toBeTruthy();
    expect(typeof ctx.createdAt).toBe("number");
  });

  it("exec — required missing → exit code 2", async () => {
    const exitSpy = (code) => { throw new Error(`__exit_${code}`); };
    const origExit = process.exit;
    process.exit = exitSpy;
    try {
      await expect(run([
        "exec", "add_backlog_item",
        "--title=Without section",
        `--db=${dbPath}`,
      ])).rejects.toThrow(/__exit_2/);
      const err = logs.err.join("\n");
      expect(err).toMatch(/required param missing: section/);
    } finally {
      process.exit = origExit;
    }
  });

  it("exec — unknown param → exit code 2", async () => {
    const origExit = process.exit;
    process.exit = (code) => { throw new Error(`__exit_${code}`); };
    try {
      await expect(run([
        "exec", "add_backlog_item",
        "--section=P1",
        "--title=ok",
        "--bogus=x",
        `--db=${dbPath}`,
      ])).rejects.toThrow(/__exit_2/);
      expect(logs.err.join("\n")).toMatch(/unexpected param: bogus/);
    } finally {
      process.exit = origExit;
    }
  });

  it("exec — невалидный select option → exit code 2", async () => {
    const origExit = process.exit;
    process.exit = (code) => { throw new Error(`__exit_${code}`); };
    try {
      await expect(run([
        "exec", "add_backlog_item",
        "--section=Pwrong",
        "--title=ok",
        `--db=${dbPath}`,
      ])).rejects.toThrow(/__exit_2/);
      expect(logs.err.join("\n")).toMatch(/section: ожидалось/);
    } finally {
      process.exit = origExit;
    }
  });

  it("dry-run — DB не создаётся", async () => {
    const { existsSync } = await import("node:fs");
    await run([
      "exec", "add_backlog_item",
      "--section=P0",
      "--title=dry",
      `--db=${dbPath}`,
      "--dry-run",
    ]);
    expect(existsSync(dbPath)).toBe(false);
    expect(logs.out.join("\n")).toMatch(/dry-run/);
  });

  it("exec replace на BacklogItem.status — context.id берётся из --id", async () => {
    // Сначала create, потом replace — id из params.id.
    await run([
      "exec", "add_backlog_item",
      "--section=P1",
      "--title=item-to-schedule",
      `--db=${dbPath}`,
    ]);
    const db = new Database(dbPath);
    const created = db.prepare("SELECT context FROM effects WHERE alpha='create'").get();
    const entityId = JSON.parse(created.context).id;
    db.close();

    await run([
      "exec", "schedule_backlog_item",
      `--id=${entityId}`,
      `--db=${dbPath}`,
    ]);

    const db2 = new Database(dbPath);
    const replace = db2.prepare("SELECT * FROM effects WHERE alpha='replace'").get();
    db2.close();
    expect(replace.target).toBe("BacklogItem.status");
    const ctx = JSON.parse(replace.context);
    expect(ctx.id).toBe(entityId);
    expect(ctx.status).toBe("scheduled");
  });
});

describe("meta-cli online", () => {
  let origFetch;
  let fetchCalls;

  beforeEach(() => {
    origFetch = globalThis.fetch;
    fetchCalls = [];
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  function mockFetch(impl) {
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url, init });
      return impl(url, init);
    };
  }

  it("--online — POST на /api/agent/meta/exec/<id> с Bearer JWT и JSON body", async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: "eff-1",
        intentId: "add_backlog_item",
        status: "confirmed",
        effects: [{ alpha: "create", target: "BacklogItem" }],
      }),
    }));
    await run([
      "exec", "add_backlog_item",
      "--section=P1", "--title=via-online",
      "--online", "--token=jwt-XYZ",
      "--server=http://localhost:9999",
    ]);
    expect(fetchCalls).toHaveLength(1);
    const call = fetchCalls[0];
    expect(call.url).toBe("http://localhost:9999/api/agent/meta/exec/add_backlog_item");
    expect(call.init.method).toBe("POST");
    expect(call.init.headers["Authorization"]).toBe("Bearer jwt-XYZ");
    expect(call.init.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(call.init.body);
    expect(body).toEqual({ section: "P1", title: "via-online" });
    expect(logs.out.join("\n")).toMatch(/✓\s+confirmed\s+eff-1/);
  });

  it("--online — отсутствие token → exit 4", async () => {
    const origToken = process.env.IDF_TOKEN;
    delete process.env.IDF_TOKEN;
    const origExit = process.exit;
    process.exit = (code) => { throw new Error(`__exit_${code}`); };
    try {
      await expect(run([
        "exec", "add_backlog_item",
        "--section=P1", "--title=t",
        "--online",
      ])).rejects.toThrow(/__exit_4/);
      expect(logs.err.join("\n")).toMatch(/требуется --token/);
    } finally {
      process.exit = origExit;
      if (origToken) process.env.IDF_TOKEN = origToken;
    }
  });

  it("--online — 403 intent_not_allowed → exit 3 + печать message", async () => {
    mockFetch(async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        error: "intent_not_allowed",
        intentId: "add_backlog_item",
        message: "Intent 'add_backlog_item' is not callable by role 'agent'",
      }),
    }));
    const origExit = process.exit;
    process.exit = (code) => { throw new Error(`__exit_${code}`); };
    try {
      await expect(run([
        "exec", "add_backlog_item",
        "--section=P1", "--title=t",
        "--online", "--token=tok",
      ])).rejects.toThrow(/__exit_3/);
      const err = logs.err.join("\n");
      expect(err).toMatch(/403 intent_not_allowed/);
      expect(err).toMatch(/not callable by role 'agent'/);
    } finally {
      process.exit = origExit;
    }
  });

  it("--online — 400 parameter_validation → печать issues[]", async () => {
    mockFetch(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: "parameter_validation",
        intentId: "add_backlog_item",
        issues: [{ parameter: "section", code: "type", expected: "string", got: "number" }],
      }),
    }));
    const origExit = process.exit;
    process.exit = (code) => { throw new Error(`__exit_${code}`); };
    try {
      await expect(run([
        "exec", "add_backlog_item",
        "--section=P1", "--title=t",
        "--online", "--token=tok",
      ])).rejects.toThrow(/__exit_3/);
      const err = logs.err.join("\n");
      expect(err).toMatch(/400 parameter_validation/);
      expect(err).toMatch(/parameter.*section/);
    } finally {
      process.exit = origExit;
    }
  });

  it("--online — ENV IDF_TOKEN и IDF_SERVER подхватываются", async () => {
    process.env.IDF_TOKEN = "env-token";
    process.env.IDF_SERVER = "http://idf.example/";
    mockFetch(async () => ({
      ok: true, status: 200, json: async () => ({ id: "x", status: "confirmed", effects: [] }),
    }));
    try {
      await run([
        "exec", "add_backlog_item",
        "--section=P1", "--title=t",
        "--online",
      ]);
      const call = fetchCalls[0];
      expect(call.url).toBe("http://idf.example/api/agent/meta/exec/add_backlog_item");
      expect(call.init.headers["Authorization"]).toBe("Bearer env-token");
    } finally {
      delete process.env.IDF_TOKEN;
      delete process.env.IDF_SERVER;
    }
  });

  it("ontology meta содержит roles.agent c canExecute = propose-only subset", async () => {
    const { ONTOLOGY } = await import("../src/domains/meta/ontology.js");
    const agent = ONTOLOGY.roles.agent;
    expect(agent).toBeTruthy();
    expect(agent.base).toBe("agent");
    expect(agent.canExecute).toEqual([
      "add_backlog_item",
      "propose_witness",
      "propose_intent_salience",
      "request_pattern_promotion",
    ]);
    expect(agent.canExecute).not.toContain("request_changeset");
    // Не должны быть доступны state-transitions и meta-circular self-mod.
    for (const forbidden of [
      "approve_pattern_promotion",
      "ship_pattern_promotion",
      "close_backlog_item",
      "schedule_backlog_item",
      "reject_backlog_item",
      "propose_meta_intent",
    ]) {
      expect(agent.canExecute).not.toContain(forbidden);
    }
  });
});
