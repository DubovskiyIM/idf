import { describe, it, expect, beforeEach } from "vitest";

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

const { evaluateRules } = require("./ruleEngine.js");

describe("evaluateRules", () => {
  const planningOntology = {
    rules: [
      { id: "quorum_autoclose", trigger: "vote_*", action: "close_poll", context: { id: "effect.pollId" } }
    ]
  };

  const closePollIntent = {
    name: "Закрыть голосование",
    particles: {
      entities: ["poll: Poll"],
      conditions: ["poll.status = 'open'", "ratio(votes.participantId, participants, pollId=target.id) >= 1.0"],
      effects: [{ α: "replace", target: "poll.status", value: "closed" }],
      witnesses: [], confirmation: "click"
    }
  };

  const deps = {
    getDomainByIntentId: (id) => id.startsWith("vote_") ? "planning" : null,
    getOntology: (domain) => domain === "planning" ? planningOntology : null,
    validateIntentConditions: (effect, world) => {
      const poll = (world.polls || []).find(p => p.id === effect.context?.id);
      if (!poll || poll.status !== "open") return { valid: false, reason: "not open" };
      return { valid: true };
    },
    getIntent: (id) => id === "close_poll" ? closePollIntent : null,
  };

  it("fires при matched trigger и valid conditions", () => {
    const stored = { intent_id: "vote_yes", context: { pollId: "P1" } };
    const world = { polls: [{ id: "P1", status: "open" }] };
    const result = evaluateRules(stored, () => world, deps);

    expect(result).toHaveLength(1);
    expect(result[0].rule.id).toBe("quorum_autoclose");
    expect(result[0].effect.intent_id).toBe("close_poll");
    expect(result[0].effect.context).toEqual({ id: "P1" });
    expect(result[0].effect.alpha).toBe("replace");
  });

  it("не fires при trigger mismatch", () => {
    const stored = { intent_id: "place_bid", context: { pollId: "P1" } };
    const world = { polls: [{ id: "P1", status: "open" }] };
    const result = evaluateRules(stored, () => world, deps);

    expect(result).toHaveLength(0);
  });

  it("не fires при invalid conditions", () => {
    const stored = { intent_id: "vote_yes", context: { pollId: "P1" } };
    const world = { polls: [{ id: "P1", status: "closed" }] };
    const result = evaluateRules(stored, () => world, deps);

    expect(result).toHaveLength(0);
  });

  it("не fires когда нет rules в онтологии", () => {
    const depsNoRules = {
      ...deps,
      getOntology: () => ({ entities: {} }),
    };
    const stored = { intent_id: "vote_yes", context: { pollId: "P1" } };
    const result = evaluateRules(stored, () => ({}), depsNoRules);

    expect(result).toHaveLength(0);
  });

  it("возвращает пустой массив для неизвестного домена", () => {
    const depsNoDomain = { ...deps, getDomainByIntentId: () => null };
    const stored = { intent_id: "vote_yes", context: { pollId: "P1" } };
    const result = evaluateRules(stored, () => ({}), depsNoDomain);

    expect(result).toHaveLength(0);
  });

  it("world-thunk не вызывается при trigger mismatch", () => {
    let thunkCalled = false;
    const worldThunk = () => { thunkCalled = true; return {}; };

    const depsNoMatch = { ...deps, getDomainByIntentId: () => null };
    evaluateRules({ intent_id: "unknown", context: {} }, worldThunk, depsNoMatch);

    expect(thunkCalled).toBe(false);
  });

  it("world-thunk вызывается при matched trigger", () => {
    let thunkCalled = false;
    const worldThunk = () => { thunkCalled = true; return { polls: [{ id: "P1", status: "open" }] }; };

    evaluateRules({ intent_id: "vote_yes", context: { pollId: "P1" } }, worldThunk, deps);

    expect(thunkCalled).toBe(true);
  });
});

const { registerIntents, getIntent: realGetIntent, validateIntentConditions: realValidate, getDomainByIntentId: realGetDomain, _registry } = require("./intents.js");

describe("evaluateRules — real domain intents", () => {
  beforeEach(() => {
    for (const key of Object.keys(_registry)) delete _registry[key];
    registerIntents({
      vote_yes: {
        name: "За", particles: {
          entities: ["option: TimeOption", "participant: Participant"],
          conditions: ["poll.status = 'open'"],
          effects: [{ α: "add", target: "votes" }],
          witnesses: [], confirmation: "click"
        }, creates: "Vote(yes)"
      },
      close_poll: {
        name: "Закрыть голосование", particles: {
          entities: ["poll: Poll"],
          conditions: ["poll.status = 'open'", "ratio(votes.participantId, participants, pollId=target.id) >= 1.0"],
          effects: [{ α: "replace", target: "poll.status", value: "closed" }],
          witnesses: [], confirmation: "click"
        }
      },
    }, "planning");
    registerIntents({
      confirm_delivery: {
        name: "Подтвердить получение", particles: {
          entities: ["order: Order"],
          conditions: ["order.status = 'shipped'"],
          effects: [{ α: "replace", target: "order.status", value: "delivered" }, { α: "replace", target: "order.deliveredAt" }],
          witnesses: [], confirmation: "click"
        }
      },
      complete_order: {
        name: "Завершить сделку", particles: {
          entities: ["order: Order"],
          conditions: ["order.status = 'delivered'"],
          effects: [{ α: "replace", target: "order.status", value: "completed" }],
          witnesses: [], confirmation: "click"
        }
      },
    }, "meshok");
  });

  const planningOntology = {
    rules: [{ id: "quorum_autoclose", trigger: "vote_*", action: "close_poll", context: { id: "effect.pollId" } }]
  };
  const meshokOntology = {
    rules: [{ id: "delivery_autocomplete", trigger: "confirm_delivery", action: "complete_order", context: { id: "effect.id" } }]
  };

  const realDeps = {
    getDomainByIntentId: realGetDomain,
    getOntology: (d) => d === "planning" ? planningOntology : d === "meshok" ? meshokOntology : null,
    validateIntentConditions: realValidate,
    getIntent: realGetIntent,
  };

  it("planning: vote + кворум достигнут → close_poll", () => {
    const stored = { intent_id: "vote_yes", context: { pollId: "P1" } };
    const world = {
      polls: [{ id: "P1", status: "open" }],
      participants: [{ id: "pt1", pollId: "P1" }, { id: "pt2", pollId: "P1" }],
      votes: [
        { id: "v1", pollId: "P1", participantId: "pt1" },
        { id: "v2", pollId: "P1", participantId: "pt2" },
      ],
    };
    const result = evaluateRules(stored, () => world, realDeps);

    expect(result).toHaveLength(1);
    expect(result[0].rule.id).toBe("quorum_autoclose");
    expect(result[0].effect.intent_id).toBe("close_poll");
    expect(result[0].effect.alpha).toBe("replace");
    expect(result[0].effect.value).toBe("closed");
  });

  it("planning: vote + кворум не достигнут → пусто", () => {
    const stored = { intent_id: "vote_yes", context: { pollId: "P1" } };
    const world = {
      polls: [{ id: "P1", status: "open" }],
      participants: [{ id: "pt1", pollId: "P1" }, { id: "pt2", pollId: "P1" }, { id: "pt3", pollId: "P1" }],
      votes: [{ id: "v1", pollId: "P1", participantId: "pt1" }],
    };
    const result = evaluateRules(stored, () => world, realDeps);

    expect(result).toHaveLength(0);
  });

  it("meshok: confirm_delivery + delivered → complete_order", () => {
    const stored = { intent_id: "confirm_delivery", context: { id: "O1" } };
    const world = {
      orders: [{ id: "O1", status: "delivered" }],
    };
    const result = evaluateRules(stored, () => world, realDeps);

    expect(result).toHaveLength(1);
    expect(result[0].rule.id).toBe("delivery_autocomplete");
    expect(result[0].effect.intent_id).toBe("complete_order");
    expect(result[0].effect.alpha).toBe("replace");
    expect(result[0].effect.value).toBe("completed");
  });
});
