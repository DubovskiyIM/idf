import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { similarity, findTopMatches, jaccard, triggerKinds, tokenSet } = require("./patternSimilarity.cjs");

describe("patternSimilarity · primitives", () => {
  it("jaccard на пустых множествах = 0", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
  it("jaccard на идентичных = 1", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });
  it("jaccard 1/3 для {a,b,c} vs {a,d}", () => {
    expect(jaccard(new Set(["a", "b", "c"]), new Set(["a", "d"]))).toBeCloseTo(1 / 4);
  });

  it("tokenSet разбивает kebab/snake/PascalCase", () => {
    expect([...tokenSet("rating-aggregate-hero")].sort()).toEqual([
      "aggregate", "hero", "rating",
    ]);
  });

  it("triggerKinds собирает kinds из requires[]", () => {
    const p = { trigger: { requires: [{ kind: "entity-field" }, { kind: "intent-creates" }] } };
    expect([...triggerKinds(p)].sort()).toEqual(["entity-field", "intent-creates"]);
  });
});

describe("similarity", () => {
  const A = {
    id: "rating-aggregate-hero",
    archetype: "detail",
    structure: { slot: "header" },
    trigger: { requires: [{ kind: "sub-entity-exists" }, { kind: "field-role-present" }] },
  };

  it("identity → 1", () => {
    expect(similarity(A, A)).toBeCloseTo(1, 2);
  });

  it("полностью разные → ~0", () => {
    const B = {
      id: "completely-different",
      archetype: "feed",
      structure: { slot: "body" },
      trigger: { requires: [{ kind: "intent-confirmation" }] },
    };
    expect(similarity(A, B)).toBeLessThan(0.1);
  });

  it("совпадает archetype + slot, разные kinds — score дробный", () => {
    const B = {
      id: "rating-statistic-hero",
      archetype: "detail",
      structure: { slot: "header" },
      trigger: { requires: [{ kind: "entity-field" }] },
    };
    const score = similarity(A, B);
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThan(1);
  });

  it("name-overlap но без trigger/slot/archetype — слабый сигнал", () => {
    const B = {
      id: "rating-aggregate-feed",
      archetype: "feed",
      structure: { slot: "body" },
      trigger: { requires: [{ kind: "intent-count" }] },
    };
    expect(similarity(A, B)).toBeLessThan(0.4);
  });

  it("null/undefined → 0", () => {
    expect(similarity(null, A)).toBe(0);
    expect(similarity(A, undefined)).toBe(0);
  });
});

describe("findTopMatches", () => {
  const subject = {
    id: "rating-hero-cand",
    archetype: "detail",
    structure: { slot: "header" },
    trigger: { requires: [{ kind: "sub-entity-exists" }, { kind: "field-role-present" }] },
  };
  const pool = [
    { id: "rating-aggregate-hero", archetype: "detail", structure: { slot: "header" },
      trigger: { requires: [{ kind: "sub-entity-exists" }, { kind: "field-role-present" }] } },
    { id: "completely-different", archetype: "feed", structure: { slot: "body" },
      trigger: { requires: [{ kind: "intent-confirmation" }] } },
    { id: "rating-hero-cand", archetype: "detail", structure: { slot: "header" },
      trigger: { requires: [] } }, // self → должно отфильтроваться
  ];

  it("top-1 — самый похожий, self исключён", () => {
    const top = findTopMatches(subject, pool, 1);
    expect(top).toHaveLength(1);
    expect(top[0].id).toBe("rating-aggregate-hero");
    // 0.85+ — все нагрузочные совпали, плюс часть name-tokens (rating, hero)
    expect(top[0].score).toBeGreaterThan(0.85);
  });

  it("top=3 возвращает упорядоченный массив (desc)", () => {
    const top = findTopMatches(subject, pool, 3);
    expect(top.length).toBeGreaterThan(0);
    for (let i = 1; i < top.length; i++) {
      expect(top[i].score).toBeLessThanOrEqual(top[i - 1].score);
    }
  });

  it("включает archetype/slot/status в результат", () => {
    const top = findTopMatches(subject, pool, 1);
    expect(top[0]).toHaveProperty("archetype", "detail");
    expect(top[0]).toHaveProperty("slot", "header");
  });
});
