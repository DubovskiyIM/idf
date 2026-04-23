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

  // ═══ Metalake ══════════════════════════════════════════════════════════════
  metalake_list: catalog("Metalake", "Metalakes",
    ["name", "comment"], {
      columns: [
        { key: "name",    label: "Name",    sortable: true, filterable: true },
        { key: "comment", label: "Comment", filterable: true },
      ],
    }),
  metalake_detail: detail("Metalake", "Metalake",
    ["name", "comment", "properties", "audit"],
    [{ entity: "Catalog", foreignKey: "metalakeId", title: "Catalogs" }]),

  // ═══ Catalog ═══════════════════════════════════════════════════════════════
  // type: relational/fileset/messaging/model; provider: hive/iceberg/...
  //
  // bodyOverride: DataGrid primitive с sort+filter per column (G20/G21/G38).
  // После merge idf-sdk#216 (DataGrid source resolution) — grid пуллит items
  // из ctx.world[source] когда node.items пустой.
  catalog_list: catalog("Catalog", "Catalogs",
    ["name", "type", "provider", "comment"], {
      columns: [
        { key: "name",     label: "Name",     sortable: true, filterable: true },
        { key: "type",     label: "Type",     sortable: true, filter: "enum",
          values: ["relational", "messaging", "fileset", "model"] },
        { key: "provider", label: "Provider", sortable: true, filterable: true },
        { key: "comment",  label: "Comment",  filterable: true },
      ],
    }),
  catalog_detail: detail("Catalog", "Catalog",
    ["name", "type", "provider", "comment", "properties", "audit"],
    [{ entity: "Schema", foreignKey: "catalogId", title: "Schemas" }]),

  // ═══ Schema ════════════════════════════════════════════════════════════════
  // Schema — child Catalog; сам является parent'ом для Table/Fileset/Topic/Model.
  schema_list: catalog("Schema", "Schemas",
    ["name", "comment"], {
      columns: [
        { key: "name",    label: "Name",    sortable: true, filterable: true },
        { key: "comment", label: "Comment", filterable: true },
      ],
    }),
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
    ["name", "comment"], {
      columns: [
        { key: "name",    label: "Name",    sortable: true, filterable: true },
        { key: "comment", label: "Comment", filterable: true },
      ],
    }),
  table_detail: detail("Table", "Table",
    ["name", "comment", "columns", "partitioning", "distribution",
     "sortOrders", "indexes", "properties", "audit"]),

  // ═══ Fileset ═══════════════════════════════════════════════════════════════
  fileset_list: catalog("Fileset", "Filesets",
    ["name", "type", "storageLocation", "comment"], {
      columns: [
        { key: "name",            label: "Name",             sortable: true, filterable: true },
        { key: "type",            label: "Type",             sortable: true, filter: "enum",
          values: ["managed", "external"] },
        { key: "storageLocation", label: "Storage Location", filterable: true },
        { key: "comment",         label: "Comment",          filterable: true },
      ],
    }),
  fileset_detail: detail("Fileset", "Fileset",
    ["name", "type", "storageLocation", "comment", "properties"]),

  // ═══ Topic ═════════════════════════════════════════════════════════════════
  topic_list: catalog("Topic", "Topics",
    ["name", "comment"], {
      columns: [
        { key: "name",    label: "Name",    sortable: true, filterable: true },
        { key: "comment", label: "Comment", filterable: true },
      ],
    }),
  topic_detail: detail("Topic", "Topic",
    ["name", "comment", "properties"]),

  // ═══ Model ═════════════════════════════════════════════════════════════════
  // latestVersion — counter. Model содержит ModelVersion как children.
  model_list: catalog("Model", "Models",
    ["name", "latestVersion", "comment"], {
      columns: [
        { key: "name",          label: "Name",           sortable: true, filterable: true },
        { key: "latestVersion", label: "Latest Version", sortable: true },
        { key: "comment",       label: "Comment",        filterable: true },
      ],
    }),
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
  role_list: catalog("Role", "Roles",
    ["name"], {
      columns: [
        { key: "name", label: "Name", sortable: true, filterable: true },
      ],
    }),
  role_detail: detail("Role", "Role",
    ["name", "securableObjects", "properties"]),

  // ═══ Tag ═══════════════════════════════════════════════════════════════════
  tag_list: catalog("Tag", "Tags",
    ["name", "comment", "inherited"], {
      columns: [
        { key: "name",      label: "Name",      sortable: true, filterable: true },
        { key: "comment",   label: "Comment",   filterable: true },
        { key: "inherited", label: "Inherited", sortable: true, filter: "enum",
          values: [true, false] },
      ],
    }),
  tag_detail: detail("Tag", "Tag",
    ["name", "comment", "inherited", "properties", "audit"]),

  // ═══ Policy ════════════════════════════════════════════════════════════════
  // Importer G32 не склеил PolicyBase/PolicyMetadata — host ontology.js
  // enrichment добавляет синтетические visible fields (name/type/enabled/
  // comment/content/audit). Используем их в projections.
  policy_list: catalog("Policy", "Policies",
    ["name", "type", "enabled", "comment"], {
      columns: [
        { key: "name",    label: "Name",    sortable: true, filterable: true },
        { key: "type",    label: "Type",    sortable: true, filterable: true },
        { key: "enabled", label: "Enabled", sortable: true, filter: "enum",
          values: [true, false] },
        { key: "comment", label: "Comment", filterable: true },
      ],
    }),
  policy_detail: detail("Policy", "Policy", ["name", "type", "enabled", "comment", "content", "audit"]),
};

export const ROOT_PROJECTIONS = [
  // Top-level nav: metalake (hierarchy root), user/group/role (IAM surface),
  // tag/policy (metadata governance). catalog/schema/table/fileset/topic/model
  // доступны через drilldown из metalake_detail → ... (absorbedBy R8 если
  // FK chain matched; иначе — временно через direct nav).
  "metalake_list",
  "user_list",
  "group_list",
  "role_list",
  "tag_list",
  "policy_list",
];
