import { describe, it, expect, beforeEach } from "vitest";
const { TimerQueue } = require("./timeEngine.js");

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
