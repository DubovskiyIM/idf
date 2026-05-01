// src/domains/gravitino/projections.js
/**
 * Gravitino authored projections — Stage 2 pre-work.
 *
 * 12 catalog + 12 detail для canonical entities (Metalake / Catalog / Schema /
 * Table / Fileset / Topic / Model / User / Group / Role / Tag / Policy).
 * Pattern-bank apply'ит поверх (hierarchy-tree-nav, subCollections, ...).
 *
 * Авторство через helper'ы — compliance-pattern (src/domains/compliance/projections.js).
 *
 * FK-chain. Gravitino REST API идентифицирует parent entity через URL path
 * (`/metalakes/{m}/catalogs/{c}/schemas/{s}/tables/{t}`), а не скалярные
 * FK-поля. После `importer-openapi@0.5.0` (PR idf-sdk#188) importer
 * автоматически синтезирует `<parent>Id` FK-поля с metadata
 * `kind:"foreignKey" + references + synthetic:"openapi-path"`. Это
 * унлочило `hierarchy-tree-nav` pattern и R8 hub-absorption.
 *
 * subCollections.foreignKey используют convention `<parent>Id` —
 * синтетический FK от importer'а. idParam для detail'а использует ту же
 * convention (`metalakeId` ссылка на `item.name`, т.к. Gravitino
 * identifier = name, синтетический FK хранит родительское name).
 *
 * X1-debt: удалить после SDK `@intent-driven/projection-generator`
 * (docs/gravitino-gaps.md G1).
 */

const pluralizeLower = (entity) => {
  const lower = entity.toLowerCase();
  if (lower.endsWith("y")) return `${lower.slice(0, -1)}ies`;
  if (lower.endsWith("s") || lower.endsWith("x") || lower.endsWith("ch") || lower.endsWith("sh")) return `${lower}es`;
  return `${lower}s`;
};

// DataGrid `source` convention совпадает с catalog-archetype default
// (`pluralizeLower(mainEntity)`), после idf-sdk#216 DataGrid primitive
// резолвит items из ctx.world[source] когда node.items пустой.
//
// onItemClick передаёт item.id (а не item.name), потому что
// resolveDetailTarget резолвит detail по `e.id === routeParams[idParam]`.
// Gravitino natural key — name, но он unique только в пределах parent
// (schema "public" может быть в нескольких catalogs), поэтому url-param
// держит uuid. Breadcrumbs должны использовать name как label.
const catalog = (mainEntity, name, witnesses, { onItemClick = true, sort, columns } = {}) => {
  const lower = mainEntity.toLowerCase();
  const clickSpec = onItemClick ? {
    action: "navigate",
    to: `${lower}_detail`,
    params: { [`${lower}Id`]: "item.id" },
  } : null;

  const base = {
    name,
    kind: "catalog",
    mainEntity,
    entities: [mainEntity],
    witnesses,
    ...(sort ? { sort } : {}),
    ...(clickSpec ? { onItemClick: clickSpec } : {}),
  };

  if (columns) {
    base.bodyOverride = {
      type: "dataGrid",
      items: [],
      source: pluralizeLower(mainEntity),
      columns,
      emptyLabel: `Нет данных (${name})`,
      ...(clickSpec ? { onItemClick: clickSpec } : {}),
    };
  }

  return base;
};

const detail = (mainEntity, name, witnesses, subCollections = [], idParam = null) => ({
  name,
  kind: "detail",
  mainEntity,
  entities: [mainEntity, ...subCollections.map(s => s.entity)],
  idParam: idParam ?? `${mainEntity.toLowerCase()}Id`,
  witnesses,
  ...(subCollections.length ? { subCollections } : {}),
});

export const PROJECTIONS = {
  // Host-polish: `audit` (nested object) НЕ включаем в catalog-list
  // witnesses — list-card renderer пытается забиндить object как text →
  // React "Objects are not valid as a child" error. Detail-projections
  // могут включать audit, т.к. buildDetailBody уважает field.primitive
  // hint (propertyPopover) из ontology.js.

  // Columns для 10 простых catalog-list'ов больше не пишем руками — после
  // idf-sdk#224 stable pattern `catalog-default-datagrid.apply` автоматически
  // генерирует dataGrid body с column-synthesis из witnesses +
  // ontology.field.type/values. `projection.bodyOverride` оставляем только
  // для user_list/group_list, где нужна actions-column (gear menu).

  // ═══ Metalake ══════════════════════════════════════════════════════════════
  // metalake_list — host-rendered (U5.5). Заменили SDK dataGrid на
  // <MetalakesHub/> canvas: контролируем Owner avatar/edit, In-Use toggle,
  // Delete с typed-name ConfirmDialog (D6). Click name → navigate в
  // metalake_workspace. Регистрация — registerCanvas("metalake_list",
  // MetalakesHub) в src/standalone.jsx.
  metalake_list: {
    name: "Metalakes",
    kind: "canvas",
    mainEntity: "Metalake",
    entities: ["Metalake", "User", "Group"],
    witnesses: ["name", "comment"],
    description: "Metalake — top-level контейнер метаданных. Внутри каждого metalake: каталоги, схемы, таблицы.",
    body: { kind: "canvas", canvasId: "metalake_list" },
  },
  metalake_detail: detail("Metalake", "Metalake",
    ["name", "comment", "properties", "audit"],
    [{ entity: "Catalog", foreignKey: "metalakeId", title: "Catalogs" }]),

  // metalake_workspace — split-pane catalog explorer для metalake (U2.1).
  // Архетип canvas — host регистрирует <CatalogExplorer/> компонент через
  // registerCanvas("metalake_workspace", ...). Левая панель — tree-explorer
  // catalogs (с tabs filter Relational/Messaging/Fileset/Model + search),
  // правая — таблица catalogs или selected catalog detail.
  //
  // Entry: клик по metalake_list row (см. onItemClick выше). Прямой URL —
  // /gravitino/metalake_workspace?metalakeId=<uuid>.
  metalake_workspace: {
    name: "Workspace",
    kind: "canvas",
    mainEntity: "Metalake",
    entities: ["Metalake", "Catalog", "Schema"],
    idParam: "metalakeId",
    witnesses: ["name"],
    body: { kind: "canvas", canvasId: "metalake_workspace" },
  },

  // access_hub — navigation-hub для IAM (U2.6 — A6 закрытие).
  // 3 tiles: Users / Groups / Roles. Inner projections остаются доступны
  // через direct URL (/gravitino/user_list), клик по tile навигирует туда же.
  access_hub: {
    name: "Access",
    kind: "canvas",
    mainEntity: "User",
    entities: ["User", "Group", "Role"],
    witnesses: [],
    body: { kind: "canvas", canvasId: "access_hub" },
  },

  // compliance_hub — navigation-hub для metadata-governance (U2.6 — A7).
  // 2 tiles: Tags / Policies.
  compliance_hub: {
    name: "Data Compliance",
    kind: "canvas",
    mainEntity: "Tag",
    entities: ["Tag", "Policy"],
    witnesses: [],
    body: { kind: "canvas", canvasId: "compliance_hub" },
  },

  // jobs_hub — top-nav root для Jobs/Templates section (U7 — A8 закрытие).
  // Canvas: <JobsHub/> с tabs Jobs / Templates.
  jobs_hub: {
    name: "Jobs",
    kind: "canvas",
    mainEntity: "Job",
    entities: ["Job", "JobTemplate"],
    witnesses: [],
    body: { kind: "canvas", canvasId: "jobs_hub" },
  },

  // ═══ Catalog ═══════════════════════════════════════════════════════════════
  // type: relational/fileset/messaging/model; provider: hive/iceberg/...
  catalog_list: catalog("Catalog", "Catalogs",
    ["name", "type", "provider", "comment"]),
  catalog_detail: detail("Catalog", "Catalog",
    ["name", "type", "provider", "comment", "properties", "audit"],
    [{ entity: "Schema", foreignKey: "catalogId", title: "Schemas" }]),

  // ═══ Schema ════════════════════════════════════════════════════════════════
  // Schema — child Catalog; сам является parent'ом для Table/Fileset/Topic/Model.
  schema_list: catalog("Schema", "Schemas",
    ["name", "comment"]),
  schema_detail: detail("Schema", "Schema",
    ["name", "comment", "properties", "audit"],
    [
      { entity: "Table", foreignKey: "schemaId", title: "Tables" },
      { entity: "Fileset", foreignKey: "schemaId", title: "Filesets" },
      { entity: "Topic", foreignKey: "schemaId", title: "Topics" },
      { entity: "Model", foreignKey: "schemaId", title: "Models" },
    ]),

  // ═══ Table ═════════════════════════════════════════════════════════════════
  // Table несёт columns (nested json), partitioning, distribution, indexes.
  table_list: catalog("Table", "Tables",
    ["name", "comment"]),
  table_detail: detail("Table", "Table",
    ["name", "comment", "columns", "partitioning", "distribution",
     "sortOrders", "indexes", "properties", "audit"]),

  // ═══ Fileset ═══════════════════════════════════════════════════════════════
  fileset_list: catalog("Fileset", "Filesets",
    ["name", "type", "storageLocation", "comment"]),
  fileset_detail: detail("Fileset", "Fileset",
    ["name", "type", "storageLocation", "comment", "properties"]),

  // ═══ Topic ═════════════════════════════════════════════════════════════════
  topic_list: catalog("Topic", "Topics",
    ["name", "comment"]),
  topic_detail: detail("Topic", "Topic",
    ["name", "comment", "properties"]),

  // ═══ Model ═════════════════════════════════════════════════════════════════
  // latestVersion — counter. Model содержит ModelVersion как children.
  model_list: catalog("Model", "Models",
    ["name", "latestVersion", "comment"]),
  model_detail: detail("Model", "Model",
    ["name", "latestVersion", "comment", "properties", "audit"],
    [{ entity: "ModelVersion", foreignKey: "modelId", title: "Versions" }]),

  // ═══ User ══════════════════════════════════════════════════════════════════
  // roles — json array (имена Role entities). В list не показываем —
  // catalog-archetype не уважает field.primitive hint (chipList), упадёт
  // на object children. Видны на detail через ChipList.
  //
  // Actions column (idf-sdk#218 col.kind:"actions" + #222 display modes):
  // 3 actions → auto-mode схлопывает в ⚙ dropdown (gear icon). Grant/Revoke
  // Role + Remove User. `user` param совпадает с OpenAPI path {user}.
  user_list: catalog("User", "Users",
    ["name"], {
      columns: [
        { key: "name", label: "Name", sortable: true, filterable: true },
        {
          key: "_actions",
          label: "Actions",
          kind: "actions",
          icon: "gear",
          menuLabel: "User actions",
          actions: [
            { intent: "grantRoleToUser", label: "Grant Role",
              params: { user: "item.name" } },
            { intent: "revokeRoleFromUser", label: "Revoke Role",
              params: { user: "item.name" } },
            { intent: "removeUser", label: "Delete",
              params: { user: "item.name" }, danger: true },
          ],
        },
      ],
    }),
  user_detail: detail("User", "User",
    ["name", "roles", "audit"]),

  // ═══ Group ═════════════════════════════════════════════════════════════════
  group_list: catalog("Group", "Groups",
    ["name"], {
      columns: [
        { key: "name", label: "Name", sortable: true, filterable: true },
        {
          key: "_actions",
          label: "Actions",
          kind: "actions",
          icon: "gear",
          menuLabel: "Group actions",
          actions: [
            { intent: "grantRoleToGroup", label: "Grant Role",
              params: { group: "item.name" } },
            { intent: "revokeRoleFromGroup", label: "Revoke Role",
              params: { group: "item.name" } },
            { intent: "removeGroup", label: "Delete",
              params: { group: "item.name" }, danger: true },
          ],
        },
      ],
    }),
  group_detail: detail("Group", "Group",
    ["name", "roles", "audit"]),

  // ═══ Role ══════════════════════════════════════════════════════════════════
  // securableObjects — matrix, только на detail. properties — json,
  // popover только на detail.
  //
  // role_list имеет только 1 witness (name) — ниже порога pattern apply
  // (trigger требует ≥2 witnesses), поэтому остаётся default card-layout.
  // Acceptable: у Role ещё нет других scalar полей для column-display.
  role_list: catalog("Role", "Roles",
    ["name"]),
  role_detail: detail("Role", "Role",
    ["name", "securableObjects", "properties"]),

  // ═══ Tag ═══════════════════════════════════════════════════════════════════
  tag_list: catalog("Tag", "Tags",
    ["name", "comment", "inherited"]),
  tag_detail: detail("Tag", "Tag",
    ["name", "comment", "inherited", "properties", "audit"]),

  // ═══ Policy ════════════════════════════════════════════════════════════════
  // После idf-sdk#227 flattenSchema — importer сливает PolicyBase +
  // CustomPolicy (allOf) + Policy (oneOf) в единый entity с полями
  // name / comment / policyType / enabled / audit / inherited / content.
  // Host enrichment в ontology.js снят.
  policy_list: catalog("Policy", "Policies",
    ["name", "policyType", "enabled", "comment"]),
  policy_detail: detail("Policy", "Policy", ["name", "policyType", "enabled", "comment", "content", "audit", "inherited"]),
};

export const ROOT_PROJECTIONS = [
  // Top-level nav: metalake (hierarchy entry) + jobs_hub + 2 hubs (access / compliance).
  // Inner projections (user_list/group_list/role_list/tag_list/policy_list)
  // остаются accessible через direct URL и через tiles внутри hubs (U2.6).
  // Структура соответствует gravitino/web-v2 nav grouping (U7 — A8 закрытие).
  "metalake_list",
  "jobs_hub",
  "access_hub",
  "compliance_hub",
];
