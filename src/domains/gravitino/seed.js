import { v4 as uuid } from "uuid";

/**
 * Seed Gravitino-домена — rich demo dataset для visual walkthrough.
 *
 * Coverage:
 *   - 3 metalakes (prod / staging / dev) с разным environment
 *   - 9 catalogs, все 4 type (relational / messaging / fileset / model),
 *     провайдеры hive / lakehouse-iceberg / kafka / hadoop / model-registry
 *   - 12 schemas (2-3 per non-messaging catalog)
 *   - 14 tables с rich columns (varchar(N) / decimal(P,S) / timestamp / enum)
 *   - 5 filesets (raw logs, landing zones, data lakes)
 *   - 4 kafka topics
 *   - 4 ML models с latestVersion counters
 *   - 6 users (admin/engineers/analysts) + 4 groups + 6 roles
 *   - 5 tags (PII / Financial / Deprecated / GDPR / Internal)
 *   - 4 policies (masking / retention / access-control / quality)
 *   - 8 grant records (role assignments)
 *
 * Все FK соответствуют synthetic <parent>Id convention от importer-openapi
 * (metalakeId / catalogId / schemaId) — видны в TreeNav и subCollection
 * sections.
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

  const audit = (creator, daysAgo = 30) => {
    const ts = new Date(now - daysAgo * 86400e3).toISOString();
    return {
      creator,
      createTime: ts,
      lastModifier: creator,
      lastModifiedTime: new Date(now - (daysAgo - 1) * 86400e3).toISOString(),
    };
  };

  // ═══ Metalakes ══════════════════════════════════════════════════════════
  const METALAKES = [
    { id: "m_prod",    name: "prod_lake",    comment: "Production metadata lake — регулируемые данные", properties: { env: "prod", "compliance.tier": "tier-1", "owner.team": "data-platform", "region": "eu-central-1" }, audit: audit("alice@acme", 120) },
    { id: "m_staging", name: "staging_lake", comment: "Pre-prod staging для валидации schemas", properties: { env: "staging", "auto-promotion": "true", "retention.days": "30" }, audit: audit("bob@acme", 80) },
    { id: "m_dev",     name: "dev_lake",     comment: "Development sandbox для экспериментов", properties: { env: "dev", "owner.team": "engineering" }, audit: audit("charlie@acme", 45) },
  ];
  METALAKES.forEach(m => ef("metalakes", m));

  // ═══ Catalogs ════════════════════════════════════════════════════════════
  const CATALOGS = [
    // Prod
    { id: "c_hive_prod",    name: "hive_warehouse",   type: "relational", provider: "hive",             comment: "Hive on S3 — analytics warehouse",            properties: { "uri": "thrift://hms.prod:9083", "warehouse.dir": "s3://prod-warehouse" }, metalakeId: "m_prod", audit: audit("alice@acme", 90) },
    { id: "c_iceberg_prod", name: "iceberg_lakehouse", type: "relational", provider: "lakehouse-iceberg", comment: "Iceberg REST catalog — ACID tables",         properties: { "uri": "https://iceberg-rest.prod", "catalog-type": "rest", "s3.bucket": "prod-iceberg" }, metalakeId: "m_prod", audit: audit("alice@acme", 60) },
    { id: "c_jdbc_prod",    name: "analytics_jdbc",   type: "relational", provider: "jdbc-postgresql",  comment: "Postgres через JDBC — operational data",      properties: { "jdbc.url": "jdbc:postgresql://prod-pg:5432/analytics", "jdbc.user": "readonly" }, metalakeId: "m_prod", audit: audit("alice@acme", 45) },
    { id: "c_fs_prod",      name: "raw_landing",      type: "fileset",    provider: "hadoop",           comment: "S3 landing zone для external feeds",           properties: { "location": "s3://prod-landing", "default.location-provider": "s3" }, metalakeId: "m_prod", audit: audit("alice@acme", 100) },
    // Staging
    { id: "c_iceberg_stg",  name: "iceberg_staging",  type: "relational", provider: "lakehouse-iceberg", comment: "Staging Iceberg — promotion pipeline",       properties: { "uri": "https://iceberg-rest.staging" }, metalakeId: "m_staging", audit: audit("bob@acme", 70) },
    { id: "c_kafka_stg",    name: "events_stream",    type: "messaging",  provider: "kafka",            comment: "Kafka staging cluster",                        properties: { "bootstrap.servers": "stg-kafka:9092", "security.protocol": "SASL_SSL" }, metalakeId: "m_staging", audit: audit("bob@acme", 55) },
    { id: "c_model_stg",    name: "ml_registry",      type: "model",      provider: "model-registry",   comment: "Model registry для ML experiments",            properties: { "registry.uri": "https://mlflow.staging" }, metalakeId: "m_staging", audit: audit("charlie@acme", 40) },
    // Dev
    { id: "c_fs_dev",       name: "s3_sandbox",       type: "fileset",    provider: "hadoop",           comment: "Dev sandbox для ad-hoc datasets",              properties: { "location": "s3://dev-sandbox" }, metalakeId: "m_dev", audit: audit("bob@acme", 25) },
    { id: "c_kafka_dev",    name: "dev_kafka",        type: "messaging",  provider: "kafka",            comment: "Dev Kafka для локальных экспериментов",        properties: { "bootstrap.servers": "dev-kafka:9092" }, metalakeId: "m_dev", audit: audit("charlie@acme", 20) },
  ];
  CATALOGS.forEach(c => ef("catalogs", c));

  // ═══ Schemas ═════════════════════════════════════════════════════════════
  const SCHEMAS = [
    // hive_warehouse
    { id: "s_sales",       name: "sales",       comment: "Sales & revenue fact tables",          properties: { "owner": "analytics", "pii": "true" }, catalogId: "c_hive_prod",    audit: audit("alice@acme", 85) },
    { id: "s_marketing",   name: "marketing",   comment: "Marketing attribution data",            properties: { "owner": "marketing-analytics" },      catalogId: "c_hive_prod",    audit: audit("alice@acme", 78) },
    { id: "s_finance",     name: "finance",     comment: "Financial ledger & reports",            properties: { "owner": "finance", "confidential": "true" }, catalogId: "c_hive_prod", audit: audit("diane@acme", 70) },
    // iceberg_lakehouse
    { id: "s_clicks",      name: "clicks",      comment: "Iceberg clickstream — partitioned by date", properties: { "partition-spec": "event_date" }, catalogId: "c_iceberg_prod", audit: audit("alice@acme", 50) },
    { id: "s_inventory",   name: "inventory",   comment: "Real-time inventory changes",           properties: { "mode": "streaming" },              catalogId: "c_iceberg_prod", audit: audit("diane@acme", 42) },
    // analytics_jdbc
    { id: "s_crm",         name: "crm",         comment: "CRM operational tables (read-only)",    properties: { "readonly": "true" },               catalogId: "c_jdbc_prod",    audit: audit("bob@acme",   35) },
    // raw_landing (fileset)
    { id: "s_external",    name: "external",    comment: "External vendor feeds",                 properties: {},                                     catalogId: "c_fs_prod",      audit: audit("alice@acme", 95) },
    // iceberg_staging
    { id: "s_staging_etl", name: "etl",         comment: "Staging ETL output",                    properties: {},                                     catalogId: "c_iceberg_stg",  audit: audit("bob@acme",   65) },
    // ml_registry
    { id: "s_ml_models",   name: "production",  comment: "Production ML models namespace",        properties: {},                                     catalogId: "c_model_stg",    audit: audit("charlie@acme", 30) },
    { id: "s_ml_exp",      name: "experiments", comment: "Experimentation namespace",             properties: {},                                     catalogId: "c_model_stg",    audit: audit("charlie@acme", 15) },
    // dev_kafka
    { id: "s_dev_events",  name: "events",      comment: "Dev event streams",                     properties: {},                                     catalogId: "c_kafka_dev",    audit: audit("charlie@acme", 12) },
    // s3_sandbox
    { id: "s_dev_sandbox", name: "sandbox",     comment: "Personal dev sandboxes",                properties: {},                                     catalogId: "c_fs_dev",       audit: audit("charlie@acme", 10) },
  ];
  SCHEMAS.forEach(s => ef("schemas", s));

  // ═══ Tables (с rich columns) ═══════════════════════════════════════════
  const COL_FACT_ORDERS = [
    { name: "order_id",    type: "bigint",    nullable: false, comment: "Surrogate PK" },
    { name: "customer_id", type: "bigint",    nullable: false, comment: "FK → dim_customer" },
    { name: "product_sku", type: "varchar",   length: 64, nullable: false },
    { name: "quantity",    type: "integer",   nullable: false },
    { name: "unit_price",  type: "decimal",   precision: 12, scale: 2, nullable: false, comment: "USD" },
    { name: "gross_amount",type: "decimal",   precision: 14, scale: 2, nullable: false },
    { name: "discount_pct",type: "decimal",   precision: 5, scale: 2,  nullable: true },
    { name: "currency",    type: "char",      length: 3, nullable: false, comment: "ISO-4217" },
    { name: "order_status",type: "varchar",   length: 16, nullable: false, comment: "pending/paid/shipped/refunded" },
    { name: "order_ts",    type: "timestamp", nullable: false },
    { name: "channel",     type: "varchar",   length: 32 },
  ];
  const COL_DIM_CUSTOMER = [
    { name: "customer_id", type: "bigint",    nullable: false, comment: "Surrogate PK" },
    { name: "email",       type: "varchar",   length: 320, nullable: false, comment: "PII" },
    { name: "first_name",  type: "varchar",   length: 100 },
    { name: "last_name",   type: "varchar",   length: 100 },
    { name: "birth_date",  type: "date",      comment: "PII — masked in views" },
    { name: "country",     type: "char",      length: 2,   comment: "ISO-3166" },
    { name: "tier",        type: "varchar",   length: 16,  comment: "bronze/silver/gold/platinum" },
    { name: "created_at",  type: "timestamp", nullable: false },
    { name: "updated_at",  type: "timestamp" },
  ];
  const COL_DIM_PRODUCT = [
    { name: "sku",         type: "varchar",   length: 64, nullable: false },
    { name: "name",        type: "varchar",   length: 256, nullable: false },
    { name: "category",    type: "varchar",   length: 64 },
    { name: "price",       type: "decimal",   precision: 10, scale: 2 },
    { name: "weight_kg",   type: "decimal",   precision: 6, scale: 3 },
    { name: "launched_at", type: "date" },
  ];
  const COL_CAMPAIGNS = [
    { name: "campaign_id", type: "bigint",   nullable: false },
    { name: "name",        type: "varchar",  length: 200, nullable: false },
    { name: "channel",     type: "varchar",  length: 32,  comment: "email/push/social/display" },
    { name: "budget",      type: "decimal",  precision: 14, scale: 2 },
    { name: "start_date",  type: "date",     nullable: false },
    { name: "end_date",    type: "date" },
    { name: "target_audience", type: "varchar", length: 128 },
  ];
  const COL_ATTRIBUTION = [
    { name: "event_id",   type: "bigint",    nullable: false },
    { name: "user_id",    type: "bigint",    nullable: false },
    { name: "campaign_id",type: "bigint" },
    { name: "channel",    type: "varchar",   length: 32 },
    { name: "attributed_revenue", type: "decimal", precision: 12, scale: 2 },
    { name: "event_ts",   type: "timestamp", nullable: false },
  ];
  const COL_LEDGER = [
    { name: "entry_id",  type: "bigint",    nullable: false },
    { name: "account",   type: "varchar",   length: 64 },
    { name: "debit",     type: "decimal",   precision: 16, scale: 2 },
    { name: "credit",    type: "decimal",   precision: 16, scale: 2 },
    { name: "currency",  type: "char",      length: 3 },
    { name: "posted_at", type: "timestamp", nullable: false },
    { name: "period",    type: "varchar",   length: 8, comment: "YYYYMM" },
  ];
  const COL_CLICKS = [
    { name: "click_id",  type: "bigint",    nullable: false },
    { name: "user_id",   type: "bigint",    nullable: false },
    { name: "url",       type: "varchar",   length: 2048, nullable: false },
    { name: "referrer",  type: "varchar",   length: 2048 },
    { name: "ip",        type: "varchar",   length: 45 },
    { name: "user_agent",type: "varchar",   length: 512 },
    { name: "session_id",type: "varchar",   length: 64 },
    { name: "event_ts",  type: "timestamp", nullable: false },
  ];
  const COL_INVENTORY = [
    { name: "sku",       type: "varchar",   length: 64, nullable: false },
    { name: "warehouse", type: "varchar",   length: 32 },
    { name: "qty_on_hand", type: "integer", nullable: false },
    { name: "last_count_at", type: "timestamp" },
  ];
  const COL_CRM = [
    { name: "contact_id",type: "bigint",    nullable: false },
    { name: "email",     type: "varchar",   length: 320, comment: "PII" },
    { name: "phone",     type: "varchar",   length: 32,  comment: "PII" },
    { name: "status",    type: "varchar",   length: 16 },
    { name: "owner",     type: "varchar",   length: 100 },
    { name: "created_at",type: "timestamp" },
  ];

  const TABLES = [
    { id: "t_fact_orders",   name: "fact_orders",   comment: "Order fact — grain: order_line",    properties: { "location": "s3://prod-warehouse/sales/fact_orders", "format": "parquet" }, columns: COL_FACT_ORDERS,   schemaId: "s_sales",      audit: audit("alice@acme", 80) },
    { id: "t_dim_customer",  name: "dim_customer",  comment: "Customer SCD-1 dimension",          properties: { "scd-type": "1" },                                                         columns: COL_DIM_CUSTOMER,  schemaId: "s_sales",      audit: audit("alice@acme", 75) },
    { id: "t_dim_product",   name: "dim_product",   comment: "Product catalog dimension",         properties: {},                                                                          columns: COL_DIM_PRODUCT,   schemaId: "s_sales",      audit: audit("alice@acme", 70) },
    { id: "t_campaigns",     name: "campaigns",     comment: "Marketing campaign master",         properties: {},                                                                          columns: COL_CAMPAIGNS,     schemaId: "s_marketing",  audit: audit("alice@acme", 60) },
    { id: "t_attribution",   name: "attribution",   comment: "Multi-touch attribution fact",      properties: {},                                                                          columns: COL_ATTRIBUTION,   schemaId: "s_marketing",  audit: audit("alice@acme", 55) },
    { id: "t_gl_ledger",     name: "gl_ledger",     comment: "General ledger — finance source of truth", properties: { "audit-lock": "true" },                                             columns: COL_LEDGER,        schemaId: "s_finance",    audit: audit("diane@acme", 65) },
    { id: "t_clicks_2026",   name: "clicks_2026",   comment: "Clickstream 2026 — Iceberg partitioned by event_date", properties: { "partition-by": "date(event_ts)" },                    columns: COL_CLICKS,        schemaId: "s_clicks",     audit: audit("alice@acme", 45) },
    { id: "t_inventory_live",name: "inventory_live",comment: "Live inventory (Iceberg streaming)", properties: { "streaming": "true" },                                                   columns: COL_INVENTORY,     schemaId: "s_inventory",  audit: audit("diane@acme", 40) },
    { id: "t_crm_contacts",  name: "contacts",      comment: "CRM contacts (readonly mirror)",    properties: { "mirror-of": "crm.contacts" },                                             columns: COL_CRM,           schemaId: "s_crm",        audit: audit("bob@acme",   30) },
  ];
  TABLES.forEach(t => ef("tables", t));

  // ═══ Filesets ═══════════════════════════════════════════════════════════
  const FILESETS = [
    { id: "fs_vendor_raw",  name: "vendor_raw",  type: "MANAGED",  storageLocation: "s3://prod-landing/vendor-feeds", comment: "Raw vendor feeds (unparsed)", properties: {}, schemaId: "s_external",    audit: audit("alice@acme", 90) },
    { id: "fs_events_raw",  name: "events_raw",  type: "EXTERNAL", storageLocation: "s3://prod-landing/events",       comment: "External event feeds",       properties: {}, schemaId: "s_external",    audit: audit("alice@acme", 85) },
    { id: "fs_dev_scratch", name: "scratch",     type: "MANAGED",  storageLocation: "s3://dev-sandbox/scratch",       comment: "Dev scratch space",            properties: {}, schemaId: "s_dev_sandbox", audit: audit("charlie@acme", 8) },
    { id: "fs_dev_imports", name: "imports",     type: "EXTERNAL", storageLocation: "s3://dev-sandbox/imports",       comment: "Dev external imports",         properties: {}, schemaId: "s_dev_sandbox", audit: audit("charlie@acme", 5) },
  ];
  FILESETS.forEach(fs => ef("filesets", fs));

  // ═══ Topics (Kafka) ═════════════════════════════════════════════════════
  const TOPICS = [
    { id: "top_orders",      name: "orders",       comment: "Order events (prod kafka)",   properties: { "partitions": 24, "retention.ms": "604800000" }, schemaId: "s_dev_events",  audit: audit("charlie@acme", 18) },
    { id: "top_inventory",   name: "inventory",    comment: "Inventory change events",     properties: { "partitions": 12 },                               schemaId: "s_dev_events",  audit: audit("charlie@acme", 15) },
    { id: "top_audit",       name: "audit_log",    comment: "Application audit log stream",properties: { "partitions": 6, "cleanup.policy": "compact" }, schemaId: "s_dev_events",  audit: audit("charlie@acme", 10) },
  ];
  TOPICS.forEach(t => ef("topics", t));

  // ═══ Models (ML Registry) ══════════════════════════════════════════════
  const MODELS = [
    { id: "mdl_price_opt",    name: "price_optimizer",    comment: "Dynamic pricing via GBM",           latestVersion: 7,  properties: { "framework": "xgboost" },      schemaId: "s_ml_models", audit: audit("alice@acme",   50) },
    { id: "mdl_churn",        name: "churn_predictor",    comment: "Customer churn propensity (deep)",  latestVersion: 3,  properties: { "framework": "pytorch" },      schemaId: "s_ml_models", audit: audit("charlie@acme", 40) },
    { id: "mdl_fraud",        name: "fraud_detector",     comment: "Real-time fraud detection",         latestVersion: 12, properties: { "framework": "onnx" },         schemaId: "s_ml_models", audit: audit("diane@acme",   35) },
    { id: "mdl_recommender",  name: "product_recsys",     comment: "Collaborative filter recommender",  latestVersion: 2,  properties: { "framework": "tensorflow" },   schemaId: "s_ml_exp",    audit: audit("charlie@acme", 14) },
  ];
  MODELS.forEach(m => ef("models", m));

  // ═══ Users ══════════════════════════════════════════════════════════════
  const USERS = [
    { id: "u_alice",   name: "alice@acme",   roles: ["admin", "data_owner"],        audit: audit("system", 365) },
    { id: "u_bob",     name: "bob@acme",     roles: ["data_engineer"],              audit: audit("system", 300) },
    { id: "u_charlie", name: "charlie@acme", roles: ["data_engineer", "mlops"],     audit: audit("system", 200) },
    { id: "u_diane",   name: "diane@acme",   roles: ["finance_analyst"],            audit: audit("system", 180) },
    { id: "u_eve",     name: "eve@acme",     roles: ["analyst"],                    audit: audit("system", 90) },
    { id: "u_frank",   name: "frank@acme",   roles: ["data_viewer"],                audit: audit("system", 60) },
  ];
  USERS.forEach(u => ef("users", u));

  // ═══ Groups ═════════════════════════════════════════════════════════════
  const GROUPS = [
    { id: "g_analytics",   name: "analytics",   roles: ["analyst", "data_viewer"],       audit: audit("system", 250) },
    { id: "g_platform",    name: "platform",    roles: ["admin", "data_engineer"],       audit: audit("system", 300) },
    { id: "g_finance",     name: "finance",     roles: ["finance_analyst", "data_viewer"], audit: audit("system", 200) },
    { id: "g_ml",          name: "ml",          roles: ["data_engineer", "mlops"],       audit: audit("system", 180) },
  ];
  GROUPS.forEach(g => ef("groups", g));

  // ═══ Roles (с securable objects) ════════════════════════════════════════
  const ROLES = [
    { id: "r_admin",           name: "admin",            securableObjects: [{ type: "metalake", name: "*", privileges: ["*"] }],                                                                                       properties: {}, audit: audit("system", 365) },
    { id: "r_data_owner",      name: "data_owner",       securableObjects: [
      { type: "catalog", name: "hive_warehouse",  privileges: ["select", "modify", "create", "delete"] },
      { type: "catalog", name: "iceberg_lakehouse", privileges: ["select", "modify"] },
    ], properties: {}, audit: audit("system", 300) },
    { id: "r_data_engineer",   name: "data_engineer",    securableObjects: [
      { type: "catalog", name: "*",               privileges: ["select", "modify", "create"] },
      { type: "schema",  name: "*",               privileges: ["select", "modify"] },
    ], properties: {}, audit: audit("system", 250) },
    { id: "r_analyst",         name: "analyst",          securableObjects: [
      { type: "schema",  name: "sales",           privileges: ["select"] },
      { type: "schema",  name: "marketing",       privileges: ["select"] },
    ], properties: {}, audit: audit("system", 200) },
    { id: "r_finance_analyst", name: "finance_analyst",  securableObjects: [
      { type: "schema",  name: "finance",         privileges: ["select"] },
      { type: "schema",  name: "sales",           privileges: ["select"] },
    ], properties: { "compliance.required": "true" }, audit: audit("system", 180) },
    { id: "r_data_viewer",     name: "data_viewer",      securableObjects: [{ type: "schema", name: "*", privileges: ["select"] }], properties: {}, audit: audit("system", 150) },
    { id: "r_mlops",           name: "mlops",            securableObjects: [
      { type: "catalog", name: "ml_registry",     privileges: ["select", "modify", "create", "delete"] },
    ], properties: {}, audit: audit("system", 120) },
  ];
  ROLES.forEach(r => ef("roles", r));

  // ═══ Tags ═══════════════════════════════════════════════════════════════
  const TAGS = [
    { id: "tag_pii",        name: "PII",        comment: "Personally identifiable information (GDPR/CCPA)",  properties: { "auto-mask": "true", "compliance": "gdpr,ccpa" }, inherited: true,  audit: audit("alice@acme",   100) },
    { id: "tag_financial",  name: "Financial",  comment: "Financial / accounting data (SOX controls)",       properties: { "compliance": "sox" },                             inherited: true,  audit: audit("diane@acme",   80) },
    { id: "tag_gdpr",       name: "GDPR",       comment: "Subject to GDPR article 30 record",               properties: { "region": "eu" },                                  inherited: true,  audit: audit("alice@acme",   70) },
    { id: "tag_internal",   name: "Internal",   comment: "Internal use only — не share с вендорами",        properties: {},                                                  inherited: false, audit: audit("alice@acme",   50) },
    { id: "tag_deprecated", name: "Deprecated", comment: "Планируется к удалению — не строить новые зависимости", properties: {},                                           inherited: false, audit: audit("bob@acme",     20) },
  ];
  TAGS.forEach(t => ef("tags", t));

  // ═══ Policies ═══════════════════════════════════════════════════════════
  // После idf-sdk#227 importer сливает PolicyBase → Policy: поле
  // называется `policyType` (из PolicyBase.policyType), не `type`.
  const POLICIES = [
    { id: "pol_pii_mask",    name: "pii-mask",             policyType: "data_masking",   enabled: true,  inherited: false, comment: "Mask PII columns at read",              content: { columns: ["email", "ssn", "phone", "dob", "birth_date", "first_name", "last_name"], algorithm: "format-preserving" }, audit: audit("alice@acme", 110) },
    { id: "pol_retention",   name: "retention-365d",       policyType: "data_lifecycle", enabled: true,  inherited: false, comment: "Delete after 365 days",                 content: { days: 365, action: "hard_delete" },                                                                                audit: audit("alice@acme", 105) },
    { id: "pol_finance_acl", name: "finance-restricted",   policyType: "access_control", enabled: true,  inherited: false, comment: "Finance schemas — только finance group", content: { allow: ["finance", "admin"], deny: ["*"] },                                                                        audit: audit("diane@acme", 85) },
    { id: "pol_quality",     name: "quality-checks",       policyType: "quality",        enabled: true,  inherited: true,  comment: "Automated data quality checks — freshness + completeness", content: { freshness_hours: 24, completeness_threshold: 0.95 },                                  audit: audit("bob@acme",   40) },
    { id: "pol_disabled",    name: "legacy-masking",       policyType: "data_masking",   enabled: false, inherited: false, comment: "Disabled — superseded by pii-mask v2",  content: {},                                                                                                                  audit: audit("bob@acme",   200) },
  ];
  POLICIES.forEach(p => ef("policies", p));

  return effects;
}
