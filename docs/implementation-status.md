# IDF Implementation Status

Живой документ об имплементационном состоянии референсной реализации IDF (прототип + SDK). Формат (`docs/manifesto-v2.md`) определяет аксиомы; этот документ фиксирует, что из формата **реализовано** и **валидировано на практике**.

**Последнее обновление:** 2026-04-19

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

**Итого:** 634 намерения, 10 доменов, один движок кристаллизации.

Freelance (12-й полевой тест) выявил 40+ конкретных SDK gap'ов в процессе авторинга — см. [`sdk-improvements-backlog.md`](sdk-improvements-backlog.md). Backlog классифицирован P0/P1/P2 и адресован `@intent-driven/core`, `@intent-driven/renderer`, `@intent-driven/adapter-antd`.

### Тестовое покрытие

- **idf (прототип)**: 716 unit-тестов в 50 файлах
- **@intent-driven/core**: 483 unit-теста
- **@intent-driven/renderer**: 95 тестов
- **@intent-driven/canvas-kit**: 36 тестов
- **4× `@intent-driven/adapter-*`**: 12 тестов суммарно
- **Итого:** ~1342 теста в SDK + прототипе
- **agent-smoke**: 75-шаговый integration-тест, покрывает все домены

---

## 2. SDK monorepo

**Репо:** `~/WebstormProjects/idf-sdk/` (pnpm workspace, tsup build, vitest)

### Пакеты

| Пакет | Версия | Лицензия | Назначение |
|---|---|---|---|
| `@intent-driven/core` | 0.9.0 | BSL 1.1 | engine, fold, crystallize_v2, invariants, materializers, Pattern Bank |
| `@intent-driven/renderer` | 0.5.0 | BSL 1.1 | ProjectionRendererV2, 7 архетипов, 11 controls, primitives (atoms/containers/chart/map), 6 parameters, adapter registry |
| `@intent-driven/adapter-mantine` | 1.1.0+ | BSL 1.1 | Mantine UI-kit (corporate) |
| `@intent-driven/adapter-shadcn` | 1.1.0+ | BSL 1.1 | shadcn/ui doodle |
| `@intent-driven/adapter-apple` | 1.1.0+ | BSL 1.1 | Apple visionOS-glass |
| `@intent-driven/adapter-antd` | 1.1.0+ | BSL 1.1 | AntD enterprise-fintech |
| `@intent-driven/canvas-kit` | 0.2.0 | BSL 1.1 | SVG/canvas утилиты (9 helpers) |
| `@intent-driven/cli` | 1.0.7 | MIT | `npx @intent-driven/cli init <name>` — 5-шаговый LLM-диалог через Claude |

**Release pipeline:** changesets-bot автоматически создаёт «Version Packages» PR при merge в main; публикация в npm при merge release PR.

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

Первое применение: `booking.auto_cancel_pending_booking` (5min — актуальное значение в коде).

### Pattern Bank
- **20 stable patterns** с формальным trigger/structure/rationale triple. Физическая раскладка в `idf-sdk/packages/core/src/patterns/stable/`:
  - `detail/` (8): `footer-inline-setter`, `keyboard-property-popover`, `lifecycle-locked-parameters`, `m2m-attach-dialog`, `observer-readonly-escape`, `phase-aware-primary-cta`, `subcollections`, `vote-group`
  - `catalog/` (4): `discriminator-wizard`, `grid-card-layout`, `hero-create`, `kanban-phase-column-board`
  - `cross/` (6): `bulk-action-toolbar`, `global-command-palette`, `hierarchy-tree-nav`, `inline-search`, `irreversible-confirm`, `optimistic-replace-with-undo`
  - `feed/` (2): `antagonist-toggle`, `composer-entry`
- **3 паттерна с `structure.apply`**: `subcollections`, `grid-card-layout`, `footer-inline-setter`. Остальные 17 — matching-only (witness-of-crystallization без mutate-слотов).
- **Falsification framework**: каждый паттерн имеет shouldMatch / shouldNotMatch fixtures.
- **Studio viewer** `/studio/patterns` + prototype `PatternInspector` drawer (toggle `Cmd+Shift+P`).

### Pattern research pipeline (двухступенчатый)

- **Ступень 1 — research candidate**: `scripts/pattern-researcher.mjs` + domain-specific batch'и (`freelance-pattern-batch.mjs`, `jobboard-pattern-batch.mjs`, `uncovered-domains-pattern-batch.mjs`) извлекают кандидатов из реальных приложений (avito, profi и т.п.) в `idf/pattern-bank/candidate/` как JSON с `trigger.requires`, `rationale.evidence`, `falsification.shouldMatch/shouldNotMatch`.
- **Ступень 2 — SDK candidate**: прошедшие human-review кандидаты переносятся в `idf-sdk/packages/core/src/patterns/candidate/` (на 2026-04-19 пусто — все review'ы либо сразу в `stable`, либо отклонены).
- **Ступень 3 — stable**: после добавления apply-функции (optional) и falsification fixtures — в `idf-sdk/packages/core/src/patterns/stable/`.
- `anti/` директория в SDK зарезервирована под anti-patterns (пусто).

### Invariants (5 kinds)
`role-capability`, `referential`, `transition`, `cardinality`, `aggregate`. Dispatch через `server/schema/invariantChecker.cjs`; handlers в `@intent-driven/core/invariants/*.js`. Проверяются в `onConfirmed`; на violation — rollback через `cascadeReject` + SSE `effect:rejected`. Декларации: invest (5), sales (3), delivery (3).

**Известный дефект (backlog 1.1, P0):** handler'ы `referential`/`aggregate`/`transition` бросают `TypeError` при альтернативных формах декларации (`{entity, field, references}` вместо канонического `{from, to}`). Исключение трактуется как `severity:"error"` и cascade-rejects подтверждённый эффект. Freelance пришлось даунгрейдить 3 инварианта в `severity:"warning"`. См. [`sdk-improvements-backlog.md §1`](sdk-improvements-backlog.md).

**Domain scoping — отсутствует (backlog 1.4, P0):** `lifequest.tasks` и `freelance.tasks` мапятся в одну SQL-таблицу `tasks`. Freelance transition-инвариант на `Task.status` ловит lifequest row'ы и ломает каскад. `filterWorldForRole` параметризован viewer'ом, но не доменом. Требует `entity.domain` в Φ-context или `invariant.where`/`invariant.domain` filter.

---

## 6. Open items

### Перенесённые из архивного v1.12

- **Composite / polymorphic entities** — union-типы не выражаются через `entity.kind`
- **Adapter capability checks at startup** — новый primitive kind без уведомления адаптеров
- **`@intent-driven/server` extraction (Phase 3)** — после стабилизации scheduler'а
- **Server-rendered PDF / DOCX** поверх documentMaterializer
- **Pattern Bank: `structure.apply` для оставшихся 17 stable паттернов** — hero-create первый кандидат
- **Role-specific FK convention** — sales/seller_profile не матчится через findSubEntities (seller/targetUser vs userId)
- **PatternInspector component test** — требует `@testing-library/react` + `jsdom`
- **Studio PatternBank URL write-back** — domain change не пишет в URL
- **X1: удаление 9 explicit `subCollections` overrides** — после ≥1 релиза с apply в проде
- **Pattern Bank anti/** — директория зарезервирована под anti-patterns, пусто
- **Pattern Bank: ML / auto-learning** паттернов из приложений
- **Cluster-friendly scheduler** — single-leader TimerQueue не distributed-ready

### Из freelance field-test (2026-04-19, freelance/sdk-backlog PR #44)

Полный классифицированный список (40+ пунктов, P0/P1/P2) — в [`sdk-improvements-backlog.md`](sdk-improvements-backlog.md). Ключевое из P0:

- **Invariant handler schema drift** (1.1) — TypeError на альтернативных формах декларации cascade-rejects эффект
- **Domain scoping инвариантов** (1.4) — cross-domain name collision (`lifequest.tasks` ↔ `freelance.tasks`)
- **`AntdButton` label vs children** (2.1), **`AntdDateTime` без времени** (2.2), **`AntdNumber` не видит `fieldRole:"price"`** (2.3), **`AntdTextInput` игнорирует `maxLength`/`pattern`** (2.4) — 3 runtime-патча в `DomainRuntime.jsx` обходят это
- **`PrimaryCTAList` не рендерит форму** (3.1) для multi-param phase-transitions
- **`ownershipConditionFor` single-owner** (3.2) — multi-owner сущности (Deal с customerId + executorId) требуют OR-логики
- **`inferParameters` читает только top-level** (4.1), **`heroCreate` matcher читает только `particles.confirmation`** (4.2) — нормализация top-level ↔ particles
- **`footer-inline-setter` слишком агрессивен** (4.3) — матчит textarea-параметры, UX ломается

### Cross-cutting инсайты, не привязанные к тикету

- **Intent salience** — design-spec в `~/WebstormProjects/idf-manifest-v2.1/docs/design/intent-salience-spec.md`. Закрывает «alphabetical-fallback» witness из функториального фикса. PoC: `salience.js` в SDK core, аннотация `edit_listing.salience: "primary"` в sales. `scripts/functoriality-spec-debt.mjs` даёт метрику: 16 alphabetical-fallback witnesses в 9 доменах (target: 0).
- **SDK утекает в host** — 3 patch-wrapper'а в `src/runtime/DomainRuntime.jsx` подменяют поведение адаптеров. Формально §15 манифеста (runtime не импортирует UI-kit) соблюдён, но де-факто хост пишет shim-слой поверх SDK.
- **Particle uniformity деградирует со сложностью** — 5/10 доменов используют custom `buildCustomEffects` (freelance имеет ~9 custom ветвей). Тренд ухудшается: freelance привнёс большой custom блок из-за отсутствующих SDK-абстракций (multi-owner, composite cardinality, expression invariant).

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

| Репо | Стек | Scope | Состояние |
|---|---|---|---|
| `~/WebstormProjects/idf-go/` | Go 1.22+, `xeipuuv/gojsonschema` | L1 + L2 | conformance на library fixtures, feedback для спеки |
| `~/WebstormProjects/idf-rust/` | Rust 1.95+, `serde`, `jsonschema` | L1 + L2 | conformance на library + events fixtures |
| `~/WebstormProjects/idf-swift/` | Swift (Package.swift) | L1 + L2 (в работе) | скелет репо с изоляционной политикой |

Эти реализации — структурный стресс-тест формата: если все четыре стека `fold(Φ)` одинакового фикстура дают одинаковый world, формат decoupled от языка. Расхождение — прямой баг-репорт к спеке.

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
- `spec/fixtures/` — library (L1+L2), events (L2+) эталонные test vectors

Scope v0.1: L1 + L2. L3 и L4 резервируются для v0.2+.

Манифест §3 и §22 описывают спеку как «запланированную». Фактически спека в активной разработке — Go/Rust реализации уже проходят conformance против её fixtures.

---

## 10. История эволюции

Хронология реализации документирована по версиям в `docs/archive/manifesto-v1.3.md` … `manifesto-v1.12.md`.

**Методологическая заметка (ex §15 v1.11):** манифест имеет три вида drift — **числовой** (счётчики устаревают), **aspirational** (заявлено, не реализовано), **фактический** (значения в документе расходятся с кодом). v2 изолирует эти drift'ы: timeless-манифест не содержит числовых фактов, живой `implementation-status.md` обновляется вместе с кодом, архив остаётся как снимок во времени.
