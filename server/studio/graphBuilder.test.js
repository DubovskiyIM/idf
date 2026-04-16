import { describe, it, expect } from "vitest";
const { buildGraph } = require("./graphBuilder.js");

describe("buildGraph(domain)", () => {
  it("produces entity nodes from ONTOLOGY.entities", async () => {
    const graph = await buildGraph("booking");
    const entityNodes = graph.nodes.filter((n) => n.kind === "entity");
    const ids = entityNodes.map((n) => n.id);
    expect(ids).toContain("entity:Booking");
    expect(ids).toContain("entity:Service");
    expect(ids).toContain("entity:TimeSlot");
    const booking = entityNodes.find((n) => n.id === "entity:Booking");
    expect(booking.name).toBe("Booking");
    expect(booking.fields.length).toBeGreaterThan(5);
  });

  it("produces intent nodes from INTENTS", async () => {
    const graph = await buildGraph("booking");
    const intentNodes = graph.nodes.filter((n) => n.kind === "intent");
    const ids = intentNodes.map((n) => n.id);
    expect(ids).toContain("intent:confirm_booking");
    expect(ids).toContain("intent:cancel_booking");
    const confirm = intentNodes.find((n) => n.id === "intent:confirm_booking");
    expect(confirm.particles.effects.length).toBeGreaterThan(0);
  });
});
