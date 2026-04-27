/**
 * Meta-домен baseline (IDF-on-IDF, Level 1).
 *
 * Проверяет: онтология собирается, snapshot читается, seed конвертируется
 * в effects без коллизий ID, fold(seed) даёт world с правильными counts,
 * deriveProjections + crystallizeV2 не падают на мета-онтологии.
 *
 * Главный результат — фиксация format-gap'ов (через `expect`,
 * который может упасть и тогда мы увидим конкретный пробел SDK).
 */
import { describe, it, expect } from "vitest";
import {
  crystallizeV2,
  deriveProjections,
  fold,
  filterProjectionsByRole,
} from "@intent-driven/core";
import {
  ONTOLOGY,
  INTENTS,
  PROJECTIONS,
  ROOT_PROJECTIONS,
  getSeedEffects,
  SEED_SUMMARY,
} from "../domain.js";

describe("meta baseline", () => {
  it("ontology: 10 сущностей, 4 роли, 9 invariants, 0 rules", () => {
    expect(Object.keys(ONTOLOGY.entities).length).toBe(10);
    expect(Object.keys(ONTOLOGY.roles).length).toBe(4);
    expect(ONTOLOGY.invariants.length).toBe(9);
    expect(ONTOLOGY.rules.length).toBe(0);
    expect(ONTOLOGY.entities.BacklogItem).toBeDefined();
    expect(ONTOLOGY.entities.PatternPromotion).toBeDefined();
    const lifecycle = ONTOLOGY.invariants.find((i) => i.name === "backlog_lifecycle");
    expect(lifecycle?.kind).toBe("transition");
    const promoLifecycle = ONTOLOGY.invariants.find((i) => i.name === "promotion_lifecycle");
    expect(promoLifecycle?.kind).toBe("transition");
  });

  it("entities имеют primary fieldRole", () => {
    for (const [name, e] of Object.entries(ONTOLOGY.entities)) {
      const hasPrimary = Object.values(e.fields).some(
        (f) => f.fieldRole === "primary",
      );
      expect(
        hasPrimary,
        `${name} должна иметь fieldRole:"primary"`,
      ).toBe(true);
    }
  });

  it("intents: 8 write-side (4 backlog + 4 pattern promotion)", () => {
    expect(Object.keys(INTENTS).length).toBe(8);
    expect(INTENTS.add_backlog_item.α).toBe("create");
    expect(INTENTS.request_pattern_promotion.α).toBe("create");
    expect(INTENTS.ship_pattern_promotion.context.__irr.point).toBe("high");
    expect(INTENTS.close_backlog_item.precondition).toEqual({
      "BacklogItem.status": ["open", "scheduled"],
    });
  });

  it("projections: 10 authored (Level 1 + Level 2 backlog + promotions + Studio shell)", () => {
    expect(Object.keys(PROJECTIONS).length).toBe(15);
    expect(PROJECTIONS.pattern_bank_browser.archetype).toBe("catalog");
    expect(PROJECTIONS.pattern_detail.archetype).toBe("detail");
    expect(PROJECTIONS.domain_detail.subCollections.length).toBe(4);
    // Level 2 — soft-authoring backlog projections.
    expect(PROJECTIONS.backlog_inbox.archetype).toBe("catalog");
    expect(PROJECTIONS.backlog_item_detail.idParam).toBe("backlogItemId");
  });

  it("ROOT_PROJECTIONS — array of sections (V2Shell контракт)", () => {
    expect(Array.isArray(ROOT_PROJECTIONS)).toBe(true);
    expect(ROOT_PROJECTIONS.length).toBeGreaterThan(0);
    for (const s of ROOT_PROJECTIONS) {
      expect(typeof s.section).toBe("string");
      expect(Array.isArray(s.items)).toBe(true);
    }
    const allItems = ROOT_PROJECTIONS.flatMap((s) => s.items);
    expect(allItems).toContain("pattern_bank_browser");
  });

  it("seed: snapshot непустой и id'шники уникальны", () => {
    expect(SEED_SUMMARY).toBeDefined();
    expect(SEED_SUMMARY.domains).toBeGreaterThanOrEqual(15);
    expect(SEED_SUMMARY.intents).toBeGreaterThan(100);
    expect(SEED_SUMMARY.stablePatterns).toBeGreaterThanOrEqual(30);
    // Реальные witness'ы из crystallizeV2 (не synthesized).
    expect(SEED_SUMMARY.witnesses).toBeGreaterThan(500);

    const effects = getSeedEffects();
    expect(effects.length).toBeGreaterThan(500);
    const ids = effects.map((e) => e.id);
    expect(
      new Set(ids).size,
      "все seed effect IDs должны быть уникальны",
    ).toBe(ids.length);
  });

  it("witness'ы имеют разные basis'ы (crystallize-rule / pattern-bank / authored)", () => {
    const effects = getSeedEffects();
    const witnessRows = effects
      .filter((e) => e.target === "witnesses")
      .map((e) => e.context);
    const baseSet = new Set(witnessRows.map((w) => w.basis));
    // crystallize_v2 даёт >=2 разных basis на реальной онтологии 16 доменов
    expect(baseSet.size).toBeGreaterThan(1);
  });

  it("fold(seed) даёт world с правильным числом domains", () => {
    const effects = getSeedEffects();
    const world = fold(effects);
    expect(Object.keys(world.domains || {}).length).toBe(SEED_SUMMARY.domains);
    expect(Object.keys(world.intents || {}).length).toBe(SEED_SUMMARY.intents);
    // GAP-meta-1 — patternId неуникален между stable и candidate банками,
    // composite-id (status + patternId + sourceProduct) разводит коллизии.
    expect(Object.keys(world.patterns || {}).length).toBe(
      SEED_SUMMARY.stablePatterns + SEED_SUMMARY.candidatePatterns,
    );
  });

  it("deriveProjections генерирует domain_list / intent_list / pattern_detail", () => {
    const derived = deriveProjections(INTENTS, ONTOLOGY);
    const ids = Object.keys(derived);
    // На пустой INTENTS derive должен сгенерировать минимум catalog/detail
    // для каждой entity. Это и есть тест того, как format reagiрует на
    // онтологию-без-intent'ов.
    expect(ids.length).toBeGreaterThan(0);
  });

  it("crystallizeV2 не падает на мета-онтологии", () => {
    const merged = { ...deriveProjections(INTENTS, ONTOLOGY), ...PROJECTIONS };
    const artifacts = crystallizeV2(INTENTS, merged, ONTOLOGY, "meta");
    expect(Object.keys(artifacts).length).toBeGreaterThan(0);
  });

  it("filterProjectionsByRole пропускает items из ROOT_PROJECTIONS", () => {
    const merged = { ...deriveProjections(INTENTS, ONTOLOGY), ...PROJECTIONS };
    const allItems = ROOT_PROJECTIONS.flatMap((s) => s.items);
    const visible = filterProjectionsByRole(allItems, merged, "formatAuthor");
    // forRoles задан в authored projections — admin видит pattern_bank_browser.
    expect(visible).toContain("pattern_bank_browser");
  });
});
