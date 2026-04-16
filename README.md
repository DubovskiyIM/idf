# Intent-Driven Frontend (IDF)

**IDF — это не фреймворк, это тип данных.** Артефакт v2 с онтологией, намерениями, проекциями и ролями — это формат описания приложения, как OpenAPI или JSON-LD. Адаптеры, материализаторы и рантаймы — *читатели* формата, а не части фреймворка.

[![npm @intent-driven/core](https://img.shields.io/npm/v/@intent-driven/core?label=%40intent-driven%2Fcore&color=2563eb)](https://www.npmjs.com/package/@intent-driven/core)
[![npm @intent-driven/renderer](https://img.shields.io/npm/v/@intent-driven/renderer?label=renderer&color=2563eb)](https://www.npmjs.com/package/@intent-driven/renderer)
[![spec Apache 2.0](https://img.shields.io/badge/spec-Apache%202.0-green)](./spec/LICENSE)
[![core BSL 1.1](https://img.shields.io/badge/%40intent--driven%2Fcore-BSL%201.1-orange)](https://github.com/DubovskiyIM/idf-sdk/blob/main/packages/core/LICENSE)
[![clients MIT](https://img.shields.io/badge/clients-MIT-blue)](./LICENSE-CODE)
[![tests 426+356](https://img.shields.io/badge/tests-426%20prototype%20%2B%20356%20SDK-brightgreen)](./docs/field-test-11.md)

Приложения **выводятся** из формального описания намерений (intents) и проекций (projections). Автор — режиссёр, ведущий диалог с моделью о том, *что* должно произойти; модель — соавтор, кристаллизующий это в исполнимый интерфейс. Рантайм — детерминированный: никаких запросов к API моделей во время использования приложения.

> **[Спецификация формата v0.1](./docs/spec-v0.1/)** — Working Draft с 6 JSON Schema'ами, 7 главами, 124 test fixtures. Верифицирована против 9 доменов (605 intents, 105 projections, 119 artifacts, 200 effects). Если хотите реализовать IDF на своём стеке — начинайте здесь.

![IDF](./docs/screenshots/domen.png)

---

## Основной тезис

UI — это пересечение двух структур: **проекций** (что видит пользователь) и **намерений** (что он может сделать). **Четыре равноправные материализации** §1 манифеста — пиксели, голос, агентский API, документ — функции над одним и тем же артефактом.

```
World(t) = fold(Φ_confirmed)
```

Состояние не хранится — вычисляется из причинно-упорядоченного потока эффектов. Все высокоуровневые конструкции (проекции, алгебра связей, интегритет) определены над этой основой.

Парадигма **фальсифицируема**: формальная модель в [спецификации формата](./docs/spec-v0.1/), проверяемая граница применимости в [одиннадцати полевых тестах](./docs/), 6 JSON Schema'ов с 138 conformance-тестами.

---

## Быстрый старт

### Установка из npm

```bash
npm install @intent-driven/core @intent-driven/renderer @intent-driven/adapter-mantine
```

```jsx
import { useEngine } from "@intent-driven/core";
import { ProjectionRendererV2, registerUIAdapter } from "@intent-driven/renderer";
import { mantineAdapter } from "@intent-driven/adapter-mantine";

registerUIAdapter(mantineAdapter);

function App({ domain }) {
  const { world, exec } = useEngine(domain);
  return <ProjectionRendererV2 artifact={domain.ARTIFACT} world={world} exec={exec} />;
}
```

### Запуск прототипа локально

Node.js 20+.

```bash
git clone https://github.com/DubovskiyIM/idf.git && cd idf
npm install

npm run server                # :3001 — основной сервер (SQLite + SSE)
npm run dev                   # :5173 — Vite dev server с переключателем доменов
```

Для демонстрации четырёх материализаций:

```bash
curl http://localhost:3001/api/agent/booking/schema
curl "http://localhost:3001/api/voice/reflect/home?format=ssml"
curl "http://localhost:3001/api/document/invest/portfolio?format=html"
```

Delivery-домен демонстрирует три paradigm-additions v1.7 совместно (temporal scheduler, map primitive, irreversibility):

```bash
npm run server
npm run courier-feed        # :3008 — GPS tick каждые 3с
npm run geocoder            # :3009 — address → coords
npm run payment-gw          # :3010 — async webhook + capture=irreversible
npm run notify-gw           # :3011 — fire-and-forget
npm run delivery-seed       # 31 bootstrap эффект
npm run dev                 # → переключить домен на delivery
```

---

## Девятидоменный прототип — 572 намерения в одном потоке Φ

| Домен | Намерений | Особенность |
|-------|-----------|-------------|
| **Sales** | 223 | Аукционная барахолка, 4 роли, чисто-кристаллизационный (без ManualUI) |
| **Messenger** | 99 | WebSocket + WebRTC, real-time, 15 custom canvas |
| **LifeQuest** | 56 | Цели + привычки, shadcn/doodle, mobile-first, 6 canvas |
| **Invest** | 49 | Fintech, 4 роли, 7 правил Rules Engine, 3 ML-сервиса |
| **Reflect** | 47 | Дневник эмоций (Yale RULER), Apple visionOS-glass, analytical canvas |
| **Delivery** | 45 | Food last-mile, 5 ролей, три paradigm-additions (scheduler+map+irreversibility) |
| **Booking** | 21 | Онлайн-запись, темпоральные предикаты, wizard |
| **Planning** | 17 | Коллективные опросы, кворум, phase-aware CTA |
| **Workflow** | 15 | Визуальный редактор процессов, React Flow canvas |

Один движок, один рантайм, один валидатор — **девять наборов определений**. **426 unit-тестов прототипа + 356 тестов SDK monorepo**, 75-шаговый agent-smoke.

### Четыре UI-адаптера на одной онтологии (валидация §17)

| Адаптер | Пакет | Стиль | Дефолт для |
|---------|-------|-------|-----------|
| Mantine | [`@intent-driven/adapter-mantine`](https://www.npmjs.com/package/@intent-driven/adapter-mantine) | Corporate / data-dense | booking, planning, workflow, messenger, sales |
| shadcn/ui (Doodle) | [`@intent-driven/adapter-shadcn`](https://www.npmjs.com/package/@intent-driven/adapter-shadcn) | Handcrafted / sketch | lifequest |
| Apple visionOS-glass | [`@intent-driven/adapter-apple`](https://www.npmjs.com/package/@intent-driven/adapter-apple) | Premium / glassmorphism | reflect |
| Ant Design | [`@intent-driven/adapter-antd`](https://www.npmjs.com/package/@intent-driven/adapter-antd) | Enterprise / fintech-grade | invest |

Переключение в runtime через PrefsPanel ⚙ → UI-kit. Capability surface адаптера позволяет graceful fallback при unsupported variant (`getCapability`/`supportsVariant`).

![IDF — Booking v2](./docs/screenshots/booking-v2.png)
![IDF — Messenger](./docs/screenshots/messenger-v2.png)

---

## Ключевые концепты

- **Намерение** — атом системы: сущности, условия, эффекты, витнессы, подтверждение (RFC 2119 определение в [спеке §3](./spec/idf-v1.0-part1-core.md)).
- **Проекция** — формальная спецификация `⟨E, Q⟩`: какие сущности показать, какой запрос, какие кнопки. Зависит от зрителя через `role.scope`.
- **Поток эффектов Φ** — единственный источник истины. Мир = `fold(Φ_confirmed)`. Lifecycle: `proposed → confirmed | rejected`.
- **Кристаллизатор v2** — построение артефакта проекции из намерений + онтологии. Детерминирован, перегенерируем, тестируем. 7 архетипов (`feed / catalog / detail / form / canvas / dashboard / wizard`).
- **Алгебра связей §12** — пять типов (▷ sequential, ⇌ antagonistic, ⊕ excluding, ∥ parallel, adjacency) выводятся из частиц, не декларируются.
- **Темпоральный scheduler** (v1.7) — `schedule_timer` / `revoke_timer` как системные intent'ы; таймеры живут в Φ как обычные эффекты. `after: "5min"`, `at: "$.readyAt + 2min"`, `revokeOn: [events]`.
- **Map primitive** (v1.7) — spatial primitive по образцу chart: 4 layer-kind (marker/route/polygon/heatmap), SVG-fallback, adapter-delegation.
- **Irreversibility** (v1.7) — instance-уровневая метка необратимости `effect.context.__irr = { point, at, reason }`; integrity правило блокирует `α:"remove"` после `point=high, at≠null`.
- **Reactive Rules Engine** — event-condition-action + 4 extensions v1.5 (aggregation / threshold / schedule v2 / condition).
- **Global Invariants** (§14 v1.6.1) — декларативные ∀-свойства мира: `role-capability`, `referential`, `transition`, `cardinality`, `aggregate`.
- **Token Bridge** — формальный CSS-vars контракт между адаптером и domain code.
- **Custom Canvas registry** — `registerCanvas(projectionId, Component)` для domain-specific visualizations.

---

## Агентский слой

Демонстрация тезиса «LLM — равноправный пользователь намерений». REST endpoint'ы (`/api/agent/:domain/{schema,world,exec}`) под JWT превращают агента в обычного клиента intent-API. Все 9 доменов имеют agent layer с декларативным role-based доступом через `ontology.roles.agent`.

- Агент читает схему, фильтрует мир по роли (`filterWorldForRole`), вызывает намерения
- Конфликт-rejection работает естественно (два клиента → один 409)
- Нет «адаптера для LLM» — агент работает с теми же intents, что и UI
- **Preapproval guard**: `roles.agent.preapproval` с 5 типами предикатов (`active`, `notExpired`, `maxAmount`, `csvInclude`, `dailySum`) — агентские лимиты декларативно
- **4 материализации**: агентский API — одна из четырёх равноправных (вместе с pixels / voice / document)

75-шаговый integration smoke проверяет happy path + rejection + 403 forbidden на всех 9 доменах.

---

## Маршруты прототипа

| Маршрут | Описание |
|---------|----------|
| `/` | IDF-каркас: панели определений, поток Φ, граф причинности, 3D causality-graph |
| `/sales` | Аукцион (dashboard + catalog + detail + form) |
| `/messenger-v2` | Мессенджер (feed + catalog + detail + WebRTC) |
| `/lifequest` | Цели + привычки (Doodle стиль, mobile-first, BottomTabs) |
| `/reflect` | Дневник эмоций (Mood Meter + analytics, Apple glass) |
| `/invest` | Портфель + робо-эдвайзер (AntD fintech, 3 ML-сервиса) |
| `/delivery` | Food last-mile (5 ролей, живая карта, 4 внешних сервиса) |
| `/booking-v2` | Бронирование услуг |
| `/planning-v2` | Совместное планирование встреч |
| `/workflow` | Workflow-редактор |

---

## Тесты, сборка, демо-скрипты

```bash
npm test                  # 426 unit-тестов прототипа
npm run build             # production-сборка
npm run agent-smoke       # 75-шаговый integration test (9 доменов)
npm run sales-demo        # walkthrough аукциона (12 шагов)
npm run delivery-seed     # bootstrap demo для delivery
npm run crystallize-llm   # LLM enrichment (опц., требует ANTHROPIC_API_KEY)
```

SDK monorepo живёт в sibling репозитории [DubovskiyIM/idf-sdk](https://github.com/DubovskiyIM/idf-sdk) — 7 пакетов, 356 тестов, tsup + vitest.

---

## Что читать

1. **[Спецификация формата v0.1](./docs/spec-v0.1/)** — нормативный документ: 7 глав (artifact, core semantics, conformance L1–L4, test suite, reference impls, versioning), 6 JSON Schema'ов, 124 test fixtures. Читать, если хотите *реализовать IDF на своём стеке* или *понять формат данных*.
2. **[Манифест v1.7](./docs/manifesto-v1.7.md)** — 26 разделов: *почему* парадигма такая, полевые тесты, architectural insights, roadmap. Философия и мотивация, не формат.
3. **[11 полевых тестов](./docs/)** — `field-test-1.md` … `field-test-11.md`. Каждый — один домен, один цикл «обнаружение блокера → формализация → закрытие».
4. **[Анонс v1.7 для Хабра](./docs/announce-habr.md)** — обзорная статья.

> **Спецификация vs Манифест:** Спецификация — *что именно* должен принимать / производить код (MUST/SHOULD/MAY по RFC 2119). Манифест — *почему* так, *что* мы узнали из полевых тестов. При расхождении авторитетна спецификация. Ранняя версия формальной спеки в `spec/` (v1.0-part1-core, на английском) superseded `docs/spec-v0.1/`.

---

## Статус

**v1.7 — production-ready research-prototype.** Четвёртый релиз подряд с пустой аспирационной категорией §26 манифеста. Все декларации манифеста подтверждены кодом (426 + 356 тестов). Все три paradigm additions v1.7 (scheduler, map, irreversibility) интегрированы в live-домен delivery.

SDK на публичном npm: https://www.npmjs.com/org/intent-driven

---

## Область применимости

Парадигма **фальсифицируема**, и это её сила:

- **Зона максимальной силы:** транзакционные домены (e-commerce, аукционы, финтех, бронирование, операционка).
- **Зона высокой силы:** темпоральные, коллаборативные, коммуникационные домены.
- **Граница:** распределённые системы с eventual consistency, real-time collaborative editing (CRDT), ML в рантайме, game-loop/физика.

Подробнее — §21 манифеста «Транзакционный уклон парадигмы» и §23 «Слабые места и открытые задачи».

---

## Стек

- **Фронтенд:** React 19, Vite 8, Tailwind CSS 4, **4 UI-адаптера** (Mantine + shadcn + Apple + AntD), Lucide + React Flow
- **Бэкенд:** Node.js + Express, SQLite (better-sqlite3), WebSocket, JWT + bcrypt
- **Кристаллизатор:** чистые функции JavaScript, 7 архетипов, Custom Canvas registry, TypeScript типы
- **Scheduler:** `server/timeEngine.js` — in-memory priority queue + hydrate-from-Φ + tick-loop
- **Rules Engine:** event-condition-action + 4 extensions v1.5 + schedule v2 (after/at/revokeOn)
- **Агентский слой:** 9 доменов, REST API, JWT + preapproval guard, 75-шаговый smoke
- **LLM enrichment:** Claude API через `@anthropic-ai/sdk` (опционально, design-time only)
- **CI:** GitHub Actions (vitest + vite build)

---

## Лицензия

Многолицензионный репозиторий:

| Зона | Лицензия | Путь |
|------|----------|------|
| Спецификация | Apache License 2.0 | [`spec/LICENSE`](./spec/LICENSE) |
| Документация (манифест, field-tests) | Apache License 2.0 | [`docs/LICENSE`](./docs/LICENSE) |
| Ядро `@intent-driven/core` | Business Source License 1.1 → Apache 2.0 на 2030-04-15 | [in SDK repo](https://github.com/DubovskiyIM/idf-sdk/blob/main/packages/core/LICENSE) |
| Прототип, домены, landing, внешние сервисы | MIT | [`LICENSE-CODE`](./LICENSE-CODE) |
| Клиентские SDK пакеты | MIT | [in SDK repo](https://github.com/DubovskiyIM/idf-sdk) |

Подробнее — [`LICENSE`](./LICENSE) (pointer, объясняющий split).

---

**Автор:** Игнат Дубовский · <dubovskyy.im@gmail.com>
