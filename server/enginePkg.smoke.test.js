import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Smoke-тест поверх @intent-driven/engine + SQLite persistence adapter.
 * Убеждается, что host-обёртка (enginePersistenceAdapter + enginePkg)
 * корректно оборачивает sync-SQLite в async Persistence и пропускает через
 * engine.submit полный lifecycle (proposed → confirmed).
 */

let tmpDir;
let originalDbPath;

beforeEach(() => {
  // Изолируем SQLite-файл, чтобы тест не трогал server/idf.db.
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "idf-engine-pkg-smoke-"));
  originalDbPath = process.env.IDF_DB_PATH;
  process.env.IDF_DB_PATH = path.join(tmpDir, "test.db");

  // Reset require cache для db.js/enginePkg.js между тестами.
  delete require.cache[require.resolve("./db.js")];
  delete require.cache[require.resolve("./enginePersistenceAdapter.js")];
  delete require.cache[require.resolve("./enginePkg.js")];
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (originalDbPath == null) delete process.env.IDF_DB_PATH;
  else process.env.IDF_DB_PATH = originalDbPath;
});

describe("enginePkg smoke (SQLite persistence adapter)", () => {
  it("submit effect → confirmed, записывается в SQLite", async () => {
    const { initEngine, getEngine } = require("./enginePkg.js");

    const minimalDomain = {
      ONTOLOGY: {
        entities: { Foo: {} },
        roles: {},
        rules: [],
      },
      INTENTS: {
        create_foo: {
          particles: { effects: [{ alpha: "add", target: "Foo" }], conditions: [] },
        },
      },
    };

    await initEngine(minimalDomain);
    const engine = getEngine();

    const result = await engine.submit({
      id: "e1",
      intent_id: "create_foo",
      alpha: "add",
      target: "Foo",
      context: { id: "f1", name: "hello" },
      created_at: 1000,
    });

    expect(result.status).toBe("confirmed");

    // Проверяем что в SQLite реально записан confirmed-эффект
    const world = await engine.foldWorld();
    expect(world.foos).toHaveLength(1);
    expect(world.foos[0].name).toBe("hello");
  });

  it("updateStatus корректно обновляет reason + resolved_at в SQLite", async () => {
    // Прямой тест adapter'а без engine.
    const { createSqlitePersistence } = require("./enginePersistenceAdapter.js");
    const persistence = createSqlitePersistence();

    await persistence.appendEffect({
      id: "e-err",
      intent_id: "test",
      alpha: "add",
      target: "X",
      context: { id: "x1" },
      created_at: 1000,
    });

    await persistence.updateStatus("e-err", "rejected", { reason: "test-reason" });

    const all = await persistence.readEffects();
    const effect = all.find((e) => e.id === "e-err");
    expect(effect).toBeDefined();
    expect(effect.status).toBe("rejected");
    expect(effect.reason).toBe("test-reason");
    expect(typeof effect.resolved_at).toBe("number");
  });

  it("ruleState.get/set работает с SQL rule_state таблицей", async () => {
    const { createSqlitePersistence } = require("./enginePersistenceAdapter.js");
    const persistence = createSqlitePersistence();

    await persistence.ruleState.set("r1", "u1", { counter: 3, lastFiredAt: 1000 });
    const state = await persistence.ruleState.get("r1", "u1");
    expect(state.counter).toBe(3);
    expect(state.lastFiredAt).toBe(1000);

    await persistence.ruleState.set("r1", "u1", { counter: 5 });
    const updated = await persistence.ruleState.get("r1", "u1");
    expect(updated.counter).toBe(5);
    expect(updated.lastFiredAt).toBe(1000); // preserved
  });

  it("isEnabled() читает USE_ENGINE_PKG env-var", () => {
    const { isEnabled } = require("./enginePkg.js");
    const prev = process.env.USE_ENGINE_PKG;

    process.env.USE_ENGINE_PKG = "1";
    expect(isEnabled()).toBe(true);

    process.env.USE_ENGINE_PKG = "0";
    expect(isEnabled()).toBe(false);

    delete process.env.USE_ENGINE_PKG;
    expect(isEnabled()).toBe(false);

    if (prev != null) process.env.USE_ENGINE_PKG = prev;
  });
});
