# CLAUDE.md — Intent-Driven Frontend

## Язык общения

Все ответы, комментарии, документация и коммит-сообщения — **на русском языке**.

## Git-коммиты

**Никогда не добавляй Claude (или другого бота) в соавторы коммитов.** Никаких `Co-Authored-By: Claude ...` / `🤖 Generated with ...` трейлеров. Коммиты — от имени автора, без упоминания инструмента.

## Суть проекта

**IDF — формат описания приложения (уровень OpenAPI / JSON-LD), не фреймворк.** Артефакт v2 с онтологией, намерениями, проекциями и ролями — тип данных; адаптеры и материализаторы — *читатели* формата. LLM участвует в проектировании и кристаллизации, но **не в рантайме**. **Четыре равноправные материализации** (Часть IV манифеста v2): пиксели (4 UI-адаптера), голос (`/api/voice/*`), агентский API (`/api/agent/*`), документ (`/api/document/*`).

## Ключевые документы

- **Манифест v2** (`docs/manifesto-v2.md`) — timeless-документ о формате IDF: 26 глав в 8 частях (I. Тезис · II. Объекты формата · III. Алгебра · IV. Четыре читателя формата · V. Авторство · VI. Conformance набросок · VII. Границы · VIII. Перспектива). Читай перед работой над ядром формата.
- **Имплементационный статус** (`docs/implementation-status.md`) — живой документ о состоянии референсной реализации: 10 доменов, SDK пакеты (версии/лицензии), ~1342 теста (716 в прототипе), open items. Обновляется как README вместе с кодом.
- **SDK backlog** (`docs/sdk-improvements-backlog.md`) — 40+ конкретных gap'ов в SDK, выявленных при авторинге freelance-домена. Классификация P0/P1/P2, адресаты: `@intent-driven/core`, `@intent-driven/renderer`, `@intent-driven/adapter-antd`.
- **Архив манифестов v1.3–v1.12** (`docs/archive/`) — исторические версии с change-log тоном, сохранены как снимок эволюции. Актуальные факты — в v2, актуальные счётчики — в implementation-status.
- **Спецификация формата v0.1** — нормативный документ в отдельном репо `~/WebstormProjects/idf-spec/`. Содержит JSON Schema для core-объектов, conformance classes L1–L2 и test fixtures. L3–L4 резервируются для v0.2+. Манифест §3/§22 упоминает спеку как «запланированную» — на 2026-04-19 она в активной разработке, и cross-stack реализации (Go/Rust) уже проходят conformance против её fixtures.
- **Cross-stack реализации** — `~/WebstormProjects/idf-{go,rust,swift}/` — три независимые реализации формата (L1+L2) против `idf-spec`, пишутся в изоляции от референсной реализации. Структурный стресс-тест «формат decoupled от языка».
- **Полевые тесты 1–11** (`docs/field-test-*.md`) — от очереди чтения до delivery. Файлы `field-test-8`, `field-test-9`, `field-test-12` (freelance) отсутствуют в docs; частичное покрытие numbering'а.
- **Дизайн-спек M1–M5** (`docs/superpowers/specs/2026-04-10-intent-ui-generation-design.md`)

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

Переключатель доменов в `prototype.jsx`. Один движок, **десять** наборов определений.

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
# Прототип (host-слой, минимальный после SDK Phase 2 extraction)
src/
  domains/{booking,planning,workflow,messenger,sales,lifequest,reflect,invest,delivery,freelance}/
  studio/           # §27 Authoring environment — Graph3D + Claude proxy (dev-time, port :4000)
  runtime/
    # engine / fold / intentAlgebra / crystallize_v2 / primitives / adapters
    # живут в SDK (@intent-driven/core, @intent-driven/renderer, @intent-driven/adapter-*, @intent-driven/canvas-kit)
    renderer/
      auth/           # host-only: JWT + useAuth
      personal/       # host-only: usePersonalPrefs (dup с SDK, см. tech-debt) + PrefsPanel
      shell/          # V2Shell

# SDK monorepo: ~/WebstormProjects/idf-sdk/packages/
#   core/            # engine, fold, intentAlgebra, crystallize_v2, invariants/*, filterWorld,
#                    # baseRoles, preapprovalGuard, materializers, irreversibility, ontology/assets
#   renderer/        # ProjectionRendererV2 + archetypes + primitives (atoms, containers, chart,
#                    # map v1.7, IrreversibleBadge v1.7) + adapter registry
#   adapter-{mantine,shadcn,apple,antd}/  # 4 UI-kit реализации
#   canvas-kit/      # SVG/canvas утилиты для domain-specific canvas

server/
  index.js             # Express :3001
  validator.js         # валидация + foldWorld + рекурсивный batch
  ruleEngine.js        # Reactive Rules + 4 v1.5 extensions
  schema/
    filterWorld.cjs           # + role.scope (v1.6) + entity.kind:"reference"
    preapprovalGuard.cjs      # agent лимиты (v1.6 §17)
    documentMaterializer.cjs  # document-материализация (v1.6 §1)
    intentAlgebra.cjs, checkOwnership.cjs, buildXxxEffects.cjs, ...
  routes/
    agent.js            # /api/agent/:domain/* + preapproval hook
    document.js         # /api/document/:domain/:projection (v1.6)
    effects, artifacts, auth, entities, crystallize

invest-ml/      :3003  # мок ML-сигналов
invest-fuzzy/   :3004  # fuzzy-scoring экзотики
market-data/    :3006  # price-tick feed
external-calendar/ :3002

scripts/    # agent-login, agent-smoke (75 шагов)
```

### Ядро (что нужно знать для работы с кодом)

**Φ как source of truth** — мир = `fold(Φ_confirmed)`, не хранится. Жизненный цикл: `proposed → confirmed | rejected`. Черновики Δ — session-scoped, промоция при confirm.

**Кристаллизатор v2** — 7 архетипов (feed/catalog/detail/form/canvas/dashboard/wizard), 6 слотов + composer. Control-архетипы: auto, composerEntry, formModal, confirmDialog, clickForm, filePicker, inlineSearch, customCapture, bulkWizard.

**R8 Hub-absorption (v1.13, core@0.11.0)** — `crystallize_v2/absorbHubChildren.js`. Child-каталоги с FK на entity с detail-проекцией автоматически помечаются `absorbedBy: "<parent>_detail"` и прокидываются как `hubSections: [{ projectionId, foreignKey, entity }]` на hub-detail (и в `slots.hubSections` для рендера). Threshold: ≥2 child'а. Author-override: `projection.absorbed: false`. Шелл (`V2Shell`) фильтрует absorbed из `ROOT_PROJECTIONS`. Снимает монотонность «много flat tabs» в CRUD-доменах (pet-домен: 8 табов → 2).

**Shape-layer (v1.13, core@0.11.0)** — `crystallize_v2/deriveShape.js`. Три shape'а поверх catalog/feed: `timeline` (date-witness + descending sort), `directory` (contact-поля phone/email/address, без date-sort), `default`. Hero-create guard блокирует hero-слот для timeline/directory — creator уходит в toolbar. Результат в `artifact.shape` + `artifact.shapeSignals` + `slots.body.shape` (non-default). Author-override: `projection.shape`. Renderer-layouts (visual timeline, tabbed hub) — roadmap v0.2.

**UI-адаптер (§17, v1.6 — 4 реализации)** — `adapters/registry.js` → `getAdaptedComponent(kind, type)`. Категории: parameter / button / shell / primitive (+ chart/sparkline/statistic) / icon. **Capability surface** (v1.6): `adapter.capabilities` + `getCapability`/`supportsVariant` для graceful fallback. Runtime-компоненты **не импортируют UI-kit напрямую**.

**Онтология (§14, v1.6)** — типизированные поля с read/write matrix. `entity.kind` таксономия: `internal` / `reference` (v1.6) / `mirror` / `assignment`. `ownerField` для single-owner, `role.scope` для m2m (v1.6). `inferFieldRole` → семантические роли (v1.6: +money/percentage/trend/ticker).

**Глобальные инварианты (§14, v1.6.1)** — `ontology.invariants[]` с 5 kind'ами (`role-capability` / `referential` / `transition` / `cardinality` / `aggregate`). Dispatch через `server/schema/invariantChecker.cjs` (thin re-export), handlers в `@intent-driven/core/invariants/*.js` (5 файлов в SDK). Интеграция — `validator.js::checkInvariantsForDomain` вызывается в `routes/effects.js::onConfirmed`; на error — rollback через `cascadeReject` + SSE `effect:rejected` с violations. Observer-invariant (§5) — частный случай `role-capability`. Декларации в invest (5 шт), sales (3 шт), delivery (3 шт).

**Базовые роли (§5, v1.6 + admin-post-v2)** — `role.base: "owner" | "viewer" | "agent" | "observer" | "admin"` как таксономический маркер. Пятый класс `admin` добавлен post-v2.0 (PR #45) после стресс-теста spec-v0.1 на library-домене (librarian не вписался в четыре). Спецификация: `admin` — row-override в `filterWorldForRole` (видит все записи независимо от `ownerField`). Открытое множество прецедентов, не closed enum. Helpers в `server/schema/baseRoles.cjs`: `getRolesByBase`, `isAgentRole`, `auditOntologyRoles`. Все 10 доменов аннотированы. Moderator → agent.

**Агентский слой (§17, v1.6)** — `/api/agent/:domain/{schema,world,exec}`, JWT + `roles.agent.canExecute` + `visibleFields` (single-owner + m2m). **Preapproval guard** (v1.6): `roles.agent.preapproval` с 5 типами предикатов (active/notExpired/maxAmount/csvInclude/dailySum). `server/schema/*` — чистые функции.

**Document materialization (§1/§17, v1.6)** — 4-я базовая материализация. `GET /api/document/:domain/:projection?format=html|json&as=role`. `documentMaterializer.cjs` превращает catalog/feed/detail/dashboard в structured document-граф. Viewer-scoped через тот же `filterWorldForRole`.

**Voice materialization (§1/§17, v1.6.2)** — все 4 материализации §1 теперь реализованы. `GET /api/voice/:domain/:projection?format=json|ssml|plain`. `voiceMaterializer.cjs` превращает projection в speech-script (`turns: [{role, text, items}]`). Brevity: top-3 для catalog, money читается «2.5 миллионов рублей». 3 формата: json (для voice-agent / Claude Voice / OpenAI realtime), SSML (для TTS), plain (debug).

**UX Pattern Layer (v1.8)** — два ортогональных измерения: **архетип** (структура: feed/catalog/detail/...) × **паттерн** (поведение: monitoring/triage/execution/exploration/configuration). Signal Classifier выводит behavioral pattern из intent-группы через weighted scoring. Rendering Strategy определяет itemLayout, emphasisFields, preferControl. **Pattern Bank — 20 stable structural patterns** (detail 8, catalog 4, cross 6, feed 2) с формальным trigger/structure/rationale triple и falsification framework. **Двухступенчатый research pipeline**: `scripts/pattern-researcher.mjs` + domain-batch'и извлекают кандидатов из реальных продуктов (avito, profi) в `idf/pattern-bank/candidate/`; после human review — в `idf-sdk/packages/core/src/patterns/candidate/` → `stable/`.

**Pattern Bank execution (§16, v1.12)** — от matching-only к executable rules. 3 паттерна с `structure.apply(slots, context)` — чистые функции, обогащают slots внутри crystallize pipeline (фаза `3d` после `assignToSlots*`, до `wrapByConfirmation`): **`subcollections`** (detail, FK-based sub-entity discovery + pluralization), **`grid-card-layout`** (catalog, layout+cardSpec), **`footer-inline-setter`** (detail, single-replace → inline-setter). Author-override: apply respects authored state (existing sections, any body.layout, existing footer items). `projection.patterns: { enabled, disabled }` — author-level preference, управляет applied set; `POST /api/patterns/preference` пишет через AST-safe codemod (recast). Feature-flag `ontology.features.structureApply` как kill-switch. `artifact.witnesses[]` — pattern matching как first-class §15 finding с `basis: "pattern-bank"`, `reliability: "rule-based"`. `explainMatch(intents, ontology, projection, options)` — единая SDK-surface для Studio viewer (`/studio/patterns`) и prototype `PatternInspector` drawer (§27 host-extension, toggle `Cmd+Shift+P`, три режима Off/Preview/Commit). Renderer props `artifactOverride` + `previewPatternId` + primitive `PatternPreviewOverlay` (dashed-border + badge) для §27 preview. 5 server endpoints `/api/patterns/{catalog,falsification,explain,projections,preference}`. 3 из 20 stable паттернов имеют apply; остальные 17 matching-only, roadmap v1.13+.

**Functoriality & salience (2026-04-18 research)** — `feat/crystallize-functoriality` ветка: sort-on-entry в `crystallizeV2` делает результат **детерминированным** относительно порядка входных intent'ов. Но детерминизм ≠ семантическая устойчивость: tied salience разрешается алфавитным tiebreak'ом (`apply_template` опережает `edit_listing` по id). Решение — `intent.salience` (explicit label `primary|secondary|tertiary|utility` или число; computed fallback из `particles.effects`). Design-spec: `~/WebstormProjects/idf-manifest-v2.1/docs/design/intent-salience-spec.md`. PoC в SDK core (`crystallize_v2/salience.js`), demo-аннотация в `sales/intents.js` (`edit_listing.salience: "primary"`). Метрика spec-debt: `scripts/functoriality-spec-debt.mjs` — 16 `alphabetical-fallback` witness'ов в 9 доменах, target 0.

**Reactive Rules Engine (§22)** — event-condition-action, правила в `ontology.rules`. **Extensions v1.5:** aggregation (counter), threshold (lookback predicate), schedule (cron-like), condition (JS expression). Invest использует все 4 в одном домене. Таблица `rule_state` per (rule, user).

**Темпоральный scheduler (§4, v1.7)** — first-class механизм, закрыл v1.6 §26 open item. Два системных intent'а: `schedule_timer(afterMs|atISO, target, revokeOn?)` и `revoke_timer(timerId)`. Реализация: `server/timeEngine.js` с `TimerQueue` (min-heap по `firesAt`), `hydrateFromWorld` при старте, `onEffectConfirmed` для реакции на schedule/revoke эффекты, `fireDue` с guard evaluation. Таймеры — обычные эффекты τ=`scheduled_timer` в Φ (не отдельный state). `schedule` в `ontology.rules[].schedule` — object `{ after | at | revokeOn? }`. Object-form передаётся в `TimerQueue.insert`. String-DSL — future, не current (§23). Применение: booking `auto_cancel_pending_booking` (отмена через 24h если not confirmed); cron-правила Rules Engine v1 мигрированы на self-rescheduling timers.

**Map-primitive (§16a, v1.7)** — spatial primitive-категория по образцу chart. `packages/renderer/src/primitives/map.jsx` (SDK): 4 layer kinds (marker / route / polygon / heatmap), SVG-fallback с pure `calcBounds`/`projectPoint`/`normalizeLayer`, adapter-delegation через `getAdaptedComponent("primitive","map")`. Semantic-роли `coordinate` / `address` / `zone` в `inferFieldRole`. Применение: 3 canvas в delivery (order_tracker / dispatcher_map / active_delivery).

**Irreversibility (§23, v1.7)** — effect-level точка невозврата через `effect.context.__irr = { point, at, reason }` (zero-migration через JSON). Helper `server/irreversibility.cjs::mergeIntoContext`. Integrity-правило в `validator.js §4` блокирует `α:"remove"` на сущности с past confirmed effect где `point === "high" && at !== null`. Forward-correction через `α:"replace"` разрешён всегда. UI: `IrreversibleBadge` primitive в SDK renderer. Применение: `capture_payment` в delivery.

**Generic Effect Handler** — fallback в `buildEffects` применяет `intent.particles.effects`. ~70% интентов sales, ~85% invest.

### Запуск

```bash
npm run calendar     # :3002
npm run server       # :3001
npm run dev          # Vite :5173
npm run invest-ml    # :3003 (опц., демо для invest)
npm run invest-fuzzy # :3004 (опц.)
npm run market-data  # :3006 (опц.)
npm test             # vitest
npm run agent-smoke  # integration smoke (75 шагов)
npm run build        # prod-сборка
```

## SDK

Монорепо `~/WebstormProjects/idf-sdk/` (pnpm workspace, tsup, vitest). Все пакеты в `packages/*`. 8 пакетов (v1.12):

- **@intent-driven/core@0.9.0** (2026-04-18) — engine, fold, intentAlgebra, crystallize_v2, **+ additions**:
  - `filterWorldForRole` — viewer-scoping с m2m через role.scope (§5)
  - `BASE_ROLES` + `getRolesByBase` + `auditOntologyRoles` — таксономия (§5)
  - `checkPreapproval` — agent лимиты (§17)
  - `materializeAsDocument` / `renderDocumentHtml` — 4-я материализация (§1)
  - `materializeAsVoice` / `renderVoiceSsml` / `renderVoicePlain` — 3-я материализация (§1)
  - `checkInvariants` + `KIND_HANDLERS` — schema-level ∀-свойства (§14 v1.6.1)
  - **UX Pattern Layer** (v1.8): `resolvePattern` — behavioral patterns (monitoring/triage/execution/exploration/configuration), signal classifier, rendering strategy. 5 behavioral + 13 structural stable patterns.
  - **Pattern Bank matching** (v1.8): `matchPatterns`, `validatePattern`, `evaluateTrigger` — формальный банк правил деривации (trigger/structure/rationale), 9 trigger kinds, falsification framework.
  - **Pattern Bank execution** (v1.12): `structure.apply(slots, context)` в 3 паттернах (`subcollections`, `grid-card-layout`, `footer-inline-setter`) обогащают слоты внутри crystallize pipeline. `applyStructuralPatterns(slots, matched, context, preferences, registry)` — фаза `3d`. Helpers `findSubEntities`, `buildSection`, `sectionIdFor`, `buildCardSpec` экспортированы.
  - **explainMatch / evaluateTriggerExplained** (v1.12): `explainMatch(intents, ontology, projection, options)` → `{ archetype, behavioral, structural: { matched, nearMiss }, witnesses, artifactBefore, artifactAfter, previewPatternId }`. Единая SDK-surface для Studio viewer и prototype Pattern Inspector. `evaluateTriggerExplained(trigger, intents, ontology, projection)` — per-requirement breakdown.
  - **witnesses-of-crystallization** (v1.12): `artifact.witnesses[]` с `basis: "pattern-bank"`, `reliability: "rule-based"` — третий time-horizon witness (после anchoring / action).
- **@intent-driven/renderer@0.5.0** (2026-04-18) — ProjectionRendererV2 + 7 архетипов + 11 controls + 3 primitives (atoms/containers/chart) + map-primitive (v1.7) + IrreversibleBadge (v1.7) + 6 parameters + navigation + validation + adapter registry (capability surface). **v1.12 additions:** `artifactOverride` + `previewPatternId` props (§27 dev-only), `PatternPreviewOverlay` primitive (dashed-border + corner-badge для derived-слотов). 95 тестов.
- **@intent-driven/adapter-{mantine,shadcn,apple,antd}@1.1.0+** (2026-04-18) — 4 UI-адаптера. Каждый: spec-object + `{Name}AdapterProvider` helper. shadcn/apple `theme.css` экспортируется через `exports["./styles.css"]` — хост импортирует явно из entry.
- **@intent-driven/canvas-kit@0.2.0** (2026-04-18) — 9 SVG-утилит (`makeSvgScale`, `axisTicks`, `pointsToPath`, `heatmapColorScale`, `useTooltipPosition`, `useDraggablePoint`, `useZoomPan`, `clusterLayout`, `calendarGrid`). Standalone (peer только react). 36 TDD-тестов.
- **@intent-driven/cli@1.0.7** (2026-04-17, MIT) — `npx @intent-driven/cli init <name>` ведёт 5-шаговый LLM-диалог (Claude haiku/sonnet/opus) и генерирует каталог `<name>/`. System prompt со spec'ой кешируется (>90% скидка).

Прототип импортирует из публичного npm через semver (`^0.9.0` core, `^0.5.0` renderer, etc). Server/schema/*.cjs — **thin re-exports** из SDK core для CJS-совместимости. Release pipeline автоматический: changesets-bot создаёт "Version Packages" PR при merge в main → publish в npm при merge release PR.

Postmortem'ы: `docs/superpowers/specs/2026-04-14-sdk-core-postmortem.md` (Phase 1), `docs/superpowers/specs/2026-04-15-renderer-extraction-postmortem.md` (Phase 2).

## Стиль кода

- Файлы < 300 LOC, кристаллизатор v2 — чистые функции без React
- Тёмная тема для системных панелей, светлая/тёмная для UI (переключается)
- Инструментальный стиль — среда авторства, не потребительский продукт

## Границы реализации

**Полный список: Часть VII манифеста v2 (`docs/manifesto-v2.md`) + Open items в `docs/implementation-status.md`.** Архивный манифест v1.12 (`docs/archive/manifesto-v1.12.md`) содержит §23/§26 как исторический срез. Не опирайся на «оно есть, раз написано в §N» — валидируй через implementation-status.

### Частично реализовано (осторожно)

- **§15 Анкеринг** — конструктивные частицы блокируют через `AnchoringError` (v1.8). Witness-of-proof filled (v1.9: `reliability`/`basis`). Pattern labeling + zazor #3 phase 1 analyzer (v1.10: `witness.pattern` + `scripts/zazor3-candidates.mjs`). Promotion writer, counterexample-search — open.
- **Voice** — `voiceMaterializer` + `/api/voice/` route реализованы (v1.6.2). Нет integration с реальным TTS / voice-agent.
- **UX Pattern Layer** — behavioral + structural matching + **`structure.apply` для 3 паттернов** (subcollections, grid-card-layout, footer-inline-setter). Остальные **17 stable** — matching-only. Falsification framework работает, `explainMatch` SDK-surface + Studio viewer + prototype PatternInspector реализованы.
- **IrreversibleBadge auto-placement** — primitive создан в SDK renderer, но `buildDetailBody` не инжектит badge в header-row и ConfirmDialog его не рендерит (backlog 3.3). Домены с `__irr:{high}` (invest, delivery, freelance) не показывают badge автоматически.

### Open items v1.12 + freelance backlog

- **Composite/polymorphic entities** — union-типы не в `entity.kind` (переносится)
- **Adapter capability checks at startup** — новый primitive kind без уведомления адаптеров
- **`@intent-driven/server` extraction (Phase 3)** — после стабилизации scheduler'а
- **Server-rendered PDF / DOCX** поверх documentMaterializer
- **Pattern Bank: `structure.apply` для оставшихся 17 stable паттернов** — hero-create первый кандидат
- **Domain scoping инвариантов** (backlog 1.4, P0) — `lifequest.tasks` ↔ `freelance.tasks` cross-domain collision; `filterWorldForRole` не параметризован доменом
- **Invariant handler schema drift** (backlog 1.1, P0) — TypeError на альтернативных формах декларации cascade-rejects эффект
- **Multi-owner ownership** (backlog 3.2, P0) — `ownershipConditionFor` хардкод single ownerField; Deal с `customerId` + `executorId` требует OR-логики
- **AntD adapter patches** (backlog 2.1–2.4, P0) — 3 workaround'а в `src/runtime/DomainRuntime.jsx`: `label` vs `children`, `AntdDateTime` без времени, `fieldRole:"price"` vs `money`, игнорирование `maxLength`/`pattern`
- **Intent salience → ratify в v2.1** — design-spec в `idf-manifest-v2.1`, PoC в SDK
- **Pattern Bank: ML/auto-learning** — автоматический анализ приложений для пополнения банка
- **Cluster-friendly scheduler** — single-leader для TimerQueue
- **Cross-stack conformance harness** — автоматический differential-test `fold(Φ)` через idf / idf-go / idf-rust / idf-swift на общих fixtures

## Приоритеты

Roadmap: Часть VIII манифеста v2 `docs/manifesto-v2.md` (направления формата без дат) + GitHub issues (оперативные задачи).

- **Ближайшее (1-2 мес)**: freelance SDK backlog P0 (invariants 1.1+1.4, antd 2.1–2.4, ownership 3.2), apply для оставшихся 17 паттернов (hero-create первый кандидат), invest visual polish для демо, публикация статьи, `@intent-driven/server` extraction (Phase 3), intent salience в v2.1
- **Среднесрочное (2-4 мес)**: production-ready invest, Pattern Bank → 50+ stable patterns через Researcher pipeline, cross-stack conformance harness, X1-удаление explicit overrides, PatternInspector test-harness
