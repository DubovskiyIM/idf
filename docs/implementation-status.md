# IDF Implementation Status

Живой документ об имплементационном состоянии референсной реализации IDF (прототип + SDK). Формат (`docs/manifesto-v2.md`) определяет аксиомы; этот документ фиксирует, что из формата **реализовано** и **валидировано на практике**.

**Последнее обновление:** 2026-04-26

---

## 1. Прототип (host-layer)

**Репо:** `~/WebstormProjects/idf/`
**Стек:** React 18, Vite, Express (сервер `:3001`), SQLite через `better-sqlite3`, vitest

### Домены

| Домен | Намерений | Сущности | Зона силы |
|---|---|---|---|
| booking | 22 | Specialist, Service, TimeSlot, Booking, Review | Транзакционный booking, первое применение темпорального scheduler'а |
| planning | 17 | Poll, TimeOption, Participant, Vote, Meeting | Коллективные решения, кворум, фазы |
| workflow | 15 | Workflow, Node, Edge, Execution, NodeResult | Граф-редактор, React Flow canvas |
| messenger | 100 | User, Contact, Conversation, Participant, Message | Real-time, WebRTC, WebSocket |
| sales | 225 | 11 сущностей, 4 роли | Масштаб 225 интентов, чисто-кристаллизационный (нет ManualUI.jsx) |
| lifequest | 56 | 10 сущностей | Mobile-first, shadcn/ui doodle, 6 custom canvas |
| reflect | 47 | 10 сущностей | Apple visionOS-glass, Yale RULER mood meter, Rules engine extensions |
| invest | 61 | 14 сущностей | AntD enterprise-fintech, 4 роли (investor/advisor/agent/observer), 7 rules, 3 внешних ML-сервиса |
| delivery | 45 | 14 сущностей | 5 ролей, map-primitive, dispatcher m2m, irreversibility в `capture_payment` |
| freelance | 46 | Task, Response, Deal, Wallet, Transaction, Review, Category | Биржа услуг, multi-owner (customerId + executorId) на Deal, escrow через hold/release, revision loop, комиссия платформы |
| compliance | 38 | User, Department, Control, JournalEntry, Approval, AttestationCycle, Attestation, Finding, Evidence, Amendment | **13-й полевой тест**, SOX ICFR / «provable UI». 6 ролей, 15 invariants (5 expression-kind), 7 rules (все 4 v1.5 ext), 5 `__irr:high` intents. Первый домен со всеми 5 behavioral patterns signal-classifier'а. Reuse AntD. Закрыл backlog §1.1. |
| keycloak | 256 | 186 entities (Realm, Client, User, Group, Role, IdentityProvider, ClientScope, Component, Organization, Workflow + 75 embedded + service types) | **15-й полевой тест** (после Gravitino 14-го), Keycloak Admin Console. **AdminShell layout** (persistent sidebar tree + body region), **scoped DataGrid** (master/customer-app/staging — разные user pool через `node.filter`), Stage 6 **tabbedForm** (Client.detail × 5 tabs × 48 полей), Stage 7 **testConnection wizard step** (IdP create). Импортирован через `@intent-driven/importer-openapi@0.11.0`. **Закрыл 12 SDK gap'ов** (G-K-1/2/3/7/8/9/10/11/14/20/24/25). 5 ролей (admin/realmAdmin/userMgr/viewer/self), 25 createX intents. AntD enterprise. |
| argocd | 106 | 300 entities (Application, ApplicationSet, Cluster, Project, Repository, Certificate, GPGKey, Account + 157 v1alpha1* K8s CRDs + wrapper types + 2 синтетических: Resource, ApplicationCondition) | **16-й полевой тест** (после Keycloak 15-го), первый **status-driven admin** домен. Импортирован из ArgoCD **Swagger 2.0** (82 paths) через `swagger2openapi` → `importer-openapi@0.11`. 5 ролей (admin/developer/deployer/viewer/auditor). Stage 4: `column.kind="badge"` cell-renderer (new SDK PR idf-sdk#293, `@intent-driven/renderer@0.47`) для syncStatus/healthStatus/connectionStatus с tone colorMap. Stage 5-6: inline-children (K8s `status.resources[]` + `status.conditions[]`) через синтетический FK + `renderAs:"resourceTree"`/`"conditionsTimeline"` dispatchers. Stage 7: tabbedForm × 5 tabs для `Application.spec`. **Host-workaround'ы зафиксированы в backlog §10** (7 gap'ов G-A-1..G-A-7): K8S_CRD_MERGE table, INTENT_RENAME (53 grpc-gateway → canonical verb), SEMANTIC_AUGMENT (плоские поля поверх nested spec, компенсирует Swagger 2→3 тип-потерю). Rich seed: 63 effects (10 apps в разных sync × health states, 20 resources с health propagation, 12 conditions по severity). |
| automation | 36 | 9 (User, Workflow, NodeType, Node, Connection, Credential, Execution, ExecutionStep, ScheduledRun) | **17-й полевой тест** (после ArgoCD 16-го), visual workflow automation в духе **n8n / Zapier / Make**. AntD enterprise (lineage invest → compliance → keycloak → argocd → automation). 4 роли (editor / executor / viewer / agent), `executor` + `agent` имеют preapproval (active + notExpired credential). 15 invariants (10 referential + 2 transition + 2 expression `no_self_loop_connection` / `credential_owner_match` + 1 cardinality `one_active_schedule_per_workflow`), 2 rules (threshold consecutive failures + schedule next-run). 3 `__irr.high` intents (`delete_workflow` / `delete_credential` / `purge_execution_history`). 4 authored projections (`workflow_canvas` / `execution_replay` / `credential_vault` / `node_palette`) + derived. 39 seed effects (2 workflows × 4-node chains + 4 executions × 5 steps). 9/9 smoke + 879/879 full host suite. **Pattern bank**: 11 candidate'ов из Phase 0 research (`pattern-bank/candidate/automation-research-2026-04-26.json`) — n8n / Zapier / Make / Activepieces / Pipedream / Temporal / Airflow convergent evolution. **0 новых SDK gap'ов** — всё выражается через текущий API. Out of scope MVP: real engine, OAuth, marketplace, live execution overlay (~70% n8n parity по structural). |

**Итого:** ~1072 намерения, 14 доменов, один движок кристаллизации.

Freelance (12-й полевой тест) выявил 40+ конкретных SDK gap'ов в процессе авторинга — см. [`sdk-improvements-backlog.md`](sdk-improvements-backlog.md). Backlog классифицирован P0/P1/P2 и адресован `@intent-driven/core`, `@intent-driven/renderer`, `@intent-driven/adapter-antd`.

Compliance (13-й полевой тест) закрыл backlog §1.1 (`invariant.kind: "expression"` — расширен до `(row, world, viewer, context)` сигнатуры), добавил 5-ю производную материализацию (`materializeAuditLog` над Φ для observer-role) и зафиксировал три открытых design-gap: polymorphic Evidence.attachedTo (sparse-columns в MVP), computed ownerField для Attestation, `role.scope: {kind: "expression"}` support.

Keycloak (15-й полевой тест, 2026-04-23) — первый dogfood-домен полностью на importer-openapi pipeline без ручного авторинга ontology. Закрыл 12 SDK gap'ов в один день (importer dedup/embedded/inferFieldRoles/detectActionEndpoints/detectCollectionPostAsCreate, core preserveMainEntity/detectFK-synthetic/R8-bestParent/formModal-entity-fields, renderer AdminShell-primitive/DataGrid-filter/ActionCell-auto-overlay). **AdminShell** — новый layout-mode для admin-style enterprise UX (Keycloak / Gravitino / Argo / Grafana / любой control-plane): 2-column shell с persistent sidebar tree (instance-aware через R8 hubSections) и body, переключаемым через `onSelect`. Открытые gap'ы: G-K-12 (Wizard через row-CTA edit), G-K-22 (`ontology.features.preferDataGrid` switch), G-K-23 (validation soft-warn). См. финальный gap-каталог `idf/docs/keycloak-gaps.md` (25 gap'ов, 9 ✅ closed via SDK PR, 6 host workarounds, 4 deferred design ask, 6 informational).

ArgoCD (16-й полевой тест, 2026-04-24) — первый **status-driven admin** домен после IAM CRUD (Keycloak) и metadata catalog (Gravitino). Stress-test importer'а на Swagger 2.0 (первый раз — ArgoCD использует gRPC-gateway c definitions[] вместо components.schemas; host конвертирует через `swagger2openapi` перед import'ом) и на **inline-children pattern** (K8s `Application.status.resources[]` / `status.conditions[]` — inline массивы без FK, importer не видит). Закрыл 1 SDK gap (idf-sdk#293 `column.kind="badge"` cell-renderer с colorMap/toneMap — host integration в renderer@0.47). Host-workaround'ы задокументированы в `sdk-improvements-backlog.md §10` как 7 gap'ов G-A-1..G-A-7: K8s CRD naming merge (`v1alpha1X → X`), markEmbedded too aggressive, inline-children primitive (3 подгапа: extractInlineArrays + inline-children renderer + resourceTree/conditionsTimeline dispatchers), deeply-nested spec → `yamlEditor` control-archetype, Swagger 2.0 type-loss на $ref полях, grpc-gateway operationId canonicalization. Ожидаемые SDK PR пакеты закроют host tables (`K8S_CRD_MERGE` + `INTENT_RENAME` + `SEMANTIC_AUGMENT` + `RESOURCE_ENTITY` + `APPLICATION_CONDITION_ENTITY` — все removable). Rich seed показывает все 3 sync × 6 health states для визуальной валидации statusBadge primitive.

### Тестовое покрытие

- **idf (прототип)**: ~842 unit-тестов в 59 файлах (+31 compliance после 13-го теста, +20 keycloak baseline после 15-го, +22 argocd baseline после 16-го)
- **@intent-driven/core**: 916 unit-тестов (+21 после PR #96 + #98: expression world/viewer/context + audit materializer)
- **@intent-driven/renderer**: 175 тестов
- **@intent-driven/canvas-kit**: 36 тестов
- **4× `@intent-driven/adapter-*`**: 34 теста суммарно (adapter-antd 22, apple 3, shadcn 3, mantine 6)
- **Итого:** ~1960 тестов в SDK + прототипе
- **agent-smoke**: 75-шаговый integration-тест, покрывает все домены
- **domain-audit**: `npm run audit-report` — 7 осей × 10 доменов, baseline в `docs/domain-audit.{md,json}`

---

## 2. SDK monorepo

**Репо:** `~/WebstormProjects/idf-sdk/` (pnpm workspace, tsup build, vitest). **19 пакетов** после Phase 2/3 extraction, scaffold-path ramp-up (2026-04-21) и `host-contracts` extraction (2026-04-25).

### Ядро и UI

| Пакет | Версия | Лицензия | Назначение |
|---|---|---|---|
| `@intent-driven/core` | 0.76.0 | BSL 1.1 | crystallize_v2, fold, invariants (6 kinds incl. **expression** с world/viewer/context), materializers (document / voice / **auditLog**), Pattern Bank (37 stable, 35 apply + 10 curated candidates), salience declaration-order ladder, **polymorphic entity-kind API** (P0.2), **canonical type-map + auto field-mapping** (P0.4 / §9.1) |
| `@intent-driven/renderer` | 0.54.0 | BSL 1.1 | ProjectionRendererV2, 7 архетипов, 11 controls, primitives (atoms/containers/chart/map + IrreversibleBadge + PatternPreviewOverlay + TreeNav + KanbanBoard + SubCollectionSection), **AdapterProvider** (Context + hooks), **ArchetypeForm** (synthesized create/edit), **CoSelectionProvider** + `useCoSelection` / `useCoSelectionEnabled` hooks |
| `@intent-driven/engine` | 0.3.0 | BSL 1.1 | **Φ-lifecycle extraction** (proposed/confirmed/rejected, fold, ruleEngine hooks, rule.warnAt secondary timers) — выделен из core для headless-хостов |
| `@intent-driven/host-contracts` | 0.2.0 | MIT | **Контракт shell↔module** (2026-04-25) — `AppModuleManifest` / `ShellContext` / `NavSection` / `RouteConfig` / `CommandConfig` + `validateModuleManifest` / `mergeNavSections` / `HEADER_SLOTS` |
| `@intent-driven/adapter-mantine` | 1.3.0 | BSL 1.1 | Mantine UI-kit (corporate) + shell.sidebar |
| `@intent-driven/adapter-shadcn` | 1.3.0 | BSL 1.1 | shadcn/ui doodle + shell.sidebar |
| `@intent-driven/adapter-apple` | 1.3.0 | BSL 1.1 | Apple visionOS-glass + shell.sidebar |
| `@intent-driven/adapter-antd` | 1.4.0 | BSL 1.1 | AntD enterprise-fintech. 4 freelance-patch'а (button label/children, DateTime withTime, fieldRole price, maxLength/pattern) закрыты; form-header adapter добавлен (§9.4) |
| `@intent-driven/canvas-kit` | 0.2.0 | BSL 1.1 | SVG/canvas утилиты (9 helpers) |

### Scaffold-путь (Этапы 1-3, добавлен 2026-04-21)

Новый путь для соло-фрилансеров, строящих CRUD-платформы: `npx create-idf-app` → importer из существующей схемы → enricher → effect-runner → BFF handlers.

| Пакет | Версия | Лицензия | Назначение |
|---|---|---|---|
| `@intent-driven/create-idf-app` | 0.6.0 | MIT | `npx create-idf-app my-app` scaffold-генератор (Этап 1 MVP) |
| `@intent-driven/importer-postgres` | 0.4.0 | MIT | Postgres `information_schema` → ontology (CRUD + FK-relations + role-inference, Phase A) |
| `@intent-driven/importer-openapi` | 0.3.0 | MIT | OpenAPI 3.x spec → ontology (`$ref` resolution, operationId override, Phase D) |
| `@intent-driven/importer-prisma` | 0.4.0 | MIT | `.prisma` → ontology через `@mrleebo/prisma-ast` (Phase E) |
| `@intent-driven/enricher-claude` | 0.2.0 | MIT | AI-обогащение ontology через subprocess к локальному `claude` CLI (Phase B) |
| `@intent-driven/effect-runner-http` | 0.3.0 | MIT | generic HTTP CRUD-runner + `useHttpEngine` React hook (Phase C) |
| `@intent-driven/auth` | 0.2.0 | MIT | JWT + Supabase providers + `useAuth` hook (Phase F) |
| `@intent-driven/server` | 0.2.0 | MIT | BFF handlers (document / voice / agent) для Vercel-style serverless functions (Phase G) |
| `@intent-driven/cli` | 1.4.4 | MIT | `idf init` (LLM), `idf import postgres|openapi|prisma`, `idf enrich` |

**Release pipeline:** changesets-bot автоматически создаёт «Version Packages» PR при merge в main; публикация в npm при merge release PR.

### SDK-тесты (реальные, 2026-04-22)

- `core`: 99 test files (~916 assertions)
- `renderer`: 38 test files (~175 assertions)
- `engine`: 10 test files
- `canvas-kit`: 9 test files (36 assertions)
- `adapter-antd` 2 / `adapter-apple` 1 / `adapter-mantine` 1 / `adapter-shadcn` 1 (34 assertions суммарно)
- `importer-postgres` 8 / `importer-prisma` 5 / `importer-openapi` 4
- `enricher-claude` 5, `effect-runner-http` 4, `create-idf-app` 5
- `server` 3, `auth` 3, `cli` 2

---

## 2a. Scaffold-путь (Этапы 1-3, релиз 2026-04-21)

Новый maturation-slope для соло-фрилансеров / микростудий, строящих CRUD-платформу против существующей базы данных или OpenAPI-контракта. Путь параллелен классическому «author ontology from scratch» и замыкает петлю **«импорт → обогащение → рантайм → материализация»**.

### Этап 1 — MVP (`create-idf-app@0.6.0`)

```bash
npx create-idf-app my-crm
```

Scaffold-генератор создаёт структуру проекта, примерную ontology, Vite + React setup, готовый к `npm run dev`.

### Этап 2 — источники онтологии (Phase A–E)

| Источник | Пакет | Что делает |
|---|---|---|
| Postgres | `importer-postgres@0.4.0` | `information_schema` → ontology (CRUD intents + FK-relations + role-inference через username column match) |
| OpenAPI 3.x | `importer-openapi@0.3.0` | `$ref` resolution, `operationId` override для intent-names |
| Prisma | `importer-prisma@0.4.0` | `.prisma` → ontology через `@mrleebo/prisma-ast` |
| Claude AI | `enricher-claude@0.2.0` | subprocess к локальному `claude` CLI; cache + suggestions apply (labels/fieldRole/valueLabels/compositions) |

### Этап 3 — рантайм + материализация (Phase C/F/G/I)

| Компонент | Пакет | Что делает |
|---|---|---|
| HTTP CRUD-runner | `effect-runner-http@0.3.0` | generic RESTful translator для IDF intents + `useHttpEngine` React hook |
| Auth | `auth@0.2.0` | JWT / Supabase providers + `useAuth` hook |
| BFF handlers | `server@0.2.0` | document / voice / agent-API для Vercel-style serverless functions |
| Native format (Phase I) | `importer-*` → `materializers/*` | замыкает loop: импортированная ontology → document/voice/agent БЕЗ host-кода |

**Workzilla-clone** — первый dogfood-проект scaffold-пути, выявил 6 P0 блокеров (§8.1–8.7) и 6 post-bump баг (§9.1–9.6), все закрыты в idf-sdk PR #177 / #179 (2026-04-21).

---

## 3. Материализации (4 равноправных читателя формата)

| Материализация | Endpoint / API | Форматы | Имплементация |
|---|---|---|---|
| **Pixels** | adapter registry + ProjectionRendererV2 | React DOM | 4 UI-адаптера, capability surface, Token Bridge |
| **Voice** | `GET /api/voice/:domain/:projection` | json / SSML / plain | `voiceMaterializer.cjs`; brevity-rules (top-3, money как «два с половиной миллиона рублей») |
| **Agent API** | `/api/agent/:domain/{schema,world,exec}` | JSON | JWT + `role.canExecute` + `visibleFields` + preapproval guard (5 predicate kinds) |
| **Document** | `GET /api/document/:domain/:projection` | HTML / JSON | `documentMaterializer.cjs`; structured document-граф, viewer-scoped |

Viewer-scoping через `filterWorldForRole` применяется ко всем четырём.

---

## 4. UI-адаптеры

| Адаптер | Стиль | Дефолт для | Capability (chart / statistic) |
|---|---|---|---|
| Mantine | Corporate / data-dense | booking, planning, workflow, messenger, sales | SVG fallback / ❌ |
| shadcn/ui (Doodle) | Handcrafted / sketch | lifequest | SVG / ❌ |
| Apple visionOS-glass | Premium / minimal | reflect | SVG / ❌ |
| AntD enterprise-fintech | Dashboard / Statistic / @ant-design/plots | invest | line/pie/column/area / ✓ sparkline ✓ |

Переключение в runtime через PrefsPanel ⚙ → UI-kit. `adapter.capabilities` декларативно описывает поддерживаемые primitive'ы и варианты; `getCapability` / `supportsVariant` дают graceful fallback при mismatch.

---

## 5. Rules Engine, Scheduler, Pattern Bank

### Reactive Rules Engine
Event-condition-action в `ontology.rules[]`. Четыре extension'а v1.5:
- `aggregation: { everyN }` — counter per-user
- `threshold: { lookback, field, condition }` — predicate над последними N записями
- `schedule: { after | at | revokeOn }` — темпоральный триггер
- `condition: "<expr>"` — JS expression evaluator (whitelisted Math)

Invest использует все четыре в одном домене.

### Темпоральный scheduler
`server/timeEngine.js` с `TimerQueue` (in-memory min-heap по `firesAt`), `hydrateFromWorld` при старте. Два системных intent'а: `schedule_timer(afterMs|atISO, target, revokeOn?)` и `revoke_timer(timerId)`. Таймеры — обычные эффекты `τ=scheduled_timer` в Φ.

**`rule.warnAt`** (2026-04-21, `@intent-driven/engine@0.3.0`) — secondary timer за `warnAt` до основного `firesAt` с тем же `revokeOn`. Закрывает session-backlog §5.2.

Первое применение: `booking.auto_cancel_pending_booking` (5min — актуальное значение в коде).

### Pattern Bank
- **37 stable patterns**, **35 с `structure.apply`** (matching-only: `global-command-palette`, `keyboard-property-popover`). Физическая раскладка в `idf-sdk/packages/core/src/patterns/stable/`:
  - `detail/` (13): `computed-cta-label`, `footer-inline-setter`, `keyboard-property-popover`, `lifecycle-gated-destructive`, `lifecycle-locked-parameters`, `m2m-attach-dialog`, `observer-readonly-escape`, `phase-aware-primary-cta`, `rating-aggregate-hero`, `review-criterion-breakdown`, `reverse-association-browser`, `subcollections`, `timer-countdown-visible`, `vote-group`
  - `catalog/` (11): `catalog-action-cta` (из §8.1 Workzilla), `catalog-creator-toolbar`, `catalog-default-datagrid`, `catalog-exclude-self-owned`, `discriminator-wizard`, `faceted-filter-panel`, `grid-card-layout`, `hero-create`, `inline-chip-association`, `kanban-phase-column-board`, `paid-visibility-elevation`
  - `cross/` (9): `bidirectional-canvas-tree-selection` (workflow-editor field-test 2026-04-24), `bulk-action-toolbar`, `global-command-palette`, `hierarchy-tree-nav`, `inline-search`, `irreversible-confirm`, `optimistic-replace-with-undo`, `reputation-tier-badge`, `undo-toast-window`
  - `feed/` (3): `antagonist-toggle`, `composer-entry`, `response-cost-before-action`
- **Cross-projection state-sharing (2026-04-24)** — первая категория паттернов, требующих shared runtime state между двумя projections. Реализована через `@intent-driven/renderer` `<CoSelectionProvider>` + `useCoSelection` / `useCoSelectionEnabled` hooks + adapter capability `interaction.externalSelection`. Промоция `bidirectional-canvas-tree-selection` (workflow-editor field-test) закрыла 3 promotion-gate'а: trigger.kind `co-selection-group-entity` (schema-level), renderer primitive contract, adapter capability с graceful fallback.
- **Falsification framework**: каждый паттерн имеет `.test.js` с shouldMatch / shouldNotMatch fixtures (31 test-файл).
- **Studio viewer** `/studio/patterns` + prototype `PatternInspector` drawer (toggle `Cmd+Shift+P`).
- **Derivation X-ray (v1.13, core@0.10.0, renderer@0.6.0)** — снятие «uncanny valley»: каждый дериввированный slot видимо помечен. SDK core: `computeSlotAttribution(intents, ontology, projection) → { slotPath → { patternId, action } }` через deep-diff после каждого `pattern.structure.apply`. SDK renderer: `PatternPreviewOverlay` mode `"xray"` (warm-yellow border + hover trail с requirements ✓/✗ + Open in Graph3D ↗); `ProjectionRendererV2` props `xrayMode` / `slotAttribution` / `xrayDomain` / `onExpandPattern` / `patternWitnesses`; `ArchetypeDetail` оборачивает derived sections. Host: `/api/patterns/explain` отдаёт `slotAttribution`; `/api/studio/domain/:name/graph` содержит pattern-узлы (kind `pattern`, IcosahedronGeometry в Graph3D) + edges `applies-to` / `affects` через `server/studio/patternNodes.js`. PatternInspector — global radio Off/X-ray в верхней секции drawer (mode независим от Apply preview). Studio hash-router `#graph/focus?domain=&pattern=&projection=` — открывает Studio в новой вкладке с подсветкой узла. CLI `scripts/derivation-diff.mjs` для standalone diff'а (`--pattern X` / `--without X` / `--json`). Известное ограничение: invest/portfolio_detail имеет ручные sections — subcollections matched, но attribution пустая (by design).

### Pattern research pipeline (двухступенчатый)

- **Ступень 1 — research candidate**: `scripts/pattern-researcher.mjs` + domain-specific batch'и (`freelance-pattern-batch.mjs`, `jobboard-pattern-batch.mjs`, `uncovered-domains-pattern-batch.mjs`) извлекают кандидатов из реальных приложений (avito, profi и т.п.) в `idf/pattern-bank/candidate/` как JSON с `trigger.requires`, `rationale.evidence`, `falsification.shouldMatch/shouldNotMatch`.
- **Ступень 2 — SDK candidate**: прошедшие human-review кандидаты переносятся в `idf-sdk/packages/core/src/patterns/candidate/` (на 2026-04-19 пусто — все review'ы либо сразу в `stable`, либо отклонены).
- **Ступень 3 — stable**: после добавления apply-функции (optional) и falsification fixtures — в `idf-sdk/packages/core/src/patterns/stable/`.
- `anti/` директория в SDK зарезервирована под anti-patterns (пусто).

### Invariants (5 kinds)
`role-capability`, `referential`, `transition`, `cardinality`, `aggregate`. Dispatch через `server/schema/invariantChecker.cjs`; handlers в `@intent-driven/core/invariants/*.js`. Проверяются в `onConfirmed`; на violation — rollback через `cascadeReject` + SSE `effect:rejected`. Декларации: invest (5), sales (3), delivery (3).

**Handler schema drift (backlog 1.1, ЗАКРЫТ 2026-04-20):** `invariants/normalize.js` + try/catch в `invariants/index.js` — альтернативные формы (`{entity, field, references}`) нормализуются, unknown shapes → warning (не cascade-reject). Invariant.where поддерживается всеми 4 kinds (`referential`, `aggregate`, `transition`, `cardinality`).

**Domain scoping — частично закрыт (backlog 1.4):** `invariant.where` даёт автору способ фильтровать row-set. Полный auto-discriminator (`__domain` provenance в Φ) deferred — требует host server changes; автор сегодня использует existing fields или добавляет discriminator-поле вручную.

**Multi-owner ownership (backlog 3.2, ЗАКРЫТ 2026-04-20):** `entity.owners: ["customerId", "executorId"]` + `intent.permittedFor` override в SDK core. `filterWorldForRole` и `assignToSlotsDetail::ownershipConditionFor` генерируют OR-expression по всем owner-полям. Legacy `ownerField` остаётся backward-compat через `getOwnerFields()` util. Host freelance ожидает миграцию на `Deal.owners`.

---

## 5a. Φ schema-versioning (закрыт 2026-04-28)

P0-architecture sprint от внешнего design review 2026-04-26. 6 phases shipped в `@intent-driven/core` + `@intent-driven/engine`:

| Phase | Что | Где |
|---|---|---|
| 0 | helpers `UNKNOWN_SCHEMA_VERSION`, `getSchemaVersion`, `tagWithSchemaVersion`, `hashOntology` | core@0.107.0 (PR idf-sdk#443) |
| 1 | engine validator проставляет `effect.context.schemaVersion` при confirm/reject | engine@0.4.0 (PR idf-sdk#445) |
| 2 | `ontology.evolution[]` append-only лог + helpers (`getEvolutionLog`, `addEvolutionEntry`, `getAncestry`, ...) | core@0.108.0 (PR idf-sdk#447) |
| 3 | `applyUpcaster` (4 declarative + functional fn) + `pathFromTo` + `upcastEffect/Effects` + `foldWithUpcast` | core@0.109.0 (PR idf-sdk#449) |
| 4 | Reader gap policy (4 reader'а × 3 gap kinds × 6 actions) + `detectFieldGap` / `resolveGap` / `scanEntityGaps` | core@0.110.0 (PR idf-sdk#451) |
| 5 | Layer 4 drift detector — `computeCanonicalGapSet`, `compareReaderObservations`, `detectReaderEquivalenceDrift` | core@0.111.0 (PR idf-sdk#453) |
| 6 | Manifest v2.1 chapter «Эволюция онтологии» (`docs/manifesto-v2.1-ontology-evolution.md`) + L3-evolution conformance class в `idf-spec` | этот PR + idf-spec follow-up |

**Жёсткие архитектурные пункты, зафиксированные в spec'е:**
1. Фиксированный порядок declarative-шагов (rename → splitDiscriminator → setDefault → enumMap) — нормативен для cross-stack
2. `fn` upcaster — design-time only, никакого runtime-LLM (иначе смерть детерминизма)
3. fn-throw → safe fallback на declarative result + `console.warn`
4. cyrb53 hash + canonicalize JSON — алгоритм нормирован для cross-stack совместимости

**Reader-equivalence (§23 axiom 5)** теперь runtime-проверяемое свойство, а не аксиома. `detectReaderEquivalenceDrift(world, ontology, observations)` сравнивает gap-set'ы 4 reader'ов; дивергенция в пересечении scope = drift event. Не сравнивает rendered output (incomparable shapes), не проверяет equivalence actions (это контракт по policy).

**Backward compat:** legacy эффекты с `UNKNOWN_SCHEMA_VERSION` проходят полную цепочку upcaster'ов от root до target. Онтологии без `evolution[]` работают через обычный `fold` без изменений.

**Open items до production pilot'а:**
- L3-evolution conformance class в `idf-spec` (отдельный PR, идёт параллельно)
- Минимум 2 реальных upcast'а в production tenant'е (один declarative, один functional) — milestone первого pilot'а
- Reader integrations в renderer / voiceMaterializer / documentMaterializer / agent route — follow-up PRs по мере подключения

## 6. Open items

### Перенесённые из архивного v1.12

- ✅ **Composite / polymorphic entities** — declarative API ЗАКРЫТ 2026-04-26 (idf-sdk PR #347): `entity.kind: "polymorphic"` + `discriminator` + `variants[]`; helpers `isPolymorphicEntity` / `getEntityVariants` / `getEffectiveFields` / `getUnionFields` / `validatePolymorphicEntity`. Production-derivation (form-archetype synthesis на discriminator + per-variant, filterWorld awareness, materializer-output) — отдельные sub-projects.
- **Adapter capability checks at startup** — новый primitive kind без уведомления адаптеров
- ✅ **`@intent-driven/server` extraction (Phase 3)** — ЗАКРЫТ 2026-04-21 как `@intent-driven/server@0.2.0` (BFF handlers document/voice/agent для Vercel-style serverless) и `@intent-driven/engine@0.3.0` (Φ-lifecycle)
- **Server-rendered PDF / DOCX** поверх documentMaterializer
- ✅ **Pattern Bank: `structure.apply` для stable паттернов** — 35 из 37 имеют apply; 2 matching-only (`global-command-palette`, `keyboard-property-popover`) — by design
- **Role-specific FK convention** — sales/seller_profile не матчится через findSubEntities (seller/targetUser vs userId)
- **PatternInspector component test** — требует `@testing-library/react` + `jsdom`
- **Studio PatternBank URL write-back** — domain change не пишет в URL
- **X1: удаление 9 explicit `subCollections` overrides** — после ≥1 релиза с apply в проде
- **Pattern Bank anti/** — директория зарезервирована под anti-patterns, пусто
- **Pattern Bank: ML / auto-learning** паттернов из приложений
- **Cluster-friendly scheduler** — single-leader TimerQueue не distributed-ready

### Из freelance field-test (2026-04-19, freelance/sdk-backlog PR #44)

Полный классифицированный список (40+ пунктов, P0/P1/P2) — в [`sdk-improvements-backlog.md`](sdk-improvements-backlog.md). Статус P0:

- ✅ **Invariant handler schema drift** (1.1) — ЗАКРЫТ (`normalize.js` + try/catch)
- ✅ **`AntdButton` label vs children** (2.1), **`AntdDateTime` без времени** (2.2), **`AntdNumber` fieldRole** (2.3), **`AntdTextInput` maxLength/pattern** (2.4) — ЗАКРЫТЫ в adapter-antd@1.2.0, host workarounds удалены
- ✅ **`ownershipConditionFor` single-owner** (3.2) — ЗАКРЫТ (`entity.owners` + `intent.permittedFor` + `getOwnerFields` util)
- ✅ **`PrimaryCTAList` multi-param phase-transitions** (3.1) — ЗАКРЫТ в idf-sdk PR #50 (overlay-form через `wrapByConfirmation`)
- ✅ **`inferParameters` top-level** (4.1), **`heroCreate` matcher** (4.2), **`footer-inline-setter` агрессивен** (4.3) — ЗАКРЫТЫ в idf-sdk PR #50
- ⏳ **Domain scoping инвариантов** (1.4) — частично (invariant.where; auto-discriminator deferred)

### Workzilla-clone dogfood (2026-04-21, idf-sdk PR #177 + #179)

Dogfood-сессия на scaffold-пути выявила и закрыла систематические P0-блоки для «scaffold → production»:

- ✅ **8.1 Action-CTA автогенерация** — новый pattern `catalog-action-cta` (item-slot trailing button) + `detail-phase-aware-cta`
- ✅ **8.2 Form-archetype synthesis** — `generateCreateProjections` для insert-intent'ов; `ArchetypeForm` рендерит по `intent.parameters`
- ✅ **8.3 `projection.witnesses[]` strict** — respect author's витнессы + ontology field.role для primitive-selection
- ✅ **8.4 Inline primitives** — child-resolver на полный primitive-registry (`statistic`/`sparkline`/`chart`/`map`/`countdown`/`badge`)
- ✅ **8.6 `toneMap` / `toneBind`** — badge принимает map-per-value или client-computed `toneBind`
- ✅ **8.7 Importer enrich** — больше семантики в heuristic-importer'е; enricher-claude добивает остальное
- ✅ **9.1 `type: "string"` canonical map** — `inferControlType` прогоняет через `mapOntologyTypeToControl`
- ✅ **9.2 default `idParam`** — detail без singleton получает `idParam = <entityLower>Id` автоматически
- ✅ **9.3 `onItemClick` edge-preference** — предпочитает edge, где `to.mainEntity === from.mainEntity`
- ✅ **9.4 Form-header adapter surface** — `getAdaptedComponent("shell", "formHeader")`, дефолт нейтральный CSS-vars
- ✅ **9.6 Synthesized projections export** — `artifact.projection` = projectionDef

⏳ **9.5 guard** на bare `projection.name`, **9.7** `inferFieldRole` legacy-role warning, **9.10–9.12** heroCreate multi-param + Badge sx + witness alignSelf (в PR `fix/heroCreate-badge-align-9.10-9.12`, pending merge).

### Tri-source field-research P0 sprint (2026-04-25/26)

Анализ трёх production-стэков (workflow-editor LLM/AI-agent, workflow-editor data-pipeline, Angular-imperative legacy с polymorphic 200+ кубами и 18-fork brand-overlay) выявил convergent evolution и закрыл четыре фундамента в SDK:

- ✅ **`@intent-driven/host-contracts@0.2.0` extraction** (idf-sdk PR #335) — формализация контракта `shell ↔ module` (AppModuleManifest / ShellContext / NavSection / RouteConfig + `validateModuleManifest` / `mergeNavSections` / `HEADER_SLOTS`). Type-only пакет, MIT.
- ✅ **`entity.kind: "polymorphic"` + `discriminator` + `variants[]`** (idf-sdk PR #347) — declarative API для node-type explosion 70+/200+. Helpers: `isPolymorphicEntity` / `getDiscriminatorField` / `getEntityVariants` / `getEntityVariant` / `listVariantValues` / `getEffectiveFields` / `getUnionFields` / `getVariantSpecificFields` / `validatePolymorphicEntity`. Закрыт давний open item «Composite / polymorphic entities». Production-derivation — отдельные sub-projects.
- ✅ **Canonical type-map + auto field-mapping FE↔BE** (idf-sdk PR #349, закрытие §9.1) — `CANONICAL_TYPES` (~40), `TYPE_ALIASES` (importer aliases), `normalizeFieldType` / `normalizeFieldDef`, `camelToSnake` / `snakeToCamel` / `inferWireFieldName`, `applyFieldMapping(obj, mapping, "toWire"|"fromWire")`, `buildAutoFieldMapping`.
- ✅ **4 candidate-паттерна** (idf-sdk PR #338) — `human-in-the-loop-gate`, `composition-as-callable`, `agent-plan-preview-approve`, `lifecycle-gates-on-run`. `CURATED_CANDIDATES.length` 6 → 10. Matching-only; promotion в stable + apply — отдельные sub-projects.
- ✅ **CI scaffold-smoke OOM fix** (idf-sdk PR #339) — `SKIP_DTS=true` env для `pnpm -r build`.

Полные детали — `sdk-improvements-backlog.md §11`.

### Rolling sync (2026-04-26 docs sweep)

Backlog-items, которые были закрыты ранее (по коду), но оставались помечены open в backlog'е до настоящей синхронизации:

- ✅ **IrreversibleBadge auto-placement** (sdk-improvements §3.3) — `assignToSlotsDetail.js:827` инжектит `{type:"irreversibleBadge", bind:"__irr"}` в header-row для detail-проекций mainEntity с irreversible action. Тесты `assignToSlotsDetail.test.js:208-267` («backlog 3.3»). `ConfirmDialog.jsx:7-16` поддерживает `spec.__irr` (decl) и `item.__irr` (post-confirm) с `reason` + configurable `confirmLabel`. Renderer primitive в `IrreversibleBadge.jsx`.
- ✅ **Inline-children family** (sdk-improvements §10.4abc, ArgoCD G-A-4) — pipeline полный: `importer-openapi.extractInlineArrays` (idf-sdk #306) + `SubCollectionSection` inline-mode по `inlineSource` path без FK-lookup (#315) + `renderAs` dispatchers `resourceTree` / `conditionsTimeline` (`PRIMITIVES.resourceTree`, named exports `ResourceTree` / `EventTimeline`). ArgoCD host workaround'ы (`Resource` / `ApplicationCondition` синтетические entities) могут быть удалены в follow-up cleanup PR.

### Cross-cutting инсайты

- **Intent salience — alpha-fb → 0 (ЗАКРЫТ 2026-04-20)**: SDK `bySalienceDesc` расширен ladder'ом `salience desc → declarationOrder asc → alphabetical (last resort)`. `declarationOrder` автоматически из `Object.entries(INTENTS)` index в `assignToSlotsDetail` + `assignToSlotsCatalog`. Witness-basis `declaration-order` — authorial signal, `alphabetical-fallback` — practically unreachable. Baseline 19 witnesses в 8 доменах → **0 во всех 10 доменах** без массовой доменной аннотации. 17 ручных `salience: "primary"` (sales/messenger/lifequest/reflect/booking/planning/workflow/freelance) — explicit-better-than-implicit для primary semantic roles, но не обязательны.
- **Derivation X-ray (v1.13)**: добавлен observability слой над pattern-bank apply. `computeSlotAttribution` — per-slot провенанс, `PatternPreviewOverlay` mode `"xray"` — warm-yellow overlay с hover-popover trail, Studio `#graph/focus` deep-link + pattern-узлы в Graph3D. Сняло «uncanny valley» для автора.
- **Drift-protection spec (v1.13)**: формализованы три detector'а поверх §24 methodological note — conformance-drift (Layer 1), override-coefficient (Layer 2), reader-equivalence-drift (Layer 3). §23 получил аксиому 5 (reader-equivalence). Spec в `idf-manifest-v2.1/docs/design/drift-protection-spec.md`.
- **Host antd cleanup (ЗАКРЫТ 2026-04-20)**: 4 workaround'а в `DomainRuntime.jsx` удалены после SDK `@intent-driven/adapter-antd@1.2.0`. `patchedAntd` chain заменён прямым `antdAdapter`.
- **SDK утекает в host** — после antd-cleanup shim-слой практически исчез. Host использует SDK напрямую; исключения точечные (e.g. auth-flow).
- **Particle uniformity деградирует со сложностью** — 5/10 доменов используют custom `buildCustomEffects` (freelance имеет ~9 custom ветвей). Тренд ухудшается: freelance привнёс большой custom блок из-за отсутствующих SDK-абстракций (composite cardinality, expression invariant deferred).

### Известные прототип-специфичные проблемы

- **`vite build` периодически падает** с ENOTEMPTY + ошибкой порядка CSS `@import` — ручной fix, не блокирует dev-server и тесты
- **entity.kind `mirror`** — маркер зарезервирован, в коде не применяется; `internal` — implicit default
- **fieldRoles `money` / `percentage` / `trend` / `ticker`** — полностью рендерятся только в AntD; остальные адаптеры используют text-fallback
- **Particle uniformity** — 5 из 10 доменов используют generic `buildEffects`; 5 имеют custom-handlers (messenger / workflow / booking / freelance / частично invest)
- **5/10 доменов — legacy** (имеют ManualUI.jsx); 5/10 — чисто-кристаллизационные (артефакт рендерится только через кристаллизатор + рендерер)

---

## 7. Команды запуска

```bash
npm run calendar     # :3002 внешний календарь (опц.)
npm run server       # :3001 основной API
npm run dev          # Vite :5173 UI
npm run invest-ml    # :3003 мок ML-сигналов (опц.)
npm run invest-fuzzy # :3004 fuzzy-scoring (опц.)
npm run market-data  # :3006 price-tick feed (опц.)
npm test             # vitest (716 тестов в прототипе, ~1342 суммарно с SDK)
npm run agent-smoke  # 75-шаговый integration
npm run build        # prod-сборка (периодически падает, см. §6)
```

---

## 8. Cross-stack реализации

Помимо референсной (React/Node), формат валидируется **тремя параллельными реализациями** на альтернативных стеках. Каждая пишется в изоляции: единственный input — `~/WebstormProjects/idf-spec/`, чтение исходников idf / idf-sdk / чужих реализаций запрещено.

| Репо | Стек | Scope | Состояние (2026-04-22) |
|---|---|---|---|
| `~/WebstormProjects/idf-go/` | Go 1.22+, `xeipuuv/gojsonschema` | L1 + L2 + L3 | v0.1.3 — materializeAsDocument package + CLI Step 5; library + events L1+L2+L3 CONFORMANT (16/16 docs) |
| `~/WebstormProjects/idf-rust/` | Rust 1.95+, `serde`, `jsonschema` | L1 + L2 + L3 | v0.1.1 — materializeAsDocument module; oба домена L1+L2+L3 CONFORMANT (16/16 docs) |
| `~/WebstormProjects/idf-swift/` | Swift 6.2 (Package.swift) | L1 + L2 + L3 | v0.1.1 — materializeAsDocument module; oба домена L1+L2+L3 CONFORMANT (16/16 docs) |

Эти реализации — структурный стресс-тест формата: если все четыре стека `fold(Φ)` одинакового фикстура дают одинаковый world, формат decoupled от языка. Расхождение — прямой баг-репорт к спеке. **Document materialization (L3) добавлен синхронно во все три стека 2026-04-21** вместе с нормированием в `idf-spec` v0.2.0.

Манифест §26 называет «второй reference implementation» направлением развития. Фактически уже идут три; §26 следует переформулировать в следующей ревизии манифеста.

---

## 9. Спецификация

**Репо:** `~/WebstormProjects/idf-spec/`

Нормативная спецификация формата v0.1 — отдельный проект, пишется по `source/manifesto-v2.snapshot.md` (frozen snapshot + SHA-256), без чтения кода референсной реализации.

**Структура:**
- `spec/00-introduction.md`, `01-conformance.md`, `02-axioms.md`
- `spec/03-objects/` — JSON Schema для ontology / intent / effect / projection / artifact
- `spec/04-algebra/` — fold, crystallize, viewer-scoping
- `spec/05-materializations/` — pixel / voice / agent API / document
- `spec/schemas/` — machine-readable JSON Schema
- `spec/fixtures/` — library (L1+L2), events (L2+), document (L3 partial, добавлен v0.2.0) эталонные test vectors

**Версии:** v0.1 — L1+L2. **v0.2.0 (2026-04-21, ветка `feat/spec-v0.2-document`)** — нормирует document materialization (L3 partial): JSON Schema для document-графа, `spec/fixtures/document/` с 16 expected-фикстурами. L4 (voice / agent BFF) резервируется для v0.3+.

Манифест §3 и §22 описывают спеку как «запланированную». Фактически спека в активной разработке — Go/Rust/Swift реализации уже проходят conformance против её fixtures (library + events + document).

---

## 10. История эволюции

Хронология реализации документирована по версиям в `docs/archive/manifesto-v1.3.md` … `manifesto-v1.12.md`.

**Методологическая заметка (ex §15 v1.11):** манифест имеет три вида drift — **числовой** (счётчики устаревают), **aspirational** (заявлено, не реализовано), **фактический** (значения в документе расходятся с кодом). v2 изолирует эти drift'ы: timeless-манифест не содержит числовых фактов, живой `implementation-status.md` обновляется вместе с кодом, архив остаётся как снимок во времени.
