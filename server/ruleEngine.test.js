import { describe, it, expect, beforeEach } from "vitest";
const Database = require("better-sqlite3");

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

// ─── Extensions v1.5: aggregation, threshold, condition, schedule ───

const {
  shouldFireAggregation, shouldFireThreshold, evaluateCondition,
  evaluateRuleCondition, parseSchedule, shouldFireSchedule,
} = require("./ruleEngine.js");

describe("aggregation rules", () => {
  let db;
  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`CREATE TABLE rule_state (
      rule_id TEXT, user_id TEXT, counter INTEGER DEFAULT 0,
      last_fired_at INTEGER, PRIMARY KEY (rule_id, user_id))`);
  });

  it("fires every Nth time", () => {
    const rule = { id: "r1", aggregation: { everyN: 3 } };
    expect(shouldFireAggregation(rule, "u1", db)).toBe(false); // 1
    expect(shouldFireAggregation(rule, "u1", db)).toBe(false); // 2
    expect(shouldFireAggregation(rule, "u1", db)).toBe(true);  // 3 ← fire
    expect(shouldFireAggregation(rule, "u1", db)).toBe(false); // 4
    expect(shouldFireAggregation(rule, "u1", db)).toBe(false); // 5
    expect(shouldFireAggregation(rule, "u1", db)).toBe(true);  // 6 ← fire
  });

  it("counter изолирован per user", () => {
    const rule = { id: "r1", aggregation: { everyN: 2 } };
    shouldFireAggregation(rule, "u1", db); // u1: 1
    expect(shouldFireAggregation(rule, "u2", db)).toBe(false); // u2: 1
    expect(shouldFireAggregation(rule, "u1", db)).toBe(true);  // u1: 2 ← fire
  });

  it("без aggregation возвращает true", () => {
    expect(shouldFireAggregation({ id: "r1" }, "u1", db)).toBe(true);
  });

  it("без db возвращает true (graceful)", () => {
    expect(shouldFireAggregation({ id: "r1", aggregation: { everyN: 5 } }, "u1", null)).toBe(true);
  });
});

describe("threshold rules", () => {
  it("all_equal: fires когда все lookback entries равны target", () => {
    const world = {
      moodEntries: [
        { userId: "u1", quadrant: "LEU", loggedAt: 5 },
        { userId: "u1", quadrant: "LEU", loggedAt: 4 },
        { userId: "u1", quadrant: "LEU", loggedAt: 3 },
      ],
    };
    const rule = { threshold: { lookback: 3, field: "quadrant", condition: "all_equal:LEU" } };
    expect(shouldFireThreshold(rule, world, "u1")).toBe(true);
  });

  it("all_equal: false если хоть одна запись отличается", () => {
    const world = {
      moodEntries: [
        { userId: "u1", quadrant: "LEU", loggedAt: 5 },
        { userId: "u1", quadrant: "HEP", loggedAt: 4 },
        { userId: "u1", quadrant: "LEU", loggedAt: 3 },
      ],
    };
    const rule = { threshold: { lookback: 3, field: "quadrant", condition: "all_equal:LEU" } };
    expect(shouldFireThreshold(rule, world, "u1")).toBe(false);
  });

  it("equals: проверяет последний entry", () => {
    const world = { moodEntries: [{ userId: "u1", entryCount: 7, loggedAt: 1 }] };
    const rule = { threshold: { lookback: 1, field: "entryCount", condition: "equals:7" } };
    expect(shouldFireThreshold(rule, world, "u1")).toBe(true);
  });

  it("без threshold возвращает true", () => {
    expect(shouldFireThreshold({}, {}, "u1")).toBe(true);
  });

  it("недостаточно entries → false", () => {
    const world = { moodEntries: [{ userId: "u1", quadrant: "LEU", loggedAt: 1 }] };
    const rule = { threshold: { lookback: 5, field: "quadrant", condition: "all_equal:LEU" } };
    expect(shouldFireThreshold(rule, world, "u1")).toBe(false);
  });
});

describe("evaluateCondition (DSL)", () => {
  it("all_equal", () => {
    expect(evaluateCondition("all_equal:LEU", ["LEU", "LEU", "LEU"])).toBe(true);
    expect(evaluateCondition("all_equal:LEU", ["LEU", "HEP"])).toBe(false);
  });
  it("equals", () => {
    expect(evaluateCondition("equals:7", [7])).toBe(true);
    expect(evaluateCondition("equals:7", [8])).toBe(false);
  });
  it("gt/lt", () => {
    expect(evaluateCondition("gt:5", [10])).toBe(true);
    expect(evaluateCondition("lt:5", [3])).toBe(true);
    expect(evaluateCondition("gt:5", [5])).toBe(false);
  });
});

describe("evaluateRuleCondition (expression)", () => {
  it("сравнения effect.<field>", () => {
    expect(evaluateRuleCondition("effect.x > 5", { x: 10 })).toBe(true);
    expect(evaluateRuleCondition("effect.x > 5", { x: 3 })).toBe(false);
  });

  it("Math.abs работает", () => {
    expect(evaluateRuleCondition("Math.abs(effect.delta) > 0.5", { delta: -0.7 })).toBe(true);
    expect(evaluateRuleCondition("Math.abs(effect.delta) > 0.5", { delta: 0.3 })).toBe(false);
  });

  it("&& и || работают", () => {
    expect(evaluateRuleCondition("effect.x > 0 && effect.y < 5", { x: 3, y: 2 })).toBe(true);
    expect(evaluateRuleCondition("effect.x > 0 && effect.y < 5", { x: 3, y: 10 })).toBe(false);
  });

  it("без условия → true", () => {
    expect(evaluateRuleCondition(null, {})).toBe(true);
    expect(evaluateRuleCondition("", {})).toBe(true);
  });

  it("missing field → null → false", () => {
    expect(evaluateRuleCondition("effect.missing > 0", {})).toBe(false);
  });

  it("invalid expression → false (safe)", () => {
    expect(evaluateRuleCondition("invalid syntax (", {})).toBe(false);
  });
});

describe("parseSchedule", () => {
  it("парсит weekly:sun:20:00", () => {
    expect(parseSchedule("weekly:sun:20:00")).toEqual({
      period: "weekly", day: 0, hour: 20, minute: 0,
    });
  });

  it("парсит daily:08:30", () => {
    expect(parseSchedule("daily:08:30")).toEqual({
      period: "daily", hour: 8, minute: 30,
    });
  });

  it("null для пустой строки", () => {
    expect(parseSchedule("")).toBe(null);
    expect(parseSchedule(null)).toBe(null);
  });
});

describe("shouldFireSchedule", () => {
  it("daily fires в указанный час", () => {
    const sched = { period: "daily", hour: 8, minute: 0 };
    const at8am = new Date("2026-04-14T08:01:00");
    const at9am = new Date("2026-04-14T09:00:00");
    expect(shouldFireSchedule(sched, at8am, 0)).toBe(true);
    expect(shouldFireSchedule(sched, at9am, 0)).toBe(false);
  });

  it("weekly fires в указанный день недели", () => {
    const sched = { period: "weekly", day: 0, hour: 20, minute: 0 };
    const sun8pm = new Date("2026-04-12T20:01:00"); // воскресенье
    const mon8pm = new Date("2026-04-13T20:01:00"); // понедельник
    expect(shouldFireSchedule(sched, sun8pm, 0)).toBe(true);
    expect(shouldFireSchedule(sched, mon8pm, 0)).toBe(false);
  });

  it("не firing если firing меньше 5 минут назад", () => {
    const sched = { period: "daily", hour: 8, minute: 0 };
    const now = new Date("2026-04-14T08:02:00");
    const recentlyFired = Date.now() - 60 * 1000; // 1 минуту назад
    expect(shouldFireSchedule(sched, now, recentlyFired)).toBe(false);
  });
});
