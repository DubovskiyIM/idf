import { describe, it, expect, beforeAll } from "vitest";

const { foldWorld, updateTypeMap } = require("./validator.js");
const db = require("./db.js");

describe("ScheduledTimer fold integration", () => {
  beforeAll(() => {
    // Регистрация типа (дубль безопасен — updateTypeMap merge'ит)
    updateTypeMap({
      entities: { ScheduledTimer: { fields: {} } },
    });
    db.prepare("DELETE FROM effects WHERE intent_id IN ('schedule_timer','revoke_timer')").run();
  });

  it("schedule_timer effect appears in world.scheduledTimers", () => {
    const id = "tmr_test_1";
    db.prepare(`
      INSERT INTO effects (id, intent_id, alpha, target, value, scope, status, context, created_at, resolved_at)
      VALUES (?, 'schedule_timer', 'add', 'ScheduledTimer', NULL, 'account', 'confirmed', ?, ?, ?)
    `).run(`eff_${id}`, JSON.stringify({
      id, firesAt: 12345, fireIntent: "x", active: true, firedAt: null,
    }), Date.now(), Date.now());

    const world = foldWorld();
    const t = (world.scheduledTimers || []).find(x => x.id === id);
    expect(t).toBeTruthy();
    expect(t.firesAt).toBe(12345);
    expect(t.active).toBe(true);
  });

  it("revoke_timer flips active to false", () => {
    const id = "tmr_test_2";
    const now = Date.now();
    db.prepare(`
      INSERT INTO effects (id, intent_id, alpha, target, value, scope, status, context, created_at, resolved_at)
      VALUES
        (?, 'schedule_timer', 'add', 'ScheduledTimer', NULL, 'account', 'confirmed', ?, ?, ?),
        (?, 'revoke_timer', 'replace', 'ScheduledTimer', NULL, 'account', 'confirmed', ?, ?, ?)
    `).run(
      `eff_${id}_a`, JSON.stringify({ id, firesAt: 200, fireIntent: "x", active: true, firedAt: null }), now, now,
      `eff_${id}_b`, JSON.stringify({ id, active: false, firedAt: now }), now + 1, now + 1,
    );
    const world = foldWorld();
    const t = (world.scheduledTimers || []).find(x => x.id === id);
    expect(t).toBeTruthy();
    expect(t.active).toBe(false);
    expect(t.firedAt).toBe(now);
  });
});
