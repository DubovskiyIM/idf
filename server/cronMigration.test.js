import { describe, it, expect } from "vitest";
const { cronToFirstFiresAt } = require("./ruleEngine.js");

describe("cron-to-timer migration", () => {
  it("daily:09:00 → ближайший 09:00 в будущем", () => {
    const now = new Date("2026-04-15T08:30:00Z").getTime();
    const fires = cronToFirstFiresAt({ period: "daily", hour: 9, minute: 0 }, now);
    expect(new Date(fires).toISOString()).toBe("2026-04-15T09:00:00.000Z");
  });
  it("daily:09:00 если уже прошло — следующий день", () => {
    const now = new Date("2026-04-15T10:00:00Z").getTime();
    const fires = cronToFirstFiresAt({ period: "daily", hour: 9, minute: 0 }, now);
    expect(new Date(fires).toISOString()).toBe("2026-04-16T09:00:00.000Z");
  });
  it("weekly:sun:18:00 — ближайшее воскресенье 18:00", () => {
    // 2026-04-15 — среда
    const now = new Date("2026-04-15T12:00:00Z").getTime();
    const fires = cronToFirstFiresAt({ period: "weekly", day: 0, hour: 18, minute: 0 }, now);
    const d = new Date(fires);
    expect(d.getUTCDay()).toBe(0);
    expect(d.getUTCHours()).toBe(18);
  });
});
