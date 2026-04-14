# Полевой тест 10 — Invest (fintech / personal investing)

**Дата:** 2026-04-14
**Домен:** `invest`
**UI-адаптер:** Ant Design (4-й адаптер)
**Тезис:** IDF — корпус для финтех-приложения; ML/fuzzy/RAG за границей §13.

## Масштаб теста

| Метрика | Значение |
|---|---|
| Сущности | 12 (User, Portfolio, Position, Asset, Transaction, Goal, RiskProfile, Recommendation, Alert, Watchlist, MarketSignal, **Assignment**) |
| Роли (§5) | 4 (investor / advisor / agent / observer) — advisor активирован с m2m |
| Намерения | 46 (включая 6 agent + 4 rule-triggered + 6 advisor) |
| Проекции | 20 (catalog/detail/dashboard/canvas/wizard + advisor + regulator) |
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

### 1. ~~Many-to-many ownership для advisor→clients~~ **ЗАКРЫТО**
Реализован `role.scope` механизм в `filterWorld.cjs` (см. «Что реализовано частично»). Backcompat сохранён.

### 2. ~~Preapproval scope для agent сверх JWT~~ **ЗАКРЫТО**
Реализован декларативный `preapprovalGuard.cjs` с 5 типами чек-предикатов:
`active`, `notExpired`, `maxAmount`, `csvInclude`, `dailySum`.

Контракт в ontology:
```js
roles.agent.preapproval = {
  entity: "AgentPreapproval",
  ownerField: "userId",
  requiredFor: ["agent_execute_preapproved_order"],
  checks: [
    { kind: "active", field: "active" },
    { kind: "notExpired", field: "expiresAt" },
    { kind: "maxAmount", paramField: "total", limitField: "maxOrderAmount" },
    { kind: "csvInclude", paramField: "assetType", limitField: "allowedAssetTypes" },
    { kind: "dailySum", paramField: "total", limitField: "dailyLimit",
      sumCollection: "transactions", sumField: "total",
      sumOwnerField: "userId", sumTimestampField: "timestamp",
      sumFilter: { field: "initiatedBy", equals: "agent" } },
  ],
}
```

Hook в `server/routes/agent.js` после ownership-check: возвращает 403
`preapproval_denied` с `failedCheck` и `details`. 16 unit-тестов в
`server/schema/preapprovalGuard.test.js` покрывают все чеки, изоляцию
owner, дневные агрегаты с фильтрами по initiator, backcompat (без
preapproval-конфига — no-op). Smoke-тест расширен до 68 шагов с
проверкой: success / maxAmount reject / csvInclude reject.

### 3. ~~Document как равноправная материализация §1~~ **ЗАКРЫТО**

Создан `server/schema/documentMaterializer.cjs` — generic функция, превращающая **любую** проекцию (catalog/feed/detail/dashboard) в структурированный document-граф + HTML-рендер. Это доказывает, что `document` ≡ `pixels` ≡ `agent-API` — разные рендеры одного артефакта.

Document-граф (universal format):
```js
{
  title, subtitle,
  meta: { date, viewer, domain, projection, materialization: "document" },
  sections: [
    { id, heading, kind: "paragraph"|"table", columns?, rows?, content? }
  ],
  footer: { note, auditTrail }
}
```

Маршрут: `GET /api/document/:domain/:projection?format=json|html&as=role`.
- `format=html` (default) — print-ready HTML, открыть в новой вкладке → Save as PDF
- `format=json` — структурированный граф для агентов/пайплайнов

Переиспользуется **тот же** `filterWorldForRole` (role.scope / ownerField), что и agent-API — document viewer-scoped. 15 unit-тестов: catalog с filter, detail + sub-collections, dashboard с embedded, money-форматирование, HTML-escape, wizard/canvas edge cases. +3 smoke-шага (69-71).

**Вывод для манифеста v1.6:** §1 расширяется до четырёх базовых материализаций:
- **pixels** (UI через адаптер — Mantine/AntD/shadcn/Apple)
- **voice** (voice-flow — не реализован, но контракт общий)
- **agent-API** (`/api/agent/:domain/*`)
- **document** (`/api/document/:domain/:projection`) — добавлено §26.3

Все четыре работают поверх одной артефакт-модели v2.

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

## Что реализовано частично

### Advisor UI (Шаг 7) — закрыт, включая серверный m2m
- `Assignment` сущность (advisorId, clientId, status)
- 6 advisor intents: assign_client / unassign / pause / resume / create_recommendation_for_client / send_client_message
- `AdvisorReviewCanvas` — выбор клиента → dashboard с P&L, аллокацией, risk profile, рекомендациями
- 3 demo-клиента в seed (Анна, Борис, Елена) с полными портфелями, целями, risk profiles
- **§26.1 ЗАКРЫТ мини-тестом:** `role.scope` механизм в `server/schema/filterWorld.cjs`:
  ```js
  scope: {
    Portfolio: { via: "assignments", viewerField: "advisorId",
                 joinField: "clientId", localField: "userId",
                 statusField: "status", statusAllowed: ["active"] }
  }
  ```
  Семантика: `advisor.scope[X]` видит `X` где `X[localField] ∈ { a[joinField] | a ∈ world[via], a[viewerField] === viewer.id, a[statusField] ∈ statusAllowed }`. Backcompat сохранён (scope отсутствует → работает entity.ownerField как раньше). 10 unit-тестов в `server/schema/filterWorld.test.js` покрывают: строгий m2m, изоляцию advisor'ов, statusAllowed-фильтр, пустые via-коллекции, разные `localField` (userId / id), defensive empty при нечитаемой декларации.

### Regulator PDF report (Шаг 8) — через print media query
- `RegulatorReportCanvas` — print-ready HTML с секциями: сводка / таблица сделок / правила
- `window.print()` → браузерный «Save as PDF»
- Разметка: цветовое кодирование по initiatedBy (user/agent/rule), footer с отсылкой к CausalityGraph
- **⚠ "Document" как равноправная материализация (§1) — концептуальный вопрос в §26.3** — текущее решение минимально: HTML + print CSS. Полноценный server-side PDF (через puppeteer или PDFKit) с цифровой подписью — отдельная задача.

## Что отложено в v2 теста

- **Server-side many-to-many ownership** (§26.1 полное решение) — расширение filterWorld до via-assignment scope
- **Server-rendered PDF + signature** — вместо client-side print
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
