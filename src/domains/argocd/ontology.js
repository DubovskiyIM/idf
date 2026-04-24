// src/domains/argocd/ontology.js
import { ontology as imported } from "./imported.js";

/**
 * G-A-1 ✅ partially CLOSED (importer-openapi@0.13.0): `mergeK8sCrdDuplicates`
 * в reimport script auto-мёрджит regex-matching пары (Application ←
 * v1alpha1Application, Cluster ← v1alpha1Cluster, Repository ←
 * v1alpha1Repository, Applicationset ← v1alpha1ApplicationSet).
 *
 * Остаются host-override'ы для semantic-alias pairs (path-name ≠
 * schema-name), которые regex не ловит:
 *   Project     ← v1alpha1AppProject      (path 'Project' ≠ schema 'AppProject')
 *   Gpgkey      ← v1alpha1GnuPGPublicKey  (path 'Gpgkey' ≠ schema 'GnuPGPublicKey')
 *   Certificate ← v1alpha1RepositoryCertificate
 *   Repocred    ← v1alpha1RepoCreds
 *   Account     ← accountAccount           (не K8s CRD)
 *   Session     ← sessionSessionResponse   (не K8s CRD)
 *
 * G-A-6 (Swagger 2.0 type-loss) остаётся open — SEMANTIC_AUGMENT
 * декларирует плоские semantic fields поверх nested spec.
 */
const K8S_CRD_MERGE = {
  Project:     "v1alpha1AppProject",
  Gpgkey:      "v1alpha1GnuPGPublicKey",
  Certificate: "v1alpha1RepositoryCertificate",
  Repocred:    "v1alpha1RepoCreds",
  Account:     "accountAccount",
  Session:     "sessionSessionResponse",
};

/**
 * Stage 3 augmentation — плоские semantic поля для UI (G-A-6 workaround).
 *
 * Without this, DataGrid columns и statusBadge primitive нечего рендерить:
 * все deeply-nested `spec.source.*` и `status.sync.status` у importer'а
 * схлопнуты до type:"string". Host объявляет denormalized projection —
 * rich seed (Stage 3) и server (Stage 4+) их наполняют.
 *
 * `fieldRole` подсказывает rendererу роль (name/status/uri/namespace) —
 * это активирует правильный primitive через inferFieldRole.
 */
const SEMANTIC_AUGMENT = {
  Application: {
    name:          { type: "text", label: "Имя", fieldRole: "name" },
    project:       { type: "entityRef", kind: "foreignKey", references: "Project", label: "Проект" },
    namespace:     { type: "text", label: "Namespace" },
    server:        { type: "text", label: "Destination", fieldRole: "uri" },
    source:        { type: "text", label: "Source URL", fieldRole: "uri" },
    revision:      { type: "text", label: "Revision" },
    syncStatus:    {
      type: "select",
      label: "Sync",
      options: ["Synced", "OutOfSync", "Unknown"],
      fieldRole: "status",
    },
    healthStatus:  {
      type: "select",
      label: "Health",
      options: ["Healthy", "Progressing", "Degraded", "Missing", "Suspended", "Unknown"],
      fieldRole: "status",
    },
    lastSyncedAt:  { type: "datetime", label: "Last sync", fieldRole: "datetime" },
  },
  Project: {
    name:          { type: "text", label: "Имя", fieldRole: "name" },
    description:   { type: "textarea", label: "Описание" },
    sourceRepos:   { type: "text", label: "Allowed source repos" },
    destinations:  { type: "text", label: "Allowed destinations" },
  },
  Cluster: {
    name:          { type: "text", label: "Имя", fieldRole: "name" },
    server:        { type: "text", label: "API URL", fieldRole: "uri" },
    project:       { type: "entityRef", kind: "foreignKey", references: "Project", label: "Проект" },
    connectionStatus: {
      type: "select",
      label: "Connection",
      options: ["Successful", "Failed", "Unknown"],
      fieldRole: "status",
    },
    kubernetesVersion: { type: "text", label: "K8s version" },
  },
  Repository: {
    repo:          { type: "text", label: "URL", fieldRole: "uri" },
    type:          { type: "select", label: "Type", options: ["git", "helm", "oci"] },
    project:       { type: "entityRef", kind: "foreignKey", references: "Project", label: "Проект" },
    connectionStatus: {
      type: "select",
      label: "Connection",
      options: ["Successful", "Failed", "Unknown"],
      fieldRole: "status",
    },
    username:      { type: "text", label: "Username" },
  },
  Applicationset: {
    name:          { type: "text", label: "Имя", fieldRole: "name" },
    project:       { type: "entityRef", kind: "foreignKey", references: "Project", label: "Проект" },
    generatorKind: {
      type: "select",
      label: "Generator",
      options: ["List", "Cluster", "Git", "Matrix", "Merge", "SCMProvider"],
    },
  },
};

function mergeK8sCrds(entities) {
  const merged = { ...entities };
  // Phase 1: host semantic-alias merge (path-name ≠ schema-name pairs).
  for (const [shortName, fullName] of Object.entries(K8S_CRD_MERGE)) {
    const full = entities[fullName];
    if (!full) continue;
    const stub = entities[shortName] || { name: shortName, fields: {} };
    merged[shortName] = {
      ...stub,
      name: shortName,
      fields: {
        ...full.fields,
        ...stub.fields,   // id-stub побеждает поле с тем же именем
      },
      kind: "internal",
      label: stub.label || shortName,
    };
  }
  // Phase 2: SEMANTIC_AUGMENT applied к любой entity (включая auto-merged
  // через SDK mergeK8sCrdDuplicates). G-A-6 workaround — плоские поля
  // поверх type:"string" полей после Swagger 2→3.
  for (const [shortName, augment] of Object.entries(SEMANTIC_AUGMENT)) {
    const base = merged[shortName];
    if (!base) continue;
    merged[shortName] = {
      ...base,
      fields: { ...base.fields, ...augment },
    };
  }
  return merged;
}

/**
 * Stage 5 — Resource entity как child-коллекция Application.
 *
 * G-A-4 (inline-children gap): в реальном ArgoCD API `Application.status.
 * resources[]` — inline массив K8s объектов (Deployment/Service/Pod/
 * ReplicaSet) под Application. Это structurally "children", но в
 * OpenAPI-контракте — inline field, не отдельная collection через FK.
 *
 * Importer'у такая форма не видна (schemaToEntity не извлекает inline
 * arrays как entity). Host декларирует синтетическую Resource entity
 * с `applicationId` FK для рендера через subCollections + `renderAs:
 * "resourceTree"` dispatcher. Когда SDK добавит inline-children primitive
 * (backlog G-A-4), host может убрать FK и вернуться к естественной
 * модели.
 *
 * fields:
 *   kind:          K8s kind (Deployment/Service/Pod/ReplicaSet/ConfigMap/Secret/...)
 *   name:          resource name
 *   namespace:     K8s namespace
 *   group:         API group (apps/v1, v1, networking.k8s.io/v1, ...)
 *   syncStatus:    Synced/OutOfSync (из Application.status.resources[i].status)
 *   healthStatus:  Healthy/Degraded/Progressing/... (из health.status)
 *   parentResource: опциональная FK на родителя (Deployment → ReplicaSet → Pod)
 */
const RESOURCE_ENTITY = {
  name: "Resource",
  label: "K8s Resource",
  kind: "internal",
  ownerField: "applicationId",
  fields: {
    id:            { type: "text" },
    applicationId: { type: "entityRef", kind: "foreignKey", references: "Application", label: "Application" },
    kind:          { type: "text", label: "Kind", fieldRole: "name" },
    name:          { type: "text", label: "Name", fieldRole: "name" },
    namespace:     { type: "text", label: "Namespace" },
    group:         { type: "text", label: "API group" },
    syncStatus: {
      type: "select",
      label: "Sync",
      options: ["Synced", "OutOfSync"],
      fieldRole: "status",
    },
    healthStatus: {
      type: "select",
      label: "Health",
      options: ["Healthy", "Progressing", "Degraded", "Missing", "Suspended", "Unknown"],
      fieldRole: "status",
    },
    parentResource: { type: "entityRef", kind: "foreignKey", references: "Resource", label: "Parent" },
  },
};

/**
 * Stage 6 — ApplicationCondition как child-коллекция Application
 * (audit-log-like timeline).
 *
 * G-A-4 (inline-children gap — второй шаг): в реальном ArgoCD
 * `Application.status.conditions[]` — inline массив с `{type, status,
 * message, lastTransitionTime}`. Те же limitations: importer не видит
 * inline arrays → host synthetic FK.
 *
 * Типичные types: SyncError / ComparisonError / ResourceHealth / Deleted /
 * ValidationFailed / ExcludedResourceWarning / SharedResourceWarning.
 * Status: True (active) / False (resolved) / Unknown.
 *
 * Renderer через renderAs:{type:"conditionsTimeline"} — color-coded
 * events по severity (type) с chronological sort descending.
 */
const APPLICATION_CONDITION_ENTITY = {
  name: "ApplicationCondition",
  label: "Application Condition",
  kind: "internal",
  ownerField: "applicationId",
  fields: {
    id:            { type: "text" },
    applicationId: { type: "entityRef", kind: "foreignKey", references: "Application", label: "Application" },
    type: {
      type: "select",
      label: "Type",
      options: [
        "SyncError", "ComparisonError", "ResourceHealth",
        "Deleted", "ValidationFailed",
        "ExcludedResourceWarning", "SharedResourceWarning",
        "OrphanedResourceWarning", "InvalidSpecError",
      ],
      fieldRole: "status",
    },
    status: {
      type: "select",
      label: "Status",
      options: ["True", "False", "Unknown"],
      fieldRole: "status",
    },
    message:            { type: "textarea", label: "Message" },
    lastTransitionTime: { type: "datetime", label: "Last transition", fieldRole: "datetime" },
  },
};

const ARGOCD_ROLES = {
  admin: {
    name: "Администратор",
    base: "admin",
    description: "Полный доступ ко всему кластеру (argocd-admin)",
  },
  developer: {
    name: "Разработчик",
    base: "owner",
    description: "Создание и настройка Applications в своих проектах",
  },
  deployer: {
    name: "Деплоер",
    base: "owner",
    description: "Запуск sync/rollback/refresh без прав на конфигурацию",
  },
  viewer: {
    name: "Viewer",
    base: "viewer",
    description: "Read-only доступ к applications / clusters / projects",
  },
  auditor: {
    name: "Аудитор",
    base: "viewer",
    description: "Read-only + доступ к events/conditions timeline",
  },
};

export const ONTOLOGY = {
  entities: {
    ...mergeK8sCrds(imported.entities),
    Resource: RESOURCE_ENTITY,
    ApplicationCondition: APPLICATION_CONDITION_ENTITY,
  },
  roles: ARGOCD_ROLES,
  invariants: imported.invariants || [],
  features: {
    ...imported.features,
    preferDataGrid: true,
  },
};
