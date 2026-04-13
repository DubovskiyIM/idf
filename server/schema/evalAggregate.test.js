import { describe, it, expect } from "vitest";

const { evalIntentCondition } = require("../intents.js");

const world = {
  bids: [
    { id: "b1", listingId: "L1", amount: 100 },
    { id: "b2", listingId: "L1", amount: 200 },
    { id: "b3", listingId: "L2", amount: 50 },
  ],
  votes: [
    { id: "v1", pollId: "P1", participantId: "u1" },
    { id: "v2", pollId: "P1", participantId: "u2" },
    { id: "v3", pollId: "P1", participantId: "u1" }, // дубль — тот же участник
    { id: "v4", pollId: "P2", participantId: "u3" },
  ],
  participants: [
    { id: "pt1", pollId: "P1", userId: "u1" },
    { id: "pt2", pollId: "P1", userId: "u2" },
    { id: "pt3", pollId: "P1", userId: "u3" },
    { id: "pt4", pollId: "P2", userId: "u3" },
  ],
};

describe("evalIntentCondition — count()", () => {
  it("count = 0 когда нет элементов", () => {
    const entity = { id: "L99" };
    expect(evalIntentCondition("count(bids, listingId=target.id) = 0", entity, {}, world)).toBe(true);
  });

  it("count = 0 ложно когда есть элементы", () => {
    const entity = { id: "L1" };
    expect(evalIntentCondition("count(bids, listingId=target.id) = 0", entity, {}, world)).toBe(false);
  });

  it("count >= N", () => {
    const entity = { id: "L1" };
    expect(evalIntentCondition("count(bids, listingId=target.id) >= 2", entity, {}, world)).toBe(true);
    expect(evalIntentCondition("count(bids, listingId=target.id) >= 3", entity, {}, world)).toBe(false);
  });

  it("count < N", () => {
    const entity = { id: "L2" };
    expect(evalIntentCondition("count(bids, listingId=target.id) < 5", entity, {}, world)).toBe(true);
  });

  it("world не передан → true (graceful)", () => {
    const entity = { id: "L1" };
    expect(evalIntentCondition("count(bids, listingId=target.id) = 0", entity, {})).toBe(true);
    expect(evalIntentCondition("count(bids, listingId=target.id) = 0", entity, {}, null)).toBe(true);
  });

  it("entity без id → true (graceful), null entity → false (guard)", () => {
    expect(evalIntentCondition("count(bids, listingId=target.id) = 0", {}, {}, world)).toBe(true);
    // null entity → false (существующий guard `if (!entity) return false`)
    expect(evalIntentCondition("count(bids, listingId=target.id) = 0", null, {}, world)).toBe(false);
  });
});

describe("evalIntentCondition — ratio()", () => {
  it("ratio < 1.0 когда не все проголосовали", () => {
    // P1: 2 distinct voters (u1,u2) из 3 participants → 0.67
    const entity = { id: "P1" };
    expect(evalIntentCondition(
      "ratio(votes.participantId, participants, pollId=target.id) >= 1.0",
      entity, {}, world
    )).toBe(false);
  });

  it("ratio >= 0.5 когда половина проголосовала", () => {
    const entity = { id: "P1" };
    expect(evalIntentCondition(
      "ratio(votes.participantId, participants, pollId=target.id) >= 0.5",
      entity, {}, world
    )).toBe(true);
  });

  it("ratio = 1.0 когда единственный участник проголосовал", () => {
    // P2: 1 distinct voter (u3) из 1 participant → 1.0
    const entity = { id: "P2" };
    expect(evalIntentCondition(
      "ratio(votes.participantId, participants, pollId=target.id) >= 1.0",
      entity, {}, world
    )).toBe(true);
  });

  it("пустая коллекция → ratio = 0", () => {
    const entity = { id: "P99" };
    expect(evalIntentCondition(
      "ratio(votes.participantId, participants, pollId=target.id) >= 0.5",
      entity, {}, world
    )).toBe(false);
  });

  it("world не передан → true (graceful)", () => {
    const entity = { id: "P1" };
    expect(evalIntentCondition(
      "ratio(votes.participantId, participants, pollId=target.id) >= 1.0",
      entity, {}
    )).toBe(true);
  });
});
