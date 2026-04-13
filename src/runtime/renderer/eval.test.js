import { describe, it, expect } from "vitest";
import { computeWitness } from "./eval.js";

const world = {
  bids: [
    { id: "b1", listingId: "L1", amount: 100 },
    { id: "b2", listingId: "L1", amount: 200 },
    { id: "b3", listingId: "L2", amount: 50 },
  ],
  votes: [
    { id: "v1", pollId: "P1", participantId: "u1" },
    { id: "v2", pollId: "P1", participantId: "u2" },
    { id: "v3", pollId: "P1", participantId: "u1" },
    { id: "v4", pollId: "P2", participantId: "u3" },
  ],
  participants: [
    { id: "pt1", pollId: "P1" },
    { id: "pt2", pollId: "P1" },
    { id: "pt3", pollId: "P1" },
    { id: "pt4", pollId: "P2" },
  ],
};

describe("computeWitness — count()", () => {
  it("count возвращает число", () => {
    expect(computeWitness("count(bids, listingId=target.id)", "L1", world)).toBe(2);
  });

  it("count для другого target", () => {
    expect(computeWitness("count(bids, listingId=target.id)", "L2", world)).toBe(1);
  });

  it("count для пустой коллекции → 0", () => {
    expect(computeWitness("count(bids, listingId=target.id)", "L99", world)).toBe(0);
  });

  it("count для отсутствующей коллекции → 0", () => {
    expect(computeWitness("count(orders, buyerId=target.id)", "X", world)).toBe(0);
  });
});

describe("computeWitness — ratio()", () => {
  it("ratio возвращает дробь", () => {
    const r = computeWitness("ratio(votes.participantId, participants, pollId=target.id)", "P1", world);
    expect(r).toBeCloseTo(0.667, 2);
  });

  it("ratio = 1.0 когда все проголосовали", () => {
    expect(computeWitness("ratio(votes.participantId, participants, pollId=target.id)", "P2", world)).toBe(1);
  });

  it("ratio с пустым total → null", () => {
    expect(computeWitness("ratio(votes.participantId, participants, pollId=target.id)", "P99", world)).toBeNull();
  });
});

describe("computeWitness — edge cases", () => {
  it("невалидное выражение → null", () => {
    expect(computeWitness("invalid expression", "L1", world)).toBeNull();
  });

  it("null world → null", () => {
    expect(computeWitness("count(bids, listingId=target.id)", "L1", null)).toBeNull();
  });
});
