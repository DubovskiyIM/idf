# Changelog

## v1.5.0 — 2026-04-14

**9-й полевой тест: reflect (дневник эмоций по Yale RULER)**

### Added

- **Домен `reflect`** — дневник эмоций с Mood Meter (Marc Brackett, Yale RULER):
  - 47 интентов, 13 проекций, 10 сущностей
  - 6 custom canvas (~1300 LOC): MoodMeterCanvas (2D-input), TimelineCanvas, CalendarHeatmapCanvas, MoodTrendsCanvas, ActivityCorrelationCanvas, MoodMeterClusterCanvas
  - 25 эмоций по 4 квадрантам Mood Meter (Energy × Pleasantness)
  - 12 seed-активностей, гипотезы, инсайты, теги
- **Apple visionOS-glass адаптер** — третий UI-kit (после Mantine + shadcn-doodle):
  - Frosted glass карточки, SF Pro Display / Inter, iOS blue accent
  - Окончательная валидация §17 «адаптивного слоя»
- **Reactive Rules Engine extensions** (§22):
  - `aggregation: { everyN }` — counter-based firing per-user
  - `threshold: { lookback, field, condition }` — predicate over last N entries (DSL: all_equal/equals/gt/lt)
  - `schedule: "weekly:sun:HH:MM" | "daily:HH:MM"` — cron-like server timer
  - `condition: "<expr>"` — JS expression evaluator (whitelisted Math)
  - Новая таблица `rule_state` (counter, last_fired_at) per (rule, user)
- **Token Bridge contract** (§17) — формальный CSS-vars между адаптером и domain code
- **Custom Canvas registry** (§16a) — formalized: `registerCanvas(projectionId, Component)`
- **Server-side aggregation** как третий тип intent — intent читает world и эмитит meta-effect
- **`/reflect`** route, добавлен в standalone и prototype

### Changed

- **README.md, CLAUDE.md** — обновлены метрики и описание
- **541 unit-тест** (было 500, +41 новых)
- **38 файлов тестов** (было 36)
- **58-шаговый agent-smoke** (было 50, +8 reflect)
- **481 интент** в 7 доменах (было 434 в 6)
- **3 UI-адаптера** (было 2)

### Honest Border

- §21 — analytical UI (charts/heatmaps/2D inputs) **inherent требуют** custom canvas (~1300 LOC в reflect, ~1500 LOC в lifequest). Это не недостаток, а формализованная граница.

### Documentation

- `docs/manifesto-v1.5.md` — обновлённый манифест
- `docs/superpowers/specs/2026-04-14-reflect-domain-design.md` — спек reflect
- `docs/superpowers/plans/2026-04-14-reflect-implementation.md` — план реализации (27 задач, 6 фаз)
- `docs/superpowers/specs/2026-04-14-reflect-postmortem.md` — анализ паттернов и инсайтов

---

## v1.4 — 2026-04-14

**Ревизия манифест↔код v1.3 + 8-й полевой тест: lifequest (цели + привычки)**

### Added

- **Домен `lifequest`** — боевой домен (цели + привычки + геймификация):
  - 56 интентов, 11 проекций, 10 сущностей
  - 6 custom canvas (~1500 LOC): TodayCanvas, WeekProgressCanvas, CalendarCanvas, RadarChart (point_a), VisionBoardCanvas, дашборды
  - shadcn/ui (Doodle) адаптер — второй UI-kit
  - Mobile-first: BottomTabs для < 768px
- **Wizard — 7-й архетип** (§16a) — многошаговый guided flow (booking_wizard)
- **Reactive Rules Engine** документирован (§22) — event-condition-action основа
- **Секционированная навигация** (§16a) — `ROOT_PROJECTIONS` с секциями
- **Personal layer §17** — usePersonalPrefs + PrefsPanel (density/fontSize/iconMode/uiKit)
- **475 unit-тестов** (было 372)

### Changed

- **Манифест v1.4** — аспирационная категория §26 впервые пуста
- 7 архетипов вместо 6

---

## v1.3 — 2026-04-13

**Agent layer для всех 5 доменов + LLM enrichment + Personal layer**

### Added

- Agent layer для всех 5 доменов (workflow + messenger добавлены к booking/planning/meshok)
- Декларативные политики кворума (`closeWhen` / `absentVote`)
- LLM enrichment pass (Claude API)
- TypeScript типы ядра (`src/types/idf.d.ts`)
- ErrorBoundary для graceful degradation
- CI через GitHub Actions
- Composer reply mode + SubCollection inline-edit
- Agent-smoke 42 шага
- Deploy config (Dockerfile + fly.toml)

---

## v1.2 — 2026-04-13

**8-й полевой тест: meshok (аукцион)**

### Added

- Домен `meshok` — 226 намерений, 10 сущностей, 4 роли (buyer/seller/moderator/agent)
- Auto-close по кворуму (`checkQuorum`)
- Agent layer для meshok
- Canvas + Dashboard архетипы (5-й и 6-й)
- M5: удаление legacy v1 (-2111 LOC)
- auth_users → Φ через `_user_register` dual-write
- Семантические роли полей → выводимая карточка (cardSpec) + секционированная форма

---

## v1.1 — 2026-04-11

**7-й полевой тест: messenger + M1/M2 (архетипы и слоты)**

### Added

- Домен `messenger` — 100 намерений в 7 категориях
- Формальная схема артефакта v2 с архетипами/слотами
- M1: Feed архетип
- M2: Catalog + Detail + навигационный граф
- Универсальная серверная валидация
- Единый пайплайн приёма эффектов

---

## v1.0 — 2026-04-XX

**Базовая парадигма: 3 домена + 23 раздела манифеста**

### Initial

- Домены: booking (20), planning (17), workflow (15) = 52 намерения
- Φ как source of truth, fold(Φ_confirmed) = world
- Жизненный цикл proposed → confirmed | rejected
- Черновики Δ, TTL-эффекты
- Граница с зеркальными сущностями (booking ↔ external calendar)
- Кристаллизация v1 (LLM-driven)
- Визуальный язык (2 темы × 3 варианта)
- Овеrlay(I) для многофазных намерений
