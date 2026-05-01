# Gravitino UI parity — gap-таблица

**Дата:** 2026-05-01
**Reference:** `~/WebstormProjects/gravitino/web-v2/web/` (Next.js 14 + AntD 5 + Tailwind, primary `#6478f7`, dark mode via `next-themes`)
**Наша реализация:** `src/domains/gravitino/` (12 canonical entities, 24 projections, AntD-адаптер, тёмная тема)
**Цель:** покрыть на нашем рендере функционал web-v2, отполировать UI до уровня "золотого" примера IDF-разработки.

> Gap-каталог `gravitino-gaps.md` — про Stage 1 crystallize derivation (закрыт). Этот документ — про feature/UX-parity со web-v2.

## Workflow

1. Юзер кидает скрин **наш** + **их** + комментарий → отдельный план через `superpowers:writing-plans` → PR.
2. Каждая итерация двигает 1-2 строки таблицы из ❌/🟡 в ✅.
3. Pattern bank / SDK / адаптерные правки — отдельные worktree'ы (`feedback_sdk_work_via_worktree`).
4. После закрытия группы рядов — ревизия онтологии по `ontology-authoring-checklist.md`.

## Легенда

| Метка | Значение |
|---|---|
| ✅ | Полное покрытие (видно в UI, поведение совпадает) |
| 🟡 | Частично (entity/projection есть, но UX отстаёт — actions, fields, validation) |
| ❌ | Нет в нашем UI |
| 🚫 | Out of scope IDF (auth flow, backend infra) — пропускаем |

---

## Раздел A — Структура и навигация

| Строка | Их web-v2 | У нас сейчас | Статус | План |
|---|---|---|---|---|
| A1 | Top nav: контекстная (Metalakes vs внутри metalake) | <ContextNav/> strip внутри metalake_workspace (4 tabs Catalogs/Jobs/Compliance/Access) — host-only solution без V2Shell ext | ✅ U-context-nav (in-metalake) · 🟡 outer flat nav остаётся (top-level Metalakes/Jobs/Access/Compliance — V2Shell-level swap deferred) |
| A2 | `/metalakes` — список с CRUD | host MetalakesHub canvas (Name → workspace / Creator / Owner avatar+✎ / Created / Properties / Comment / In-Use toggle / Delete с typed-name confirm) | ✅ | U5.5 — заменили SDK dataGrid на host-rendered |
| A3 | `/catalogs?metalake=X` — split-pane: tree слева + detail справа | `metalake_workspace` canvas: `<CatalogExplorer/>` с breadcrumb + 2-col layout | ✅ | U2.1 — page-local |
| A4 | Tree node hierarchy: metalake → catalog → schema → {table,fileset,topic,model,function} | `<CatalogTree/>` все уровни до leaf (table/fileset/topic/model). Function — U6 | ✅ U2.3 |
| A5 | URL query params как state (`?metalake=X&catalog=Y&schema=Z&table=T`) | URL-routing через `/projection/id` | 🟡 | Поддержать nested context-params |
| A6 | `/access` redirect hub → users/userGroups/roles | access_hub canvas (HubGrid: Users/Groups/Roles tiles) | ✅ U2.6 |
| A7 | `/compliance` redirect hub → tags/policies | compliance_hub canvas (HubGrid: Tags/Policies tiles) | ✅ U2.6 |
| A8 | `/jobs`, `/jobTemplates` | jobs_hub canvas (tabs Jobs/Templates) — top-nav 4-й tab | ✅ U7 |
| A9 | OIDC login + `/oauth/callback` | 🚫 | 🚫 | Out of scope (host-level auth) |

---

## Раздел B — Сущности (entities)

| Строка | Entity | Их fields в UI | Наши fields | Статус | Заметки |
|---|---|---|---|---|---|
| B1 | **Metalake** | name, creator, owner, properties, comment, audit, in-use toggle | host MetalakesHub: Name (→ workspace) / Creator / Owner avatar+✎ / Created / Properties / Comment / In Use toggle / Delete с ConfirmDialog | ✅ U5.5 |
| B2 | **Catalog** | name, type, provider, comment, properties + **provider-specific config** (500+ props через EntityPropertiesFormItem) | + CreateCatalogDialog с dynamic form (6 providers across 4 types: hive/iceberg/jdbc-postgresql/kafka/hadoop/model-registry) | ✅ U3 minimum · 🟡 остальные 5+ providers и edit-flow в U3.5 |
| B3 | **Schema** | name, comment, properties, audit + tabs (tables/filesets/models/functions/tags/policies/properties) | SchemaDetailPane: child-kind / Tags / Policies / Properties tabs + Set Owner header | ✅ U6.3 · 🟡 functions tab (U-functions) |
| B4 | **Table** | columns, partitioning, distribution, sortOrder, indexes, properties + tabs (Columns / Partitioning / Associated Filesets / Tags / Policies / Properties) | TableDetailPane: Columns / Partitioning / Distribution / SortOrder / Indexes / Tags / Policies / Properties tabs (conditional show) + Set Owner header | ✅ U6.3 · 🟡 Associated Filesets (cross-link, U-cross) |
| B5 | **Column** (nested) | name, type, comment, nullable, autoIncrement, defaultValue + complex types (struct/map/array) | TableDetailPane Columns tab: expandable rows для struct<...>/array<...>/map<...,...>; рекурсивный NestedTypeView с indent | ✅ U-detail-polish |
| B6 | **Fileset** | name, location, properties + Browse Files | + FilesetDetailPane (Files tab с path/size/modified + Properties); seed.fileset_files mock | ✅ U6.2 (mock) |
| B7 | **Topic** | name, comment, properties | + TopicDetailPane (header + Properties с kafka-tokens) | ✅ U6.2 |
| B8 | **Model** | name, comment, latestVersion, properties + Versions tab + Link Version dialog | + ModelDetailPane (tabs Versions/Properties) с таблицей версий + Link Version button | ✅ U6.1 |
| B9 | **ModelVersion** | version, modelObject, aliases, properties | seed (10 versions) + render в ModelDetailPane (Versions table с aliases-chips) | ✅ U6.1 |
| B10 | **Function** | name, comment, functionBody (read-only) | + FunctionDetailPane (read-only body + properties); CatalogTree показывает functions под relational schema | ✅ U6.2 |
| B11 | **User** | name, roles | name, roles (`chipList`), audit + grant/revoke/delete actions | ✅ | Сравнить actions UX |
| B12 | **Role** | name, privileges (resource × action tree) | RoleDetailPane: privileges grouped by resource type (metalake/catalog/...) с ALLOW/DENY chips | ✅ U-iam |
| B13 | **UserGroup** | name, members | GroupDetailPane: tabs Members/Roles + add (selector доступных users) / remove (per row) — optimistic | ✅ U-iam |
| B14 | **Tag** | name, comment, audit + assignment to metadata objects | AssociatePopover в CatalogsTable (catalog) + SchemaDetailPane Tags tab + TableDetailPane Tags tab (schema/table levels) | ✅ U6.3 |
| B15 | **Policy** | name, rules (resource × action × effect) | PolicyDetailPane: Rules summary chips (per policyType heuristic) + JSON pretty-print + enabled/disabled badge | ✅ U-polish-3 (read-only) · 🟡 rules editor U-polish-3b |
| B16 | **Job** | jobId, status, startTime, endTime, details + cancel + drawer | seed (6 runs: success/failed/running/queued) + JobsTable + JobDetailDrawer + Cancel optimistic | ✅ U7 |
| B17 | **JobTemplate** | name, config, description | seed (3 templates: spark/shell/airflow) + TemplatesTable | ✅ U7 |
| B18 | **Audit** (везде) | creator, createTime, lastModifier, lastModifyTime | `propertyPopover` | ✅ | Унифицировано |

---

## Раздел C — Actions (mutations)

| Строка | Action | Где у них | У нас | Статус |
|---|---|---|---|---|
| C1 | Create / Edit / Delete для всех 12+ сущностей | Modal dialogs | ✅ form-архетип | ✅ |
| C2 | Set Owner | `SetOwnerDialog` (User/Group cascader) | SetOwnerDialog wired для catalog/metalake/schema/table (полное покрытие) | ✅ U6.3 |
| C3 | Toggle In-Use (metalake/catalog) | Switch | In-Use toggle в MetalakesHub (U5.5) + CatalogsTable (U-polish-3, optimistic per id) | ✅ U-polish-3 (metalake+catalog) |
| C4 | Test Connection (catalog) | Кнопка перед save | Test Connection кнопка в CreateCatalogDialog (mock async — heuristic isPlausibleUri); реальный probe — U6.5 backend | ✅ U-polish-2 (mock) |
| C5 | Grant Role to User/Group | Через user/group row-action | ✅ row-action | ✅ |
| C6 | Revoke Role | Через user/group row-action | ✅ | ✅ |
| C7 | Assign Tag to metadata object | Popover на entity-row | AssociatePopover в CatalogsTable (UI-state, exec в U2.5b) | ✅ U2.5 catalog |
| C8 | Assign Policy to metadata object | Popover | AssociatePopover в CatalogsTable | ✅ U2.5 catalog |
| C9 | Link/Unlink Model Version | `LinkVersionDialog` | LinkVersion (U6.1) + Unlink (✓ ConfirmDialog) + Edit Aliases (inline modal) — все optimistic | ✅ U-detail-polish |
| C10 | Browse Files (fileset) | `ListFiles` page | Files tab в FilesetDetailPane (mock в seed.fileset_files; real listFiles intent — U6.5) | ✅ U6.2 (mock) |
| C11 | Cancel Job | Drawer | Cancel-кнопка в JobDetailDrawer (только для running/queued); optimistic status="cancelled" в JobsHub state | ✅ U7 |
| C12 | Add Partitions (table) | (нет в UI?) | imported intent есть | n/a |

---

## Раздел D — UI patterns / визуальные

| Строка | Pattern | Их реализация | Наша | Статус |
|---|---|---|---|---|
| D1 | Split-pane catalog explorer | AntD `Splitter` + `TreeComponent` | host `<CatalogExplorer/>` (page-local в `gravitino/explorer/`) | ✅ U2.1 |
| D2 | Tabbed entity detail (tabs внутри detail) | AntD `Tabs` | Tabs.jsx (host-side) + SchemaDetailPane / TableDetailPane | ✅ U4 |
| D3 | Resizable table columns | `react-antd-column-resize` | adapter capability? | 🟡 |
| D4 | Properties popover | Inline cell с count + popover | `propertyPopover` primitive | ✅ |
| D5 | Tag/Policy chip с remove | `CustomTags` | `<ChipList/>` в CatalogsTable + AssociatePopover для add/remove | ✅ U2.5 |
| D6 | Confirmation by name-match (delete) | `ConfirmInput` (тип "DELETE-name") | <ConfirmDialog/> с typed-name match (catalog Delete в CatalogsTable) | ✅ U-polish-1 catalog · 🟡 metalake/schema/table — host-расширение |
| D7 | Dark theme | next-themes + AntD ConfigProvider | per-domain antdThemeConfig + darkAlgorithm + CSS-vars override (gravitino-only) | ✅ U1 |
| D8 | Brand primary `#6478f7` | Tailwind + AntD theme | colorPrimary `#6478f7` через ConfigProvider | ✅ U1 |
| D9 | Loading skeletons | Custom `Loading` | adapter capability | 🟡 |
| D10 | Empty-state иллюстрации | Брендовые | <EmptyState/> с inline-SVG (4 kinds: catalogs/files/versions/jobs); применён в CatalogsTable/FilesetDetailPane/ModelDetailPane | ✅ U-polish-2 |
| D11 | Toast notifications | `StyledToast` | <ToastProvider/> + useToast() — fires на assignments / owner / create / delete | ✅ U-polish-1 |
| D12 | Iconify + custom SVG (40KB icon set) | `Icons.js` | adapter icons | 🟡 |
| D13 | Search bar (client-side filter) | AntD `Input.Search` | catalog-archetype filterBar | ✅ |
| D14 | Owner avatar inline | + click → `SetOwnerDialog` | Owner cell с avatar-letter chip + ✎ edit (CatalogsTable) | ✅ U5 |
| D15 | Tree expand/collapse persist | Redux store | localStorage `gravitino-tree-expanded` JSON-array of node IDs | ✅ U-polish-2 |

---

## Раздел E — Темы и токены (priority)

Стартуем с самого визуально-заметного:

1. **D7+D8** — токены AntD: primary `#6478f7`, success `#71DD37`, error `#FF3E1D`, warning `#FFAB00`, info `#03C3EC`. Dark-фон `#334155`, dark-text `#f1f5f9`.
2. **A2/A3** — `/metalakes` и `/catalogs` split-pane как стартовые экраны.
3. **B2** — provider-specific catalog forms (наибольший gap).
4. **B4 + D2** — tabbed table detail.

---

## Roadmap (черновой, переоценится итерационно)

- **Sprint U1** (визуальный baseline): D7+D8 (тема), A2 (metalakes list cleanup), B1 (metalake detail polish).
- **Sprint U2** (split-pane): A3+A4+D1 — pattern `split-pane-tree-explorer` в bank, апдейт `metalake_detail`.
- **Sprint U3** (provider forms): B2 — динамическая форма catalog, mapping 500+ props на ontology field-types.
- **Sprint U4** (tabbed detail): B3+B4+D2 — pattern `tabbed-entity-detail` или расширение detail-archetype.
- **Sprint U5** (cross-cutting actions): C2 (owner), C7+C8 (tag/policy assignment).
- **Sprint U6** (Model Versions, Functions, Filesets browse): B9, B10, C9, C10.
- **Sprint U7** (Jobs): B16+B17, C11.

## История

- **2026-05-01** — документ создан (этот snapshot). Inventory baseline web-v2 vs `src/domains/gravitino/`.
- **2026-05-01 (Sprint U1)** — `metalake_list` → dataGrid с 7 колонками паритетно web-v2 (Name/Creator/Owner/CreatedAt/Properties popover/Comment/Actions gear). HeaderBar (компактный header + ⚙-popover) заменил inline `toolbarBar` в V2Shell — освобождает строку под основной UI. Дубль top-bar в `standalone.jsx` отключён для v2-доменов. AntD dark theme + brand primary `#6478f7` per-domain (только gravitino, остальные AntD-домены не тронуты). Зависит от SDK PR #459 (DataGrid nested dataPath / kind:datetime / kind:propertyPopover) для full visual fidelity. Закрыто: A2, D7, D8.
- **2026-05-01 (Sprint U2.1)** — `metalake_workspace` canvas-projection + `<CatalogExplorer/>` (split-pane: `<CatalogTree/>` слева с filter-tabs Relational/Messaging/Fileset/Model + search; `<CatalogsTable/>` справа с breadcrumb «Metalakes › {metalake.name}»). Entry — клик по metalake_list row (`onItemClick.to` обновлён). Закрыто: A3, D1; A4 → 🟡 (до schema/table уровней). Out of scope U2.5: Tags/Policies inline-popovers.
- **2026-05-01 (Sprint U2.5)** — `<AssociatePopover/>` (multiselect tag/policy с search) + Tags/Policies колонки на `<CatalogsTable/>` (chip-list assignments + «+ Associate Tag/Policy» кнопки). Seed: 3 prod catalogs получили demo `tags`/`policies`. UI-state в `CatalogExplorer.assignments` (optimistic, без backend exec — реальные intents `associateTags` / `associatePoliciesForObject` в U2.5b). Закрыто: B14 catalog-level, C7, C8, D5. Schema/table-level — U6.
- **2026-05-01 (Sprint U2.3)** — `<CatalogTree/>` расширен до nested уровней: catalog → schemas (relational/fileset/model) или topics (messaging) → leaf entities (tables/filesets/topics/models). Expand/collapse state, icons (📂/🗒/📁/📡/🤖). Click по non-catalog узлу пока не меняет правую панель (детали в U2.4). Function — U6. Закрыто: A4.
- **2026-05-01 (Sprint U3)** — `<CreateCatalogDialog/>` (modal с cascade Type→Provider→dynamic fields) + кнопка «+ Create Catalog» в `<CatalogsTable/>`. PROVIDER_SCHEMA — 6 representative providers (hive/lakehouse-iceberg/jdbc-postgresql/kafka/hadoop/model-registry) covering 4 type-categories. Optimistic add в `CatalogExplorer.createdCatalogs` (без backend exec — реальный intent `createCatalog` в U3.5). Закрыто (minimum): B2.
- **2026-05-01 (Sprint U4)** — `<Tabs/>` (host) + `<SchemaDetailPane/>` (tabs Tables/Filesets/Models/Properties в зависимости от catalog.type) + `<TableDetailPane/>` (tabs Columns/Partitioning/Properties). CatalogExplorer переключает right-pane на detail при клике schema/table в tree. Multi-level breadcrumb: Metalakes › metalake › catalog › schema › table. Tags/Policies tabs внутри detail — U2.5b; functions/distribution/sortOrder/indexes — U6. Закрыто (minimum): B3, B4, D2.
- **2026-05-01 (Sprint U2.6)** — top-nav grouping: 6 flat root projections (metalake/user/group/role/tag/policy _list) → 3 hubs (metalake_list / access_hub / compliance_hub). Новые canvas-projections + `<HubGrid/>` (generic tile-grid с link-tiles на inner projections). Inner projections доступны через direct URL и tile-click. Закрыто: A6, A7.
- **2026-05-01 (Sprint U5)** — `<SetOwnerDialog/>` (modal cascader с tabs Users/Groups + search) + Owner колонка в `<CatalogsTable/>` (avatar-letter + ✎ edit / + Set Owner placeholder). Seed: owner на 3 metalakes + 3 prod catalogs. UI-state в `CatalogExplorer.ownerOverrides` (optimistic, без backend exec — реальный intent `setMetalakeOwner` / `setCatalogOwner` в U5b). Закрыто (catalog-level): C2, D14; B1 catalog-side. Metalake/schema/table set-owner — U5.5.
- **2026-05-01 (Sprint U6.1)** — Model versions UI: seed 10 ModelVersion записей под 4 models (price_optimizer 4 versions, churn 2, fraud 2, recsys 2; aliases production/staging/candidate/champion/shadow). `<ModelDetailPane/>` (tabs Versions/Properties; header с latest-badge; Versions-таблица: Version / Model Object (URI mono) / Aliases (chips) / Properties (compact JSON)). `<LinkVersionDialog/>` (modal: version (default = max+1) / modelObject required / aliases comma-separated). CatalogExplorer wire: click model в tree → ModelDetailPane; Link Version → optimistic add в `linkedVersions` state (паттерн как U2.5 assignments + U3 createdCatalogs + U5 ownerOverrides). Закрыто: B8, B9, C9 (link). Unlink/edit version — U6.2.
- **2026-05-01 (Sprint U6.2)** — leaf detail panes для Fileset / Function / Topic + seed extensions (3 functions под s_marketing/s_finance/s_sales: revenue_split / currency_normalize / pii_mask; 6 fileset_files под fs_vendor_raw / fs_dev_scratch). `<FilesetDetailPane/>` (tabs Files/Properties с path/size/modified + human-readable size formatting KB/MB/GB). `<FunctionDetailPane/>` (read-only body в `<pre>` + properties). `<TopicDetailPane/>` (header + Properties с kafka-tokens retention.ms / partitions / cleanup.policy). `<CatalogTree/>` расширен: getSchemaChildren возвращает массив групп — функции под relational schema показываются alongside tables (icon 𝑓). `<CatalogExplorer/>` wire: click fileset/function/topic в tree → respective pane (паттерн как U4 table/U6.1 model). Breadcrumb extracted в отдельный файл (`<Breadcrumb/>`) для соблюдения <300 LOC лимита. Закрыто: B6 (mock files), B10 (read-only function), C10 (mock browse); B7 enhanced.
- **2026-05-01 (Sprint U-polish-2)** — `<EmptyState/>` (inline-SVG для 4 kinds: catalogs/files/versions/jobs + optional action button) — применён в CatalogsTable/FilesetDetailPane/ModelDetailPane. CatalogTree expanded state persist через localStorage (D15). CreateCatalogDialog Test Connection кнопка (mock async ~500ms + isPlausibleUri heuristic — C4 mock; реальный probe в U6.5). Закрыто: D10, D15, C4 (mock).
- **2026-05-01 (Sprint U7)** — Jobs/JobTemplates entity area. Seed: 3 templates (spark_daily_etl/metastore_backup/data_quality_checks) + 6 jobs (success/failed/running/queued mix). `<JobStatusBadge/>` (5 цветов: success/failed/running/queued/cancelled). `<JobDetailDrawer/>` (right-side: Template/Started/Finished/Duration/Details + Cancel button для running/queued). `<JobsHub/>` (canvas: tabs Jobs/Templates, click row → drawer). Новая `jobs_hub` projection — 4-й root в top-nav (Metalakes / **Jobs** / Access / Compliance). Закрыто: A8, B16, B17, C11.
- **2026-05-01 (Sprint U-polish-1)** — Topic seed `schemaId` → `catalogId` fix (теперь topics видны в Messaging tab tree под `c_kafka_dev`). `<ConfirmDialog/>` (typed-name match per web-v2 ConfirmInput) + Delete action в CatalogsTable rows + optimistic delete state (`deletedIds`). `<ToastProvider/>` + `useToast()` — feedback на все optimistic actions (catalog created / owner set / tag/policy associated / catalog deleted) с success/error/info kinds. CatalogExplorer обёрнут двойным компонентом (Provider + Inner) для корректного hook-ordering. Закрыто (catalog-level): D6, D11.
- **2026-05-01 (Sprint U-polish-3)** — `<PolicyDetailPane/>` (read-only: tabs Rules/Properties; Rules tab — human-readable summary chips per policyType heuristic + raw JSON content; enabled/disabled badge в header) + `<PolicyDetailCanvas/>`. policy_detail → canvas. CatalogsTable получил In-Use toggle column (паттерн identical to MetalakesHub из U5.5). Seed: enabled flag на 9 catalogs (один — false для demo). Закрыто: B15 (read-only), C3 catalog.
- **2026-05-01 (Sprint U6.3)** — Schema / Table extended detail. `<SchemaDetailPane/>` получил Tags + Policies tabs (chip-list + AssociatePopover) + Set Owner ✎ в header. `<TableDetailPane/>`: + Distribution / SortOrder / Indexes / Tags / Policies tabs (conditional show — пустые не показываются) + Set Owner. `CatalogExplorer` wire'ит новые state slots `schemaOwnerOverrides` / `tableOwnerOverrides` / `schemaAssignments` / `tableAssignments` (через общий хук `useEntityOverrides`) + 2 дополнительных `<SetOwnerDialog/>` instances (для schema/table) через `<OwnerDialogs/>` wrapper. `useTreeSelection.makeTreeSelectHandler` — extracted resolver для tree-node kind. `DetailPaneCommon.jsx` — общие OwnerBlock + ChipsAssoc для двух pane'ов. Seed: tags/policies/owner на 3 schemas (s_sales / s_finance / s_marketing); tags/policies/owner + indexes/distribution/sortOrders на 2 tables (t_fact_orders / t_dim_customer). Закрыто: B3 (functions tab — отдельно), B4 (associated filesets — cross-link отдельно), C2 schema/table, B14 schema/table.
- **2026-05-01 (Sprint U-iam2.a)** — host TagsTable / PoliciesTable / UsersTable / GroupsTable / RolesTable + общий `<TwoPaneLayout/>`. AccessHub / ComplianceHub полностью переписаны на 2-pane (left submenu Tabs, right table). Row-actions: edit / delete / grant-role (placeholder для U-iam2.b). + RunJobDialog (template select) + RegisterJobTemplateDialog (Comment/Executable/Arguments). JobsHub Run Job button → optimistic add. Закрыто (read-side): A6 v2, A7 v2, B11 actions match. Остаются: write-side dialogs (Create Tag/Policy/Role + Grant Role) — U-iam2.b.
- **2026-05-01 (Sprint U-iam2.b)** — write-side dialogs: `<CreateTagDialog/>` (Name/Comment/Color picker/Properties); `<CreatePolicyDialog/>` (Name/Enabled/Type/Supported Object Types multi/Rules/Comment/Properties); `<CreateRoleDialog/>` (Securable Object с Type/Full Name/Allow Privileges multi-select per type/Properties); `<GrantRoleDialog/>` (multi-select roles для User/Group). Wire в AccessHub/ComplianceHub: optimistic add в createdTags/createdPolicies/createdRoles + grantedRoles overrides. Toast feedback на всё. Закрыто: write-side IAM/governance.
- **2026-05-01 (Sprint U-detail-polish)** — ModelDetailPane Versions tab: Actions колонка с ✎ Edit Aliases (inline modal) + 🗑 Unlink (ConfirmDialog typed-version match). CatalogExplorer wires `useModelVersionOverrides` хук (linkedVersions + unlinkedIds + aliasOverrides → applyTo): optimistic. TableDetailPane Columns tab refactor → `<ColumnsTab/>` + `columnTypeParser.js` (struct/array/map recursive parser); ColumnRow с ▸/▼ expand → NestedTypeView (indent + recursive struct/array/map). Seed: nested-type columns в t_fact_orders (metadata struct + line_items array<struct> + address_overrides map) для demo. Закрыто: B5, C9 (полностью).
