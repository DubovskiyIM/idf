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

const { buildActionEffect } = require("./ruleEngine.js");

describe("buildActionEffect", () => {
  it("строит эффект из single-effect intent", () => {
    const intent = {
      particles: {
        effects: [{ α: "replace", target: "poll.status", value: "closed" }]
      }
    };
    const context = { id: "P1" };
    const effect = buildActionEffect("close_poll", intent, context);

    expect(effect.intent_id).toBe("close_poll");
    expect(effect.alpha).toBe("replace");
    expect(effect.target).toBe("poll.status");
    expect(effect.value).toBe("closed");
    expect(effect.context).toEqual({ id: "P1" });
    expect(effect.scope).toBe("account");
    expect(effect.id).toBeTruthy();
    expect(effect.created_at).toBeTruthy();
  });

  it("оборачивает multi-effect intent в batch", () => {
    const intent = {
      particles: {
        effects: [
          { α: "replace", target: "order.status", value: "completed" },
          { α: "replace", target: "order.completedAt" },
        ]
      }
    };
    const context = { id: "O1" };
    const effect = buildActionEffect("complete_order", intent, context);

    expect(effect.alpha).toBe("batch");
    expect(effect.target).toBe("order");
    expect(effect.intent_id).toBe("complete_order");
    expect(effect.value).toHaveLength(2);
    expect(effect.value[0]).toEqual({
      alpha: "replace", target: "order.status", value: "completed",
      context: { id: "O1" }, scope: "account"
    });
    expect(effect.value[1]).toEqual({
      alpha: "replace", target: "order.completedAt", value: undefined,
      context: { id: "O1" }, scope: "account"
    });
  });
});
