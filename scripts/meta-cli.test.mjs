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
  it("list — печатает все 11 intents мета-домена", async () => {
    await run(["list"]);
    const out = logs.out.join("\n");
    expect(out).toMatch(/Meta intents \(11\)/);
    expect(out).toMatch(/add_backlog_item/);
    expect(out).toMatch(/propose_witness/);
    expect(out).toMatch(/ship_pattern_promotion/);
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
