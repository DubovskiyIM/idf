import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

function runCli(args) {
  return execSync(`node scripts/derivation-diff.mjs ${args}`, { encoding: "utf8" });
}

describe("derivation-diff CLI", () => {
  it("outputs stable JSON for sales/order_detail with subcollections", () => {
    const out = runCli("--domain sales --projection order_detail --json");
    const data = JSON.parse(out);
    expect(data.domain).toBe("sales");
    expect(data.projection).toBe("order_detail");
    expect(data.mode).toBe("all");
    expect(Array.isArray(data.patterns)).toBe(true);
    const sub = data.patterns.find(p => p.patternId === "subcollections");
    expect(sub).toBeDefined();
    expect(sub.changes.length).toBeGreaterThan(0);
    expect(sub.changes[0]).toHaveProperty("path");
    expect(sub.changes[0]).toHaveProperty("action");
  });

  it("supports --without to invert", () => {
    const out = runCli("--domain sales --projection order_detail --without subcollections --json");
    const data = JSON.parse(out);
    expect(data.mode).toBe("without");
    expect(data.excluded).toBe("subcollections");
    expect(data.patterns.find(p => p.patternId === "subcollections")).toBeUndefined();
  });

  it("supports --pattern to isolate one", () => {
    const out = runCli("--domain sales --projection order_detail --pattern subcollections --json");
    const data = JSON.parse(out);
    expect(data.mode).toBe("single");
    expect(data.only).toBe("subcollections");
    expect(data.patterns.length).toBe(1);
    expect(data.patterns[0].patternId).toBe("subcollections");
  });

  it("returns valid output for booking domain (catalog projection)", () => {
    const out = runCli("--domain booking --projection service_catalog --json");
    const data = JSON.parse(out);
    expect(Array.isArray(data.patterns)).toBe(true);
    // booking catalog может или не иметь matched apply patterns — проверяем что не падает
  });
});
