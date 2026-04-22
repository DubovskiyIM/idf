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

  it("ontology.entities covers 12 Gravitino модулей", () => {
    const entities = Object.keys(ONTOLOGY.entities);
    const required = [
      "Metalake", "Catalog", "Schema", "Table", "Fileset",
      "Topic", "Model", "User", "Group", "Role", "Tag", "Policy",
    ];
    for (const name of required) {
      const match = entities.find(e => e.toLowerCase().includes(name.toLowerCase()));
      expect(match, `Entity matching "${name}" не найден в imported ontology`).toBeTruthy();
    }
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

  it("getSeedEffects() возвращает пустой array (Stage 1)", () => {
    expect(getSeedEffects()).toEqual([]);
  });
});
