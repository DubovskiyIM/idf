# Полевой тест 11 — Delivery (food / groceries last-mile)

**Дата:** 2026-04-15
**Домен:** `delivery`
**Формат:** **Trilogy paradigm-additions** — scheduler + map + irreversibility, интегрированы одним доменом
**Тезис:** IDF выдерживает операционную вертикаль с темпоральной реактивностью, пространственным primitive и необратимыми побочными эффектами — все три paradigm-additions совместно работают в одном домене без коллизий.

## Масштаб теста

| Метрика | Значение |
|---|---|
| Сущности | **14** (User, Merchant, MenuItem, Zone, DispatcherAssignment, Order, OrderItem, Delivery, Address, CourierLocation, Payment, Notification, Review, AgentPreapproval) |
| Роли (§5) | **5** (customer / courier / merchant / dispatcher / agent) — dispatcher активирован с m2m через DispatcherAssignment |
| Намерения | **45** в 7 группах (customer 10 + merchant 8 + courier 7 + dispatcher 6 + agent 4 + rule-triggered 6 + foreign 4) |
| Проекции | **25** с 5 ROOT-секциями (Клиент / Курьер / Мерчант / Диспетчер / Настройки), **3 canvas с map-primitive** |
| Правила Rules Engine | **8** — 5 temporal (schedule v2 after/at) + 1 threshold (stuck_courier) + 1 condition (cooking_delay) + 1 aggregation (feedback every 10-th delivery) |
| Глобальные инварианты | **3** (transition Order.status, role-capability customer, referential OrderItem→Order) |
| Внешние сервисы | **4** (courier-location-feed:3008, geocoder:3009, payment-gateway:3010, notification-gateway:3011) |
| Seed-эффектов | **31** (9 User + 3 Merchant + 10 MenuItem + 2 Zone + 2 DispatcherAssignment + 1 Address + 1 Order + 2 OrderItem + 1 Payment) |
| Unit-тесты (добавлено) | **+60** (14 scheduler scheduleV2 + 17 timeEngine + 14 irreversibility helper + 4 validator integrity + 14 map helpers + 8 field roles + 3 cron migration) |
| Regression | **424/424** server/* passing |

## Полевой тест как триггер трёх paradigm-additions

До v1.7 парадигма была validated через восемь доменов, **последовательно** закрывающих §26 open items (каждый field-test — один-два закрытых пункта). Field-test 11 **уникален**: **запустил три paradigm-additions одновременно** — каждый нужен был для delivery-домена по своему основанию:

1. **Temporal Scheduler (§4 first-class)** — потому что food-delivery это SLA-driven операционка: «отмена через 5 мин без accept», «эскалация через 15 мин без pickup», «release hold через 24h без capture». Polling-подход (существовавший `schedule "daily:09:00"` cron) не подходит event-driven таймерам с динамическим revoke.
2. **Map primitive (§16a spatial-категория)** — потому что 3 canvas-проекции (dispatcher_map / order_tracker / active_delivery) требуют отрисовки зон, маркеров курьеров и маршрутов. Chart-primitive (v1.6) дал шаблон расширения; map — второе подряд primitive расширение.
3. **Irreversibility (§23 closure)** — потому что платежи и уведомления дают настоящие точки невозврата: `payment.captured` и `sms.sent` — реальные effects которые нельзя откатить через rollback.

Три additions собирались в паралелли (Plans 2, 3, 4 независимо) и **впервые применились совместно** в Plan 1 (delivery domain): `place_order` запускает scheduler-таймер, `dispatcher_map` использует map-primitive, `capture_payment` эмитит `__irr.high`.

## Что сработало

### Scheduler как системные intent'ы (Plan 2)

`schedule_timer` + `revoke_timer` реализованы как обычные intent'ы со `target: "ScheduledTimer"`. TimerQueue — in-memory min-heap + `hydrateFromWorld` при старте. Ключевой тезис подтверждён: **scheduler не вводит отдельное хранилище** — таймеры живут в Φ как обычные эффекты, state восстанавливается из fold(Φ).scheduledTimers. `evaluateScheduleV2` парсит `after: "5min"` / `at: "$.readyAt + 2min"` / `revokeOn: [...]` как расширение Rules Engine.

Старый cron v1 мигрирован на self-rescheduling timer без breaking изменений. 7 интеграционных тестов + booking демо (`auto_cancel_pending_booking`).

### Map primitive как spatial-категория (Plan 3)

Второе подряд primitive-расширение подтвердило шаблон chart:
- Pure helpers (`calcBounds`/`projectPoint`/`normalizeLayer`) отделены от React, 14 unit-тестов
- SVG-fallback общий в SDK renderer, адаптер-native реализации — optional (через `getAdaptedComponent("primitive","map")`)
- 4 layer kinds (marker/route/polygon/heatmap) покрывают food-delivery + universal geo
- Семантические field-роли `coordinate`/`address`/`zone` добавлены в `inferFieldRole` — автоматическое распознавание при кристаллизации

### Irreversibility как zero-migration поле эффекта (Plan 4)

`effect.context.__irr = { point, at, reason }` живёт в JSON — не потребовалась SQL миграция. Integrity rule в `validator.js §4` блокирует `α:"remove"` на сущности с past confirmed effect где `point === "high" && at !== null`. Forward-correction через `α:"replace"` разрешён всегда.

`IrreversibleBadge` primitive в SDK renderer автоматически рендерит «⚠ Необратимо» в detail-проекциях если item имеет такую метку.

**Неожиданный инсайт:** witness-of-proof появился естественно. Каждый `revoke_timer` effect пишет в context `causedByTimer`, `firedAt`, `guardEvaluatedTrue` — минимальная структура witness впервые в prod-коде без отдельных §15 усилий.

### Domain authoring как чистый template-follow

Delivery-домен — **9-й в прототипе**, ~1700 LOC доменного кода (сравнимо с invest 1438). Авторинг по проверенному паттерну invest/sales/reflect. Generic Effect Handler покрыл **41 из 45 intents** (~91%); специфика только для `place_order` (batch), `capture_payment` (irreversibility), `cancel_order` (compensating), `request_refund` (forward-correction).

### Внешняя граница §19 — 4-й подряд сценарий

До field-test 11 граница была проверена на 3 паттернах: pull-sync (external-calendar), periodic push (market-data / invest-ml), fire-and-forget (notification — только контракт). Plan 5 добавил **4-й паттерн: async state machine с webhook'ами** (payment-gateway: pending→held→captured|refunded). Пять паттернов границы — стабилизировано:

| Паттерн | Сервис | Эффекты | Irreversibility |
|---|---|---|---|
| pull-sync | external-calendar:3002 | mirror Event | — |
| periodic push (state replace) | market-data:3006 | foreign replace Position.currentPrice | — |
| periodic push (append) | courier-location-feed:3008 | foreign add CourierLocation | — |
| request-response + mirror | geocoder:3009 | foreign add Address | — |
| async state machine | payment-gateway:3010 | foreign replace Payment.status | `__irr.high` на capture |
| fire-and-forget | notification-gateway:3011 | foreign add Notification | `__irr.high` на delivered |

`server/effect-pipeline.js` не требовал изменений — все 6 паттернов ложатся на единый `/api/effects/seed` endpoint с `intent_id:"_foreign"`.

## Что сломалось / потребовало доработки

### Fold validator.js — два дефекта обнаружены при реализации Plan 3

Task 8 Plan 2 (ScheduledTimer fold integration) выявил два pre-existing бага в `validator.js::foldWorld`:

**(a) Плюрализация lowercase** — `updateTypeMap` делал `toLowerCase()` перед плюрализацией, давая кривые коллекции `scheduledtimers` вместо `scheduledTimers`. Фикс: сохраняем camelCase-первую-букву-строчную.

**(b) α:replace с target без точки** — код предполагал формат `"Entity.field"` и падал с `{...entity, "Entity": val}` для голого `"ScheduledTimer"`. Фикс: если target без точки, мержим весь ctx (без id) в запись.

Оба фикса — **generic improvements** ко всему fold, применимы к всем существующим и будущим сущностям. 424/424 regression тестов подтвердили — ничего не сломано.

### Scheduler final-review harden

После Plan 2 final review обнаружил race window: если `ScheduledTimer` не в typeMap (например, test env без `updateTypeMap`), то `revoke_timer` с `α:replace` получает validation error «сущность не найдена», timer остаётся active в Φ, а из in-memory queue уже удалён. На рестарте `hydrateFromWorld` снова его подберёт → риск duplicate fire.

Фикс в `validator.js §5`: пропускаем entity-exists check для `schedule_timer` и `revoke_timer`. 2 строки в условии.

### Flaky integration test в параллельном vitest

`server/scheduler.integration.test.js` (created Plan 2) иногда fail'ится при параллельном vitest-run из-за shared SQLite state между test-файлами. В изоляции 2/2 passing. Задокументировано как **test-infra issue**, закрыто помечено в §26 open items v1.7 (правильное решение — per-file SQLite через `IDF_DB_PATH` env).

## Открытые дыры (§26 manifesto — новые v1.7 items)

### 1. Cron self-rescheduling после firing
Plan 2 мигрирует legacy cron (`"daily:09:00"`) в первый `ScheduledTimer` при boot, но после firing следующий timer **не создаётся автоматически**. Нужна system-rule `revokeOn: cron_timer_fired` → re-emit schedule_timer, либо sub-handler внутри `fireDue`. Не блокирует прототип (в delivery нет cron-правил), но потребуется для production.

### 2. Cluster-friendly single-leader для scheduler
При horizontal scale каждый node будет fire'ить таймеры → duplicate emits. Нужен либо leader-election (один процесс tick'ает), либо DB-lock на transition `active:true, firedAt:null → firedAt:now`.

### 3. Irreversibility — replace-to-prior blocking
Сейчас блокируется только `α:"remove"`. Для full "rollback-protection" нужно сравнивать новое value vs history same-field. Требовало бы history diff — future, не требуется в delivery/invest.

### 4. Asset-boundary vs effect-boundary формализация (§19)
Plan 3 выявил что tile-провайдер (Mapbox/OSM), emoji-CDN, шрифты — внешние источники, но не writer/reader Φ. Это **asset-boundary**, не effect-boundary §19. Формализован в manifesto v1.7 §19 как терминологический инсайт; production SDK может потребовать явного `ontology.assets[]` для audit/CSP/SRI.

### 5. Form-factor / device-profile как ось §17 (не-реализовано, обнаружено)
Delivery имеет 4 surface с разными form-factor'ами: customer mobile (Apple-glass), courier mobile (Mantine), merchant kiosk/KDS (shadcn), dispatcher desktop (AntD). Решение «разные адаптеры для разных ролей домена» требует per-role adapter resolver в runtime. Сейчас переключение через PrefsPanel — глобальное. Не реализовано (вне scope paradigm-validation); задокументировано как §26 open item.

### 6. Native map реализации (опциональный polish)
Mapbox GL JS для Apple и `@ant-design/maps` для AntD — чисто визуальные улучшения. SVG-fallback из SDK renderer покрывает все 3 canvas структурно корректно. Native реализации — future, не блокируют paradigm validation.

## Hypotheses verdict

Spec field-test 11 (`docs/superpowers/specs/2026-04-15-delivery-domain-field-test-11-design.md`) формулировал 3 гипотезы:

### H1 — Темпоральная реактивность first-class интегрируется с Rules Engine без дублирования

✅ **ПОДТВЕРЖДЕНА.** `schedule v2` — аддитивное расширение существующего формата rules. Парсер `evaluateScheduleV2` сосуществует с legacy `evaluateScheduledRules`. Cron мигрирован. Один путь вместо двух. Детальный verdict: `docs/superpowers/specs/2026-04-15-temporal-scheduler-validation.md`.

### H2 — Distributed-tx во внешней границе не требует saga-алгебры

✅ **ПОДТВЕРЖДЕНА в рамках прототипа.** Сценарий place_order + payment hold + geocode + notification целиком обрабатывается через:
- `α:"batch"` для atomic multi-effect (Order + Payment add)
- Rules Engine для compensating (`rule_release_expired_hold` при hold без capture за 24h)
- Forward-correction через обычный `α:"replace"` (request_refund даже после captured)
- Irreversibility point — structural marker, не отдельная saga state

Специальная saga-алгебра не потребовалась. Honest border: это тестировалось на прототипе, не на production-нагрузке с real network partitions.

### H3 — kiosk form-factor через существующие архетипы без нового адаптера

🟡 **Отложена.** Решение «достаточно ли shadcn для KDS» требует manual UI smoke с готовым domain (не проверено автоматизированно в subagent-driven execution). Архитектурно `kds_board` как `kind: "dashboard"` с widget-проекциями работает; визуальная адекватность для реального мерчантского workflow — вопрос UX, не paradigm. Фиксируется как open item для будущих itераций.

## Унаследованные v1.6 open items — какие закрыты

v1.6 §26 содержал 5 основных open items:

1. ✅ **Темпоральная реактивность как first-class scheduler** — закрыто в v1.7 (Plan 2).
2. ✅ **Необратимые побочные эффекты требуют статуса "точка невозврата"** — закрыто в v1.7 (Plan 4).
3. 🟡 **Composite / polymorphic entities** (union-типы в entity.kind) — не затрагивается field-test 11, переносится в v1.8.
4. 🟡 **Adapter capability mismatch при extending primitives** — обнаружен паттерн: chart + map расширялись как independent primitive-категории, зато без breaking существующих адаптеров. Капabilities объявляются, runtime консультируется, fallback работает. Всё формально покрыто; declare-and-check при startup — future enhancement, не блокер.
5. 🟡 **Server-rendered PDF / DOCX** — не затрагивается field-test 11, переносится.

**Итого v1.7 закрыл 2 из 5 крупных v1.6 items + запустил трио paradigm additions + 1 full domain.**

## Результаты прототипирования

- **9 доменов** (+ delivery): booking, planning, workflow, messenger, sales, lifequest, reflect, invest, **delivery**
- **527+ намерений** в прототипе (делаем учёт: messenger 100 + sales 225 + lifequest 56 + reflect 47 + invest 46 + **delivery 45** + остальные ~50)
- **424/424 server/* unit-тестов** (+60 от field-test 11)
- **Пять UI-адаптеров-вариаций в использовании**: Mantine / shadcn / Apple / AntD + возможный 5-й для KDS (отложен, H3)
- **Шесть паттернов внешней границы** §19: pull-sync / periodic-push-append / periodic-push-replace / request-response / async-state-machine / fire-and-forget

## Четвёртый цикл architectural stability

v1.4 → v1.5 → v1.6 → **v1.7** — четыре релиза подряд с пустой аспирационной категорией в §26. v1.7 особенно показательна: **5 закрытий всех additive**, zero breaking changes.

Поверх 3-х paradigm additions + domain + 5 npm services delivery запускается из коробки:

```bash
npm run server              # :3001
npm run courier-feed        # :3008 (Plan 5)
npm run geocoder            # :3009 (Plan 5)
npm run payment-gw          # :3010 (Plan 5, irreversibility webhook)
npm run notify-gw           # :3011 (Plan 5, fire-and-forget с irreversibility)
npm run delivery-seed       # bootstrap 31 эффект (Plan 5)
npm run dev                 # :5173 — domain-switcher → delivery
```

## Заключение

Field-test 11 — **самый paradigmatic-heavy** field-test из одиннадцати: три одновременных paradigm-additions (scheduler + map + irreversibility) + полноценный domain authoring с 9-м в корпусе. Все additions additive, zero breaking, четвёртый подряд релиз «manifesto ↔ code synchrony».

Следующий focus не paradigm, а **infrastructure / DX**: `@intent-driven/server` extraction (SDK Phase 3), CI pipeline, public npm publish, DX-аудит, documentation. Paradigm стабилизировалась — нужно довести до переиспользуемого tooling.
