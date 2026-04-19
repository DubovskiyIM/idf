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
| invest | 58 | 14 сущностей | AntD enterprise-fintech, 4 роли (investor/advisor/agent/observer), 7 rules, 3 внешних ML-сервиса |
| delivery | 45 | 14 сущностей | 5 ролей, map-primitive, dispatcher m2m, irreversibility в `capture_payment` |

**Итого:** 585 намерений, 9 доменов, один движок кристаллизации.

### Тестовое покрытие

- **idf (прототип)**: 497 unit-тестов в 42 файлах
- **@intent-driven/core**: 483 unit-теста
- **@intent-driven/renderer**: 95 тестов
- **@intent-driven/canvas-kit**: 36 тестов
- **4× `@intent-driven/adapter-*`**: 12 тестов суммарно
- **Итого:** 1123 теста в SDK + прототипе
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
- **13 stable patterns** с формальным trigger/structure/rationale triple
- **3 паттерна с `structure.apply`**: `subcollections`, `grid-card-layout`, `footer-inline-setter`
- **10 matching-only**: hero-create, phase-aware-primary-cta, irreversible-confirm, inline-search, composer-entry, vote-group, antagonist-toggle, hierarchy-tree-nav, discriminator-wizard, m2m-attach-dialog
- **Falsification framework**: каждый паттерн имеет shouldMatch / shouldNotMatch fixtures
- **Studio viewer** `/studio/patterns` + prototype `PatternInspector` drawer (toggle `Cmd+Shift+P`)

### Invariants (5 kinds)
`role-capability`, `referential`, `transition`, `cardinality`, `aggregate`. Dispatch через `server/schema/invariantChecker.cjs`; handlers в `@intent-driven/core/invariants/*.js`. Проверяются в `onConfirmed`; на violation — rollback через `cascadeReject` + SSE `effect:rejected`. Декларации: invest (5), sales (3), delivery (3).

---

## 6. Open items

### Перенесённые из архивного v1.12

- **Composite / polymorphic entities** — union-типы не выражаются через `entity.kind`
- **Adapter capability checks at startup** — новый primitive kind без уведомления адаптеров
- **`@intent-driven/server` extraction (Phase 3)** — после стабилизации scheduler'а
- **Server-rendered PDF / DOCX** поверх documentMaterializer
- **Pattern Bank: `structure.apply` для оставшихся 10 stable паттернов** — hero-create первый кандидат
- **Role-specific FK convention** — sales/seller_profile не матчится через findSubEntities (seller/targetUser vs userId)
- **PatternInspector component test** — требует `@testing-library/react` + `jsdom`
- **Studio PatternBank URL write-back** — domain change не пишет в URL
- **X1: удаление 9 explicit `subCollections` overrides** — после ≥1 релиза с apply в проде
- **Pattern Bank candidate/ + anti/** — директории зарезервированы, пустые
- **Pattern Bank: ML / auto-learning** паттернов из приложений
- **Cluster-friendly scheduler** — single-leader TimerQueue не distributed-ready

### Известные прототип-специфичные проблемы

- **`vite build` периодически падает** с ENOTEMPTY + ошибкой порядка CSS `@import` — ручной fix, не блокирует dev-server и тесты
- **entity.kind `mirror`** — маркер зарезервирован, в коде не применяется; `internal` — implicit default
- **fieldRoles `money` / `percentage` / `trend` / `ticker`** — полностью рендерятся только в AntD; остальные адаптеры используют text-fallback
- **Particle uniformity** — 6 из 9 доменов используют generic `buildEffects`; 3 имеют custom-handlers (messenger/workflow/booking)
- **5/9 доменов — legacy** (имеют ManualUI.jsx); 4/9 — чисто-кристаллизационные (артефакт рендерится только через кристаллизатор + рендерер)

---

## 7. Команды запуска

```bash
npm run calendar     # :3002 внешний календарь (опц.)
npm run server       # :3001 основной API
npm run dev          # Vite :5173 UI
npm run invest-ml    # :3003 мок ML-сигналов (опц.)
npm run invest-fuzzy # :3004 fuzzy-scoring (опц.)
npm run market-data  # :3006 price-tick feed (опц.)
npm test             # vitest (1123 теста через SDK+прототип)
npm run agent-smoke  # 75-шаговый integration
npm run build        # prod-сборка (периодически падает, см. §6)
```

---

## 8. История эволюции

Хронология реализации документирована по версиям в `docs/archive/manifesto-v1.3.md` … `manifesto-v1.12.md`.

**Методологическая заметка (ex §15 v1.11):** манифест имеет три вида drift — **числовой** (счётчики устаревают), **aspirational** (заявлено, не реализовано), **фактический** (значения в документе расходятся с кодом). v2 изолирует эти drift'ы: timeless-манифест не содержит числовых фактов, живой `implementation-status.md` обновляется вместе с кодом, архив остаётся как снимок во времени.
