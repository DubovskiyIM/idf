import { describe, it, expect } from "vitest";
import {
  STATES,
  initAuthoring,
  applyTurn,
  canFinalize,
  mergePatch,
  validatePartial,
} from "./authoringStateMachine.cjs";

describe("authoringStateMachine", () => {
  it("STATES — 7 последовательных состояний", () => {
    expect(STATES).toEqual([
      "empty", "kickoff", "entities", "intents", "roles", "ontology_detail", "preview", "committed",
    ]);
  });

  it("initAuthoring даёт empty state с непустым nextPrompt", () => {
    const s = initAuthoring({ domainId: "retro" });
    expect(s.state).toBe("empty");
    expect(s.spec.meta.id).toBe("retro");
    expect(s.spec.INTENTS).toEqual({});
    expect(s.spec.ONTOLOGY.entities).toEqual({});
    expect(s.spec.ONTOLOGY.roles).toEqual({});
    expect(s.nextPrompt).toBeTruthy();
    expect(s.history).toEqual([]);
  });

  it("applyTurn перевести из empty -> kickoff и добавить meta.description", async () => {
    const s0 = initAuthoring({ domainId: "retro" });
    const s1 = await applyTurn(s0, {
      userText: "Инструмент для retro-митингов",
      llmResponse: {
        patch: { meta: { description: "Retro tool" } },
        nextState: "kickoff",
        nextPrompt: "Кто пользуется?",
      },
    });
    expect(s1.state).toBe("kickoff");
    expect(s1.spec.meta.description).toBe("Retro tool");
    expect(s1.history.length).toBe(1);
    expect(s1.history[0].userText).toContain("retro");
  });

  it("applyTurn добавляет entity в ONTOLOGY без затирания meta", async () => {
    const s0 = initAuthoring({ domainId: "retro" });
    const s1 = await applyTurn(s0, {
      userText: "x",
      llmResponse: { patch: { meta: { description: "D" } }, nextState: "entities" },
    });
    const s2 = await applyTurn(s1, {
      userText: "add Card",
      llmResponse: {
        patch: { ONTOLOGY: { entities: { Card: { fields: { title: { type: "text" } } } } } },
        nextState: "entities",
      },
    });
    expect(s2.spec.meta.description).toBe("D");
    expect(s2.spec.ONTOLOGY.entities.Card).toBeDefined();
  });

  it("applyTurn мержит INTENTS incrementally", async () => {
    const s0 = initAuthoring({ domainId: "t" });
    const s1 = await applyTurn(s0, {
      userText: "x",
      llmResponse: {
        patch: { INTENTS: { a: { α: "create" } } },
        nextState: "intents",
      },
    });
    const s2 = await applyTurn(s1, {
      userText: "y",
      llmResponse: {
        patch: { INTENTS: { b: { α: "remove" } } },
        nextState: "intents",
      },
    });
    expect(Object.keys(s2.spec.INTENTS)).toEqual(["a", "b"]);
  });

  it("validatePartial: unknown_entity если intent.target без соответствующей entity", () => {
    const issues = validatePartial({
      INTENTS: { x: { α: "create", target: "Ghost" } },
      ONTOLOGY: { entities: { Real: {} } },
    });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("unknown_entity");
    expect(issues[0].intentId).toBe("x");
    expect(issues[0].target).toBe("Ghost");
  });

  it("validatePartial: нет issues когда target валиден", () => {
    const issues = validatePartial({
      INTENTS: { x: { α: "create", target: "Real" } },
      ONTOLOGY: { entities: { Real: {} } },
    });
    expect(issues).toEqual([]);
  });

  it("validatePartial: target по Entity.field (Entity.status) — валиден если Entity есть", () => {
    const issues = validatePartial({
      INTENTS: { x: { α: "replace", target: "Real.status" } },
      ONTOLOGY: { entities: { Real: {} } },
    });
    expect(issues).toEqual([]);
  });

  it("applyTurn сохраняет validationIssues в state", async () => {
    const s0 = initAuthoring({ domainId: "t" });
    const s1 = await applyTurn(s0, {
      userText: "x",
      llmResponse: {
        patch: { INTENTS: { x: { α: "create", target: "Missing" } } },
        nextState: "intents",
      },
    });
    expect(s1.validationIssues.length).toBe(1);
    expect(s1.validationIssues[0].code).toBe("unknown_entity");
  });

  it("canFinalize=true когда есть и entities, и intents, и state preview/ontology_detail", () => {
    const state = {
      state: "preview",
      spec: { INTENTS: { a: {} }, ONTOLOGY: { entities: { X: {} } } },
    };
    expect(canFinalize(state)).toBe(true);
    expect(canFinalize({ ...state, state: "ontology_detail" })).toBe(true);
  });

  it("canFinalize=false на entities (слишком рано)", () => {
    expect(canFinalize({
      state: "entities",
      spec: { INTENTS: { a: {} }, ONTOLOGY: { entities: { X: {} } } },
    })).toBe(false);
  });

  it("canFinalize=false если нет ни одного intent'а", () => {
    expect(canFinalize({
      state: "preview",
      spec: { INTENTS: {}, ONTOLOGY: { entities: { X: {} } } },
    })).toBe(false);
  });

  it("canFinalize=false если нет ни одной entity", () => {
    expect(canFinalize({
      state: "preview",
      spec: { INTENTS: { a: {} }, ONTOLOGY: { entities: {} } },
    })).toBe(false);
  });

  it("mergePatch — invariants array аккумулирует, не затирает", () => {
    const base = { ONTOLOGY: { entities: {}, roles: {}, invariants: [{ id: 1 }] } };
    const merged = mergePatch(base, {
      ONTOLOGY: { invariants: [{ id: 2 }] },
    });
    expect(merged.ONTOLOGY.invariants).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("applyTurn без llmResponse patch не роняет state (graceful)", async () => {
    const s0 = initAuthoring({ domainId: "t" });
    const s1 = await applyTurn(s0, {
      userText: "x",
      llmResponse: { nextState: "kickoff", nextPrompt: "дальше?" },
    });
    expect(s1.state).toBe("kickoff");
    expect(s1.spec).toEqual(s0.spec);
  });
});

describe("applyManualSpec", () => {
  const { initAuthoring, applyManualSpec, canFinalize } = require("./authoringStateMachine.cjs");

  it("заменяет spec целиком, не трогая history/domainId", () => {
    const s0 = initAuthoring({ domainId: "demo" });
    const s1 = { ...s0, history: [{ userText: "x", llmResponse: {} }] };
    const newSpec = {
      meta: { id: "demo" },
      INTENTS: { create_x: { α: "create", target: "X" } },
      ONTOLOGY: { entities: { X: { fields: {} } }, roles: {}, invariants: [] },
      PROJECTIONS: {},
    };
    const s2 = applyManualSpec(s1, newSpec);
    expect(s2.spec).toEqual(newSpec);
    expect(s2.history).toEqual(s1.history);
    expect(s2.domainId).toBe("demo");
  });

  it("если spec имеет intents+entities, переводит state в preview", () => {
    const s0 = initAuthoring({ domainId: "demo" });
    const newSpec = {
      meta: { id: "demo" },
      INTENTS: { create_x: { α: "create", target: "X" } },
      ONTOLOGY: { entities: { X: { fields: {} } }, roles: {}, invariants: [] },
      PROJECTIONS: {},
    };
    const s2 = applyManualSpec(s0, newSpec);
    expect(s2.state).toBe("preview");
    expect(canFinalize(s2)).toBe(true);
  });

  it("если spec пуст, оставляет state empty", () => {
    const s0 = initAuthoring({ domainId: "demo" });
    const s2 = applyManualSpec(s0, {
      meta: { id: "demo" }, INTENTS: {}, ONTOLOGY: { entities: {}, roles: {}, invariants: [] }, PROJECTIONS: {},
    });
    expect(s2.state).toBe("empty");
    expect(canFinalize(s2)).toBe(false);
  });

  it("validatePartial запускается на новом spec — unknown_entity ловится", () => {
    const s0 = initAuthoring({ domainId: "demo" });
    const newSpec = {
      meta: { id: "demo" },
      INTENTS: { create_x: { α: "create", target: "Missing" } },
      ONTOLOGY: { entities: { X: { fields: {} } }, roles: {}, invariants: [] },
      PROJECTIONS: {},
    };
    const s2 = applyManualSpec(s0, newSpec);
    expect(s2.validationIssues).toHaveLength(1);
    expect(s2.validationIssues[0].code).toBe("unknown_entity");
  });
});
