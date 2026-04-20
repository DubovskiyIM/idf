# IDF Implementation Status

Живой документ об имплементационном состоянии референсной реализации IDF (прототип + SDK). Формат (`docs/manifesto-v2.md`) определяет аксиомы; этот документ фиксирует, что из формата **реализовано** и **валидировано на практике**.

**Последнее обновление:** 2026-04-20

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

**Итого:** 672 намерения, 11 доменов, один движок кристаллизации.

Freelance (12-й полевой тест) выявил 40+ конкретных SDK gap'ов в процессе авторинга — см. [`sdk-improvements-backlog.md`](sdk-improvements-backlog.md). Backlog классифицирован P0/P1/P2 и адресован `@intent-driven/core`, `@intent-driven/renderer`, `@intent-driven/adapter-antd`.

Compliance (13-й полевой тест) закрыл backlog §1.1 (`invariant.kind: "expression"` — расширен до `(row, world, viewer, context)` сигнатуры), добавил 5-ю производную материализацию (`materializeAuditLog` над Φ для observer-role) и зафиксировал три открытых design-gap: polymorphic Evidence.attachedTo (sparse-columns в MVP), computed ownerField для Attestation, `role.scope: {kind: "expression"}` support.

### Тестовое покрытие

- **idf (прототип)**: 799 unit-тестов в 56 файлах (+31 compliance после 13-го теста)
- **@intent-driven/core**: 916 unit-тестов (+21 после PR #96 + #98: expression world/viewer/context + audit materializer)
- **@intent-driven/renderer**: 175 тестов
- **@intent-driven/canvas-kit**: 36 тестов
- **4× `@intent-driven/adapter-*`**: 34 теста суммарно (adapter-antd 22, apple 3, shadcn 3, mantine 6)
- **Итого:** ~1960 тестов в SDK + прототипе
- **agent-smoke**: 75-шаговый integration-тест, покрывает все домены
- **domain-audit**: `npm run audit-report` — 7 осей × 10 доменов, baseline в `docs/domain-audit.{md,json}`

---

## 2. SDK monorepo

**Репо:** `~/WebstormProjects/idf-sdk/` (pnpm workspace, tsup build, vitest)

### Пакеты

| Пакет | Версия | Лицензия | Назначение |
|---|---|---|---|
| `@intent-driven/core` | 0.33.0 | BSL 1.1 | engine, fold, crystallize_v2, invariants (6 kinds incl. **expression** с world/viewer/context), materializers (document / voice / **auditLog**), Pattern Bank, salience declaration-order ladder |
| `@intent-driven/renderer` | 0.12.0 | BSL 1.1 | ProjectionRendererV2, 7 архетипов, 11 controls, primitives (atoms/containers/chart/map + IrreversibleBadge + PatternPreviewOverlay), 6 parameters, adapter registry |
| `@intent-driven/adapter-mantine` | 1.1.0+ | BSL 1.1 | Mantine UI-kit (corporate) |
| `@intent-driven/adapter-shadcn` | 1.1.1+ | BSL 1.1 | shadcn/ui doodle |
| `@intent-driven/adapter-apple` | 1.1.2+ | BSL 1.1 | Apple visionOS-glass |
| `@intent-driven/adapter-antd` | 1.2.0+ | BSL 1.1 | AntD enterprise-fintech (button label/children, DateTime withTime, fieldRole price, maxLength/pattern — все patches from freelance field-test закрыты) |
| `@intent-driven/canvas-kit` | 0.2.0 | BSL 1.1 | SVG/canvas утилиты (9 helpers) |
| `@intent-driven/cli` | 1.0.32+ | MIT | `npx @intent-driven/cli init <name>` — 5-шаговый LLM-диалог через Claude |

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

Полный классифицированный список (40+ пунктов, P0/P1/P2) — в [`sdk-improvements-backlog.md`](sdk-improvements-backlog.md). Статус P0 (2026-04-20):

- ✅ **Invariant handler schema drift** (1.1) — ЗАКРЫТ (`normalize.js` + try/catch)
- ✅ **`AntdButton` label vs children** (2.1), **`AntdDateTime` без времени** (2.2), **`AntdNumber` fieldRole** (2.3), **`AntdTextInput` maxLength/pattern** (2.4) — ЗАКРЫТЫ в adapter-antd@1.2.0, host workarounds удалены
- ✅ **`ownershipConditionFor` single-owner** (3.2) — ЗАКРЫТ (`entity.owners` + `intent.permittedFor` + `getOwnerFields` util)
- ⏳ **Domain scoping инвариантов** (1.4) — частично (invariant.where; auto-discriminator deferred)
- ⏳ **`PrimaryCTAList` не рендерит форму** (3.1) для multi-param phase-transitions
- ⏳ **`inferParameters` читает только top-level** (4.1), **`heroCreate` matcher читает только `particles.confirmation`** (4.2)
- ⏳ **`footer-inline-setter` слишком агрессивен** (4.3) — матчит textarea-параметры

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
