import { describe, it, expect, beforeAll } from "vitest";

const { getIntent, registerIntents } = require("./intents.js");

// Side-effect: registers _system intents
require("./systemIntents.cjs");

describe("systemIntents", () => {
  it("регистрирует schedule_timer в _system домене", () => {
    const intent = getIntent("schedule_timer");
    expect(intent).toBeTruthy();
    expect(intent.particles?.effects?.[0]?.α).toBe("add");
    expect(intent.particles?.effects?.[0]?.target).toBe("ScheduledTimer");
  });

  it("регистрирует revoke_timer в _system домене", () => {
    const intent = getIntent("revoke_timer");
    expect(intent).toBeTruthy();
    expect(intent.particles?.effects?.[0]?.α).toBe("replace");
    expect(intent.particles?.effects?.[0]?.target).toBe("ScheduledTimer");
  });

  it("schedule_timer требует параметры firesAt + fireIntent", () => {
    const intent = getIntent("schedule_timer");
    const params = intent.particles?.parameters || [];
    expect(params.find(p => p.name === "firesAt")).toBeTruthy();
    expect(params.find(p => p.name === "fireIntent")).toBeTruthy();
  });
});
