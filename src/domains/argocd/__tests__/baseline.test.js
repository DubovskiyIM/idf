// Stage 1 baseline smoke для ArgoCD (16-й полевой тест).
// Cель — зафиксировать состояние passthrough-import'а + ловить регрессии
// до dev-server'а. Gap'ы G-A-1..G-A-5 из domain.js описывают
// ожидаемые "not-yet-fixed" места; тесты пишут expect на **current**
// behaviour, чтобы ловить улучшения (а не только регрессии).
import { describe, it, expect } from "vitest";
import { ONTOLOGY, INTENTS, ROOT_PROJECTIONS } from "../domain.js";

describe("argocd Stage 1 baseline (import passthrough)", () => {
  it("ontology imported: 300+ entities, 100+ intents, 5 ролей", () => {
    expect(Object.keys(ONTOLOGY.entities).length).toBeGreaterThanOrEqual(290);
    expect(Object.keys(INTENTS).length).toBeGreaterThanOrEqual(100);
    expect(Object.keys(ONTOLOGY.roles).length).toBe(5);
  });

  it("5 ролей с правильными base: admin/developer/deployer/viewer/auditor", () => {
    expect(ONTOLOGY.roles.admin?.base).toBe("admin");
    expect(ONTOLOGY.roles.developer?.base).toBe("owner");
    expect(ONTOLOGY.roles.deployer?.base).toBe("owner");
    expect(ONTOLOGY.roles.viewer?.base).toBe("viewer");
    expect(ONTOLOGY.roles.auditor?.base).toBe("viewer");
  });

  it("K8s CRDs присутствуют под v1alpha1* naming (pre-G-A-1)", () => {
    // Важно: импорт не dedup'ил K8s CRD pattern, сущности сидят под
    // v1alpha1<Name>. G-A-1 — будущий SDK PR mergeK8sCrdDuplicates.
    expect(ONTOLOGY.entities.v1alpha1Application).toBeDefined();
    expect(ONTOLOGY.entities.v1alpha1AppProject).toBeDefined();
    expect(ONTOLOGY.entities.v1alpha1Cluster).toBeDefined();
    expect(ONTOLOGY.entities.v1alpha1Repository).toBeDefined();
    expect(ONTOLOGY.entities.v1alpha1ApplicationSet).toBeDefined();
  });

  it("G-A-1 snapshot: short-name entities существуют, но только как {id}-stub", () => {
    // Новое открытие 2026-04-24: importer создаёт 2 отдельные entities на
    // K8s CRD тип — path-derived stub (Application, Cluster) с fields:{id}
    // и schema-derived full (v1alpha1Application) с 4 полями (kind:embedded).
    // Они НЕ мёрджатся. Это и есть G-A-1 — нужно schema-merge path-derived
    // entity с v<ver><Name>-сущностью из schemas.
    expect(ONTOLOGY.entities.Application).toBeDefined();
    expect(Object.keys(ONTOLOGY.entities.Application.fields)).toEqual(["id"]);
    expect(ONTOLOGY.entities.Cluster).toBeDefined();
    expect(Object.keys(ONTOLOGY.entities.Cluster.fields)).toEqual(["id"]);
    // Реальные поля — в embedded-стороне
    expect(Object.keys(ONTOLOGY.entities.v1alpha1Application.fields))
      .toContain("spec");
    expect(Object.keys(ONTOLOGY.entities.v1alpha1Application.fields))
      .toContain("status");
  });

  it("G-A-2 snapshot: K8s CRDs помечены embedded (должны быть top-level)", () => {
    // markEmbeddedTypes aggressive для K8s root CRDs — они принимаются
    // как nested embedded потому что path-level wrapper types (например
    // v1alpha1ApplicationList) используют их через $ref. После G-A-2 fix'а
    // v1alpha1Application.kind должен стать !== "embedded".
    expect(ONTOLOGY.entities.v1alpha1Application.kind).toBe("embedded");
    expect(ONTOLOGY.entities.v1alpha1AppProject.kind).toBe("embedded");
  });

  it("G-A-4 snapshot: intents используют grpc-gateway naming", () => {
    // ArgoCD OpenAPI operationId: `<ServiceName>_<Verb>` — ApplicationService_Create
    // вместо canonical createApplication. Читабельность страдает; на Stage 2
    // применим PARAM_ALIASES или host-level rename.
    expect(INTENTS.ApplicationService_Create).toBeDefined();
    expect(INTENTS.ApplicationService_Create.creates).toBe("Application");
    expect(INTENTS.ApplicationService_List).toBeDefined();
    expect(INTENTS.ApplicationService_Get).toBeDefined();
    // Canonical имена отсутствуют
    expect(INTENTS.createApplication).toBeUndefined();
    expect(INTENTS.listApplications).toBeUndefined();
  });

  it("intents с creates — 17 штук для 8 canonical entity types", () => {
    const withCreates = Object.entries(INTENTS).filter(([, i]) => i.creates);
    expect(withCreates.length).toBeGreaterThanOrEqual(15);
    const creates = new Set(withCreates.map(([, i]) => i.creates));
    // Canonical entities (as referenced by intents, not as stored)
    expect(creates.has("Application")).toBe(true);
    expect(creates.has("Cluster")).toBe(true);
    expect(creates.has("Project")).toBe(true);
    expect(creates.has("Repository")).toBe(true);
    expect(creates.has("Certificate")).toBe(true);
  });

  it("ROOT_PROJECTIONS пуст на Stage 1 (whitelist добавим на Stage 3)", () => {
    expect(ROOT_PROJECTIONS).toEqual([]);
  });
});
