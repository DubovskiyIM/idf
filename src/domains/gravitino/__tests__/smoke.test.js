// src/domains/gravitino/__tests__/smoke.test.js
import { describe, it, expect } from "vitest";
import {
  ONTOLOGY, INTENTS, PROJECTIONS, ROOT_PROJECTIONS, RULES,
  DOMAIN_ID, DOMAIN_NAME, getSeedEffects,
} from "../domain.js";
import { crystallizeV2 } from "@intent-driven/core";

describe("gravitino domain — Stage 1 baseline", () => {
  it("exports present", () => {
    expect(DOMAIN_ID).toBe("gravitino");
    expect(DOMAIN_NAME).toBeTruthy();
    expect(ONTOLOGY).toBeTypeOf("object");
    expect(INTENTS).toBeTypeOf("object");
    expect(Array.isArray(ROOT_PROJECTIONS)).toBe(true);
    expect(PROJECTIONS).toBeTypeOf("object");
    expect(Array.isArray(RULES)).toBe(true);
  });

  it("ontology.entities содержит 12 canonical Gravitino модулей (exact match)", () => {
    const entities = Object.keys(ONTOLOGY.entities);
    const required = [
      "Metalake", "Catalog", "Schema", "Table", "Fileset",
      "Topic", "Model", "User", "Group", "Role", "Tag", "Policy",
    ];
    for (const name of required) {
      expect(entities, `Canonical entity "${name}" не найден в imported ontology`).toContain(name);
    }
  });

  it("imported ontology содержит полный counterpart Gravitino OpenAPI", () => {
    // Lower bound — не хрупкий к минорным изменениям upstream OpenAPI, но
    // ловит regression importer'а (например, $ref resolution ломается и
    // entities схлопываются до ~30). Baseline: 218 entities, 120 intents.
    expect(Object.keys(ONTOLOGY.entities).length).toBeGreaterThanOrEqual(150);
    expect(Object.keys(INTENTS).length).toBeGreaterThanOrEqual(100);
  });

  it("intents покрывают CRUD хотя бы для Metalake", () => {
    const names = Object.keys(INTENTS);
    const hasList = names.some(n => /^list.*[mM]etalake/i.test(n));
    const hasCreate = names.some(n => /^create.*[mM]etalake/i.test(n));
    expect(hasList, "нет list*Metalake intent").toBe(true);
    expect(hasCreate, "нет create*Metalake intent").toBe(true);
  });

  it("crystallizeV2 не бросает ошибок", () => {
    expect(() => crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, DOMAIN_ID)).not.toThrow();
  });

  it("crystallizeV2 деривирует ≥24 artifact'а (12 list + 12 detail minimum)", () => {
    const artifacts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, DOMAIN_ID);
    expect(Object.keys(artifacts).length).toBeGreaterThanOrEqual(24);
  });

  it("metalake_detail дериввирован как archetype=detail", () => {
    // subCollection Catalog → Metalake не подтянется в slots/hubSections пока
    // FK-поле `metalakeId` не появится в Catalog.fields (Stage 2 gap — Gravitino
    // использует URL-path parent, не scalar FK). Тест фиксирует только наличие
    // artifact'а и его archetype; subCollection — авторский hint в projection.
    const artifacts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, DOMAIN_ID);
    const md = artifacts.metalake_detail;
    expect(md).toBeDefined();
    expect(md.archetype).toBe("detail");
    expect(md.projection).toBe("metalake_detail");
  });

  it("getSeedEffects() возвращает пустой array (Stage 1)", () => {
    expect(getSeedEffects()).toEqual([]);
  });
});
