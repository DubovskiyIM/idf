#!/usr/bin/env node
/**
 * Pattern Bank batch для метадата-каталогов / governance-систем (gravitino-like).
 *
 * Охват: 3 эталонных системы:
 *   MLflow      — model registry + experiment tracking (run-centric)
 *   DataHub     — federated metadata graph с lineage
 *   Unity Catalog — Databricks 3-tier governance (catalog/schema/object)
 *
 * Использует pattern-researcher.mjs (Phase 1-2-3). По аналогии с
 * uncovered-domains-pattern-batch.mjs.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESEARCHER = join(__dirname, "pattern-researcher.mjs");

const SOURCES = [
  {
    name: "mlflow-tracking",
    archetype: "dashboard",
    description: `MLflow (web UI + Python/REST API, 2025-2026). Эталон ML lifecycle platform: experiment tracking + model registry + model serving. Open-source (Databricks). Один из 2-3 базовых стандартов в data/ML stack.

Иерархия сущностей:
- Experiment — namespace для серии runs (один эксперимент = одна задача / hyper-search).
- Run — конкретное выполнение тренировки. Содержит: parameters, metrics (time-series), tags, artifacts (model, plots, datasets), source code version.
- Registered Model — именованный артефакт в Model Registry с версиями.
- Model Version — конкретная версия (semver-like number) с promotion stages.
- Stage / Alias (новое API) — Production / Staging / Archived (legacy) или alias-based (champion / challenger).

Главный экран Experiments:
- Левый sidebar: дерево experiments с поиском и фильтрами.
- Центр: таблица runs внутри experiment. Колонки: Run Name + Created + Duration + User + Source + Models + Status + параметры + метрики (выбираются динамически).
- Compare runs — checkbox-multiselect → "Compare" button → screen с parallel-coordinates plot, scatter, contour, parallel metrics chart.
- Filter bar: SQL-like query "metrics.accuracy > 0.9 AND params.lr < 0.01".
- Sort by metric — кликаешь header → ASC/DESC.
- Add chart panel: scatter / parallel / line / bar — over runs.

Run Detail page:
- Hero: run name, status (FINISHED / FAILED / RUNNING), start/end time, source code commit hash + link.
- Tabs: Overview / Parameters / Metrics / Artifacts / Tags / Source / Notes.
- Metrics — time-series графики (epoch × metric value) с overlay на other runs.
- Artifacts — file tree (model.pkl, requirements.txt, conda.yaml, plots/*.png, dataset signatures).
- Click на artifact → preview (image, text, json).
- "Register Model" CTA — promote run-output в Model Registry с указанием model name.

Model Registry main:
- Список registered models. Карточка: name + latest versions per stage + last updated + tags.
- Search by name / tag.

Registered Model detail:
- Header: name + description + tags + owners.
- Versions table: Version + Status (Stage/Alias) + Source Run + Created + Last Modified + signatures.
- Click version → Version Detail с lineage до source run.
- Stage transition (legacy): button "Transition to Staging/Production/Archived" с request-for-comment workflow если включены model-stage-permissions.
- Aliases (новое): assign / remove alias (champion / challenger / latest) — N-to-N.
- Compare versions side-by-side (signatures, metrics).

Model Version detail:
- Hero: model name + version number + alias chips + stage badge.
- Source: link to producing run + commit hash + dataset.
- Schema: input/output signatures (column name + type).
- Inference example: code-snippet (Python / REST curl) — copy-paste.
- Serving info: deployed endpoints (если есть), latency stats.

Artifacts viewer:
- Generic file tree.
- Specialized renderers: prediction trace (для LLMs), evaluation table, dataset profile.

Compare experiments / runs:
- Multi-run plot: parallel coordinates по выбранным params/metrics.
- Diff view — какие parameters различаются.
- Tabular diff — column per run.

Search всё:
- Top search bar: "model:my_model version:>=3" / "tag:production" / "metric:accuracy>0.85".
- Across experiments / runs / models.

Workflows / API:
- mlflow.start_run() context manager в коде → создаёт run, ловит params/metrics/artifacts.
- mlflow.log_param/log_metric/log_artifact — primitives.
- MLflow Projects — packaged code (MLproject yaml).
- MLflow Models — стандартный формат (flavors: sklearn, pytorch, transformers, ...).
- MLflow Recipes (legacy: Pipelines) — opinionated workflow.

Permissions (Databricks-managed MLflow):
- Per-experiment / per-model ACL: CAN_READ / CAN_EDIT / CAN_MANAGE.
- Stage transition approvals для production.

Lineage:
- Run → Models (run produced model versions).
- Model → Run (model came from run).
- Dataset → Run (run consumed dataset).
- Visualised в Databricks UC; в open-source MLflow через tags.

Роли: ML engineer (run author, model registrar), reviewer (approver of stage transition), serving operator (deploys models), observer (read-only stakeholder), system (CI pipeline).

Ключевые intent'ы: create_experiment, log_run, log_param, log_metric, log_artifact, register_model, transition_model_stage (legacy), assign_model_alias, compare_runs, search_runs, deploy_model, archive_model_version, attach_run_to_dataset, set_run_tag, restore_deleted_experiment.

Эталон. Run-centric tracking (run = primary record). Metric time-series как first-class data. Compare-N-runs (parallel coordinates) как primary analytical surface. Model Registry с stages/aliases (alias-based — modern). Artifact tree с typed renderers. SQL-like query bar поверх runs. Lineage Run ↔ Model ↔ Dataset.`,
  },
  {
    name: "datahub-metadata",
    archetype: "catalog",
    description: `DataHub (web UI + GraphQL/REST + Kafka, 2025-2026). Эталон federated metadata graph. Open-source от LinkedIn / Acryl Data. Конкурирует с Atlas, Collibra, Alation.

Концептуальная модель:
- Entity types: Dataset, Dashboard, Chart, DataFlow, DataJob, MLModel, MLFeature, Glossary Term, Domain, Container (Database/Schema/Folder), Tag, CorpUser, CorpGroup.
- Aspects (composable metadata facets per entity): Ownership, Documentation, Schema, Tags, GlossaryTerms, Domains, Lineage, Status, Deprecation, DataQuality, Usage, Operations.
- Relationships: hasOwner, downstreamOf (lineage), partOf (container), associatedWith (term), classifiedAs (tag).
- URN format: urn:li:dataset:(urn:li:dataPlatform:snowflake,DB.schema.table,PROD).

Search (главная функция):
- Top search bar fronted by Elasticsearch.
- Auto-complete с group-by-type (Datasets / Dashboards / Terms / People).
- Advanced search: filter chips по type, platform, env, tag, term, owner, domain.
- Search ranking учитывает usage stats и pagerank-like score по lineage.

Dataset Detail (главный entity-screen):
- Hero: name + platform icon + environment (PROD / DEV) + path breadcrumb (database > schema > table).
- Health badge: deprecated / has-incident / freshness-stale.
- Tabs: Schema / Documentation / Lineage / Properties / Queries / Stats / Validation / Operations / Access.
- Schema tab: nested column tree с types, descriptions, column-level tags / glossary terms / business owners.
- Lineage tab — graph viewer:
  - Upstream (источники) ← current → Downstream (потребители).
  - Узлы — datasets/jobs/dashboards с typed icons.
  - Column-level lineage — раскрытие колонки с подсветкой path-через-systems.
  - Filter: depth, hop count, type filter, time range.
- Properties: key-value pairs (custom + auto-extracted).
- Queries: SQL-snippets, частота, top users.
- Stats: row count, size, null %, distinct values per column over time.
- Validation: assertions (Great Expectations / dbt tests) с pass/fail history.
- Operations: when written, frequency, partition info.

Glossary (business terms):
- Hierarchical taxonomy: Term Group → Term → child terms.
- Каждый term — своя detail-page с definition, related terms, applied to datasets/columns.
- Approval workflow: Term Proposal → Approve/Reject.

Domains:
- Business domains для группировки assets ("Marketing", "Finance", "Customer 360").
- Каждый domain имеет owner team и связанные assets.

Tags:
- Lightweight labels (PII, deprecated, high-quality).
- Можно навесить на любой entity и колонку.

Ownership & Roles:
- Per-entity owners по типам: Technical Owner, Business Owner, Data Steward, Data Producer, Consumer.
- Группы (CorpGroup) и пользователи (CorpUser).
- Inheritance: container owns schema → schema owns tables (suggested, не enforced).

Lineage в деталях:
- Table-level lineage: автоматический ingestion (Snowflake query history, dbt manifest, Airflow DAG, BI tools).
- Column-level lineage из dbt manifests, Snowflake access_history, BigQuery information_schema.
- Sibling links — same logical entity на разных платформах (Iceberg в S3 + Snowflake external table).

Posts / Announcements:
- Embedded blog — команда платформы постит изменения, deprecation notices.
- Pinned to home + entity pages.

Actions framework:
- Slack notification on incident.
- Auto-tag PII по data classifier.
- Auto-deprecation если table не запрашивалась 90 days.
- Custom actions через GraphQL events.

Ingestion:
- Recipes (yaml) — connectors к Snowflake / Redshift / BigQuery / Postgres / Kafka / Airflow / dbt / Looker / Tableau / PowerBI / Mode / Hive.
- UI-based ingestion editor + scheduling.
- CLI ingest для CI pipelines.

Permissions (RBAC):
- Roles: Admin, Editor, Reader, Curator (term/domain steward).
- Policy с granular permissions: VIEW_ENTITY_PAGE, EDIT_ENTITY_TAGS, ASSIGN_OWNERS, MANAGE_GLOSSARY.
- Resource-level conditions: filter by domain/platform/tag.

Browse path:
- Hierarchical tree platform → env → DB → schema → table.
- Альтернатива поиску для discovery в knowing world.

Compliance:
- PII detection (rule-based + ML).
- Sensitivity labels (Confidential / Restricted / Public).
- Retention policy hints.

Embedded analytics:
- "Most queried tables this week".
- "Top dashboards by viewers".
- "Datasets with broken upstream".

Роли: data steward (curator of glossary/domains), data engineer (producer of pipelines), data analyst (consumer of datasets), platform admin (controls access), executive (audits via domain page).

Ключевые intent'ы: search_metadata, propose_glossary_term, approve_term, attach_term_to_column, set_owner, navigate_lineage, expand_column_lineage, deprecate_dataset, create_domain, assign_assets_to_domain, post_announcement, configure_ingestion_recipe, run_ingestion, view_usage_stats, set_pii_classification, file_data_incident, view_data_quality_history.

Эталон. Federated multi-platform graph (Snowflake + dbt + Airflow + Tableau в одном catalog). Lineage-first navigation: column-level lineage как primary surface. Aspects-as-facets (composable metadata). Glossary с approval workflow. Domain-based ownership / authorization. PageRank-like search ranking по usage. Sibling-links для same-logical-entity на разных платформах.`,
  },
  {
    name: "unity-catalog-databricks",
    archetype: "catalog",
    description: `Unity Catalog (Databricks workspace UI + REST API + SDKs, 2025-2026). Эталон data + AI governance в lakehouse архитектуре. 3-tier hierarchy с unified ACL для tables, volumes, models, functions, ML features.

Иерархия (3 уровня):
- Metastore — root, per-region (workspace может share metastore).
- Catalog — top-level container (например, "main", "dev", "prod_east").
- Schema (Database) — внутри catalog.
- Securable objects: Table, View, Volume (file-based artifacts), Function, Model, Registered AI tool, Materialized View, Streaming table.
- Дополнительно: Connection (foreign catalog к Snowflake/Postgres/BigQuery), External Location, Storage Credential.

Catalog Explorer (главный):
- Левая панель: tree catalog → schema → object type → object name. Resizable, expandable.
- Правая панель: detail для выбранного объекта.
- Search bar: across catalogs / schemas / tables.
- Filter chips: tag, owner, type.

Table Detail:
- Hero: catalog.schema.table + type badge (Managed / External / Foreign / Streaming) + format (Delta / Iceberg / Parquet).
- Quick actions: Open in Notebook / Query in SQL Editor / Sample data / Refresh metadata.
- Tabs: Overview / Sample Data / Details / Permissions / History / Lineage / Quality / Insights.
- Overview: column tree (name + type + nullable + comment + tags + classification labels).
- Sample data — auto-fetch первые N строк (cached).
- Details: format, location, partitioning, TBLPROPERTIES, num records, data size, last updated, retention.
- Permissions: grants table — principal × privilege (SELECT / MODIFY / MANAGE / ...).
- History: time-travel — Delta version timeline с user + operation + records affected.
- Lineage: upstream/downstream tables, notebooks, DLT pipelines, jobs, dashboards. Column-level toggle.
- Quality: DLT expectations + manual assertions результаты.
- Insights: query frequency, top users, most-frequent column predicates.

Volume:
- File-based artifacts (PDFs, images, model weights, raw files).
- Browse: file tree + upload / download.
- Same governance что и tables.

Function:
- UDF (Python / SQL) с signature.
- Версионирование, permissions, comments.

AI Tools / Functions for Agents:
- Catalog functions wrapping API endpoints / SQL queries.
- Used by Mosaic AI Agent Framework.
- Description (LLM-readable), parameters, return type.

Model (registered model — UC-managed MLflow):
- Versions table.
- Aliases (champion / challenger).
- Permissions per model.
- Lineage до tables (training data).
- Serving endpoints attached.

Permissions / Grants:
- Granular: SELECT, MODIFY, INSERT, UPDATE, DELETE, READ_VOLUME, WRITE_VOLUME, EXECUTE, USE_CATALOG, USE_SCHEMA, MANAGE.
- Inheritance: catalog grants apply to schemas, schema grants to tables.
- Row-level filters / column masks через SQL functions.
- Service principals и groups как первоклассные принципалы.
- ABAC (attribute-based) через tags + policies (preview).

Lineage (autocaptured):
- Из всех Databricks queries (notebook, SQL editor, jobs, DLT, BI from Databricks SQL).
- Across notebooks → tables → dashboards.
- Real-time, not manual.
- Column-level автоматический.

Tags:
- Key:value tags на schemas, tables, columns.
- Can drive ABAC policies.

Classification labels:
- PII / sensitivity на column level.
- Auto-detected (preview) или manual.
- Drive masking policies.

Delta Sharing:
- "Share" — set of tables to share extra-tenant.
- "Recipient" — external customer (open или Databricks-to-Databricks).
- Activation link для open recipients.

Foreign catalogs:
- Mount Snowflake / BigQuery / Postgres как catalog в UC — query без копирования.
- Lakehouse Federation.

Audit log:
- Per-action audit (who queried what, when).
- Forwarded to system tables, queryable as Delta tables.

System tables:
- Built-in audit / billing / lineage / usage / quality таблицы под "system." catalog.

Notebook integration:
- В блокноте: % sql SELECT * FROM main.default.customers; — auto-permitions checked, lineage captured.
- Schema browser в side panel.

Genie (ai-driven ad-hoc):
- Natural language → SQL поверх UC tables.
- Permissions enforced.

Роли: data steward (catalog/schema admin), data engineer (creates DLT pipelines), data analyst (queries tables), ML engineer (creates models), governance officer (audits, sets policies), workspace user (consumer).

Ключевые intent'ы: create_catalog, grant_privilege, revoke_privilege, drop_table_with_cascade, time_travel_query, set_classification_label, attach_tag, define_row_filter, create_share, accept_share, browse_volume, upload_to_volume, register_function, deploy_model_serving, query_with_genie, view_lineage, audit_query_log, federate_external_catalog, set_default_catalog_for_workspace.

Эталон. 3-tier hierarchy (catalog/schema/object) с unified ACL across data + AI + files + functions. Auto-captured lineage из всех query-paths (notebook + DLT + SQL + BI). Time-travel как first-class табы Delta. Foreign catalogs (federation) + Delta Sharing (out-bound) — single governance plane. ABAC через tags + classification labels driving row-filters / column-masks. AI tools / functions / models — same securables как tables.`,
  },
];

function run(source) {
  return new Promise((resolve, reject) => {
    const args = [
      RESEARCHER,
      "--source", source.name,
      "--description", source.description,
      "--archetype", source.archetype,
    ];
    const started = Date.now();
    console.log(`\n═══════════ ${source.name} ═══════════`);
    console.log(`  started at ${new Date().toISOString()}`);
    const proc = spawn("node", args, { stdio: ["ignore", "inherit", "inherit"] });
    proc.on("close", code => {
      const mins = ((Date.now() - started) / 60000).toFixed(1);
      console.log(`  ${source.name} finished in ${mins} min (exit ${code})`);
      if (code === 0) resolve({ source: source.name, minutes: mins });
      else reject(new Error(`${source.name} failed with exit ${code}`));
    });
    proc.on("error", reject);
  });
}

async function main() {
  const startedAll = Date.now();
  console.log(`Gravitino-like Pattern Batch — ${new Date().toISOString()}`);
  console.log(`Targets: metadata catalogs / governance — MLflow · DataHub · Unity Catalog`);
  console.log(`Sources: ${SOURCES.map(s => s.name).join(", ")}`);

  const results = [];
  for (const source of SOURCES) {
    try {
      const r = await run(source);
      results.push({ ...r, status: "ok" });
    } catch (err) {
      console.error(`  error: ${err.message}`);
      results.push({ source: source.name, status: "failed", error: err.message });
    }
  }

  const totalMin = ((Date.now() - startedAll) / 60000).toFixed(1);
  console.log(`\n═══ BATCH DONE in ${totalMin} min ═══`);
  for (const r of results) {
    console.log(`  ${r.status === "ok" ? "✓" : "✗"} ${r.source}${r.minutes ? ` (${r.minutes} min)` : ""}`);
  }
}

main().catch(err => {
  console.error("Batch crashed:", err);
  process.exit(1);
});
