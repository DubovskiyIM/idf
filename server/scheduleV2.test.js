import { describe, it, expect } from "vitest";
import { parseDuration, resolveFiresAt } from "./scheduleV2.cjs";

describe("scheduleV2.parseDuration", () => {
  it("parses '5min' to 5*60*1000 ms", () => {
    expect(parseDuration("5min")).toBe(300_000);
  });
  it("parses '2h'", () => {
    expect(parseDuration("2h")).toBe(7_200_000);
  });
  it("parses '24h'", () => {
    expect(parseDuration("24h")).toBe(86_400_000);
  });
  it("parses '48h'", () => {
    expect(parseDuration("48h")).toBe(48 * 3600 * 1000);
  });
  it("parses '30s'", () => {
    expect(parseDuration("30s")).toBe(30_000);
  });
  it("returns null for invalid input", () => {
    expect(parseDuration("xyz")).toBeNull();
    expect(parseDuration("")).toBeNull();
    expect(parseDuration(null)).toBeNull();
  });
});

describe("scheduleV2.resolveFiresAt", () => {
  const baseTime = 1_700_000_000_000;

  it("resolves 'after:5min' relative to now", () => {
    const fired = resolveFiresAt({ after: "5min" }, {}, baseTime);
    expect(fired).toBe(baseTime + 300_000);
  });

  it("resolves 'at: $.readyAt' from payload", () => {
    const payload = { readyAt: 1_800_000_000_000 };
    const fired = resolveFiresAt({ at: "$.readyAt" }, payload, baseTime);
    expect(fired).toBe(1_800_000_000_000);
  });

  it("resolves 'at: $.readyAt + 10min'", () => {
    const payload = { readyAt: 1_800_000_000_000 };
    const fired = resolveFiresAt({ at: "$.readyAt + 10min" }, payload, baseTime);
    expect(fired).toBe(1_800_000_000_000 + 600_000);
  });

  it("returns null when path missing", () => {
    expect(resolveFiresAt({ at: "$.missing" }, {}, baseTime)).toBeNull();
  });

  it("at: dotted path '$.order.placedAt'", () => {
    const payload = { order: { placedAt: 1_700_000_000_000 } };
    const fired = resolveFiresAt({ at: "$.order.placedAt + 5min" }, payload, baseTime);
    expect(fired).toBe(1_700_000_000_000 + 300_000);
  });
});
