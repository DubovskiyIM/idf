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

  it("produces effect-particle edges from intent.particles.effects", async () => {
    const graph = await buildGraph("booking");
    const effectEdges = graph.edges.filter((e) => e.kind === "effect-particle");
    expect(effectEdges.length).toBeGreaterThan(0);
    const confirmEdges = effectEdges.filter((e) => e.source === "intent:confirm_booking");
    expect(confirmEdges.length).toBeGreaterThanOrEqual(2);
  });

  it("produces witness-particle edges from intent.particles.witnesses", async () => {
    const graph = await buildGraph("booking");
    const witnessEdges = graph.edges.filter((e) => e.kind === "witness-particle");
    expect(witnessEdges.length).toBeGreaterThan(0);
    const confirmWitnesses = witnessEdges.filter((e) => e.source === "intent:confirm_booking");
    expect(confirmWitnesses.length).toBeGreaterThanOrEqual(1);
  });

  it("produces ownership edges from entity.ownerField (invest has User+Portfolio)", async () => {
    const graph = await buildGraph("invest");
    const ownership = graph.edges.filter((e) => e.kind === "ownership");
    const portfolio = ownership.find((e) => e.source === "entity:Portfolio" && e.target === "entity:User");
    expect(portfolio).toBeDefined();
  });

  it("produces reference edges from entityRef fields", async () => {
    const graph = await buildGraph("booking");
    const refs = graph.edges.filter((e) => e.kind === "reference");
    expect(refs.length).toBeGreaterThan(0);
    const serviceRefs = refs.filter((e) => e.source === "entity:Booking" && e.target === "entity:Service");
    expect(serviceRefs.length).toBeGreaterThanOrEqual(1);
  });

  it("produces role nodes if ONTOLOGY.roles present", async () => {
    const graph = await buildGraph("booking");
    const roles = graph.nodes.filter((n) => n.kind === "role");
    if (roles.length > 0) {
      expect(roles[0].id.startsWith("role:")).toBe(true);
    }
  });

  it("produces projection nodes from PROJECTIONS", async () => {
    const graph = await buildGraph("booking");
    const projs = graph.nodes.filter((n) => n.kind === "projection");
    expect(projs.length).toBeGreaterThan(0);
  });

  it("produces role-capability edges array (possibly empty)", async () => {
    const graph = await buildGraph("booking");
    const caps = graph.edges.filter((e) => e.kind === "role-capability");
    expect(Array.isArray(caps)).toBe(true);
  });
});
