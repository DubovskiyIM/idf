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
| A1 | Top nav: контекстная (Metalakes vs внутри metalake) | Plain top nav без контекстных режимов | 🟡 | Сделать nav-projections режима |
| A2 | `/metalakes` — список с CRUD | `metalake_list` dataGrid (Name/Creator/Owner/CreatedAt/Properties/Comment/Actions) | ✅ | U1 — owner placeholder до U5 |
| A3 | `/catalogs?metalake=X` — split-pane: tree слева + detail справа | `metalake_workspace` canvas: `<CatalogExplorer/>` с breadcrumb + 2-col layout | ✅ | U2.1 — page-local |
| A4 | Tree node hierarchy: metalake → catalog → schema → {table,fileset,topic,model,function} | `<CatalogTree/>` все уровни до leaf (table/fileset/topic/model). Function — U6 | ✅ U2.3 |
| A5 | URL query params как state (`?metalake=X&catalog=Y&schema=Z&table=T`) | URL-routing через `/projection/id` | 🟡 | Поддержать nested context-params |
| A6 | `/access` redirect hub → users/userGroups/roles | 3 root projections (user/group/role _list) | 🟡 | Сгруппировать в "Access" submenu |
| A7 | `/compliance` redirect hub → tags/policies | 2 root projections | 🟡 | Сгруппировать в "Compliance" submenu |
| A8 | `/jobs`, `/jobTemplates` | ❌ нет projections | ❌ | Stage 3 — Job/JobTemplate проекции |
| A9 | OIDC login + `/oauth/callback` | 🚫 | 🚫 | Out of scope (host-level auth) |

---

## Раздел B — Сущности (entities)

| Строка | Entity | Их fields в UI | Наши fields | Статус | Заметки |
|---|---|---|---|---|---|
| B1 | **Metalake** | name, creator, owner, properties, comment, audit, in-use toggle | name, comment, properties, audit | 🟡 | Нет: in-use toggle, owner display inline |
| B2 | **Catalog** | name, type, provider, comment, properties + **provider-specific config** (500+ props через EntityPropertiesFormItem) | + CreateCatalogDialog с dynamic form (6 providers across 4 types: hive/iceberg/jdbc-postgresql/kafka/hadoop/model-registry) | ✅ U3 minimum · 🟡 остальные 5+ providers и edit-flow в U3.5 |
| B3 | **Schema** | name, comment, properties, audit + tabs (tables/filesets/models/functions/tags/policies/properties) | name, comment, properties, audit + sub-collections | 🟡 | Нет вкладок tags/policies на schema |
| B4 | **Table** | columns, partitioning, distribution, sortOrder, indexes, properties + tabs (Columns / Partitioning / Associated Filesets / Tags / Policies / Properties) | columns (`schemaEditor`), partitioning, distribution, sortOrders, indexes, properties | 🟡 | Tabbed-detail не реализован, indexes/sortOrder не рендерятся |
| B5 | **Column** (nested) | name, type, comment, nullable, autoIncrement, defaultValue + complex types (struct/map/array) | Через `schemaEditor` primitive | 🟡 | Сложные типы (nested struct) — gap |
| B6 | **Fileset** | name, location, properties + Browse Files | name, type, storageLocation, comment, properties | 🟡 | Browse Files (file list) не реализован |
| B7 | **Topic** | name, comment, properties | name, comment, properties | ✅ | Близко к parity |
| B8 | **Model** | name, comment, latestVersion, properties + Versions tab + Link Version dialog | name, latestVersion, comment, properties | 🟡 | ModelVersion как сущность не выведена в UI |
| B9 | **ModelVersion** | version, modelObject, aliases, properties | imported, нет projection | ❌ | Создать `model_version_list` под model_detail |
| B10 | **Function** | name, comment, functionBody (read-only) | imported, нет projection | ❌ | `function_list` под schema_detail |
| B11 | **User** | name, roles | name, roles (`chipList`), audit + grant/revoke/delete actions | ✅ | Сравнить actions UX |
| B12 | **Role** | name, privileges (resource × action tree) | name, securableObjects (`permissionMatrix`), properties | 🟡 | Нужна сверка permission-matrix UX vs их tree |
| B13 | **UserGroup** | name, members | `Group`: name, roles, audit | 🟡 | Members editing — отдельный flow |
| B14 | **Tag** | name, comment, audit + assignment to metadata objects | + AssociatePopover на CatalogsTable (catalog-level) | ✅ U2.5 catalog · 🟡 schema/table U6 |
| B15 | **Policy** | name, rules (resource × action × effect) | name, policyType, enabled, content, audit, inherited, comment | 🟡 | Нет UI для rules/assignment |
| B16 | **Job** | jobId, status, startTime, endTime, details + cancel + drawer | ❌ | ❌ | Stage 3 |
| B17 | **JobTemplate** | name, config, description | ❌ | ❌ | Stage 3 |
| B18 | **Audit** (везде) | creator, createTime, lastModifier, lastModifyTime | `propertyPopover` | ✅ | Унифицировано |

---

## Раздел C — Actions (mutations)

| Строка | Action | Где у них | У нас | Статус |
|---|---|---|---|---|
| C1 | Create / Edit / Delete для всех 12+ сущностей | Modal dialogs | ✅ form-архетип | ✅ |
| C2 | Set Owner | `SetOwnerDialog` (User/Group cascader) | ❌ | ❌ Нет cross-entity owner-assignment intent |
| C3 | Toggle In-Use (metalake/catalog) | Switch | ❌ | ❌ |
| C4 | Test Connection (catalog) | Кнопка перед save | ❌ | ❌ Side-effect intent с external check |
| C5 | Grant Role to User/Group | Через user/group row-action | ✅ row-action | ✅ |
| C6 | Revoke Role | Через user/group row-action | ✅ | ✅ |
| C7 | Assign Tag to metadata object | Popover на entity-row | AssociatePopover в CatalogsTable (UI-state, exec в U2.5b) | ✅ U2.5 catalog |
| C8 | Assign Policy to metadata object | Popover | AssociatePopover в CatalogsTable | ✅ U2.5 catalog |
| C9 | Link/Unlink Model Version | `LinkVersionDialog` | ❌ | ❌ |
| C10 | Browse Files (fileset) | `ListFiles` page | ❌ | ❌ Read-only filesystem nav |
| C11 | Cancel Job | Drawer | ❌ | ❌ Stage 3 |
| C12 | Add Partitions (table) | (нет в UI?) | imported intent есть | n/a |

---

## Раздел D — UI patterns / визуальные

| Строка | Pattern | Их реализация | Наша | Статус |
|---|---|---|---|---|
| D1 | Split-pane catalog explorer | AntD `Splitter` + `TreeComponent` | host `<CatalogExplorer/>` (page-local в `gravitino/explorer/`) | ✅ U2.1 |
| D2 | Tabbed entity detail (tabs внутри detail) | AntD `Tabs` | Detail без tabs | ❌ |
| D3 | Resizable table columns | `react-antd-column-resize` | adapter capability? | 🟡 |
| D4 | Properties popover | Inline cell с count + popover | `propertyPopover` primitive | ✅ |
| D5 | Tag/Policy chip с remove | `CustomTags` | `<ChipList/>` в CatalogsTable + AssociatePopover для add/remove | ✅ U2.5 |
| D6 | Confirmation by name-match (delete) | `ConfirmInput` (тип "DELETE-name") | ❌ | ❌ Irreversibility integration |
| D7 | Dark theme | next-themes + AntD ConfigProvider | per-domain antdThemeConfig + darkAlgorithm + CSS-vars override (gravitino-only) | ✅ U1 |
| D8 | Brand primary `#6478f7` | Tailwind + AntD theme | colorPrimary `#6478f7` через ConfigProvider | ✅ U1 |
| D9 | Loading skeletons | Custom `Loading` | adapter capability | 🟡 |
| D10 | Empty-state иллюстрации | Брендовые | дефолт AntD | 🟡 |
| D11 | Toast notifications | `StyledToast` | adapter | 🟡 |
| D12 | Iconify + custom SVG (40KB icon set) | `Icons.js` | adapter icons | 🟡 |
| D13 | Search bar (client-side filter) | AntD `Input.Search` | catalog-archetype filterBar | ✅ |
| D14 | Owner avatar inline | + click → `SetOwnerDialog` | ❌ | ❌ |
| D15 | Tree expand/collapse persist | Redux store | ❌ | ❌ Pattern для bank |

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
