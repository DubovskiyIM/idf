import { describe, it, expect, beforeEach } from "vitest";
const { TimerQueue, hydrateFromWorld } = require("./timeEngine.js");

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
