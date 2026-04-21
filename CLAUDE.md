# CLAUDE.md — Intent-Driven Frontend

## Язык общения

Все ответы, комментарии, документация и коммит-сообщения — **на русском языке**.

## Git-коммиты

**Никогда не добавляй Claude (или другого бота) в соавторы коммитов.** Никаких `Co-Authored-By: Claude ...` / `🤖 Generated with ...` трейлеров. Коммиты — от имени автора, без упоминания инструмента.

## Суть проекта

**IDF — формат описания приложения (уровень OpenAPI / JSON-LD), не фреймворк.** Артефакт v2 с онтологией, намерениями, проекциями и ролями — тип данных; адаптеры и материализаторы — *читатели* формата. LLM участвует в проектировании и кристаллизации, но **не в рантайме**. **Четыре равноправные материализации** (Часть IV манифеста v2): пиксели (4 UI-адаптера), голос (`/api/voice/*`), агентский API (`/api/agent/*`), документ (`/api/document/*`).

## Ключевые документы

- **Манифест v2** (`docs/manifesto-v2.md`) — timeless-документ о формате IDF: 26 глав в 8 частях (I. Тезис · II. Объекты формата · III. Алгебра · IV. Четыре читателя формата · V. Авторство · VI. Conformance набросок · VII. Границы · VIII. Перспектива). Читай перед работой над ядром формата.
- **Имплементационный статус** (`docs/implementation-status.md`) — живой документ: 11 доменов (672 намерения), SDK пакеты, ~1960 тестов (799 host + 916 core + 175 renderer + 36 canvas-kit + 34 adapters), open items. Обновляется вместе с кодом и часто опережает этот CLAUDE.md.
- **SDK backlog** (`docs/sdk-improvements-backlog.md`) — 40+ gap'ов из freelance field-test'а. P0-блок закрыт 2026-04-20 (antd 2.1–2.4, invariants 1.1, multi-owner 3.2). Остаются §3.1 (PrimaryCTAList multi-param), §4.1–4.3 (inferParameters / heroCreate / footer-inline-setter).
- **Session backlog** (`docs/backlog.md`) — cross-cutting очередь между сессиями (inbox для deferred items, insights, находок; не дублирует sdk-improvements-backlog).
- **Design-спеки** (`docs/design/`) — `intent-salience-spec.md`, `2026-04-20-sdk-p0-integration-design.md`.
- **Архив манифестов v1.3–v1.12** (`docs/archive/`) — исторические версии с change-log тоном. Актуальные факты — в v2 + implementation-status.
- **Спецификация формата v0.1** — репо `~/WebstormProjects/idf-spec/`. JSON Schema для core-объектов, conformance classes L1–L2, test fixtures. L3–L4 резервируются для v0.2+.
- **Cross-stack реализации** — `~/WebstormProjects/idf-{go,rust,swift}/` — три независимые реализации против `idf-spec` (L1+L2). Структурный стресс-тест «формат decoupled от языка».
- **Manifesto v2.1 (in-flight)** — `~/WebstormProjects/idf-manifest-v2.1/` — рабочий репо для v2.1. Содержит `docs/design/drift-protection-spec.md` (три detector'а поверх §24 + reader-equivalence как §23 аксиома 5), intent-salience-spec, rule-R9/R10/R1b специфика, debugging-derived-ui-spec, layered authoring draft.
- **Полевые тесты 1–11** (`docs/field-test-*.md`) — от очереди чтения до delivery. Файлы `field-test-8/9/12/13` отсутствуют в docs (частичное покрытие numbering'а); freelance и compliance документированы только в implementation-status + sdk-backlog.

## Архитектура

### Домены

| Домен | Намерений | Сущности | Особенности |
|-------|-----------|----------|-------------|
| booking | 22 | Specialist, Service, TimeSlot, Booking, Review | |
| planning | 17 | Poll, TimeOption, Participant, Vote, Meeting | кворум, фазы |
| workflow | 15 | Workflow, Node, Edge, Execution, NodeResult | React Flow canvas |
| messenger | 100 | User, Contact, Conversation, Participant, Message | WebRTC, real-time WS |
| sales | 225 | User, Listing, Bid, Category, Order, Review, Dispute, Watchlist, Message, SavedSearch, Notification | 4 роли, **чисто-кристаллизационный** (нет ManualUI.jsx) |
| lifequest | 56 | User, Sphere, Goal, Habit, HabitLog, Task, SphereAssessment, VisionItem, Badge, Quote | **боевой домен**, shadcn/ui адаптер, doodle-стилистика, mobile-first (BottomTabs), 6 custom canvas |
| reflect | 47 | User, MoodEntry, Activity, EntryActivity, Hypothesis, HypothesisEvidence, Insight, Reminder, Tag, EntryTag | **9-й полевой тест**, **Apple visionOS-glass** адаптер, Mood Meter (Yale RULER), 6 analytical canvas, **Rules engine extensions** (aggregation/threshold/schedule/condition) |
| invest | 61 | User, Portfolio, Position, Asset, Transaction, Goal, RiskProfile, Recommendation, Alert, Watchlist, MarketSignal, Assignment, AgentPreapproval, Rule | **10-й полевой тест**, **AntD enterprise-fintech** адаптер. 4 роли (investor/advisor/agent/observer), 7 правил Rules Engine (все 4 v1.5 ext), 3 внешних ML-сервиса. Закрыл 6 §26 open items. |
| delivery | 45 | User, Merchant, MenuItem, Zone, DispatcherAssignment, Order, OrderItem, Delivery, Address, CourierLocation, Payment, Notification, Review, AgentPreapproval | **11-й полевой тест**, food/groceries last-mile. 5 ролей (customer/courier/merchant/dispatcher/agent), dispatcher m2m через DispatcherAssignment. 8 правил (5 temporal schedule v2, 1 threshold, 1 condition, 1 aggregation), 3 canvas с map-primitive, `capture_payment` с `__irr`. Применяет все 3 paradigm additions v1.7 совместно. |
| freelance | 46 | User, Task, Response, Deal, Wallet, Transaction, Review, Category | **12-й полевой тест**, биржа услуг. Multi-owner (customerId + executorId) на Deal, escrow (hold/release), revision-loop (`on_review ↔ revision_requested`), комиссия платформы. `__irr.high` на `confirm_deal`. Выявил 40+ SDK gap'ов — см. `docs/sdk-improvements-backlog.md`. |
| compliance | 38 | User, Department, Control, JournalEntry, Approval, AttestationCycle, Attestation, Finding, Evidence, Amendment | **13-й полевой тест**, SOX ICFR / «provable UI». 6 ролей (preparer/reviewer/approver/controlOwner/auditor/cfo), 15 invariants (5 expression-kind — SoD triplet + dynamic threshold + cycle-close), 7 правил (все 4 v1.5 ext), 5 `__irr:high` intents (approve_je / submit_attestation / amend_attestation / sign_off_cycle_404 / file_amendment). **Первый домен со всеми 5 behavioral patterns** signal-classifier'а. AntD reuse. Закрыл backlog §1.1 (expression-kind). |

Переключатель доменов в `prototype.jsx`. Один движок, **одиннадцать** наборов определений. Суммарно 672 намерения.

`.worktrees/petstore-demo/` — отдельный git-worktree с demo-доменом (не в `src/domains/`), HTTP-proxy effect builder + dailySum predicate; used as лёгкий demo surface для внешней аудитории.

### UI-адаптеры (§17)

| Адаптер | Стиль | Дефолт для | Capability (v1.6) |
|---------|-------|-----------|---|
| Mantine | Corporate / data-dense | booking, planning, workflow, messenger, sales | chart: SVG fallback, statistic: ❌ |
| shadcn/ui (Doodle) | Handcrafted / sketch | lifequest | chart: SVG, statistic: ❌ |
| Apple visionOS-glass | Premium / minimal | reflect | chart: SVG, statistic: ❌ |
| **AntD enterprise-fintech** | Dashboard / Statistic / @ant-design/plots | **invest** | chart: line/pie/column/area, statistic: ✓, sparkline: ✓ |

Переключение в runtime через PrefsPanel ⚙ → UI-kit. **adapter.capabilities** (v1.6) — декларативная surface; `getCapability` / `supportsVariant` дают graceful fallback. Token Bridge — формальный CSS-vars contract между адаптером и domain code.

### Структура (верхний уровень)

```
# Прототип (host-слой — минимальный после SDK Phase 2 extraction)
src/
  domains/{booking,planning,workflow,messenger,sales,lifequest,reflect,invest,delivery,freelance,compliance}/
  studio/           # §27 authoring environment — Graph3D + pattern-узлы + Claude proxy (dev-time, :4000)
  runtime/
    DomainRuntime.jsx          # антд-shim чистый после adapter-antd@1.2.0
    renderer/
      auth/                    # host-only: JWT + useAuth
      personal/                # usePersonalPrefs (dup с SDK, tech-debt) + PrefsPanel
      shell/                   # V2Shell, BottomTabs, CrystallizeInspector,
                               # MaterializationsViewer, PatternInspector, humanizeProjectionId

# SDK monorepo: ~/WebstormProjects/idf-sdk/packages/
#   core/            # engine, fold, intentAlgebra, crystallize_v2, invariants/* (6 kinds),
#                    # filterWorld, filterProjectionsByRole, baseRoles, preapprovalGuard,
#                    # materializers (document/voice/auditLog), patterns/ (31 stable, 28 с apply),
#                    # salience, causalSort, conditionParser, anchoring, irreversibility
#   renderer/        # ProjectionRendererV2 + archetypes + primitives (atoms, containers, chart,
#                    # map, IrreversibleBadge, PatternPreviewOverlay, TreeNav, KanbanBoard,
#                    # SubCollectionSection) + adapter registry (capability surface)
#   adapter-{mantine,shadcn,apple,antd}/  # 4 UI-kit реализации, все @1.3.x
#   canvas-kit/      # 9 SVG/canvas утилит
#   cli/             # npx @intent-driven/cli init — 5-шаговый LLM-диалог

server/
  index.js             # Express :3001
  validator.js         # валидация + foldWorld + invariant dispatch + рекурсивный batch
  ruleEngine.js        # Reactive Rules + 4 v1.5 extensions
  timeEngine.js        # TimerQueue (min-heap по firesAt) + hydrateFromWorld
  schema/
    filterWorld.cjs           # + role.scope + entity.kind:"reference" + multi-owner OR
    preapprovalGuard.cjs      # agent лимиты (5 predicate kinds incl. dailySum)
    documentMaterializer.cjs  # document-материализация (§1)
    voiceMaterializer.cjs     # voice-материализация (§1, 3 форматов)
    invariantChecker.cjs      # thin re-export из SDK
    baseRoles.cjs, buildXxxEffects.cjs (11 доменов), intentAlgebra.cjs, checkOwnership.cjs
  routes/
    agent.js            # /api/agent/:domain/* + preapproval hook
    document.js         # /api/document/:domain/:projection
    voice.js            # /api/voice/:domain/:projection
    patterns.js         # /api/patterns/{catalog,falsification,explain,projections,preference}
    studio.js           # /api/studio/domain/:name/graph — pattern-узлы + applies-to/affects edges
    crystallize.js, effects.js, artifacts.js, auth.js, entities.js, workflows.js

scripts/    # 40+: agent-login/smoke (75 шагов), audit-report (7 осей × 10 доменов),
            # derivation-diff (+ invest/sales specializations), derivation-spec-debt,
            # functoriality-{inspect,probe,slots,spec-debt,toolbar-map}, ontology-audit,
            # zazor3-candidates, pattern-researcher (+ domain batches: freelance/jobboard/uncovered),
            # salience-suggestions, conformance-runner, match-golden-patterns, crystallize-llm,
            # migrate-conformance-fixtures, freelance-{accounts,hypothesize,pattern-batch}

invest-ml/      :3003  # мок ML-сигналов
invest-fuzzy/   :3004  # fuzzy-scoring экзотики
market-data/    :3006  # price-tick feed
external-calendar/ :3002

.worktrees/    # параллельный agent-driven workflow — petstore-demo, freelance-polish и др.
```

### Ядро (что нужно знать для работы с кодом)

**Φ как source of truth** — мир = `fold(Φ_confirmed)`, не хранится. Жизненный цикл: `proposed → confirmed | rejected`. Черновики Δ — session-scoped, промоция при confirm.

**Кристаллизатор v2** — 7 архетипов (feed/catalog/detail/form/canvas/dashboard/wizard), 6 слотов + composer. Control-архетипы: auto, composerEntry, formModal, confirmDialog, clickForm, filePicker, inlineSearch, customCapture, bulkWizard.

**R8 Hub-absorption (v1.13, core@0.11.0)** — `crystallize_v2/absorbHubChildren.js`. Child-каталоги с FK на entity с detail-проекцией автоматически помечаются `absorbedBy: "<parent>_detail"` и прокидываются как `hubSections: [{ projectionId, foreignKey, entity }]` на hub-detail (и в `slots.hubSections` для рендера). Threshold: ≥2 child'а. Author-override: `projection.absorbed: false`. Шелл (`V2Shell`) фильтрует absorbed из `ROOT_PROJECTIONS`. Снимает монотонность «много flat tabs» в CRUD-доменах (pet-домен: 8 табов → 2).

**Shape-layer (v1.13, core@0.11.0)** — `crystallize_v2/deriveShape.js`. Три shape'а поверх catalog/feed: `timeline` (date-witness + descending sort), `directory` (contact-поля phone/email/address, без date-sort), `default`. Hero-create guard блокирует hero-слот для timeline/directory — creator уходит в toolbar. Результат в `artifact.shape` + `artifact.shapeSignals` + `slots.body.shape` (non-default). Author-override: `projection.shape`. Renderer-layouts (visual timeline, tabbed hub) — roadmap v0.2.

**UI-адаптер (§17, v1.6 — 4 реализации)** — `adapters/registry.js` → `getAdaptedComponent(kind, type)`. Категории: parameter / button / shell / primitive (+ chart/sparkline/statistic) / icon. **Capability surface** (v1.6): `adapter.capabilities` + `getCapability`/`supportsVariant` для graceful fallback. Runtime-компоненты **не импортируют UI-kit напрямую**.

**Онтология (§14, v1.6)** — типизированные поля с read/write matrix. `entity.kind` таксономия: `internal` / `reference` (v1.6) / `mirror` / `assignment`. `ownerField` для single-owner, `role.scope` для m2m (v1.6). `inferFieldRole` → семантические роли (v1.6: +money/percentage/trend/ticker).

**Глобальные инварианты (§14, 6 kinds)** — `ontology.invariants[]`: `role-capability` / `referential` / `transition` / `cardinality` / `aggregate` / **`expression`**. Handlers в `@intent-driven/core/invariants/*.js`, server re-export через `server/schema/invariantChecker.cjs`. `expression` — row-level predicate с доступом к `(row, world, viewer, context)` (core@0.32+, расширен в core@0.33); закрыл backlog §1.1. **Handler schema drift ЗАКРЫТ** (backlog 1.1, 2026-04-20): `invariants/normalize.js` + try/catch нормализуют альтернативные формы (`{entity, field, references}`), unknown shapes → warning, не cascade-reject. `invariant.where` поддерживается всеми 4 kinds (`referential` / `aggregate` / `transition` / `cardinality`) — даёт автору ручной row-filter как частичное решение domain-scoping (backlog 1.4). Интеграция: `validator.js::checkInvariantsForDomain` → `routes/effects.js::onConfirmed`; на violation — rollback через `cascadeReject` + SSE `effect:rejected`. Декларации: invest 5, sales 3, delivery 3, compliance 15 (из них 5 expression).

**Базовые роли (§5, v1.6 + admin)** — `role.base: "owner" | "viewer" | "agent" | "observer" | "admin"` как таксономический маркер. Пятый класс `admin` — row-override в `filterWorldForRole` (видит всё независимо от `ownerField`). Открытое множество прецедентов, не closed enum. Helpers в `server/schema/baseRoles.cjs`: `getRolesByBase`, `isAgentRole`, `auditOntologyRoles`. Все 11 доменов аннотированы. Compliance CFO — `agent` с cycle-level scope.

**Multi-owner ownership (§5, backlog 3.2 ЗАКРЫТ 2026-04-20)** — `entity.owners: ["customerId", "executorId"]` (array) + `intent.permittedFor` override в SDK core. `filterWorldForRole` и `assignToSlotsDetail::ownershipConditionFor` генерируют OR-expression по всем owner-полям. Util `getOwnerFields()` (SDK) — источник истины. Legacy `ownerField` остаётся backward-compat. Применение: freelance.Deal (customer + executor).

**Агентский слой (§17, v1.6)** — `/api/agent/:domain/{schema,world,exec}`, JWT + `roles.agent.canExecute` + `visibleFields` (single-owner + m2m). **Preapproval guard** (v1.6): `roles.agent.preapproval` с 5 типами предикатов (active/notExpired/maxAmount/csvInclude/dailySum). `server/schema/*` — чистые функции.

**Document materialization (§1/§17, v1.6)** — 4-я базовая материализация. `GET /api/document/:domain/:projection?format=html|json&as=role`. `documentMaterializer.cjs` превращает catalog/feed/detail/dashboard в structured document-граф. Viewer-scoped через тот же `filterWorldForRole`.

**Voice materialization (§1/§17, v1.6.2)** — все 4 материализации §1 теперь реализованы. `GET /api/voice/:domain/:projection?format=json|ssml|plain`. `voiceMaterializer.cjs` превращает projection в speech-script (`turns: [{role, text, items}]`). Brevity: top-3 для catalog, money читается «2.5 миллионов рублей». 3 формата: json (для voice-agent / Claude Voice / OpenAI realtime), SSML (для TTS), plain (debug).

**UX Pattern Layer (§16, двухосевая)** — **архетип** (структура: feed/catalog/detail/...) × **паттерн** (поведение: monitoring/triage/execution/exploration/configuration). Signal Classifier выводит behavioral pattern из intent-группы через weighted scoring. Rendering Strategy → itemLayout, emphasisFields, preferControl. **Pattern Bank — 31 stable structural patterns** (см. «Pattern Bank execution» ниже) с формальным `trigger/structure/rationale` triple и falsification fixtures (`shouldMatch` / `shouldNotMatch`). **Research pipeline** (двухступенчатый): `scripts/pattern-researcher.mjs` + domain-batch'и (`freelance-pattern-batch.mjs`, `jobboard-pattern-batch.mjs`, `uncovered-domains-pattern-batch.mjs`) извлекают кандидатов из реальных продуктов (avito, profi, kwork, fl.ru, workzilla, linkedin-jobs, hh.ru, linear, notion, height, stripe) в `idf/pattern-bank/candidate/` (~49+ кандидатов на 2026-04-21); после human review — в `idf-sdk/packages/core/src/patterns/stable/` (candidate/ в SDK на текущий момент пусто — review'ы идут напрямую в stable или отклоняются). `anti/` зарезервирован.

**Pattern Bank execution (§16)** — от matching-only к executable rules. **31 stable pattern в SDK, 28 с `structure.apply(slots, context)`** (на 2026-04-21). `applyStructuralPatterns` — фаза `3d` после `assignToSlots*`, до `wrapByConfirmation`. Matching-only (3): `optimistic-replace-with-undo`, `global-command-palette`, `keyboard-property-popover`. Раскладка по архетипу:
- **detail/** (12): subcollections, footer-inline-setter, m2m-attach-dialog, observer-readonly-escape, lifecycle-locked-parameters, vote-group, phase-aware-primary-cta, computed-cta-label, rating-aggregate-hero, review-criterion-breakdown, timer-countdown-visible, keyboard-property-popover
- **catalog/** (8): grid-card-layout, hero-create, kanban-phase-column-board, discriminator-wizard, faceted-filter-panel, paid-visibility-elevation, catalog-creator-toolbar, catalog-exclude-self-owned
- **cross/** (8): bulk-action-toolbar, hierarchy-tree-nav, irreversible-confirm, inline-search, reputation-tier-badge, undo-toast-window, optimistic-replace-with-undo, global-command-palette
- **feed/** (3): composer-entry, antagonist-toggle, response-cost-before-action

Author-override: apply respects authored state. `projection.patterns: { enabled, disabled }` — author-level preference; `POST /api/patterns/preference` — AST-safe codemod (recast). Feature-flag `ontology.features.structureApply` как kill-switch. `artifact.witnesses[]` с `basis: "pattern-bank"`, `reliability: "rule-based"`. `explainMatch(intents, ontology, projection, options)` — SDK-surface для Studio viewer (`/studio/patterns`) и prototype `PatternInspector` drawer (§27 host-extension, toggle `Cmd+Shift+P`, режимы Off/Preview/Commit + X-ray radio). 5 server endpoints `/api/patterns/{catalog,falsification,explain,projections,preference}`. Renderer primitives `PatternPreviewOverlay`, `TreeNav`, `KanbanBoard`; `SubCollectionSection` применяет `sort/where/terminalStatus`; `ConfirmDialog` поддерживает `__irr` + `confirmLabel` + корректный tone. Новые projection-level hooks: `projection.hero` (authored node), `projection.gating` (onboarding prerequisites), `projection.forRoles` (role-aware nav filtering §4.9).

**Derivation X-ray (§27)** — второй ортогональный слой над Pattern Bank: **что** дериввировано vs **какой apply** выполнится. `computeSlotAttribution(intents, ontology, projection) → { slotPath → { patternId, action } }` (SDK core, deep-diff после каждого apply). Renderer `PatternPreviewOverlay` mode `"xray"` — warm-yellow border + hover-trail с requirements ✓/✗ + «Open in Graph3D ↗». `ProjectionRendererV2` props `xrayMode` / `slotAttribution` / `xrayDomain` / `onExpandPattern`. Host: `CrystallizeInspector` (`Cmd+Shift+D` 💎), `PatternInspector` global radio Off/X-ray (mode независим от Apply preview). Server: `/api/patterns/explain` отдаёт `slotAttribution`; `/api/studio/domain/:name/graph` содержит pattern-узлы (kind `pattern`) + edges `applies-to` / `affects`. Studio hash-router `#graph/focus?domain=&pattern=&projection=` — deep-link из Inspector'а. Standalone CLI `scripts/derivation-diff.mjs` (`--pattern X` / `--without X` / `--json`).

**Functoriality & salience ladder (ЗАКРЫТО 2026-04-20)** — sort-on-entry в `crystallizeV2` делает результат детерминированным по порядку intent'ов, но детерминизм ≠ семантическая устойчивость. SDK `bySalienceDesc` расширен ladder'ом `salience desc → declarationOrder asc → alphabetical (last resort)`. `declarationOrder` автоматически из `Object.entries(INTENTS)` index в `assignToSlotsDetail` + `assignToSlotsCatalog`. Witness-basis: `declaration-order` — authorial signal; `alphabetical-fallback` — practically unreachable. **Baseline 19 witness'ов → 0 во всех 10 доменах** без массовой аннотации. 17 ручных `salience: "primary"` — explicit-better-than-implicit для primary semantic roles, но не обязательны. Metric-script: `scripts/functoriality-spec-debt.mjs`. Design-spec: `~/WebstormProjects/idf-manifest-v2.1/docs/design/intent-salience-spec.md`.

**Reactive Rules Engine (§22)** — event-condition-action, правила в `ontology.rules`. **Extensions v1.5:** aggregation (counter), threshold (lookback predicate), schedule (cron-like), condition (JS expression). Invest использует все 4 в одном домене. Таблица `rule_state` per (rule, user).

**Темпоральный scheduler (§4, v1.7)** — first-class механизм, закрыл v1.6 §26 open item. Два системных intent'а: `schedule_timer(afterMs|atISO, target, revokeOn?)` и `revoke_timer(timerId)`. Реализация: `server/timeEngine.js` с `TimerQueue` (min-heap по `firesAt`), `hydrateFromWorld` при старте, `onEffectConfirmed` для реакции на schedule/revoke эффекты, `fireDue` с guard evaluation. Таймеры — обычные эффекты τ=`scheduled_timer` в Φ (не отдельный state). `schedule` в `ontology.rules[].schedule` — object `{ after | at | revokeOn? }`. Object-form передаётся в `TimerQueue.insert`. String-DSL — future, не current (§23). Применение: booking `auto_cancel_pending_booking` (отмена через 24h если not confirmed); cron-правила Rules Engine v1 мигрированы на self-rescheduling timers.

**Map-primitive (§16a, v1.7)** — spatial primitive-категория по образцу chart. `packages/renderer/src/primitives/map.jsx` (SDK): 4 layer kinds (marker / route / polygon / heatmap), SVG-fallback с pure `calcBounds`/`projectPoint`/`normalizeLayer`, adapter-delegation через `getAdaptedComponent("primitive","map")`. Semantic-роли `coordinate` / `address` / `zone` в `inferFieldRole`. Применение: 3 canvas в delivery (order_tracker / dispatcher_map / active_delivery).

**Irreversibility (§23, v1.7+)** — effect-level точка невозврата через `effect.context.__irr = { point, at, reason }` (zero-migration через JSON). Helper `server/irreversibility.cjs::mergeIntoContext`. Integrity-правило блокирует `α:"remove"` на сущности с past confirmed effect где `point === "high" && at !== null`. Forward-correction через `α:"replace"` разрешён всегда. UI: `IrreversibleBadge` primitive + `ConfirmDialog` поддержка `__irr`/`confirmLabel`/tone (renderer@0.18+). Применение: `capture_payment` в delivery, `confirm_deal` в freelance, 5 intents в compliance (approve_je / submit_attestation / amend_attestation / sign_off_cycle_404 / file_amendment). **Auto-placement** badge в header-row — backlog 3.3 (primitive есть, `buildDetailBody` не инжектит).

**Reader-equivalence (§23 axiom 5, v2.1)** — четыре материализации (pixels / voice / agent-API / document) должны отдавать изоморфный information content на одном срезе Φ. Формализовано в `~/WebstormProjects/idf-manifest-v2.1/docs/design/drift-protection-spec.md` как Layer 3 detector. Layer 1 (conformance-drift) и Layer 2 (override-coefficient) — другие два detector'а. На 2026-04-21 живой из трёх — только alpha-fb / override-coefficient метрики; reader-equivalence — спека, не runtime check.

**Generic Effect Handler** — fallback в `buildEffects` применяет `intent.particles.effects`. ~70% интентов sales, ~85% invest. 5/10 доменов сохраняют custom `buildCustomEffects` (freelance имеет ~9 custom ветвей из-за composite cardinality / отсутствующей expression-invariant UX); трэнд — «particle uniformity деградирует со сложностью».

### Запуск

```bash
npm run calendar          # :3002 external-calendar
npm run server            # :3001 Express (validator + routes + timeEngine)
npm run dev               # :5173 Vite
npm run dev:studio        # server + vite concurrent (для §27 Studio)
npm run invest-ml         # :3003 (опц., демо для invest)
npm run invest-fuzzy      # :3004 (опц.)
npm run market-data       # :3006 (опц.)
npm run courier-feed      # courier-location-feed (delivery)
npm run geocoder          # geocoder (delivery)
npm run payment-gw        # payment-gateway mock
npm run notify-gw         # notification-gateway mock
npm test                  # vitest (host)
npm run test:core         # vitest в packages/core/ (если есть local pkgs)
npm run agent-smoke       # 75-шаговый integration smoke (все домены)
npm run smoke-compliance  # compliance-specific smoke
npm run audit-domains     # 7-ось audit per domain
npm run audit-report      # unified report по 10 доменам → docs/domain-audit.{md,json}
npm run conformance       # idf-spec conformance runner (L1+L2 fixtures)
npm run sales-demo        # scripted walkthrough для sales
npm run delivery-seed     # seed delivery world
npm run build             # prod-сборка
```

## SDK

Монорепо `~/WebstormProjects/idf-sdk/` (pnpm workspace, tsup, vitest). 8 пакетов. **Версии на 2026-04-21 (actual, не исторические):**

| Пакет | Актуальная версия | Лицензия | Назначение |
|---|---|---|---|
| `@intent-driven/core` | **0.48.0** | BSL 1.1 | engine, fold, crystallize_v2, invariants (6 kinds incl. expression с `(row, world, viewer, context)`), materializers (document / voice / auditLog), salience ladder, 31 stable patterns с 28 apply, filterProjectionsByRole, getOwnerFields, anchoring, irreversibility |
| `@intent-driven/renderer` | **0.25.0** | BSL 1.1 | ProjectionRendererV2, 7 архетипов, 11 controls, primitives (atoms/containers/chart/map + IrreversibleBadge + PatternPreviewOverlay + TreeNav + KanbanBoard + SubCollectionSection), xrayMode/slotAttribution props, ConfirmDialog с __irr |
| `@intent-driven/adapter-mantine` | **1.3.0** | BSL 1.1 | Mantine (corporate) + shell.sidebar |
| `@intent-driven/adapter-shadcn` | **1.3.0** | BSL 1.1 | shadcn/ui doodle + shell.sidebar |
| `@intent-driven/adapter-apple` | **1.3.0** | BSL 1.1 | Apple visionOS-glass + shell.sidebar |
| `@intent-driven/adapter-antd` | **1.3.0** | BSL 1.1 | AntD enterprise-fintech. 4 freelance-workaround'а (label/children, DateTime withTime, fieldRole price, maxLength/pattern) закрыты в 1.2.0 |
| `@intent-driven/canvas-kit` | **0.2.0** | BSL 1.1 | 9 SVG/canvas утилит |
| `@intent-driven/cli` | **1.0.53** | MIT | `npx @intent-driven/cli init <name>` — 5-шаговый LLM-диалог с кэшированием системного промпта |

Host `package.json` использует semver: `^0.48.0` core, `^0.25.0` renderer, `^1.3.0` adapters, `^0.2.0` canvas-kit. Server/schema/*.cjs — **thin re-exports** из SDK core для CJS-совместимости (не дублируют логику). 

**Release pipeline:** changesets-bot создаёт «Version Packages» PR при merge в main → publish в npm при merge release PR. **SDK развивается быстрее host**: 26+ релизов core за 2026-04-20 один. Перед любым SDK-plan'ом — `git fetch origin main` в `~/WebstormProjects/idf-sdk/` + `npm view @intent-driven/core version`, иначе этот CLAUDE.md может быть позади.

**SDK test counts (реальные):** core ~92 test files, renderer ~37, canvas-kit 9, adapter-antd 2, apple/mantine/shadcn по 1.

Postmortem'ы: `docs/superpowers/specs/2026-04-14-sdk-core-postmortem.md` (Phase 1 extraction), `docs/superpowers/specs/2026-04-15-renderer-extraction-postmortem.md` (Phase 2).

## Стиль кода

- Файлы < 300 LOC, кристаллизатор v2 — чистые функции без React
- Тёмная тема для системных панелей, светлая/тёмная для UI (переключается)
- Инструментальный стиль — среда авторства, не потребительский продукт

## Границы реализации

**Полный список: Часть VII манифеста v2 (`docs/manifesto-v2.md`) + Open items в `docs/implementation-status.md`.** Архивный манифест v1.12 (`docs/archive/manifesto-v1.12.md`) содержит §23/§26 как исторический срез. Не опирайся на «оно есть, раз написано в §N» — валидируй через implementation-status.

### Частично реализовано (осторожно)

- **§15 Анкеринг** — конструктивные частицы блокируют через `AnchoringError`. Witness-of-proof filled (`reliability`/`basis`). Pattern labeling + zazor #3 phase 1 analyzer (`witness.pattern` + `scripts/zazor3-candidates.mjs`). Promotion writer, counterexample-search — open.
- **Voice** — `voiceMaterializer` + `/api/voice/` route реализованы. Нет integration с реальным TTS / voice-agent.
- **Reader-equivalence (§23 axiom 5)** — сформулирован в `drift-protection-spec.md` как Layer 3 detector. Runtime-check не существует; сейчас это аксиома, не проверяемое свойство.
- **Drift-protection spec** — три detector'а формализованы, работает только alpha-fb / override-coefficient (Layer 1/2). Layer 3 — спецификация.
- **IrreversibleBadge auto-placement** (backlog 3.3) — primitive есть в renderer, `ConfirmDialog` теперь поддерживает `__irr`/`confirmLabel`/tone, но `buildDetailBody` не инжектит badge в header-row для mainEntity с `__irr`.
- **Pattern Bank (31 stable)** — 28 с `structure.apply`, 3 matching-only (optimistic-replace-with-undo, global-command-palette, keyboard-property-popover). Falsification fixtures, `explainMatch` SDK-surface, Studio `/studio/patterns`, prototype `PatternInspector` + X-ray radio — всё реализовано.

### Закрытые backlog-items (за 2026-04-20 sprint)

- ✅ **invariant.kind: "expression"** (backlog 1.1) — core@0.32.0, extended @0.33.0 (predicate получает world/viewer/context); 5 шт в compliance
- ✅ **Invariant handler schema drift** (backlog 1.1 extended) — `invariants/normalize.js` + try/catch; unknown shapes → warning, не cascade-reject
- ✅ **Multi-owner ownership** (backlog 3.2) — `entity.owners: [...]` + `intent.permittedFor` + OR-expression в `filterWorldForRole` / `ownershipConditionFor`
- ✅ **AntD adapter patches** (backlog 2.1–2.4) — все 4 P0 закрыты в adapter-antd@1.2.0, host workarounds удалены из `DomainRuntime.jsx`
- ✅ **Alpha-fb salience → 0** — ladder `salience desc → declarationOrder → alphabetical`, baseline 19 → 0 witness'ов во всех 10 доменах
- ✅ **Domain scoping — частично** (backlog 1.4) — `invariant.where` для 4 kinds; full auto-discriminator (`__domain` provenance) deferred

### Open items (актуально на 2026-04-21)

- **Domain scoping full** (backlog 1.4) — auto-discriminator `__domain` provenance в Φ deferred; сейчас автор использует `invariant.where` или discriminator-поле вручную
- **PrimaryCTAList multi-param phase-transitions** (backlog 3.1) — параметры `spec.parameters` теряются на `onClick`, renderer не рендерит overlay-form при `parameters.length > 0`
- **inferParameters top-level** (backlog 4.1), **heroCreate matcher** (backlog 4.2), **footer-inline-setter агрессивен** (backlog 4.3) — P1 из freelance field-test'а
- **Composite groupBy в cardinality** (session-backlog 1.2) — «один активный Response на пару (executorId, taskId)» сейчас в host
- **IrreversibleBadge auto-placement** (session-backlog 1.6) — primitive ждёт инжекта в buildDetailBody
- **Composite / polymorphic entities** — union-типы не выражаются через `entity.kind`; Evidence.attachedTo в compliance обходится 3 sparse-FK
- **Adapter capability checks at startup** — новый primitive kind без уведомления адаптеров
- **`@intent-driven/server` extraction (Phase 3)** — после стабилизации scheduler'а
- **Server-rendered PDF / DOCX** поверх documentMaterializer
- **X1: удаление explicit overrides** — 9 ручных `subCollections` после ≥1 релиза с apply в проде
- **PatternInspector component test** — требует `@testing-library/react` + `jsdom`
- **Cluster-friendly scheduler** — single-leader TimerQueue не distributed
- **Cross-stack conformance harness** — автоматический differential-test `fold(Φ)` через idf / idf-go / idf-rust / idf-swift на общих fixtures
- **Pattern Bank: ML/auto-learning** — автоматический анализ приложений для пополнения банка

## Приоритеты

Roadmap: Часть VIII манифеста v2 `docs/manifesto-v2.md` (направления формата без дат) + GitHub issues (оперативные задачи) + `docs/backlog.md` (cross-cutting очередь между сессиями).

- **Ближайшее (1-2 мес)**: freelance backlog P1 (§3.1 PrimaryCTAList multi-param, §4.1–4.3 inferParameters/heroCreate/footer), apply для 3 оставшихся matching-only паттернов, domain scoping (`__domain` provenance), IrreversibleBadge auto-placement, invest visual polish для демо, публикация статьи, `@intent-driven/server` extraction, reader-equivalence runtime-check (v2.1 axiom 5)
- **Среднесрочное (2-4 мес)**: production-ready invest, Pattern Bank → 50+ stable patterns через Researcher pipeline (сейчас 31 + 49+ candidate'ов в bank/), cross-stack conformance harness (differential-test через idf/go/rust/swift), X1-удаление explicit overrides, PatternInspector test-harness, composite groupBy/polymorphic entity kind
