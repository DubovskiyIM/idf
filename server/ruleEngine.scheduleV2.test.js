import { describe, it, expect, beforeEach } from "vitest";
const { evaluateScheduleV2 } = require("./ruleEngine.js");

describe("evaluateScheduleV2", () => {
  let emitted;
  const ingest = (ef) => emitted.push(ef);

  beforeEach(() => { emitted = []; });

  const baseDeps = (rules, opts = {}) => ({
    getRulesForDomain: () => rules,
    getDomainByIntentId: () => "test",
    ingestEffect: ingest,
    foldWorld: () => ({ scheduledTimers: opts.timers || [] }),
    now: () => 1_000_000,
  });

  it("emits schedule_timer when rule.after matches trigger", () => {
    evaluateScheduleV2(
      { intent_id: "place_order", context: JSON.stringify({ orderId: "o1" }) },
      baseDeps([{
        id: "cancel_stale",
        trigger: "place_order",
        after: "5min",
        fireIntent: "rule_cancel_stale_order",
        params: { orderId: "$.orderId" },
        revokeOn: ["accept_order", "cancel_order"],
      }])
    );
    expect(emitted.length).toBe(1);
    const ef = emitted[0];
    expect(ef.intent_id).toBe("schedule_timer");
    const ctx = ef.context;
    expect(ctx.firesAt).toBe(1_000_000 + 300_000);
    expect(ctx.fireIntent).toBe("rule_cancel_stale_order");
    expect(ctx.fireParams.orderId).toBe("o1");
    expect(ctx.revokeOnEvents).toEqual(["accept_order", "cancel_order"]);
    expect(ctx.triggerEventKey).toBe("cancel_stale:place_order");
  });

  it("emits revoke_timer when effect matches rule.revokeOn", () => {
    evaluateScheduleV2(
      { intent_id: "accept_order", context: "{}" },
      baseDeps(
        [{ id: "cancel_stale", trigger: "place_order", after: "5min",
           fireIntent: "rule_cancel_stale_order",
           revokeOn: ["accept_order"] }],
        { timers: [
          { id: "tmr_x", active: true, firedAt: null,
            triggerEventKey: "cancel_stale:place_order" },
          { id: "tmr_y", active: true, firedAt: null,
            triggerEventKey: "other_rule:other" },
        ] }
      )
    );
    expect(emitted.length).toBe(1);
    expect(emitted[0].intent_id).toBe("revoke_timer");
    expect(emitted[0].context.id).toBe("tmr_x");
  });

  it("no emit when rule has neither after nor at", () => {
    evaluateScheduleV2(
      { intent_id: "place_order", context: "{}" },
      baseDeps([{ id: "r", trigger: "place_order", fireIntent: "x" }])
    );
    expect(emitted).toEqual([]);
  });

  it("supports rule.at with payload reference", () => {
    evaluateScheduleV2(
      { intent_id: "mark_ready",
        context: JSON.stringify({ readyAt: 5_000_000, orderId: "o2" }) },
      baseDeps([{
        id: "escalate",
        trigger: "mark_ready",
        at: "$.readyAt + 15min",
        fireIntent: "rule_escalate",
        params: { orderId: "$.orderId" },
      }])
    );
    expect(emitted.length).toBe(1);
    expect(emitted[0].context.firesAt).toBe(5_000_000 + 900_000);
    expect(emitted[0].context.fireParams.orderId).toBe("o2");
  });
});
