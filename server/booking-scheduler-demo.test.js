import { describe, it, expect } from "vitest";

describe("booking demo schedule v2 rule", () => {
  it("ONTOLOGY.rules содержит auto_cancel_pending_booking", async () => {
    // booking — ESM; используем dynamic import
    const bookingModule = await import("../src/domains/booking/ontology.js");
    const ONTOLOGY = bookingModule.ONTOLOGY || bookingModule.default;
    expect(ONTOLOGY).toBeTruthy();
    expect(ONTOLOGY.rules).toBeTruthy();
    const rule = ONTOLOGY.rules.find(r => r.id === "auto_cancel_pending_booking");
    expect(rule).toBeTruthy();
    expect(rule.after).toBe("5min");
    expect(rule.trigger).toBe("create_booking");
    expect(rule.fireIntent).toBeTruthy();
    expect(rule.revokeOn).toBeInstanceOf(Array);
    expect(rule.revokeOn.length).toBeGreaterThan(0);
  });
});
