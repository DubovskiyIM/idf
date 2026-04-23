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

const catalog = (mainEntity, name, witnesses, { onItemClick = true, sort } = {}) => ({
  name,
  kind: "catalog",
  mainEntity,
  entities: [mainEntity],
  witnesses,
  ...(sort ? { sort } : {}),
  ...(onItemClick ? {
    onItemClick: {
      action: "navigate",
      to: `${mainEntity.toLowerCase()}_detail`,
      params: { [`${mainEntity.toLowerCase()}Id`]: "item.name" },
    },
  } : {}),
});

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
    ["name", "comment"]),
  metalake_detail: detail("Metalake", "Metalake",
    ["name", "comment", "properties", "audit"],
    [{ entity: "Catalog", foreignKey: "metalakeId", title: "Catalogs" }]),

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
  user_list: catalog("User", "Users",
    ["name"]),
  user_detail: detail("User", "User",
    ["name", "roles", "audit"]),

  // ═══ Group ═════════════════════════════════════════════════════════════════
  group_list: catalog("Group", "Groups",
    ["name"]),
  group_detail: detail("Group", "Group",
    ["name", "roles", "audit"]),

  // ═══ Role ══════════════════════════════════════════════════════════════════
  // securableObjects — matrix, только на detail. properties — json,
  // popover только на detail.
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
  // Importer G32 не склеил PolicyBase/PolicyMetadata — host ontology.js
  // enrichment добавляет синтетические visible fields (name/type/enabled/
  // comment/content/audit). Используем их в projections.
  policy_list: catalog("Policy", "Policies", ["name", "type", "enabled", "comment"]),
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
