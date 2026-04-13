import { describe, it, expect } from "vitest";

const { matchTrigger, resolveContext } = require("./ruleEngine.js");

describe("matchTrigger", () => {
  it("exact match", () => {
    expect(matchTrigger("confirm_delivery", "confirm_delivery")).toBe(true);
  });

  it("exact mismatch", () => {
    expect(matchTrigger("confirm_delivery", "place_bid")).toBe(false);
  });

  it("glob prefix match", () => {
    expect(matchTrigger("vote_*", "vote_yes")).toBe(true);
    expect(matchTrigger("vote_*", "vote_no")).toBe(true);
    expect(matchTrigger("vote_*", "vote_maybe")).toBe(true);
  });

  it("glob prefix mismatch", () => {
    expect(matchTrigger("vote_*", "place_bid")).toBe(false);
  });

  it("wildcard * matches everything", () => {
    expect(matchTrigger("*", "anything")).toBe(true);
  });
});

describe("resolveContext", () => {
  const storedContext = { pollId: "P1", participantId: "pt1", id: "E1" };

  it("резолвит effect.<field>", () => {
    const mapping = { id: "effect.pollId" };
    expect(resolveContext(mapping, storedContext)).toEqual({ id: "P1" });
  });

  it("резолвит effect.id", () => {
    const mapping = { id: "effect.id" };
    expect(resolveContext(mapping, storedContext)).toEqual({ id: "E1" });
  });

  it("несколько полей", () => {
    const mapping = { id: "effect.pollId", participantId: "effect.participantId" };
    expect(resolveContext(mapping, storedContext)).toEqual({ id: "P1", participantId: "pt1" });
  });

  it("литерал без prefix effect. подставляется as-is", () => {
    const mapping = { status: "active", id: "effect.id" };
    expect(resolveContext(mapping, storedContext)).toEqual({ status: "active", id: "E1" });
  });

  it("отсутствующее поле → undefined", () => {
    const mapping = { id: "effect.missingField" };
    expect(resolveContext(mapping, storedContext)).toEqual({ id: undefined });
  });
});
