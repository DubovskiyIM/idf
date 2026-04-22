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
  // ═══ Metalake ══════════════════════════════════════════════════════════════
  // Metalake — root сущности Gravitino. Witness'ы: name (primary-title),
  // comment (long-text), audit (creator/createTime nested).
  metalake_list: catalog("Metalake", "Metalakes",
    ["name", "comment", "audit"]),
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
    ["name", "comment", "audit"]),
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
    ["name", "comment", "audit"]),
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
    ["name", "latestVersion", "comment", "audit"]),
  model_detail: detail("Model", "Model",
    ["name", "latestVersion", "comment", "properties", "audit"],
    [{ entity: "ModelVersion", foreignKey: "modelId", title: "Versions" }]),

  // ═══ User ══════════════════════════════════════════════════════════════════
  // roles — json array (имена Role entities).
  user_list: catalog("User", "Users",
    ["name", "roles", "audit"]),
  user_detail: detail("User", "User",
    ["name", "roles", "audit"]),

  // ═══ Group ═════════════════════════════════════════════════════════════════
  group_list: catalog("Group", "Groups",
    ["name", "roles", "audit"]),
  group_detail: detail("Group", "Group",
    ["name", "roles", "audit"]),

  // ═══ Role ══════════════════════════════════════════════════════════════════
  // securableObjects — json, privileges matrix.
  role_list: catalog("Role", "Roles",
    ["name", "securableObjects", "properties"]),
  role_detail: detail("Role", "Role",
    ["name", "securableObjects", "properties"]),

  // ═══ Tag ═══════════════════════════════════════════════════════════════════
  tag_list: catalog("Tag", "Tags",
    ["name", "comment", "inherited", "audit"]),
  tag_detail: detail("Tag", "Tag",
    ["name", "comment", "inherited", "properties", "audit"]),

  // ═══ Policy ════════════════════════════════════════════════════════════════
  // Policy в canonical ontology имеет только `id` (остальные атрибуты в
  // PolicyBase/PolicyMetadata subtypes — не склеены importer'ом как single
  // entity). Witness — минимальный.
  policy_list: catalog("Policy", "Policies", ["id"]),
  policy_detail: detail("Policy", "Policy", ["id"]),
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
