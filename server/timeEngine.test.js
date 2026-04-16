import { describe, it, expect, beforeEach } from "vitest";
const { TimerQueue, hydrateFromWorld, fireDue } = require("./timeEngine.js");

describe("TimerQueue", () => {
  let q;
  beforeEach(() => { q = new TimerQueue(); });

  it("starts empty", () => {
    expect(q.size()).toBe(0);
    expect(q.popDue(Date.now())).toEqual([]);
  });

  it("insert + popDue returns due timers in firesAt order", () => {
    q.insert({ id: "t1", firesAt: 100 });
    q.insert({ id: "t2", firesAt: 50 });
    q.insert({ id: "t3", firesAt: 200 });
    const due = q.popDue(150);
    expect(due.map(t => t.id)).toEqual(["t2", "t1"]);
    expect(q.size()).toBe(1);
  });

  it("popDue with now < earliest returns []", () => {
    q.insert({ id: "t1", firesAt: 100 });
    expect(q.popDue(50)).toEqual([]);
    expect(q.size()).toBe(1);
  });

  it("removeById removes and preserves ordering", () => {
    q.insert({ id: "a", firesAt: 100 });
    q.insert({ id: "b", firesAt: 200 });
    q.insert({ id: "c", firesAt: 300 });
    expect(q.removeById("b")).toBe(true);
    expect(q.size()).toBe(2);
    const due = q.popDue(400);
    expect(due.map(t => t.id)).toEqual(["a", "c"]);
  });

  it("removeById nonexistent returns false", () => {
    q.insert({ id: "a", firesAt: 100 });
    expect(q.removeById("missing")).toBe(false);
    expect(q.size()).toBe(1);
  });

  it("insert duplicate id replaces existing", () => {
    q.insert({ id: "a", firesAt: 100 });
    q.insert({ id: "a", firesAt: 200 });
    expect(q.size()).toBe(1);
    const due = q.popDue(150);
    expect(due).toEqual([]);
    const due2 = q.popDue(250);
    expect(due2.map(t => t.id)).toEqual(["a"]);
  });
});

describe("hydrateFromWorld", () => {
  it("loads active && !firedAt timers from world", () => {
    const q = new TimerQueue();
    const world = {
      scheduledTimers: [
        { id: "t1", firesAt: 1000, active: true, firedAt: null, fireIntent: "x" },
        { id: "t2", firesAt: 2000, active: true, firedAt: 500, fireIntent: "y" },  // already fired
        { id: "t3", firesAt: 3000, active: false, firedAt: null, fireIntent: "z" }, // revoked
        { id: "t4", firesAt: 4000, active: true, firedAt: null, fireIntent: "w" },
      ],
    };
    hydrateFromWorld(q, world);
    expect(q.size()).toBe(2);
    expect(q.all().map(t => t.id).sort()).toEqual(["t1", "t4"]);
  });

  it("handles missing scheduledTimers collection", () => {
    const q = new TimerQueue();
    hydrateFromWorld(q, {});
    expect(q.size()).toBe(0);
  });
});

describe("onEffectConfirmed", () => {
  const { onEffectConfirmed } = require("./timeEngine.js");
  let q;
  beforeEach(() => { q = new TimerQueue(); });

  it("schedule_timer adds to queue with parsed payload", () => {
    onEffectConfirmed(q, {
      intent_id: "schedule_timer",
      target: "ScheduledTimer",
      alpha: "add",
      value: JSON.stringify({
        id: "tmr_1",
        firesAt: 1700,
        fireIntent: "rule_cancel",
        fireParams: { orderId: "o1" },
      }),
      context: JSON.stringify({}),
    });
    expect(q.size()).toBe(1);
    const t = q.all()[0];
    expect(t.id).toBe("tmr_1");
    expect(t.firesAt).toBe(1700);
    expect(t.fireIntent).toBe("rule_cancel");
    expect(t.fireParams).toEqual({ orderId: "o1" });
  });

  it("schedule_timer can also read from context (context.id, context.firesAt)", () => {
    onEffectConfirmed(q, {
      intent_id: "schedule_timer",
      target: "ScheduledTimer",
      alpha: "add",
      value: null,
      context: JSON.stringify({
        id: "tmr_ctx",
        firesAt: 9999,
        fireIntent: "x",
      }),
    });
    expect(q.size()).toBe(1);
    expect(q.all()[0].id).toBe("tmr_ctx");
  });

  it("revoke_timer removes by id from value or context", () => {
    q.insert({ id: "tmr_1", firesAt: 100 });
    q.insert({ id: "tmr_2", firesAt: 200 });
    onEffectConfirmed(q, {
      intent_id: "revoke_timer",
      target: "ScheduledTimer",
      alpha: "replace",
      value: null,
      context: JSON.stringify({ id: "tmr_1" }),
    });
    expect(q.size()).toBe(1);
    expect(q.all()[0].id).toBe("tmr_2");
  });

  it("ignores effects with unrelated intent_id", () => {
    onEffectConfirmed(q, { intent_id: "place_order", value: null, context: "{}" });
    expect(q.size()).toBe(0);
  });
});

describe("fireDue", () => {
  let q;
  let emitted;

  beforeEach(() => {
    q = new TimerQueue();
    emitted = [];
  });

  const deps = (worldOverride = {}) => ({
    ingestEffect: (ef) => emitted.push(ef),
    foldWorld: () => ({ orders: [], ...worldOverride }),
  });

  it("fires due timer: emits fireIntent + mark firedAt", () => {
    q.insert({
      id: "tmr_1",
      firesAt: 100,
      fireIntent: "rule_cancel",
      fireParams: { orderId: "o1" },
      guard: null,
    });
    fireDue(q, 200, deps());
    // 2 effects: fire + mark
    expect(emitted.length).toBe(2);
    expect(emitted[0].intent_id).toBe("rule_cancel");
    expect(emitted[0].context.orderId).toBe("o1");
    expect(emitted[0].parent_id).toBe("tmr_1");
    expect(emitted[1].intent_id).toBe("revoke_timer");
    expect(emitted[1].context.id).toBe("tmr_1");
    expect(q.size()).toBe(0);
  });

  it("__witness в fire + revoke effect context (§15 v1.9)", () => {
    q.insert({
      id: "tmr_w",
      firesAt: 100,
      fireIntent: "rule_cancel",
      fireParams: { orderId: "o1" },
      guard: null,
    });
    fireDue(q, 200, deps());
    const fireEffect = emitted[0];
    const revokeEffect = emitted[1];
    expect(fireEffect.context.__witness).toBeDefined();
    expect(fireEffect.context.__witness.basis).toContain("tmr_w");
    expect(revokeEffect.context.__witness).toBeDefined();
    expect(revokeEffect.context.__witness.basis).toContain("tmr_w");
    expect(revokeEffect.context.__witness.firedAt).toBeDefined();
  });

  it("does not fire if not yet due", () => {
    q.insert({ id: "t", firesAt: 1000, fireIntent: "x", guard: null });
    fireDue(q, 500, deps());
    expect(emitted).toEqual([]);
    expect(q.size()).toBe(1);
  });

  it("guard true allows fire", () => {
    q.insert({
      id: "t", firesAt: 100, fireIntent: "x", guard: "world.orders.length > 0",
    });
    fireDue(q, 200, deps({ orders: [{ id: "o1" }] }));
    expect(emitted.length).toBe(2); // fire + mark
    expect(emitted[0].intent_id).toBe("x");
  });

  it("guard false skips fire but marks revoked", () => {
    q.insert({
      id: "t", firesAt: 100, fireIntent: "x", guard: "world.orders.length > 0",
    });
    fireDue(q, 200, deps({ orders: [] }));
    // only revoke_timer emitted (no fire)
    expect(emitted.length).toBe(1);
    expect(emitted[0].intent_id).toBe("revoke_timer");
    expect(q.size()).toBe(0);
  });

  it("multiple due timers fire in firesAt order", () => {
    q.insert({ id: "a", firesAt: 100, fireIntent: "first", guard: null });
    q.insert({ id: "b", firesAt: 50, fireIntent: "earliest", guard: null });
    fireDue(q, 200, deps());
    const fireIntents = emitted.filter(e => e.intent_id !== "revoke_timer");
    expect(fireIntents.map(e => e.intent_id)).toEqual(["earliest", "first"]);
  });
});

describe("fireDue — cron self-rescheduling", () => {
  let q;
  let emitted;

  beforeEach(() => {
    q = new TimerQueue();
    emitted = [];
  });

  const deps = () => ({
    ingestEffect: (ef) => emitted.push(ef),
    foldWorld: () => ({}),
  });

  it("таймер с cronSchedule hint → после fire эмитит следующий schedule_timer", () => {
    const now = new Date("2026-04-15T09:00:00Z").getTime();
    q.insert({
      id: "cron_tmr",
      firesAt: now,
      fireIntent: "daily_report",
      fireParams: {},
      cronSchedule: "daily:09:00",
      triggerEventKey: "cron:test_domain:daily_report",
      guard: null,
    });
    fireDue(q, now, deps());

    // Ожидаем 3 effect: fireIntent + revoke_timer (witness) + новый schedule_timer на завтра
    const fireIntents = emitted.filter(e => e.intent_id === "daily_report");
    const revokes = emitted.filter(e => e.intent_id === "revoke_timer");
    const schedules = emitted.filter(e => e.intent_id === "schedule_timer");

    expect(fireIntents.length).toBe(1);
    expect(revokes.length).toBe(1);
    expect(schedules.length).toBe(1);

    const nextCtx = schedules[0].context;
    expect(nextCtx.cronSchedule).toBe("daily:09:00");
    expect(nextCtx.fireIntent).toBe("daily_report");
    // Следующий запуск — завтра 09:00 UTC
    const nextDate = new Date(nextCtx.firesAt);
    expect(nextDate.getUTCHours()).toBe(9);
    expect(nextDate.getUTCDate()).toBe(16); // next day (2026-04-16)
  });

  it("таймер без cronSchedule — обычное firing без re-emit", () => {
    q.insert({
      id: "one_shot",
      firesAt: 100,
      fireIntent: "rule_cancel",
      fireParams: {},
      guard: null,
    });
    fireDue(q, 200, deps());

    const schedules = emitted.filter(e => e.intent_id === "schedule_timer");
    expect(schedules.length).toBe(0); // ничего не re-emit'ится
  });
});
