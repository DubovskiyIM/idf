# Gravitino UX pattern observations — running notes

**Назначение.** Накопительный файл для UI/UX паттернов, которые всплывают во время Gravitino dogfood sprint'а. После завершения каждой стадии — triage: кандидаты в pattern bank (`idf-sdk/packages/core/src/patterns/stable/`) через researcher-pipeline.

**Формат записи.**
```
### P-N: <краткое название>
**Стадия:** Stage X
**Источник:** Gravitino v2 WebUI / наш derived / авторский шаблон
**Наблюдение:** что именно делает UX (как, когда)
**Trigger:** какие signals ontology/intents делают этот паттерн уместным
**Structure:** что рендерится (primitive/slots)
**Evidence:** screenshot / docs link
**Counterexample:** где не подходит
**Related patterns:** из существующих 32 stable
```

---

## Паттерны

### P-1: Path-derived hierarchy (format-level)

**Стадия:** Stage 1 discovery / Stage 2 Task 0 (2026-04-22..23)
**Источник:** Gravitino REST API convention
**Наблюдение:** В path-based REST API (Gravitino, K8s, AWS REST, Stripe) иерархия ресурсов живёт в URL (`/metalakes/{m}/catalogs/{c}/schemas/{s}/tables/{t}`), а не в scalar FK полях сущностей. В ontology после importer-openapi@0.3.0 — catalog/schema/table **не имеют parent-ID**, pattern `hierarchy-tree-nav` не триггерится.
**Trigger:** Gravitino как raison d'être; но pattern applies ко всем path-hierarchical APIs.
**Structure:** не UI-pattern сам по себе, но **PRE-condition для hierarchy-tree-nav** — требует синтеза FK на importer уровне.
**Evidence:** Stage 2 Task 0 report (2026-04-23): `metalake_detail.slots.sidebar = []` — pattern не apply'ится на Gravitino потому что FK-chain отсутствует.
**Related patterns:** `hierarchy-tree-nav` (existing stable), R8 hub-absorption (crystallize).
**Follow-up:** SDK PR — importer-openapi@0.4.0 синтезирует path-derived FK (`Child.parentId: { kind:"foreignKey", references:"Parent" }`).

### P-2: Absolute-rooted hierarchy nav vs relative-rooted

**Стадия:** Stage 2 Task 1 (2026-04-23)
**Источник:** Gravitino v2 WebUI + Stage 2 discovery
**Наблюдение:** Классическая иерархическая навигация (Gravitino, AWS, K8s, Stripe) держит **одно и то же дерево на всех страницах** — корень всегда в глобальной root-сущности. Пользователь видит всю иерархию, знает где находится, может jump'ать. Наш текущий `hierarchy-tree-nav` pattern даёт **relative-rooted** tree — на `catalog_list` корень = Catalog, а не Metalake. Это визуально неверно для многостраничного workflow.
**Trigger:** projection с mainEntity участвующим в FK-цепочке, где есть absolute root ≥2 levels выше.
**Structure:** V2Shell-level tree state (не projection-level). Tree всегда стартует с absolute root; current projection получает highlight.
**Evidence:** Gravitino screenshots, AWS Console, K8s dashboard — single persistent tree.
**Counterexample:** Apps с flat navigation (twitter, messenger) — tree бессмысленна.
**Related patterns:** `hierarchy-tree-nav` (existing, relative-rooted) — возможно расширить флагом `rootEntity` или выделить в `absolute-hierarchy-nav` как separate pattern.
**Follow-up:** Stage 2 Task 4 (host V2Shell global tree state) или SDK extension.

### P-3: Auto-derived sections — title/entity inference

**Стадия:** Stage 2 Task 1 (2026-04-23)
**Источник:** Gravitino auto-pattern discovery
**Наблюдение:** Pattern `subcollections` auto-fire'ит на entity с back-FK и добавляет sections с `title: undefined, entity: undefined`. Правильно — title = plural-form entity-name (`Users`), entity = найденный child. Сейчас рендер покажет пустые заголовки + unknown-entity списки.
**Trigger:** detail-projection, auto-apply subcollections pattern, entity без authored subCollections hint.
**Structure:** pattern apply должен resolve'ить child-entity имя и строить title через plural-form heuristic.
**Evidence:** `arts.user_detail.slots.sections[0] = {title: undefined, entity: undefined, foreignKey: "userId"}`.
**Counterexample:** authored subCollections — пользователь задаёт title явно, нечего auto-infer.
**Related patterns:** `subcollections` в `packages/core/src/patterns/stable/detail/` — fix именно там.
**Follow-up:** SDK backlog — либо fix apply-функции, либо переместить subcollections в matching-only (без apply) и заставить авторов явно писать subCollections.

### P-4: DataGrid для всех catalog-list проекций (не только «≥3 metrics»)

**Стадия:** Stage 2/3 post-seed (2026-04-23)
**Источник:** Gravitino dogfood + Workzilla/AntD pro admin paradigm
**Наблюдение:** При seed с ≥5 items в catalog user ожидает **таблицу с sort/filter per column**, не cards. Card-layout уместен для визуально-насыщенных feeds (e-commerce listings, social posts), не для CRUD-administration UI (metalakes, policies, roles). Для 12 list-проекций Gravitino 100% должны быть таблицами.
**Trigger (candidate):** `archetype === "catalog"` + `mainEntity` entity без `image|multiImage` полей + witnesses не содержат `heroImage|avatar` + ≥5 seeded items (admin CRUD surface, не feed).
**Structure:** `slots.body = { type: "dataGrid", source: pluralize(mainEntity), columns: witnesses → DataGrid.columns, onItemClick }`. Каждый witness field превращается в `column` с `sortable: true + filterable|filter:"enum"` по field.type.
**Evidence:** Gravitino v2 WebUI ВСЕ 12 модулей — таблицы (screenshot batch 2026-04-22). AntD Pro admin-layout defaults to `<Table>` primitive. User feedback 2026-04-23: «Таблиц нет, все в карточках».
**Counterexample:** sales.listing_feed — image-rich catalog (multiImage), grid-card-layout уместен; reflect.mood_entries_feed — compact cards OK; любой feed-архетип (не catalog).
**Related patterns:** `grid-card-layout` (работает на image/money fields), `faceted-filter-panel` (дополняет DataGrid для ≥3 enum polya).
**Follow-up:** после dogfood финала — кандидат в `catalog/dataGrid-default-layout` с trigger-matcher'ом. До того — host авторы пишут `projection.bodyOverride` руками (current state).

### P-5: Natural-key navigation (name vs synthetic id)

**Стадия:** Stage 2 (click-handler debugging, 2026-04-23)
**Источник:** Gravitino (name = natural key), Stripe ids (`cus_*` prefix), K8s resources (name within namespace)
**Наблюдение:** `resolveDetailTarget` в renderer hardcodes `list.find(e => e.id === routeParams[idParam])`. Когда domain имеет natural key (`name` для Gravitino, `slug` для CMS), автор интуитивно передаёт `params: { metalakeId: "item.name" }` — и detail не резолвится, клик «не работает» silently.
**Trigger (format-level):** `entity` с уникальным human-readable полем (name/slug/code) + idParam convention в URL с natural key — ожидает lookup by that field, не by `.id`.
**Structure:** kandidat — ontology-level `entity.identifierField: "name"` + `resolveDetailTarget` использует `e[identifierField] ?? e.id`. Или host-level: автор осознанно передаёт `item.id` (uuid-style URL, breadcrumbs label отдельно через `name`).
**Evidence:** user feedback 2026-04-23 «не работают клики/евенты» → root cause: `item.name` → e.id mismatch (id=`m_prod`, name=`prod_lake`). Fix: сменили onItemClick на `item.id`.
**Counterexample:** когда `id === name` уже уникален в пределах world (напр., все доменные User id = email), fix не нужен.
**Related patterns:** `hierarchy-tree-nav`, `subCollections.foreignKey` — те же conventions по natural-key могут проявляться.
**Follow-up:** SDK backlog — предложить `entity.identifierField` в ontology-шейпе или добавить fallback `e.id ?? e.name` в resolveDetailTarget. Исправить silent-fail: если detail не находит entity, рендерить empty-state «не найден», а не пустой экран.

### P-?: (placeholder for next observation)

<!-- По мере работы в Stage 2-8 добавлять P-6, P-7, ... -->
