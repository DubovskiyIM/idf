import { describe, it, expect } from "vitest";
const { checkAnchoring } = require("./anchoringCheck.js");

const ONTOLOGY = {
  entities: {
    Booking: { fields: { id: { type: "id" }, status: { type: "enum" } } },
    Service: { fields: ["id", "name"] },
  },
};

describe("checkAnchoring", () => {
  it("returns no warnings when all particles resolve", () => {
    const intent = {
      particles: {
        entities: ["booking: Booking"],
        effects: [{ α: "replace", target: "booking.status", value: "cancelled" }],
        witnesses: ["booking.id"],
      },
    };
    const warnings = checkAnchoring("cancel_booking", intent, ONTOLOGY);
    expect(warnings).toHaveLength(0);
  });

  it("warns about effect target that doesn't match any entity.field", () => {
    const intent = {
      particles: {
        entities: ["booking: Booking"],
        effects: [{ α: "replace", target: "booking.nonexistent", value: "x" }],
      },
    };
    const warnings = checkAnchoring("bad_intent", intent, ONTOLOGY);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe("error");
    expect(warnings[0].kind).toBe("effect-unanchored");
  });

  it("warns about witness that doesn't resolve", () => {
    const intent = {
      particles: {
        entities: ["booking: Booking"],
        effects: [],
        witnesses: ["booking.ghost"],
      },
    };
    const warnings = checkAnchoring("w_intent", intent, ONTOLOGY);
    const witnessWarn = warnings.find((w) => w.kind === "witness-unanchored");
    expect(witnessWarn).toBeDefined();
    expect(witnessWarn.severity).toBe("warning");
  });

  it("allows collection effects (target = plural string)", () => {
    const intent = {
      particles: {
        entities: ["booking: Booking"],
        effects: [{ α: "add", target: "bookings" }],
      },
    };
    const warnings = checkAnchoring("x", intent, ONTOLOGY);
    expect(warnings).toHaveLength(0);
  });
});
