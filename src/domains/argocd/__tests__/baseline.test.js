// Baseline smoke для ArgoCD (16-й полевой тест).
// Stage 1: import passthrough, снапшот gap'ов G-A-1..G-A-5.
// Stage 2: host-level K8s CRD merge + grpc-gateway intent canonicalization.
// Stage 3: ROOT_PROJECTIONS whitelist + semantic augmentation + rich seed.
import { describe, it, expect } from "vitest";
import { crystallizeV2, deriveProjections, fold } from "@intent-driven/core";
import { ONTOLOGY, INTENTS, PROJECTIONS, ROOT_PROJECTIONS, getSeedEffects } from "../domain.js";

describe("argocd Stage 1+2 baseline", () => {
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

  it("G-A-1 workaround: короткие имена после merge имеют поля из v1alpha1*", () => {
    // Application ← v1alpha1Application (metadata/operation/spec/status + id stub)
    expect(ONTOLOGY.entities.Application.kind).toBe("internal");
    const appFields = Object.keys(ONTOLOGY.entities.Application.fields);
    expect(appFields).toContain("id");
    expect(appFields).toContain("spec");
    expect(appFields).toContain("status");
    expect(appFields).toContain("metadata");

    // Cluster ← v1alpha1Cluster (10+ полей)
    const clusterFields = Object.keys(ONTOLOGY.entities.Cluster.fields);
    expect(clusterFields).toContain("name");
    expect(clusterFields).toContain("connectionState");
    expect(clusterFields).toContain("project");

    // Project ← v1alpha1AppProject (path short-name ≠ CRD name)
    const projectFields = Object.keys(ONTOLOGY.entities.Project.fields);
    expect(projectFields).toContain("spec");
    expect(projectFields).toContain("metadata");

    // Gpgkey ← v1alpha1GnuPGPublicKey (плоская, без spec/status)
    const gpgFields = Object.keys(ONTOLOGY.entities.Gpgkey.fields);
    expect(gpgFields).toContain("fingerprint");
    expect(gpgFields).toContain("keyID");
    expect(gpgFields).toContain("owner");

    // Account ← accountAccount (non-K8s root)
    const accFields = Object.keys(ONTOLOGY.entities.Account.fields);
    expect(accFields).toContain("name");
    expect(accFields).toContain("capabilities");
  });

  it("G-A-1 backward-compat: v1alpha1* сущности сохранены для wrapper-refs", () => {
    // v1alpha1ApplicationList.items[] ссылается на v1alpha1Application —
    // merge не должен удалять embedded-сущности.
    expect(ONTOLOGY.entities.v1alpha1Application).toBeDefined();
    expect(ONTOLOGY.entities.v1alpha1Application.kind).toBe("embedded");
    expect(ONTOLOGY.entities.v1alpha1ApplicationList).toBeDefined();
  });

  it("G-A-4 workaround: grpc-gateway operationId переименованы в canonical", () => {
    // Canonical имена должны существовать
    expect(INTENTS.createApplication).toBeDefined();
    expect(INTENTS.listApplications).toBeDefined();
    expect(INTENTS.readApplication).toBeDefined();
    expect(INTENTS.syncApplication).toBeDefined();
    expect(INTENTS.createCluster).toBeDefined();
    expect(INTENTS.listClusters).toBeDefined();
    expect(INTENTS.createProject).toBeDefined();
    expect(INTENTS.createRepository).toBeDefined();
    expect(INTENTS.createApplicationSet).toBeDefined();
    expect(INTENTS.createGpgkey).toBeDefined();

    // Оригинальные имена удалены (не дублирование)
    expect(INTENTS.ApplicationService_Create).toBeUndefined();
    expect(INTENTS.ApplicationService_Sync).toBeUndefined();

    // _aliasOf сохранён для debug
    expect(INTENTS.createApplication._aliasOf).toBe("ApplicationService_Create");
    expect(INTENTS.syncApplication._aliasOf).toBe("ApplicationService_Sync");
  });

  it("intent.creates указывает на короткое имя (которое теперь имеет поля)", () => {
    expect(INTENTS.createApplication.creates).toBe("Application");
    expect(INTENTS.createCluster.creates).toBe("Cluster");
    expect(INTENTS.createProject.creates).toBe("Project");
    expect(INTENTS.createRepository.creates).toBe("Repository");
  });

  it("features.preferDataGrid: true (admin-style catalog UX)", () => {
    expect(ONTOLOGY.features.preferDataGrid).toBe(true);
  });

  it("G-A-2 snapshot: K8s root CRDs остаются embedded (unresolved)", () => {
    // v1alpha1Application НЕ unmark'ен — markEmbeddedTypes пометил
    // и Stage 2 host merge этого не правит (merge создаёт новую short-name
    // entity, не трогает v1alpha1Application). SDK PR нужен.
    expect(ONTOLOGY.entities.v1alpha1Application.kind).toBe("embedded");
  });

  it("Stage 3 ROOT_PROJECTIONS whitelist — 8 canonical модулей", () => {
    expect(ROOT_PROJECTIONS).toHaveLength(8);
    expect(ROOT_PROJECTIONS).toContain("application_list");
    expect(ROOT_PROJECTIONS).toContain("applicationset_list");
    expect(ROOT_PROJECTIONS).toContain("project_list");
    expect(ROOT_PROJECTIONS).toContain("cluster_list");
    expect(ROOT_PROJECTIONS).toContain("repository_list");
    expect(ROOT_PROJECTIONS).toContain("certificate_list");
    expect(ROOT_PROJECTIONS).toContain("gpgkey_list");
    expect(ROOT_PROJECTIONS).toContain("account_list");
  });

  it("Stage 3 semantic augmentation: Application/Cluster/Repository имеют flat fields", () => {
    const app = ONTOLOGY.entities.Application.fields;
    expect(app.syncStatus?.type).toBe("select");
    expect(app.syncStatus?.options).toContain("Synced");
    expect(app.syncStatus?.options).toContain("OutOfSync");
    expect(app.syncStatus?.fieldRole).toBe("status");
    expect(app.healthStatus?.options).toContain("Healthy");
    expect(app.healthStatus?.options).toContain("Degraded");
    expect(app.project?.type).toBe("entityRef");
    expect(app.project?.references).toBe("Project");

    const cluster = ONTOLOGY.entities.Cluster.fields;
    expect(cluster.connectionStatus?.fieldRole).toBe("status");
    expect(cluster.server?.fieldRole).toBe("uri");

    const repo = ONTOLOGY.entities.Repository.fields;
    expect(repo.type?.type).toBe("select");
    expect(repo.type?.options).toEqual(["git", "helm", "oci"]);
  });

  it("Stage 3 authored catalogs: dataGridBody c statusBadge-ready columns", () => {
    const appList = PROJECTIONS.application_list;
    expect(appList.bodyOverride?.type).toBe("dataGrid");
    const cols = appList.bodyOverride.columns.map(c => c.key);
    expect(cols).toContain("syncStatus");
    expect(cols).toContain("healthStatus");
    expect(cols).toContain("project");
    expect(cols).toContain("_actions");
    // actions: sync (primary), read, remove (danger)
    const actions = appList.bodyOverride.columns.find(c => c.key === "_actions").actions;
    expect(actions.find(a => a.intent === "syncApplication")).toBeDefined();
    expect(actions.find(a => a.intent === "removeApplication")?.danger).toBe(true);
  });

  it("Stage 5 — Resource entity с applicationId FK", () => {
    expect(ONTOLOGY.entities.Resource).toBeDefined();
    expect(ONTOLOGY.entities.Resource.kind).toBe("internal");
    expect(ONTOLOGY.entities.Resource.ownerField).toBe("applicationId");
    const fields = ONTOLOGY.entities.Resource.fields;
    expect(fields.applicationId?.type).toBe("entityRef");
    expect(fields.applicationId?.references).toBe("Application");
    expect(fields.kind?.fieldRole).toBe("name");
    expect(fields.syncStatus?.fieldRole).toBe("status");
    expect(fields.healthStatus?.options).toContain("Degraded");
    expect(fields.parentResource?.references).toBe("Resource");
  });

  it("Stage 5 — seed генерит 5 resources × 4 apps = 20 Resource effects", () => {
    const effects = getSeedEffects();
    const resources = effects.filter(e => e.target === "Resource");
    expect(resources.length).toBe(20);
    const apps = new Set(resources.map(r => r.context.applicationId));
    expect(apps.size).toBe(4);
    const kinds = resources.map(r => r.context.kind).sort();
    expect(kinds.filter(k => k === "Deployment").length).toBe(4);
    expect(kinds.filter(k => k === "ReplicaSet").length).toBe(4);
    expect(kinds.filter(k => k === "Pod").length).toBe(8);
    expect(kinds.filter(k => k === "Service").length).toBe(4);
    const paymentsPods = resources.filter(
      r => r.context.applicationId === "a_payments-api" && r.context.kind === "Pod"
    );
    expect(paymentsPods.map(p => p.context.healthStatus).sort())
      .toEqual(["Degraded", "Missing"]);
  });

  it("Stage 5 — application_detail subCollection с renderAs:resourceTree", () => {
    const detail = PROJECTIONS.application_detail;
    expect(detail.subCollections).toBeDefined();
    const resSub = detail.subCollections.find(s => s.entity === "Resource");
    expect(resSub).toBeDefined();
    expect(resSub.foreignKey).toBe("applicationId");
    expect(resSub.renderAs?.type).toBe("resourceTree");
    const healthCol = resSub.columns.find(c => c.key === "healthStatus");
    expect(healthCol?.kind).toBe("badge");
    expect(healthCol?.colorMap?.Degraded).toBe("danger");
  });

  it("Stage 4 badge columns: syncStatus/healthStatus с kind:badge + colorMap", () => {
    const cols = PROJECTIONS.application_list.bodyOverride.columns;
    const syncCol = cols.find(c => c.key === "syncStatus");
    expect(syncCol?.kind).toBe("badge");
    expect(syncCol?.colorMap).toEqual({
      Synced: "success",
      OutOfSync: "warning",
      Unknown: "neutral",
    });

    const healthCol = cols.find(c => c.key === "healthStatus");
    expect(healthCol?.kind).toBe("badge");
    expect(healthCol?.colorMap?.Healthy).toBe("success");
    expect(healthCol?.colorMap?.Degraded).toBe("danger");
    expect(healthCol?.colorMap?.Progressing).toBe("info");

    // Cluster.connectionStatus тоже с badge
    const clusterCols = PROJECTIONS.cluster_list.bodyOverride.columns;
    const connCol = clusterCols.find(c => c.key === "connectionStatus");
    expect(connCol?.kind).toBe("badge");
    expect(connCol?.colorMap?.Successful).toBe("success");
    expect(connCol?.colorMap?.Failed).toBe("danger");
  });

  it("Stage 3 rich seed: 50+ effects (35 base + 20 Stage 5 resources)", () => {
    const effects = getSeedEffects();
    expect(effects.length).toBeGreaterThanOrEqual(50);
    const byTarget = {};
    for (const e of effects) byTarget[e.target] = (byTarget[e.target] || 0) + 1;
    expect(byTarget.Project).toBe(3);
    expect(byTarget.Cluster).toBe(2);
    expect(byTarget.Repository).toBe(5);
    expect(byTarget.Application).toBe(10);
    expect(byTarget.Applicationset).toBe(3);
    expect(byTarget.Gpgkey).toBe(3);
    expect(byTarget.Account).toBe(3);
    expect(byTarget.Certificate).toBe(2);

    // Distribution — все 3 syncStatus представлены
    const apps = effects.filter(e => e.target === "Application");
    const syncStatuses = new Set(apps.map(a => a.context.syncStatus));
    expect(syncStatuses).toEqual(new Set(["Synced", "OutOfSync", "Unknown"]));
    // Health — как минимум 4 состояния из 6
    const healthStatuses = new Set(apps.map(a => a.context.healthStatus));
    expect(healthStatuses.size).toBeGreaterThanOrEqual(4);
  });

  it("Stage 3 fold(seed): world имеет 10 Applications с корректным project FK", () => {
    const world = fold(getSeedEffects());
    expect((world.Application || []).length).toBe(10);
    const payments = (world.Application || []).filter(a => a.project === "p_payments");
    expect(payments.length).toBe(2);
    // connectionStatus для r_legacy = Failed
    const legacy = (world.Repository || []).find(r => r.id === "r_legacy");
    expect(legacy?.connectionStatus).toBe("Failed");
  });

  it("Stage 3 crystallizeV2 не падает на authored catalog projections", () => {
    const derived = deriveProjections(INTENTS, ONTOLOGY);
    const merged = { ...derived };
    for (const [id, authored] of Object.entries(PROJECTIONS)) {
      merged[id] = merged[id] ? { ...merged[id], ...authored } : authored;
    }
    expect(() => crystallizeV2(INTENTS, merged, ONTOLOGY, "argocd")).not.toThrow();
    const artifacts = crystallizeV2(INTENTS, merged, ONTOLOGY, "argocd");
    expect(Object.keys(artifacts).length).toBeGreaterThan(5);
    // application_list body должен быть dataGrid после merge
    expect(artifacts.application_list?.slots?.body?.type).toBe("dataGrid");
  });
});
