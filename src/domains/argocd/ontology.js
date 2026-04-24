// src/domains/argocd/ontology.js
import { ontology as imported } from "./imported.js";

/**
 * Stage 2 host-workaround для G-A-1 (K8s CRD naming merge).
 *
 * importer-openapi@0.11 создаёт две отдельные entities на K8s CRD:
 *   - path-derived `Application` (fields:{id}, kind:internal) — из URL pattern
 *     `/api/v1/applications/{name}` через entityNameFromPath.
 *   - schema-derived `v1alpha1Application` (4 поля, kind:embedded) — из
 *     `#/definitions/v1alpha1.Application` через schemaToEntity.
 *
 * Host-level merge map: короткое имя ← полная v-сущность. Поля копируются,
 * kind переводится в "internal", v-сущность остаётся как embedded для
 * wrapper-refs (`v1alpha1ApplicationList.items[]`).
 *
 * G-A-6 также: после swagger2openapi конверсии все $ref-поля K8s CRD
 * теряют типизацию, становятся `{type: "string"}`. Для Stage 3 DataGrid
 * и Stage 4 statusBadge нужны плоские semantic fields — добавляем их
 * через SEMANTIC_AUGMENT ниже (syncStatus / healthStatus / project / ...).
 */
const K8S_CRD_MERGE = {
  Application:    "v1alpha1Application",
  Cluster:        "v1alpha1Cluster",
  Project:        "v1alpha1AppProject",
  Repository:     "v1alpha1Repository",
  Applicationset: "v1alpha1ApplicationSet",
  Gpgkey:         "v1alpha1GnuPGPublicKey",
  Certificate:    "v1alpha1RepositoryCertificate",
  Repocred:       "v1alpha1RepoCreds",
  Account:        "accountAccount",
  Session:        "sessionSessionResponse",
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
  for (const [shortName, fullName] of Object.entries(K8S_CRD_MERGE)) {
    const full = entities[fullName];
    if (!full) continue;
    const stub = entities[shortName] || { name: shortName, fields: {} };
    const augment = SEMANTIC_AUGMENT[shortName] || {};
    merged[shortName] = {
      ...stub,
      name: shortName,
      fields: {
        ...full.fields,
        ...stub.fields,   // id-stub побеждает поле с тем же именем
        ...augment,       // semantic augmentation имеет абсолютный приоритет
      },
      kind: "internal",
      label: stub.label || shortName,
    };
  }
  return merged;
}

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
  entities: mergeK8sCrds(imported.entities),
  roles: ARGOCD_ROLES,
  invariants: imported.invariants || [],
  features: {
    ...imported.features,
    preferDataGrid: true,
  },
};
