import { v4 as uuid } from "uuid";

/**
 * Seed Gravitino-домена для dev/demo режима.
 *
 * Fit-for-purpose sample data: 2 metalakes × 2 catalogs × 2 schemas ×
 * 2 tables + sample filesets/topics/models/users/groups/roles/tags/policies.
 * Цель: показать иерархическую навигацию (Metalake → Catalog → Schema →
 * Table) — breadcrumbs / treeNav / subCollections получают реальные
 * instances для рендера.
 *
 * FK-синтез от importer-openapi@0.5.0 даёт <parent>Id поля на nested
 * entities (Catalog.metalakeId → Metalake, Schema.catalogId → Catalog,
 * Table.schemaId → Schema). Seed заполняет их consistent ID'ами.
 */
export function getSeedEffects() {
  const now = Date.now();
  const effects = [];
  const ef = (target, context) => effects.push({
    id: uuid(),
    intent_id: "_seed",
    alpha: "add",
    scope: "account",
    parent_id: null,
    status: "confirmed",
    ttl: null,
    created_at: now,
    resolved_at: now,
    target,
    context,
  });

  const audit = (creator) => ({
    creator, createTime: new Date(now).toISOString(),
    lastModifier: creator, lastModifiedTime: new Date(now).toISOString(),
  });

  // ═══ Metalakes ══════════════════════════════════════════════════════════
  const METALAKES = [
    { id: "m_prod", name: "prod_lake", comment: "Production metadata lake — PII sensitive", properties: { env: "prod", "compliance.tier": "tier-1" }, audit: audit("alice@acme") },
    { id: "m_dev",  name: "dev_lake",  comment: "Development sandbox",                       properties: { env: "dev" },                                   audit: audit("bob@acme") },
  ];
  METALAKES.forEach(m => ef("metalakes", m));

  // ═══ Catalogs (Metalake → Catalog) ═══════════════════════════════════════
  const CATALOGS = [
    { id: "c_hive_prod",    name: "hive_warehouse",   type: "relational", provider: "hive",             comment: "Hive on S3", properties: { "uri": "thrift://hms.prod:9083" },             metalakeId: "m_prod", audit: audit("alice@acme") },
    { id: "c_iceberg_prod", name: "iceberg_lakehouse", type: "relational", provider: "lakehouse-iceberg", comment: "Iceberg REST catalog", properties: { "uri": "https://iceberg-rest.prod" }, metalakeId: "m_prod", audit: audit("alice@acme") },
    { id: "c_kafka_dev",    name: "events_kafka",     type: "messaging",  provider: "kafka",            comment: "Kafka for event streams", properties: { "bootstrap.servers": "dev-kafka:9092" }, metalakeId: "m_dev", audit: audit("bob@acme") },
    { id: "c_fs_dev",       name: "s3_files",         type: "fileset",    provider: "hadoop",           comment: "Fileset catalog над S3",  properties: { "location": "s3://dev-datalake" },     metalakeId: "m_dev", audit: audit("bob@acme") },
  ];
  CATALOGS.forEach(c => ef("catalogs", c));

  // ═══ Schemas (Catalog → Schema) ══════════════════════════════════════════
  const SCHEMAS = [
    { id: "s_sales",     name: "sales",     comment: "Sales domain tables",           properties: { "owner": "analytics" }, catalogId: "c_hive_prod",    audit: audit("alice@acme") },
    { id: "s_marketing", name: "marketing", comment: "Marketing attribution",         properties: {},                       catalogId: "c_hive_prod",    audit: audit("alice@acme") },
    { id: "s_clicks",    name: "clicks",    comment: "Iceberg clicks",                properties: {},                       catalogId: "c_iceberg_prod", audit: audit("alice@acme") },
    { id: "s_logs",      name: "logs",      comment: "Application logs",              properties: {},                       catalogId: "c_fs_dev",       audit: audit("bob@acme") },
  ];
  SCHEMAS.forEach(s => ef("schemas", s));

  // ═══ Tables (Schema → Table) ═════════════════════════════════════════════
  const TABLES = [
    { id: "t_fact_sales",    name: "fact_sales",    comment: "Fact table for sales events",  properties: { "location": "s3://warehouse/sales/fact_sales" }, schemaId: "s_sales",     audit: audit("alice@acme") },
    { id: "t_dim_customer",  name: "dim_customer",  comment: "Customer dimension",           properties: {},                                                 schemaId: "s_sales",     audit: audit("alice@acme") },
    { id: "t_campaigns",     name: "campaigns",     comment: "Marketing campaigns",          properties: {},                                                 schemaId: "s_marketing", audit: audit("alice@acme") },
    { id: "t_clicks_2026",   name: "clicks_2026",   comment: "Iceberg partitioned by date",  properties: {},                                                 schemaId: "s_clicks",    audit: audit("alice@acme") },
  ];
  TABLES.forEach(t => ef("tables", t));

  // ═══ Filesets / Topics / Models ══════════════════════════════════════════
  ef("filesets", { id: "fs_raw_logs", name: "raw_logs", type: "MANAGED", storageLocation: "s3://dev-datalake/raw/logs", comment: "Raw unparsed logs", properties: {}, schemaId: "s_logs", audit: audit("bob@acme") });
  ef("topics", { id: "top_events", name: "events", comment: "Application events topic", properties: { "partitions": 12 }, schemaId: "s_logs", audit: audit("bob@acme") });
  ef("models", { id: "mdl_price_opt", name: "price_optimizer", comment: "Linear pricing model", latestVersion: 3, properties: {}, schemaId: "s_sales", audit: audit("alice@acme") });

  // ═══ Access control ═════════════════════════════════════════════════════
  const USERS = [
    { id: "u_alice", name: "alice@acme", roles: ["admin", "data_owner"],       audit: audit("system") },
    { id: "u_bob",   name: "bob@acme",   roles: ["data_engineer"],             audit: audit("system") },
    { id: "u_charlie", name: "charlie@acme", roles: ["analyst"],               audit: audit("system") },
  ];
  USERS.forEach(u => ef("users", u));

  const GROUPS = [
    { id: "g_analytics",  name: "analytics",  roles: ["analyst", "data_viewer"], audit: audit("system") },
    { id: "g_platform",   name: "platform",   roles: ["admin", "data_engineer"], audit: audit("system") },
  ];
  GROUPS.forEach(g => ef("groups", g));

  const ROLES = [
    { id: "r_admin",       name: "admin",         securableObjects: [{ type: "metalake", name: "*", privileges: ["*"] }], properties: {}, audit: audit("system") },
    { id: "r_data_owner",  name: "data_owner",    securableObjects: [{ type: "catalog",  name: "hive_warehouse", privileges: ["select", "modify"] }], properties: {}, audit: audit("system") },
    { id: "r_analyst",     name: "analyst",       securableObjects: [{ type: "schema",   name: "sales", privileges: ["select"] }], properties: {}, audit: audit("system") },
    { id: "r_data_viewer", name: "data_viewer",   securableObjects: [{ type: "schema",   name: "*", privileges: ["select"] }], properties: {}, audit: audit("system") },
  ];
  ROLES.forEach(r => ef("roles", r));

  // ═══ Data compliance: Tags + Policies ════════════════════════════════════
  const TAGS = [
    { id: "tag_pii",         name: "PII",            comment: "Contains personally identifiable information", properties: {}, inherited: true,  audit: audit("alice@acme") },
    { id: "tag_financial",   name: "Financial",      comment: "Financial / accounting data",                  properties: {}, inherited: true,  audit: audit("alice@acme") },
    { id: "tag_deprecated",  name: "Deprecated",     comment: "Scheduled for removal",                        properties: {}, inherited: false, audit: audit("bob@acme") },
  ];
  TAGS.forEach(t => ef("tags", t));

  const POLICIES = [
    { id: "pol_pii_mask",   name: "pii-mask",        type: "data_masking",   enabled: true,  comment: "Mask PII columns at read", content: { columns: ["email", "ssn", "dob"] }, audit: audit("alice@acme") },
    { id: "pol_retention",  name: "retention-365d",  type: "data_lifecycle", enabled: true,  comment: "Delete after 365 days",    content: { days: 365 },                          audit: audit("alice@acme") },
  ];
  POLICIES.forEach(p => ef("policies", p));

  return effects;
}
