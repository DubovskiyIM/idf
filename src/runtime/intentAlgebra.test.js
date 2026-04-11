import { describe, it, expect } from "vitest";
import { computeAlgebra, normalizeEntityFromTarget } from "./intentAlgebra.js";

describe("normalizeEntityFromTarget", () => {
  const ontology = {
    entities: {
      Specialist: { fields: ["id", "name"] },
      Service: { fields: ["id", "name", "price"] },
      TimeSlot: { fields: ["id", "date", "status"] },
      Booking: { fields: ["id", "status"] },
    }
  };

  it("простой target: 'bookings' → 'booking'", () => {
    expect(normalizeEntityFromTarget("bookings", ontology)).toBe("booking");
  });

  it("dotted target: 'booking.status' → 'booking'", () => {
    expect(normalizeEntityFromTarget("booking.status", ontology)).toBe("booking");
  });

  it("collection plural: 'specialists' → 'specialist'", () => {
    expect(normalizeEntityFromTarget("specialists", ontology)).toBe("specialist");
  });

  it("multi-segment entity: 'slot.status' → 'slot' (last segment of TimeSlot)", () => {
    expect(normalizeEntityFromTarget("slot.status", ontology)).toBe("slot");
  });

  it("drafts особый случай: 'drafts' → 'draft'", () => {
    expect(normalizeEntityFromTarget("drafts", ontology)).toBe("draft");
  });
});

describe("computeAlgebra skeleton", () => {
  const ontology = {
    entities: {
      Booking: { fields: ["id", "status"] }
    }
  };

  it("пустые INTENTS → пустой adjacency map", () => {
    expect(computeAlgebra({}, ontology)).toEqual({});
  });

  it("один intent → relations с пустыми массивами", () => {
    const intents = {
      create_booking: {
        name: "Создать",
        particles: { entities: [], conditions: [], effects: [], witnesses: [] }
      }
    };
    const result = computeAlgebra(intents, ontology);
    expect(result).toEqual({
      create_booking: {
        sequentialIn: [],
        sequentialOut: [],
        antagonists: [],
        excluding: [],
        parallel: []
      }
    });
  });

  it("несколько intent'ов → каждый получает пустой relations", () => {
    const intents = {
      a: { name: "A", particles: { effects: [], conditions: [] } },
      b: { name: "B", particles: { effects: [], conditions: [] } }
    };
    const result = computeAlgebra(intents, ontology);
    expect(Object.keys(result).sort()).toEqual(["a", "b"]);
    expect(result.a.sequentialOut).toEqual([]);
    expect(result.b.sequentialOut).toEqual([]);
  });
});
