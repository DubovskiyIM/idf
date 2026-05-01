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

  it("getSeedEffects() возвращает demo seed для hierarchical navigation (Stage 2 Task 3)", () => {
    const effects = getSeedEffects();
    expect(Array.isArray(effects)).toBe(true);
    expect(effects.length).toBeGreaterThan(20);
    // Покрытие canonical entities: хотя бы по одному instance для top-6.
    const byTarget = {};
    for (const e of effects) byTarget[e.target] = (byTarget[e.target] || 0) + 1;
    for (const t of ["metalakes", "catalogs", "schemas", "tables", "users", "roles"]) {
      expect(byTarget[t], `seed для ${t} отсутствует`).toBeGreaterThan(0);
    }
  });

  it("seed FK chain consistent — каждый child ссылается на существующего parent", () => {
    const effects = getSeedEffects();
    const byTarget = {};
    for (const e of effects) (byTarget[e.target] ||= []).push(e.context);
    const metalakeIds = new Set((byTarget.metalakes || []).map(m => m.id));
    const catalogIds = new Set((byTarget.catalogs || []).map(c => c.id));
    const schemaIds = new Set((byTarget.schemas || []).map(s => s.id));
    for (const c of byTarget.catalogs || []) {
      expect(metalakeIds.has(c.metalakeId), `Catalog ${c.id} → несуществующий metalake ${c.metalakeId}`).toBe(true);
    }
    for (const s of byTarget.schemas || []) {
      expect(catalogIds.has(s.catalogId), `Schema ${s.id} → несуществующий catalog ${s.catalogId}`).toBe(true);
    }
    for (const t of byTarget.tables || []) {
      expect(schemaIds.has(t.schemaId), `Table ${t.id} → несуществующий schema ${t.schemaId}`).toBe(true);
    }
  });

  it("metalake_list: dataGrid с колонками name/creator/owner/createdAt/properties/comment/actions", () => {
    const proj = PROJECTIONS.metalake_list;
    expect(proj.bodyOverride).toBeDefined();
    expect(proj.bodyOverride.type).toBe("dataGrid");
    const keys = proj.bodyOverride.columns.map(c => c.key);
    expect(keys).toEqual(expect.arrayContaining([
      "name", "creator", "owner", "createdAt", "properties", "comment", "_actions",
    ]));
    const nameCol = proj.bodyOverride.columns.find(c => c.key === "name");
    expect(nameCol.sortable).toBe(true);
    expect(nameCol.filterable).toBe(true);
    const createdAtCol = proj.bodyOverride.columns.find(c => c.key === "createdAt");
    expect(createdAtCol.sortable).toBe(true);
    const actionsCol = proj.bodyOverride.columns.find(c => c.key === "_actions");
    expect(actionsCol.kind).toBe("actions");
    expect(actionsCol.actions.length).toBeGreaterThanOrEqual(1);
    // Param-key contract: должен совпадать с openapi-declared `name` (path /metalakes/:name).
    // user_list использует `user` потому что path там /metalakes/{m}/users/{user}; здесь — `name`.
    const editAction = actionsCol.actions.find(a => a.intent === "alterMetalake");
    const deleteAction = actionsCol.actions.find(a => a.intent === "dropMetalake");
    expect(Object.keys(editAction.params)).toEqual(["name"]);
    expect(Object.keys(deleteAction.params)).toEqual(["name"]);
  });

  it("metalake_list: имеет subtitle/description", () => {
    const proj = PROJECTIONS.metalake_list;
    expect(typeof proj.description).toBe("string");
    expect(proj.description.length).toBeGreaterThan(20);
  });

  it("metalake_workspace: canvas-projection с canvasId='metalake_workspace'", () => {
    const proj = PROJECTIONS.metalake_workspace;
    expect(proj).toBeDefined();
    expect(proj.kind).toBe("canvas");
    expect(proj.mainEntity).toBe("Metalake");
    expect(proj.idParam).toBe("metalakeId");
    expect(proj.body).toBeDefined();
    expect(proj.body.kind).toBe("canvas");
    expect(proj.body.canvasId).toBe("metalake_workspace");
  });

  it("metalake_list: onItemClick переходит в metalake_workspace (а не metalake_detail)", () => {
    const proj = PROJECTIONS.metalake_list;
    expect(proj.bodyOverride.onItemClick.to).toBe("metalake_workspace");
    expect(proj.bodyOverride.onItemClick.params).toEqual({ metalakeId: "item.id" });
  });

  it("access_hub: canvas-projection с canvasId='access_hub'", () => {
    const proj = PROJECTIONS.access_hub;
    expect(proj).toBeDefined();
    expect(proj.kind).toBe("canvas");
    expect(proj.body.canvasId).toBe("access_hub");
  });

  it("compliance_hub: canvas-projection с canvasId='compliance_hub'", () => {
    const proj = PROJECTIONS.compliance_hub;
    expect(proj).toBeDefined();
    expect(proj.kind).toBe("canvas");
    expect(proj.body.canvasId).toBe("compliance_hub");
  });

  it("ROOT_PROJECTIONS: 4 hubs (metalake_list / jobs_hub / access_hub / compliance_hub)", () => {
    expect(ROOT_PROJECTIONS).toEqual(["metalake_list", "jobs_hub", "access_hub", "compliance_hub"]);
  });

  it("jobs_hub: canvas-projection с canvasId='jobs_hub'", () => {
    const proj = PROJECTIONS.jobs_hub;
    expect(proj).toBeDefined();
    expect(proj.kind).toBe("canvas");
    expect(proj.body.canvasId).toBe("jobs_hub");
  });
});
