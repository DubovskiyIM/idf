import { describe, it, expect, beforeAll, beforeEach } from "vitest";

const db = require("./db.js");
const { TimerQueue } = require("./timeEngine.js");
const { registerIntents } = require("./intents.js");
const { updateTypeMap } = require("./validator.js");
require("./systemIntents.cjs");

describe("scheduler integration via onConfirmed", () => {
  let queue;

  beforeAll(() => {
    // Регистрируем тип ScheduledTimer в typeMap (нужно для foldWorld)
    updateTypeMap({ entities: { ScheduledTimer: { fields: {} } } });
    // Регистрируем тестовые intent'ы в test-домене
    registerIntents({
      place_order: {
        particles: { effects: [{ α: "add", target: "Order" }], conditions: [] },
      },
      accept_order: {
        particles: { effects: [{ α: "replace", target: "Order" }], conditions: [] },
      },
      rule_cancel_stale_order: {
        particles: { effects: [{ α: "replace", target: "Order" }], conditions: [] },
      },
    }, "test_sched");
  });

  beforeEach(() => {
    db.prepare("DELETE FROM effects WHERE intent_id IN ('schedule_timer','revoke_timer','place_order','accept_order','rule_cancel_stale_order')").run();
    queue = new TimerQueue();
  });

  it("place_order effect → schedule_timer создан в Φ → queue получает таймер на следующий tick", async () => {
    const rules = [{
      id: "cancel_stale",
      trigger: "place_order",
      after: "5min",
      fireIntent: "rule_cancel_stale_order",
      params: { orderId: "$.orderId" },
      revokeOn: ["accept_order"],
    }];

    const { evaluateScheduleV2 } = require("./ruleEngine.js");
    const { ingestEffect } = require("./effect-pipeline.js");

    const stored = {
      intent_id: "place_order",
      context: JSON.stringify({ orderId: "o42" }),
    };

    evaluateScheduleV2(stored, {
      getRulesForDomain: () => rules,
      getDomainByIntentId: () => "test_sched",
      ingestEffect: (ef) => ingestEffect(ef, { broadcast: () => {}, delay: 0 }),
      foldWorld: () => ({ scheduledTimers: [] }),
    });

    // Ищем schedule_timer с нужным triggerEventKey (изолируемся от других тестов)
    const allSchedEffects = db.prepare("SELECT * FROM effects WHERE intent_id='schedule_timer'").all();
    const schedEffects = allSchedEffects.filter(e => {
      try { return JSON.parse(e.context).fireIntent === "rule_cancel_stale_order"; } catch { return false; }
    });
    expect(schedEffects.length).toBe(1);
    const ctx = JSON.parse(schedEffects[0].context);
    expect(ctx.fireIntent).toBe("rule_cancel_stale_order");
    expect(ctx.fireParams.orderId).toBe("o42");

    const { onEffectConfirmed } = require("./timeEngine.js");
    onEffectConfirmed(queue, schedEffects[0]);

    expect(queue.size()).toBe(1);
    expect(queue.all()[0].fireIntent).toBe("rule_cancel_stale_order");
  });

  it("accept_order → revoke_timer для соответствующего таймера", async () => {
    const rules = [{
      id: "cancel_stale",
      trigger: "place_order",
      after: "5min",
      fireIntent: "rule_cancel_stale_order",
      revokeOn: ["accept_order"],
    }];

    db.prepare(`
      INSERT INTO effects (id, intent_id, alpha, target, value, scope, status, context, created_at, resolved_at)
      VALUES ('eff_pre_t', 'schedule_timer', 'add', 'ScheduledTimer', NULL, 'account', 'confirmed', ?, ?, ?)
    `).run(JSON.stringify({
      id: "tmr_active", firesAt: Date.now() + 999_999,
      fireIntent: "rule_cancel_stale_order", active: true, firedAt: null,
      triggerEventKey: "cancel_stale:place_order",
    }), Date.now(), Date.now());

    const { evaluateScheduleV2 } = require("./ruleEngine.js");
    const { ingestEffect } = require("./effect-pipeline.js");

    evaluateScheduleV2(
      { intent_id: "accept_order", context: "{}" },
      {
        getRulesForDomain: () => rules,
        getDomainByIntentId: () => "test_sched",
        ingestEffect: (ef) => ingestEffect(ef, { broadcast: () => {}, delay: 0 }),
        foldWorld: () => require("./validator.js").foldWorld(),
      }
    );

    const revokes = db.prepare("SELECT * FROM effects WHERE intent_id='revoke_timer'").all();
    expect(revokes.length).toBeGreaterThanOrEqual(1);
    const ctx = JSON.parse(revokes[revokes.length - 1].context);
    expect(ctx.id).toBe("tmr_active");
  });
});
