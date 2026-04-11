import { describe, it, expect } from "vitest";
import { inferParameters } from "./inferParameters.cjs";

const ontology = {
  entities: {
    Specialist: { fields: ["id", "name", "specialization"] },
    Service:    { fields: ["id", "specialistId", "name", "duration", "price", "active"] },
    TimeSlot:   { fields: ["id", "specialistId", "date", "startTime", "endTime", "status"] },
    Booking:    { fields: ["id", "clientId", "specialistId", "serviceId", "slotId", "status", "price", "createdAt"] },
    Review: {
      fields: ["id", "bookingId", "specialistId", "authorId", "serviceName", "rating", "text", "response", "createdAt"]
    }
  }
};

describe("inferParameters", () => {
  it("выводит параметры из creates:X c foreign keys как entityRef", () => {
    const intent = {
      name: "Создать бронирование",
      creates: "Booking",
      particles: {
        entities: [],
        witnesses: [],
        effects: [{ α: "add", target: "bookings" }]
      }
    };
    const params = inferParameters(intent, ontology);
    const names = params.map(p => p.name);
    expect(names).toContain("specialistId");
    expect(names).toContain("serviceId");
    expect(names).toContain("slotId");
    expect(names).toContain("price");
    // id/clientId/status/createdAt — системные, должны быть исключены
    expect(names).not.toContain("id");
    expect(names).not.toContain("clientId");
    expect(names).not.toContain("status");
    expect(names).not.toContain("createdAt");
  });

  it("помечает foreign keys как type: entityRef", () => {
    const intent = {
      creates: "Booking",
      particles: { witnesses: [], effects: [] }
    };
    const params = inferParameters(intent, ontology);
    const slotId = params.find(p => p.name === "slotId");
    expect(slotId.type).toBe("entityRef");
    expect(slotId.entity).toBe("TimeSlot");
  });

  it("помечает price как type: number", () => {
    const intent = {
      creates: "Booking",
      particles: { witnesses: [], effects: [] }
    };
    const params = inferParameters(intent, ontology);
    const price = params.find(p => p.name === "price");
    expect(price.type).toBe("number");
  });

  it("создаёт params с required: true для creator-интента", () => {
    const intent = { creates: "Booking", particles: { witnesses: [], effects: [] } };
    const params = inferParameters(intent, ontology);
    expect(params.every(p => p.required === true)).toBe(true);
  });

  it("пустой массив для intent без creates и без witnesses", () => {
    const intent = { creates: null, particles: { witnesses: [], effects: [] } };
    const params = inferParameters(intent, ontology);
    expect(params).toEqual([]);
  });

  it("выводит параметры из witnesses (без точки) для не-creator intent'а", () => {
    const intent = {
      creates: null,
      particles: {
        witnesses: ["rating", "text"],
        effects: [{ α: "replace", target: "review.rating" }]
      }
    };
    const params = inferParameters(intent, ontology);
    const names = params.map(p => p.name);
    expect(names).toContain("rating");
    expect(names).toContain("text");
  });

  it("игнорирует dot-witnesses (они — preview)", () => {
    const intent = {
      creates: null,
      particles: { witnesses: ["review.rating", "review.text"], effects: [] }
    };
    const params = inferParameters(intent, ontology);
    expect(params).toEqual([]);
  });

  it("нормализует creates с parenthesized суффиксом", () => {
    const intent = {
      creates: "Booking(draft)",
      particles: { witnesses: [], effects: [] }
    };
    const params = inferParameters(intent, ontology);
    expect(params.some(p => p.name === "slotId")).toBe(true);
  });
});
