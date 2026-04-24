// src/domains/argocd/projections.js
import { deriveProjections } from "@intent-driven/core";
import { ONTOLOGY } from "./ontology.js";
import { INTENTS } from "./intents.js";

/**
 * Stage 3 whitelist — 8 canonical модулей в sidebar вместо 20+ derived
 * catalog'ов (в т.ч. K8s wrapper-types и action-endpoints).
 *
 * ArgoCD Web UI имеет 6 top-level вкладок: Applications / ApplicationSets /
 * Settings (Projects / Clusters / Repositories / GPG Keys / Certificates).
 * Здесь Settings развёрнут в отдельные tab'ы — admin-UX плоская.
 */
const CANONICAL_ENTITIES = [
  "Application", "Applicationset", "Project", "Cluster",
  "Repository", "Certificate", "Gpgkey", "Account",
];

/**
 * DataGrid helper — генерит columns из списка fields + actions-столбец.
 * (Скопировано из Keycloak, G-K-22 workaround.)
 *
 * Stage 4: status-колонки (syncStatus/healthStatus/connectionStatus) —
 * `kind: "badge"` с canonical colorMap. Renderer делегирует в Badge
 * primitive с tone mapping (renderer@0.47+ idf-sdk#293 G-A-3).
 */
const STATUS_COLOR_MAPS = {
  syncStatus: {
    Synced: "success",
    OutOfSync: "warning",
    Unknown: "neutral",
  },
  healthStatus: {
    Healthy: "success",
    Progressing: "info",
    Degraded: "danger",
    Missing: "neutral",
    Suspended: "warning",
    Unknown: "neutral",
  },
  connectionStatus: {
    Successful: "success",
    Failed: "danger",
    Unknown: "neutral",
  },
};

function dgColumns(fieldKeys, fieldDefs = {}) {
  return fieldKeys.map(key => {
    const base = {
      key,
      label: fieldDefs[key]?.label || key,
      sortable: true,
      filterable: true,
    };
    const colorMap = STATUS_COLOR_MAPS[key];
    if (colorMap) {
      return { ...base, kind: "badge", colorMap };
    }
    return base;
  });
}

function dataGridBody(mainEntity, fieldKeys, actionIntents = []) {
  const defs = ONTOLOGY.entities[mainEntity]?.fields || {};
  const cols = dgColumns(fieldKeys, defs);
  if (actionIntents.length > 0) {
    cols.push({
      key: "_actions",
      kind: "actions",
      label: "",
      display: "auto",
      actions: actionIntents.map(({ intent, label, danger, variant }) => ({
        intent,
        label,
        params: { id: "item.id", name: "item.name" },
        danger: !!danger,
        variant,
      })),
    });
  }
  return { type: "dataGrid", source: mainEntity, columns: cols };
}

export const PROJECTIONS = {
  // === Applications ===
  application_list: {
    id: "application_list",
    kind: "catalog",
    title: "Applications",
    mainEntity: "Application",
    intents: ["listApplications"],
    absorbed: false,
    bodyOverride: dataGridBody("Application",
      ["name", "syncStatus", "healthStatus", "project", "namespace", "source", "revision"],
      [
        { intent: "syncApplication", label: "Sync", variant: "primary" },
        { intent: "readApplication", label: "Открыть" },
        { intent: "removeApplication", label: "Удалить", danger: true },
      ]
    ),
  },
  application_detail: {
    id: "application_detail",
    kind: "detail",
    mainEntity: "Application",
    intents: ["readApplication", "updateApplication", "syncApplication",
              "rollbackApplication", "removeApplication"],
    idParam: "name",
    // Stage 7 — tabbedForm для deeply-nested Application.spec (G-A-5
    // host-workaround). Вместо flat formBody с 15+ полями — 5 семантических
    // tabs: Settings / Source / Destination / Sync / Advanced. Покрывает
    // основные ArgoCD Application UI секции (Web-UI "App Details" panel).
    //
    // Поля берутся из SEMANTIC_AUGMENT (ontology.js) + базовые K8s metadata.
    // Полный spec.syncPolicy / spec.source.helm.parameters[] требует SDK PR
    // `yamlEditor` control-archetype (backlog §10.5).
    editBodyOverride: {
      type: "tabbedForm",
      initialTab: "settings",
      tabs: [
        {
          id: "settings",
          title: "Settings",
          fields: [
            { name: "name",         label: "Имя", type: "string", required: true },
            { name: "project",      label: "Проект", type: "entityRef", references: "Project" },
            { name: "namespace",    label: "Namespace", type: "string" },
            { name: "syncStatus",   label: "Sync status",   type: "select",
              options: ["Synced", "OutOfSync", "Unknown"] },
            { name: "healthStatus", label: "Health status", type: "select",
              options: ["Healthy", "Progressing", "Degraded", "Missing", "Suspended", "Unknown"] },
          ],
          onSubmit: { intent: "updateApplication" },
        },
        {
          id: "source",
          title: "Source",
          fields: [
            { name: "source",    label: "Repo URL",   type: "string", placeholder: "https://github.com/acme/platform-gitops" },
            { name: "revision",  label: "Revision",   type: "string", placeholder: "main / HEAD / v1.2.3" },
          ],
          onSubmit: { intent: "updateApplication" },
        },
        {
          id: "destination",
          title: "Destination",
          fields: [
            { name: "server",    label: "Target cluster", type: "string",
              placeholder: "https://kubernetes.default.svc" },
            { name: "namespace", label: "Target namespace", type: "string" },
          ],
          onSubmit: { intent: "updateApplication" },
        },
        {
          id: "sync",
          title: "Sync policy",
          fields: [
            { name: "lastSyncedAt", label: "Last synced", type: "datetime" },
            { name: "revision",     label: "Target revision", type: "string" },
          ],
          onSubmit: { intent: "updateApplication" },
        },
        {
          id: "advanced",
          title: "Advanced (raw)",
          fields: [
            { name: "spec",      label: "spec (raw JSON)",      type: "textarea" },
            { name: "metadata",  label: "metadata (raw JSON)",  type: "textarea" },
            { name: "status",    label: "status (raw, readonly)", type: "textarea", readOnly: true },
          ],
          onSubmit: { intent: "updateApplication" },
        },
      ],
    },
    // Stage 5 — Resource tree subCollection. renderAs:"resourceTree" —
    // host-specific dispatcher (V2Shell::renderSubCollection) рендерит
    // иерархическое дерево с K8s kind-icons и status-badges, вместо плоской
    // table. Fallback на обычный list если renderer не знает dispatcher.
    subCollections: [
      {
        entity: "Resource",
        foreignKey: "applicationId",
        title: "Resources",
        renderAs: { type: "resourceTree" },
        columns: [
          { key: "kind",         label: "Kind", sortable: true, filterable: true },
          { key: "name",         label: "Name", sortable: true, filterable: true },
          { key: "namespace",    label: "Namespace", sortable: true, filterable: true },
          { key: "syncStatus",   label: "Sync",   kind: "badge",
            colorMap: { Synced: "success", OutOfSync: "warning" } },
          { key: "healthStatus", label: "Health", kind: "badge",
            colorMap: {
              Healthy: "success", Progressing: "info", Degraded: "danger",
              Missing: "neutral", Suspended: "warning", Unknown: "neutral",
            } },
        ],
      },
      // Stage 6 — ApplicationCondition timeline (audit-log inline).
      // renderAs:"conditionsTimeline" — новый dispatcher с chronological
      // sort descending + color-coding по type+status severity
      // (SyncError/ComparisonError→danger, Warning→warning, resolved→neutral).
      {
        entity: "ApplicationCondition",
        foreignKey: "applicationId",
        title: "Conditions",
        renderAs: { type: "conditionsTimeline" },
        sort: { key: "lastTransitionTime", order: "desc" },
        columns: [
          { key: "type",    label: "Type",   kind: "badge",
            colorMap: {
              SyncError: "danger", ComparisonError: "danger",
              ValidationFailed: "danger", InvalidSpecError: "danger",
              ResourceHealth: "warning", Deleted: "neutral",
              ExcludedResourceWarning: "info",
              SharedResourceWarning: "info",
              OrphanedResourceWarning: "info",
            } },
          { key: "status",  label: "Active", kind: "badge",
            colorMap: { True: "warning", False: "success", Unknown: "neutral" } },
          { key: "message", label: "Message" },
          { key: "lastTransitionTime", label: "At" },
        ],
      },
    ],
  },

  // === ApplicationSets ===
  applicationset_list: {
    id: "applicationset_list",
    kind: "catalog",
    title: "ApplicationSets",
    mainEntity: "Applicationset",
    intents: ["listApplicationSets"],
    absorbed: false,
    bodyOverride: dataGridBody("Applicationset",
      ["name", "project", "generatorKind"],
      [
        { intent: "readApplicationSet", label: "Открыть" },
        { intent: "removeApplicationSet", label: "Удалить", danger: true },
      ]
    ),
  },

  // === Projects (AppProject) ===
  project_list: {
    id: "project_list",
    kind: "catalog",
    title: "Projects",
    mainEntity: "Project",
    intents: ["listProjects"],
    absorbed: false,
    bodyOverride: dataGridBody("Project",
      ["name", "description", "sourceRepos", "destinations"],
      [
        { intent: "readProject", label: "Открыть" },
        { intent: "removeProject", label: "Удалить", danger: true },
      ]
    ),
  },

  // === Clusters ===
  cluster_list: {
    id: "cluster_list",
    kind: "catalog",
    title: "Clusters",
    mainEntity: "Cluster",
    intents: ["listClusters"],
    absorbed: false,
    bodyOverride: dataGridBody("Cluster",
      ["name", "server", "project", "connectionStatus", "kubernetesVersion"],
      [
        { intent: "rotateClusterAuth", label: "Rotate auth" },
        { intent: "readCluster", label: "Открыть" },
        { intent: "removeCluster", label: "Удалить", danger: true },
      ]
    ),
  },

  // === Repositories ===
  repository_list: {
    id: "repository_list",
    kind: "catalog",
    title: "Repositories",
    mainEntity: "Repository",
    intents: ["listRepositories"],
    absorbed: false,
    bodyOverride: dataGridBody("Repository",
      ["repo", "type", "project", "username", "connectionStatus"],
      [
        { intent: "readRepository", label: "Открыть" },
        { intent: "removeRepository", label: "Удалить", danger: true },
      ]
    ),
  },

  // === Certificates ===
  certificate_list: {
    id: "certificate_list",
    kind: "catalog",
    title: "Certificates",
    mainEntity: "Certificate",
    intents: ["listCertificates"],
    absorbed: false,
  },

  // === GPG Keys ===
  gpgkey_list: {
    id: "gpgkey_list",
    kind: "catalog",
    title: "GPG Keys",
    mainEntity: "Gpgkey",
    intents: ["listGpgkeys"],
    absorbed: false,
    bodyOverride: dataGridBody("Gpgkey",
      ["keyID", "fingerprint", "owner", "subType", "trust"],
      [
        { intent: "readGpgkey", label: "Открыть" },
        { intent: "removeGpgkey", label: "Удалить", danger: true },
      ]
    ),
  },

  // === Accounts ===
  account_list: {
    id: "account_list",
    kind: "catalog",
    title: "Accounts",
    mainEntity: "Account",
    intents: ["listAccounts"],
    absorbed: false,
  },
};

export const ROOT_PROJECTIONS = [
  "application_list",
  "applicationset_list",
  "project_list",
  "cluster_list",
  "repository_list",
  "certificate_list",
  "gpgkey_list",
  "account_list",
];
