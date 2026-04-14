# Полевой тест 10 — Invest (fintech / personal investing)

**Дата:** 2026-04-14
**Домен:** `invest`
**UI-адаптер:** Ant Design (4-й адаптер)
**Тезис:** IDF — корпус для финтех-приложения; ML/fuzzy/RAG за границей §13.

## Масштаб теста

| Метрика | Значение |
|---|---|
| Сущности | 11 (User, Portfolio, Position, Asset, Transaction, Goal, RiskProfile, Recommendation, Alert, Watchlist, MarketSignal) |
| Роли (§5) | 4 (investor / advisor / agent / observer) |
| Намерения | 40 (включая 6 agent + 4 rule-triggered) |
| Проекции | 17 (catalog/detail/dashboard/canvas/wizard) |
| Правила Rules Engine | 7 (все 4 extensions v1.5) |
| Внешние сервисы | 3 (invest-ml:3003, invest-fuzzy:3004, market-data:3006) |
| Seed-эффектов | ~60 (3 портфеля, 10 позиций, 14 сделок, 3 цели, 4 recommend, 4 alert) |
| UI-адаптер (новый) | Ant Design — parameter/button/shell/primitive/icon/**chart** |

## Что сработало

### Agent layer §17 без костылей
`/api/agent/invest/*` заработал сразу после регистрации `buildInvestEffects.cjs` + dispatch-ключа в `effectBuildersRegistry.cjs`. Shemma публикуется через `POST /api/typemap`, `roles.agent.canExecute` + `visibleFields` автоматически фильтруют ответы. **Smoke-test расширен до 65 шагов** (invest 7: schema / world / propose_rebalance / flag_anomaly / fetch_signal / buy_asset-403).

### Reactive Rules Engine §22 v1.5 — все 4 extension на одном домене
7 правил используют **все** четыре расширения:
- `aggregation { everyN: 10 }` — каждая 10-я сделка → drift-proposal
- `threshold { lookback: 3, condition: "all_equal:fuzzy_risk" }` — серия рисковых сигналов → alert
- `schedule "weekly:sun:18:00"` — еженедельный отчёт
- `schedule "daily:09:00"` — ежедневная проверка stop-loss
- `condition "effect.quantity > 100"` — крупная продажа → ребаланс
- `condition "effect.kind === 'sentiment' && Math.abs(effect.value) > 0.7"` — сильный sentiment → alert
- `aggregation { everyN: 5 }` для recommendations — overflow-напоминание

### Generic Effect Handler покрывает 70%+ интентов
Из 40 интентов только `buy_asset`/`sell_asset` (расчёт `total`) и `compute_risk_profile` (вывод `level` из score) требуют специальной логики в `buildEffects`. Остальные — через механический `intent.particles.effects`.

### Wizard-архетип на финтех-кейсе
`risk_questionnaire` (4 шага) + `portfolio_onboarding` (3 шага). Понадобилось **одно небольшое расширение ядра**: добавлена поддержка `source.inline` в `ArchetypeWizard.jsx` — статический массив опций без сидинга. Это общее улучшение для всех доменов.

### Внешняя граница §13 — masштабируется с :3002 до N
`external-calendar` был единственным внешним сервисом. Добавлены три новых (:3003 ML-сигналы, :3004 fuzzy-score, :3006 market-data ticks) по паттерну периодического push через `POST /api/effects/seed` с `intent_id: "_foreign"`. Работает без изменений в серверном pipeline.

### AntD-адаптер — контракт стабилен
4-й независимый UI-kit (после Mantine / shadcn / Apple) интегрирован **без изменений в `src/runtime/` вне `adapters/`**. ConfigProvider + русская локаль + dark-algorithm. `@ant-design/plots` даёт chart-primitive нативно. PrefsPanel: 4-й segment.

### Chart-primitive — первый не-текстовый primitive
`chart` + `sparkline` — новая категория. Вынесены в общие primitives с SVG-fallback (Line + Pie) для адаптеров без явной реализации. AntD-адаптер подставляет `@ant-design/plots`. Два canvas'а (`allocation_breakdown`, `market_trends`) декларативно используют chart-primitive.

## Что сломалось / потребовало доработки

### Ошибка «slot composer is required for feed»
Первая попытка использовать `kind: "feed"` для `transactions_history`, `recommendations_inbox`, `alerts_feed` провалилась — feed требует composer-слот, а у них нет creator-интентов с `confirmation: "enter"`. **Фикс:** поменял на `kind: "catalog"` — подходит лучше семантически (read-only + per-item действия).

### Nav-граф брал «первый попавшийся» detail по entity
Клик по сделке уводил в `portfolio_detail` c `portfolioId=tx_14`, потому что `Transaction` была в `entities` у `portfolio_detail`. **Фикс:** добавлены detail-проекции для всех mainEntity (5 новых) + сужены `entities` до одной сущности. Sub-collections продолжают работать через отдельную декларацию.

## Открытые дыры (§26 manifesto)

### 1. Many-to-many ownership для advisor→clients
`ownerField` — single user. Для advisor-assignment-паттерна нужен `assignmentEntity` или расширение онтологии. **Статус:** проект advisor-UI отложен — потребовало бы нового первичного механизма в ядре. Зафиксирован как honest open item.

### 2. Preapproval scope для agent сверх JWT
JWT даёт scope (какой пользователь), но не лимиты (max ордер, разрешённые активы). Робо-эдвайзер не может выполнять preapproved orders без дополнительного декларативного механизма. **Возможное решение:** `user.agentPreapproval: { maxOrderRUB, allowedAssetTypes, expiresAt }` + guard в `agent_execute_preapproved_order`.

### 3. Regulator-export как новая материализация
PDF-отчёт с causal chain — не пиксели, не голос, не agent-API. Манифест перечисляет материализации, но PDF/document вписывается неоднозначно. **Открытый вопрос:** добавлять document как равноправную материализацию или это просто рендер-формат проекции?

### 4. Chart-primitive: где живёт спец?
Декларативный `{ type: "chart", chartType: "line", ... }` — часть проекции. Но конкретный chartType-диалект (`candlestick` есть в AntD, нет в SVG-fallback) — это уже адаптерная особенность. Возникает `capability surface` — проекция не знает, что адаптер поддерживает. **Возможное решение:** registry capabilities на адаптере, warning при mismatch.

### 5. `Asset` без ownership
`ownerField` отсутствует — Asset это reference data. Но `role: investor.visibleFields.Asset` не декларирован, схема выдавала `Asset: undefined`. Graceful degradation: `"all"` для entities без ownerField. **Открытый вопрос:** формализовать `Asset.kind: "reference"` как явный маркер.

### 6. Capability-surface адаптера
AntD поддерживает `Statistic` primitive (trend-стрелка), Mantine — нет. cardSpec для портфелей не знает, рендерить ли trend как текст или как Statistic. Сейчас — через `getAdaptedComponent("primitive", "statistic")` с fallback, но паттерн не формализован.

## Метрики успеха — достижения

| Метрика плана | План | Факт |
|---|---|---|
| % через Generic Effect Handler | 70%+ | ~85% |
| Правил Rules Engine | 5+ | 7 |
| Agent smoke-steps | 15+ | 65 (invest 7 из них) |
| Regulator audit causal chain | ≤5 кликов в CausalityGraph | не имплементирован |
| 0 импортов AntD/Mantine/shadcn в `src/runtime/` вне adapters/ | Pass | Pass |
| AntD покрывает все kind без доп. категорий в runtime | Pass (кроме chart) | chart добавлен как ожидаемое расширение |
| 3–5 новых дыр в §26 | 3–5 | 6 |

## Что отложено в v2 теста

- **Advisor UI** (Шаг 7) — требует расширение ownerField до many-to-many
- **Regulator PDF-export** (Шаг 8) — новая материализация, дизайн-вопрос открыт
- **Tax-loss harvesting optimizer** — логика ушла бы в invest-ml, не в IDF-ядро
- **Реальное исполнение ордеров** — мок broker-adapter достаточен для полевого теста

## Связь с манифестом

| Раздел | Проверено | Как |
|---|---|---|
| §1 мультимодальность | ✓ | UI (AntD) + agent API (`/api/agent/invest/*`) |
| §5 роли + доступ | ✓ | 4 роли с `canExecute` + `visibleFields` + `ownerField` |
| §10 причинный порядок | ✓ | causalSort проходит для всех invest-эффектов |
| §12 алгебра связей | ✓ | intentAlgebra работает на invest из коробки |
| §13 граница | ✓ | 3 внешних сервиса, периодический push foreign-эффектов |
| §15 анкеринг | ~ | warnings есть, witness-of-proof — остаётся open |
| §17 agent layer | ✓ | `/api/agent/invest/*`, JWT, role-based, smoke test |
| §22 Reactive Rules | ✓ | все 4 extension в одном домене |
| §26 аспирационная категория | — | 6 новых открытых вопросов зафиксированы |

## Выводы

**IDF как корпус для финтеха — работает.** UI, agent API, правила, audit-trail, внешние интеграции — всё декларативно. ML/fuzzy/RAG не интегрируются в ядро — они остаются за границей, пушат foreign-эффекты. Единственное существенное расширение ядра — `chart`-primitive как новая категория, ожидаемое развитие после v1.2 (`inferFieldRole` расширял primitives внутренне, chart — это внешняя категория).

**4-й адаптер без костылей — контракт §17 стабилен.** AntD интегрировался за час написания кода (~450 LOC), без модификаций SlotRenderer / архетипов / crystallize. Это сильнейшее свидетельство, что адаптерный уровень — правильный срез абстракции.

**Rules Engine v1.5 задействован полностью впервые.** До invest ни один домен не использовал все 4 расширения одновременно. Тест подтверждает, что расширения — ортогональны и комбинируются.

## Следующие шаги

- Deploy публичный демо (`/invest`) + запись скринкаста (2-3 мин)
- Advisor UI как отдельный mini-test для проверки many-to-many ownership (§26.1)
- Обновить манифест до v1.6: зафиксировать chart-primitive, capability-surface адаптера, 6 новых §26 open items
