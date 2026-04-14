# Intent-Driven Frontend

**Парадигма выводимых UI, где LLM работает только в авторстве, а не в рантайме.**

Приложения не пишутся вручную и не собираются в браузере LLM на лету, а **выводятся из формального описания пользовательских намерений**. Автор — режиссёр, ведущий диалог с моделью о том, *что* должно произойти; модель — соавтор, кристаллизующий это в исполнимый интерфейс. Рантайм — детерминированный: никаких запросов к API моделей во время использования приложения.

![IDF](./docs/screenshots/domen.png)

## Основной тезис

UI — это пересечение двух структур: **проекций** (что видит пользователь) и **намерений** (что он может сделать). Пиксели, голос, агентский API — лишь равноправные материализации этого пересечения.

Кристаллизация происходит **в авторстве**, не в рантайме. Когда пользователь нажимает кнопку, никакая LLM не участвует в решении, что показать или что применить — всё уже выведено заранее. LLM возвращается только когда автор меняет намерения.

Следствие: парадигма **фальсифицируема** — у неё есть формальная модель (см. манифест), проверяемая граница применимости (см. полевые тесты) и жёсткие инвариантные правила, которые либо выполняются, либо нет.

## Прототип

**Семидоменное приложение, 481 намерение** в одном потоке эффектов `Φ`:

| Домен | Намерений | Сущностей | Описание |
|-------|-----------|-----------|----------|
| **Meshok** | 225 | 11 | Аукционная барахолка (eBay-style): лоты, ставки, заказы, споры, отзывы |
| **Messenger** | 100 | 6 | Мессенджер с WebSocket, WebRTC-звонками, групповыми чатами |
| **LifeQuest** | 56 | 10 | Цели + привычки + геймификация (боевой домен), shadcn/doodle стилистика, 6 custom canvas |
| **Reflect** | 47 | 10 | Дневник эмоций по Yale RULER (Mood Meter), Apple visionOS-glass, 6 analytical canvas |
| **Booking** | 21 | 6 | Онлайн-запись к специалистам |
| **Planning** | 17 | 5 | Совместное планирование встреч: опросы, голосование, кворум |
| **Workflow** | 15 | 6 | Редактор рабочих процессов с React Flow и серверным исполнением |

Один движок, один рантайм, один валидатор — **семь наборов определений**. **541 unit-тест**, 71-шаговый agent-smoke, CI через GitHub Actions.

### Три UI-адаптера на одной онтологии (валидация §17)

| Адаптер | Стиль | Дефолт для |
|---------|-------|-----------|
| **Mantine** | Corporate / data-dense | booking, planning, workflow, messenger, meshok |
| **shadcn/ui (Doodle)** | Handcrafted / sketch | lifequest |
| **Apple visionOS-glass** | Premium / minimal frosted glass | reflect |

Переключение в runtime через PrefsPanel ⚙ → UI-kit. **Token Bridge** — формальный CSS-vars contract между адаптером и domain code.

## Ключевые концепты

- **Намерение** — атом системы: сущности, условия, эффекты, витнессы, подтверждение.
- **Проекция** — формальная спецификация: какие сущности показать, какие фильтры, какие кнопки доступны.
- **Поток эффектов** `Φ` — единственный источник истины. Мир = `fold(Φ_confirmed)`. Lifecycle: `proposed → confirmed | rejected`.
- **Кристаллизация** — автоматическое построение артефакта проекции из намерений + онтологии. Детерминирована, перегенерируема, тестируема.
- **7 архетипов**: `feed`, `catalog`, `detail`, `form`, `canvas`, `dashboard`, `wizard` — покрывают все полевые тесты.
- **UI-адаптер** — три kit'а (Mantine + shadcn-doodle + Apple visionOS-glass). Смена kit'а — один вызов `registerUIAdapter`.
- **Custom Canvas registry** — `registerCanvas(projectionId, Component)` для domain-specific UI (charts, 2D inputs, spatial canvases).
- **Reactive Rules Engine** — декларативная автоматизация: trigger + 4 модификатора (aggregation/threshold/schedule/condition).
- **Token Bridge** — формальный CSS-vars contract между адаптером и domain code.
- **Агентский слой** — JSON-API для LLM-агента, живущего в общем `Φ` с людьми. 8 доменов с agent layer.
- **LLM enrichment** — опциональный проход Claude API для обогащения артефактов (labels, icons, placeholders).

![IDF](./docs/screenshots/booking-v2.png)
![IDF](./docs/screenshots/messenger-v2.png)

## Агентский слой

Демонстрация тезиса «LLM — равноправный пользователь намерений». REST endpoint'ы (`/api/agent/:domain/{schema,world,exec}`) под JWT превращают агента в обычного клиента интент-API. Все 8 доменов имеют agent layer с декларативным role-based доступом через `ontology.roles.agent`.

- Агент читает схему, фильтрует мир по роли, вызывает намерения
- Конфликт-rejection работает естественно (два клиента → один 409)
- Нет «адаптера для LLM» — агент работает с теми же интентами, что и UI

Подробнее: [`docs/agent-demo.md`](docs/agent-demo.md) | [`docs/agent-system-prompt.md`](docs/agent-system-prompt.md)

## Как запустить

Node.js 20+.

```bash
npm install

npm run server    # :3001 — основной сервер
npm run calendar  # :3002 — мок внешнего календаря (для booking)
npm run dev       # :5173 — Vite dev server
```

Откройте `http://localhost:5173`, переключатель доменов вверху.

### Маршруты

| Маршрут | Описание |
|---------|----------|
| `/` | IDF-каркас: панели определений, поток Φ, граф причинности |
| `/meshok` | Аукцион (dashboard + catalog + detail + form) |
| `/messenger-v2` | Мессенджер (feed + catalog + detail) |
| `/lifequest` | Цели + привычки + геймификация (Doodle стиль, mobile-first) |
| `/reflect` | Дневник эмоций (Mood Meter + analytics, Apple visionOS-glass) |
| `/booking-v2` | Бронирование |
| `/planning-v2` | Совместное планирование |
| `/workflow` | Workflow-редактор (canvas + catalog) |

### Тесты и сборка

```bash
npm test              # 541 unit-тест
npm run build         # production-сборка
npm run agent-smoke   # 71-шаговый integration test агентского слоя (8 доменов)
npm run meshok-demo   # демо-сценарий аукциона (12 шагов)
npm run crystallize-llm  # LLM enrichment (требует ANTHROPIC_API_KEY)
```

## Что читать

1. **[Манифест v1.6](docs/manifesto-v1.6.md)** — 26 разделов, формальное описание парадигмы. Читать целиком, если интересно *почему*.
2. **[Полевые тесты 1–10](docs/)** — десять доменов, в которых парадигма проверялась на прочность. Включая [reflect postmortem](docs/superpowers/specs/2026-04-14-reflect-postmortem.md) — анализ паттернов после 10-го теста (invest, fintech).
3. **[Agent-demo](docs/agent-demo.md)** — как LLM-агент становится клиентом интент-API. Читать, если интересно *как «UI — это не код»*.

## Статус

**Исследовательский прототип v1.6.** Код работает, 329 тестов ядра проходит, CI настроен, TypeScript типы ядра определены. **Аспирационная категория §26 манифеста — пуста**: всё что декларировано, реализовано. Парадигма готова к SDK extraction и production usage.

## Границы применимости

Парадигма **фальсифицируема**, и это её сила:

- **Зона максимальной силы:** транзакционные домены (e-commerce, аукционы, финтех, бронирование).
- **Зона высокой силы:** темпоральные и коллаборативные домены (календари, опросы, мессенджеры).
- **Граница:** распределённые системы с eventual consistency, real-time collaborative editing (CRDT), ML в рантайме.

Подробнее — §21 манифеста и §23 «Слабые места».

## Стек

- **Фронтенд:** React 19, Vite 8, Tailwind CSS 4, **3 UI-адаптера** (Mantine + Radix/shadcn + Apple), Lucide icons, React Flow
- **Бэкенд:** Node.js + Express, SQLite (better-sqlite3), WebSocket, JWT + bcrypt
- **Кристаллизатор:** чистые функции JavaScript, 7 архетипов, Custom Canvas registry, TypeScript типы
- **Reactive Rules Engine:** event-condition-action + 4 модификатора (aggregation/threshold/schedule/condition)
- **Агентский слой:** 8 доменов, REST API, `server/schema/*` (чистые CJS-модули)
- **LLM enrichment:** Claude API через `@anthropic-ai/sdk` (опционально)
- **CI:** GitHub Actions (vitest + vite build)

## Лицензия

[MIT](LICENSE). Используй, форкай, модифицируй, публикуй — на усмотрение. Гарантий никаких.
