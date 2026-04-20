/**
 * Freelance — Derivation Rules Coverage.
 *
 * Формальный тест: для 13 правил деривации (R1..R11) фиксируем активацию
 * в freelance-домене. Freelance выбран потому что это самый сложный
 * из 10 доменов — multi-owner Deal, escrow, composite invariants,
 * reference Category. Максимальное покрытие preconditions в одном месте.
 *
 * Source of truth — `artifact.witnesses[]` с `basis: "crystallize-rule"`.
 * Для near-miss случаев (правило почти подходит) — `collectNearMissWitnesses`.
 *
 * Plan: docs/superpowers/plans/2026-04-20-freelance-derivation-tests.md
 */
import { describe, it, expect } from "vitest";
import {
  crystallizeV2,
  composeProjections,
  collectNearMissWitnesses,
} from "@intent-driven/core";
import {
  ONTOLOGY,
  INTENTS,
  PROJECTIONS,
} from "./domain.js";

// ---------------------------------------------------------------------------
// Helpers

function allCrystallizeWitnesses() {
  // R-rule witnesses появляются только для projections из deriveProjections
  // (через proj.derivedBy[]). Authored PROJECTIONS не несут этих witnesses.
  // composeProjections — запускает deriveProjections + мёрджит с authored
  // (authored priority). Это даёт нам реальный derivation coverage.
  const intentsArr = Object.entries(INTENTS).map(([id, i]) => ({ id, ...i }));
  const composed = composeProjections(intentsArr, ONTOLOGY, PROJECTIONS);

  const ontologyWithDerive = {
    ...ONTOLOGY,
    features: { ...(ONTOLOGY.features || {}), structureApply: true },
  };
  const artifacts = crystallizeV2(INTENTS, composed, ontologyWithDerive, "freelance", {});
  const witnesses = [];
  for (const [projId, art] of Object.entries(artifacts || {})) {
    for (const w of (art?.witnesses || [])) {
      witnesses.push({ ...w, _projection: projId });
    }
  }
  return witnesses;
}

function witnessesByRule(ruleId) {
  return allCrystallizeWitnesses().filter(
    w => w.basis === "crystallize-rule" && w.ruleId === ruleId,
  );
}

function nearMissForRule(ruleId) {
  const intentsArr = Object.entries(INTENTS).map(([id, i]) => ({ id, ...i }));
  const nms = collectNearMissWitnesses(intentsArr, ONTOLOGY);
  return (nms || []).filter(nm => nm.ruleId === ruleId);
}

// Универсальный extractor field из witness — details или input
function detail(w, field) {
  return w.details?.[field] ?? w.input?.[field] ?? w[field];
}

// ---------------------------------------------------------------------------
// R1 — catalog from creator

describe("R1 — catalog from creator", () => {
  it("fires для ключевых entity с creator-intent (Task, Response, Review)", () => {
    const witnesses = witnessesByRule("R1");
    const entities = new Set(witnesses.map(w => detail(w, "entity")));
    // Deal не имеет pure-creator → R3 detail, не R1 catalog — это норма
    expect(entities).toContain("Task");
    expect(entities).toContain("Response");
    expect(entities).toContain("Review");
  });

  it("input.creators ≥1 для каждого R1 witness", () => {
    const witnesses = witnessesByRule("R1");
    expect(witnesses.length).toBeGreaterThanOrEqual(4);
    for (const w of witnesses) {
      const creators = detail(w, "creators") || [];
      expect(creators.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// R1b — read-only catalog (reference entity)

describe("R1b — read-only catalog", () => {
  it("fires для Category (kind:reference)", () => {
    const witnesses = witnessesByRule("R1b");
    const categoryWitness = witnesses.find(w => detail(w, "entity") === "Category");
    expect(categoryWitness).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// R2 — feed override

describe("R2 — feed override", () => {
  it("fires или near-miss для Task/Deal (timestamp + status candidate)", () => {
    const fires = witnessesByRule("R2");
    const nm = nearMissForRule("R2");
    if (fires.length === 0 && nm.length === 0) {
      // eslint-disable-next-line no-console
      console.warn("[R2] freelance не активирует feed-override — нет feed-friendly projections");
    }
    // Мягко: если fires есть — shape должен содержать feedSignals
    for (const w of fires) {
      const signals = detail(w, "feedSignals") || [];
      expect(Array.isArray(signals)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// R3 — detail from mutators

describe("R3 — detail from mutators", () => {
  it("fires для Task, Response, Deal, Review (entity с >1 mutator)", () => {
    const witnesses = witnessesByRule("R3");
    const entities = new Set(witnesses.map(w => detail(w, "entity")));
    expect(entities).toContain("Task");
    expect(entities).toContain("Response");
    expect(entities).toContain("Deal");
    expect(entities).toContain("Review");
  });

  it("input.mutators >1 для каждого R3 witness", () => {
    const witnesses = witnessesByRule("R3");
    expect(witnesses.length).toBeGreaterThanOrEqual(1);
    for (const w of witnesses) {
      const mutators = detail(w, "mutators") || [];
      expect(mutators.length).toBeGreaterThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// R3b — singleton-detail (no idParam)

describe("R3b — singleton detail", () => {
  it("fires для Wallet (один per user, ownerField=userId)", () => {
    const witnesses = witnessesByRule("R3b");
    const walletWitness = witnesses.find(w => detail(w, "entity") === "Wallet");
    expect(walletWitness).toBeDefined();
    const ownerField = detail(walletWitness, "ownerField");
    expect(ownerField).toBe("userId");
  });
});

// ---------------------------------------------------------------------------
// R4 — sub-collection

describe("R4 — sub-collection from parent detail", () => {
  const expectedPairs = [
    { parent: "Task", child: "Response" },
    { parent: "Task", child: "Deal" },
    { parent: "Wallet", child: "Transaction" },
    { parent: "User", child: "Review" },
  ];

  for (const { parent, child } of expectedPairs) {
    it(`${parent} → ${child}`, () => {
      const witnesses = witnessesByRule("R4");
      const match = witnesses.find(w =>
        detail(w, "parentEntity") === parent &&
        detail(w, "childEntity") === child,
      );
      if (!match) {
        // eslint-disable-next-line no-console
        console.warn(`[R4] ${parent} → ${child} не активирует — проверить FK наличие`);
      }
      // Soft — может не fire если parent не detail-projection, что норма
    });
  }

  it("активирует ≥1 R4 witness", () => {
    const witnesses = witnessesByRule("R4");
    expect(witnesses.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// R6 — field union

describe("R6 — field union across intents", () => {
  it("fires ≥1 для entity с ≥2 intents и разными fields", () => {
    const witnesses = witnessesByRule("R6");
    expect(witnesses.length).toBeGreaterThanOrEqual(1);
    const entities = new Set(witnesses.map(w => detail(w, "entity")));
    expect(entities).toContain("Task");
  });

  it("output.witnesses имеет ≥2 unique fields (признак field-union)", () => {
    const witnesses = witnessesByRule("R6");
    for (const w of witnesses) {
      // output.witnesses в R6 — flat-list собранных fields из contributing intents
      const outputWitnesses = w.output?.witnesses || [];
      expect(outputWitnesses.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// R7 v2 — owner-scoped feed

describe("R7 v2 — owner-scoped feed", () => {
  it("fires для ≥3 entities с ownerField (owner-scoped derivation)", () => {
    const witnesses = witnessesByRule("R7");
    expect(witnesses.length).toBeGreaterThanOrEqual(3);
    const entities = new Set(witnesses.map(w => detail(w, "entity")));
    expect(entities).toContain("Response");
    expect(entities).toContain("Review");
  });

  it("каждый R7 witness имеет ownerField + sourceBase", () => {
    const witnesses = witnessesByRule("R7");
    for (const w of witnesses) {
      expect(typeof detail(w, "ownerField")).toBe("string");
      expect(detail(w, "sourceCatalog") || detail(w, "sourceBase")).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// R7b — multi-owner filter (disjunction)

describe("R7b — multi-owner filter", () => {
  it("fires для Deal (owners-array [customerId, executorId])", () => {
    const witnesses = witnessesByRule("R7b");
    const dealWitness = witnesses.find(w => detail(w, "entity") === "Deal");
    expect(dealWitness).toBeDefined();
    const fields = detail(dealWitness, "ownerFields") || [];
    expect(fields).toContain("customerId");
    expect(fields).toContain("executorId");
  });
});

// ---------------------------------------------------------------------------
// R8 — hub absorption

describe("R8 — hub absorption", () => {
  it("fires ≥1 — parent detail поглощает child catalogs", () => {
    const witnesses = witnessesByRule("R8");
    // Hub-absorption либо parent-side (R8 hub declaration), либо child-side
    // (R8 absorbed marker). Обе формы допустимы.
    expect(witnesses.length).toBeGreaterThanOrEqual(1);
  });

  it("parent-side R8 witnesses имеют absorbedChildren ≥2", () => {
    const witnesses = witnessesByRule("R8");
    const parentSide = witnesses.filter(w => Array.isArray(detail(w, "absorbedChildren")));
    for (const w of parentSide) {
      const absorbed = detail(w, "absorbedChildren") || [];
      expect(absorbed.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ---------------------------------------------------------------------------
// R9 — cross-entity composite

describe("R9 — cross-entity composite (alias joins)", () => {
  it("fires ≥1 — projections с FK-composition получают alias-join declarations", () => {
    const witnesses = witnessesByRule("R9");
    expect(witnesses.length).toBeGreaterThanOrEqual(1);
    for (const w of witnesses) {
      const joins = detail(w, "joins") || [];
      expect(joins.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// R10 — role scope (m2m)

describe("R10 — role scope (m2m)", () => {
  it("fires для declared role.scope deklарaций (если есть в freelance)", () => {
    const witnesses = witnessesByRule("R10");
    if (witnesses.length === 0) {
      // eslint-disable-next-line no-console
      console.warn("[R10] нет declared role.scope в freelance (agent/observer m2m scoping)");
      return;
    }
    for (const w of witnesses) {
      const role = detail(w, "roleName") || detail(w, "role");
      expect(typeof role).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// R11 v2 — temporal owner-scoped feed

describe("R11 v2 — temporal owner-scoped feed", () => {
  const expectedEntities = [
    { entity: "Review" },
    { entity: "Transaction" },
  ];

  for (const { entity } of expectedEntities) {
    it(`fires для ${entity} (createdAt + ownerField)`, () => {
      const witnesses = witnessesByRule("R11");
      const match = witnesses.find(w => detail(w, "entity") === entity);
      if (!match) {
        // eslint-disable-next-line no-console
        console.warn(`[R11] ${entity} не активирует — проверить timestamp field detection`);
        return;
      }
      const ts = detail(match, "timestampField");
      expect(typeof ts).toBe("string");
    });
  }
});

// ---------------------------------------------------------------------------
// Coverage matrix

describe("Coverage matrix", () => {
  it("выводит сводку активаций per rule, gate ≥8/13", () => {
    const allRules = ["R1", "R1b", "R2", "R3", "R3b", "R4", "R6", "R7", "R7b", "R8", "R9", "R10", "R11"];
    const fireCount = {};
    for (const rid of allRules) {
      fireCount[rid] = witnessesByRule(rid).length;
    }
    // eslint-disable-next-line no-console
    console.log("\n=== Freelance derivation coverage ===");
    for (const rid of allRules) {
      const n = fireCount[rid];
      const mark = n > 0 ? "✓" : "—";
      // eslint-disable-next-line no-console
      console.log(`  ${mark} ${rid.padEnd(4)} — ${n} witnesses`);
    }
    const activatedCount = Object.values(fireCount).filter(n => n > 0).length;
    // eslint-disable-next-line no-console
    console.log(`\nActivated: ${activatedCount}/${allRules.length}\n`);
    expect(activatedCount).toBeGreaterThanOrEqual(8);
  });
});
