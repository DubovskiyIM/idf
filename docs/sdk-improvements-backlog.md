# SDK Improvements Backlog

**Источник:** сессия 2026-04-19 по починке freelance-домена (Cycle 1–2, 8 пунктов чек-листа).
**Адресат:** `@intent-driven/core` + `@intent-driven/renderer` + `@intent-driven/adapter-antd` в `~/WebstormProjects/idf-sdk/`.
**Статус:** ⛔ = блокировало e2e, 🟡 = workaround стоял в `idf/`, 🟢 = nice-to-have.

---

## 1. Invariants & schema mismatches

### 1.1 ⛔ Handler schema-drift не падает gracefully
**Файл:** `packages/core/src/invariants/{referential,aggregate,transition,cardinality}.js`
**Проблема.** Handler'ы бросают `TypeError: Cannot read properties of undefined (reading 'split')`, когда автор онтологии декларирует инвариант в альтернативной форме. Brosaемое исключение в `checkInvariants/index.js` превращается в `violation: {severity:"error"}`, что каскадно откатывает ЛЮБОЙ свежеподтверждённый эффект домена.
**Конкретно:**
- `referential` ждёт `{from:"Entity.field", to:"Entity.field"}`, но `freelance`/`delivery` писали `{entity, field, references}`.
- `aggregate` ждёт `{op, from:"Entity.field", target:"Entity.field", where}`, писали `{entity, field, formula:{op, of, where, groupBy}}`.
- `transition` ждёт `transitions` или `order`, писали `allowed`.
**Что сделать.** Либо поддержать оба формата (нормализация в `index.js::checkInvariants`), либо проваливаться в `{severity:"warning", message: "unknown invariant shape", details}` вместо кидания. Не откатывать effect на эту ошибку.

### 1.2 ⛔ Нет `expression` / custom-predicate kind
**Кейс.** `Deal.customerId !== Deal.executorId` — простая row-level инварианта без встроенного kind'а. Пришлось снять и полагаться на `buildCustomEffects`.
**Что сделать.** Добавить `kind: "expression"` с evaluatorом JS-выражения над row. Или документировать `registerKind` API и примеры (сейчас есть в коде, но не в docs).

### 1.3 🟡 Composite `groupBy` в `cardinality`
**Кейс.** «Один активный Response на пару (executorId, taskId)» — нельзя выразить декларативно. Пришлось enforce в `buildCustomEffects::submit_response`.
**Что сделать.** `groupBy: ["executorId", "taskId"]` — массив, handler конкатенирует в ключ группы.

### 1.4 ⛔ Scoping инвариантов по домену — нет
**Кейс.** `lifequest.tasks` и `freelance.tasks` мапятся в одну SQL-таблицу `effects → tasks`. Freelance transition-invariant на `Task.status` ловит lifequest'овские `status="active"` и ломает каскад. Пришлось даунгрейдить три инварианта в `severity:"warning"`.
**Что сделать.** Один из:
- `invariant.domain` — фильтр, применять инвариант только к row'ам, созданным этим доменом (нужен `entity.domain` в Φ-context).
- `invariant.where` (уже есть для cardinality) — расширить на transition/aggregate.
- Namespace коллекций: `{domain}.tasks` вместо глобального `tasks`.

---

## 2. `@intent-driven/adapter-antd` bugs

### 2.1 ⛔ Button primary/secondary/danger: API mismatch `label` vs `children`
**Файл:** `packages/adapter-antd/src/adapter.jsx:342-384`
**Проблема.** `AntdPrimaryButton({ label, ... })` читает `label`, а `packages/renderer/src/controls/FormModal.jsx:112` передаёт подпись через `children`:
```jsx
<PrimaryBtn onClick={onSubmit} disabled={submitting}>
  {submitting ? "…" : (item ? "Сохранить" : "Создать")}
</PrimaryBtn>
```
Кнопка рендерится пустой (цветной квадрат).
**Workaround в idf.** `DomainRuntime.jsx::patchAntdButtonsChildrenAsLabel` — обёртка передаёт children→label.
**Что сделать.** Антд-адаптер должен принимать **и `label`, и `children`**, приоритет label если оба заданы.

### 2.2 ⛔ `AntdDateTime` всегда рисует `DatePicker` без времени
**Файл:** `packages/adapter-antd/src/adapter.jsx:289-318`
**Проблема.** TimePicker включается только если `/time/i.test(name) && !/date/i.test(name)`. Для `deadline`, `expiresAt`, `scheduledAt` нет времени.
**Workaround в idf.** `DomainRuntime.jsx::AntdDateTimeWithTime` с `showTime:{minuteStep:5}`.
**Что сделать.** Респектить `spec.withTime` / `spec.precision: "minute"` / `spec.control: "datetime-local"`. Или по умолчанию для `type:"datetime"` всегда показывать время.

### 2.3 ⛔ `AntdNumber` не видит `fieldRole:"price"`
**Файл:** `packages/adapter-antd/src/adapter.jsx:267-287`
**Проблема.** `const isMoney = spec.fieldRole === "money" || /price|amount|cost|fee|value/i.test(spec.name)`. Но SDK `inferFieldRole` маппит money → `role:"price"` (PriceBlock). Форма теряет ₽-префикс на полях, у которых role стал price.
**Workaround в idf.** `DomainRuntime.jsx::AntdPriceNumber` + dispatcher на `spec.fieldRole === "price"`.
**Что сделать.** `isMoney = spec.fieldRole ∈ {"money", "price"}`.

### 2.4 ⛔ `AntdTextInput` игнорирует `maxLength`/`minLength`/`pattern`
**Файл:** `packages/adapter-antd/src/adapter.jsx:203-213`
**Проблема.** HTML-атрибуты валидации не пробрасываются в `<Input>`. Для `cardLastFour` (ровно 4 цифры), phone, etc. — нельзя ввести ограничение без кастомного кода.
**Workaround в idf.** `DomainRuntime.jsx::AntdTextInputWithValidation`.
**Что сделать.** Пробросить `maxLength`, `minLength`, `pattern` в `<Input>`. Отобразить ошибку, если HTML-validation fails при submit.

### 2.5 🟢 antd v5 deprecation warnings
**Проблема.** В console:
- `[antd: Card] size="default" is deprecated. Please use size="medium" instead.`
- `[antd: Card] bordered is deprecated. Please use variant instead.`
**Что сделать.** Миграция в `adapter-antd` на новый API.

### 2.6 🟡 `AntdOverflowMenu` игнорирует `spec.condition`
**Файл:** `packages/renderer/src/archetypes/ArchetypeDetail.jsx:114-125`
**Проблема.** `toolbarItems.map` превращает spec в `{key, label, icon, onClick}` — **без** `condition`. `AntdOverflowMenu` на выходе видит все кнопки независимо от viewer'а.
**Fallback-путь** (`SlotRenderer`) условия применяет — но antd-адаптер обходит SlotRenderer.
**Что сделать.** В `ArchetypeDetail.jsx` отфильтровать `slots.toolbar` по `evalCondition(spec.condition, ...)` ДО маппинга в `AdaptedOverflow` items, либо передать condition в AdaptedOverflow и пусть адаптер фильтрует.

---

## 3. `@intent-driven/renderer` — `ArchetypeDetail`, `FormModal`, `PrimaryCTA`

### 3.1 ✅ `PrimaryCTAList` не рендерит форму для multi-param phase-transitions
**Статус:** закрыто в idf-sdk PR #50 (merged 2026-04-19). Phase-transitions с параметрами идут через `wrapByConfirmation` → toolbar-overlay независимо от irreversibility. Host-workaround `irreversibility:"high"` на `submit_work_result` / `request_revision` / `submit_revision` снят в idf PR `feat/sdk-p0-integration` (2026-04-20) — вернули семантически корректный `medium`.

**Исходная проблема (для истории):** `packages/renderer/src/archetypes/ArchetypeDetail.jsx:267-320` — `onClick={() => ctx.exec(spec.intentId, {id: target.id})}` параметры `spec.parameters` никогда не собирались.
**Workaround в idf был:** форсирован `irreversibility:"high"` на submit_work_result/submit_revision/request_revision, чтобы их исключил фильтр `primaryCTA` (line 135: `!== "high"`). С `control:"formModal"` попадали в toolbar.

### 3.2 ⛔ `ownershipConditionFor` хардкод одного ownerField
**Файл:** `packages/core/src/crystallize_v2/assignToSlotsDetail.js:265-282`
**Проблема.** `Deal.ownerField = "customerId"` → SDK ставит `condition: "customerId === viewer.id"` на все toolbar-кнопки, меняющие Deal.*. Это правильно для `accept_result`/`request_revision` (customer actions), но неправильно для `submit_work_result`/`submit_revision` (executor actions).
**Что сделать.** Один из:
- `entity.owners: ["customerId", "executorId"]` — SDK использует OR всех owners.
- `intent.permittedFor: ["executor"]` — override per-intent, подменяет ownershipCond.
- Читать `particles.conditions` и мёрджить с ownershipCond (если в conditions уже есть ownership-check, не добавлять).

### 3.6 ⛔ Singleton-detail empty-state без creator-toolbar
**Обнаружено:** 2026-04-20 при интеграции SDK P0-backlog (freelance my_wallet_detail).
**Файл:** `packages/renderer/src/archetypes/ArchetypeDetail.jsx:75-105`
**Проблема.** При `!target` (singleton detail, запись ещё не существует) SDK делает early return с `<EmptyState title="X ещё не создан" hint="Создайте запись..." />` и больше ничего не рендерит. `top_up_wallet_by_card` (α:"add", toolbar-intent) не доступен — пользователь уткнулся в dead-end: видит сообщение «создайте запись», но кнопки создания нет.
**Что сделать (один из):**
- `ArchetypeDetail` при `!target` (singleton): отфильтровать `slots.toolbar` по `spec.α === "add" && spec.creates === mainEntity` и отрендерить creator-row ниже EmptyState.
- Новый stable pattern `singleton-empty-creator` в Pattern Bank с `structure.apply(slots, context)` — inject `{type:"emptyStateCreator", intent:creatorIntentId}` в detail.header для singleton без target.
- Host-level workaround: в host `ArchetypeDetail` override или domain-level UI — но это затягивает обратно overrides, противоречит drift-protection v2.1.
**Priority:** P0 — wallet-flow полностью сломан без creator-affordance в empty-state.
**Workaround сейчас:** нет (SDK-level, не обходится декларативно).

### 3.3 🟡 `IrreversibleBadge` не auto-placed
**Файлы:** `packages/core/src/crystallize_v2/assignToSlotsDetail.js::buildDetailBody` + `packages/renderer/src/controls/ConfirmDialog.jsx`.
**Проблема.** Entity с `__irr:{point:"high", at}` получает поле данных, но SDK `buildDetailBody` не инжектит `{type:"irreversibleBadge"}` node в children. ConfirmDialog тоже не рендерит badge (`controls/ConfirmDialog.jsx`).
**Что сделать.**
- `buildDetailBody` должен добавлять `irreversibleBadge` в header-row (рядом с title) для mainEntity, если у target есть `__irr`.
- ConfirmDialog должен рендерить badge, если `spec.irreversibility === "high"`, с текстом причины из `__irr.reason`.
- ConfirmDialog fixed label «Удалить» — сделать configurable (`spec.confirmLabel` / `spec.danger: false`). Для `confirm_deal` надпись «Удалить» абсурдна.

### 3.4 🟢 `registerUIAdapter` вызывается в render
**Файл:** `packages/renderer/src/adapters/registry.js` + usage pattern.
**Проблема.** В `idf/src/runtime/DomainRuntime.jsx:257` (и standalone.jsx:142) вызывается прямо в render — side-effect. Триггерит "Internal React error: Expected static flag" при HMR-переключении UI-kit.
**Что сделать.** Перевести регистрацию в React Context (`<AdapterProvider adapter={x}>…</AdapterProvider>`) или useSyncExternalStore. Убрать global registry как mutable state.

### 3.5 🟡 `AuthGate` хардкодит `--mantine-color-*`
**Файл:** нет в SDK (в `idf/src/runtime/renderer/auth/AuthGate.jsx`), но паттерн shared-auth полезен.
**Что сделать.** Экспортировать `<AuthForm>` primitive из `@intent-driven/renderer`, который читает IDF Token Bridge (`--idf-*`). Сейчас `idf/` имеет локальную копию.

---

## 4. Control Archetypes & Pattern Bank

### 4.1 ✅ `inferParameters` не читает `intent.particles.parameters`
**Статус:** закрыто в idf-sdk PR #50 (merged 2026-04-19). Fallback на `intent.particles.parameters` добавлен. Совокупно с §4.2 закрыло my_deals-heroCreate edge-case, что позволило вернуть `creates:"Deal"` в `confirm_deal` (idf PR `feat/sdk-p0-integration`, 2026-04-20).

### 4.2 ✅ `heroCreate` матчер нормализует top-level confirmation
**Статус:** закрыто в idf-sdk PR #50 (merged 2026-04-19). `selectArchetype` нормализует `intent.confirmation ?? intent.particles?.confirmation`.

### 4.3 ✅ `footer-inline-setter` слишком агрессивен
**Статус:** закрыто в idf-sdk PR #50 (merged 2026-04-19). Matcher теперь отсекает `parameters` с `control ∈ {textarea, file, multiImage}`. Host-workaround `projection.patterns.disabled:["footer-inline-setter"]` снят в idf PR `feat/sdk-p0-integration` (2026-04-20) на `deal_detail_customer` / `deal_detail_executor`.

**Исходная проблема (для истории):** матчер `effects.length === 1 && α === "replace"` не проверял parameters. `request_revision` (1 effect + textarea `comment`) попадал — переведён из toolbar в footer.
**Workaround в idf был:** `projection.patterns: { disabled: ["footer-inline-setter"] }` на двух deal-проекциях.

### 4.4 🟡 `collapseToolbar` dedup по `icon`
**Файл:** `packages/core/src/crystallize_v2/assignToSlotsDetail.js:217-228`
**Проблема.** При >3 intents, visible отбирает уникальные `icon`. Когда 4 intents имеют default fallback `⚡` (нет правила в `getIntentIcon`), 3 из 4 оказываются в overflow. Потеря primary-кнопки.
**Workaround в idf.** Явные `icon:"↩"/"📤"/"⚡"/"✓"` на всех phase-transition intents.
**Что сделать.** Dedup только при равной `salience`; explicit salience=primary/high игнорирует icon-dedup.

### 4.5 🟡 `subCollection.addControl` требует `parentEntity` в `entities`
**Файл:** `packages/core/src/crystallize_v2/assignToSlotsDetail.js::buildSection:340`
**Проблема.** Для `submit_response` addControl на task_detail.Response-section: `intent.particles.entities.includes("Task")` — required. Но FK `Response.taskId` УЖЕ декларирует связь. Заставляет писать `entities: ["task: Task", "response: Response"]` даже когда task-связь косвенная.
**Что сделать.** Если subEntity имеет FK-поле на `parentEntity` (через ontology FK-detection), разрешить addControl без явного `parentEntity` в entities.

### 4.6 🟡 subCollection: нет `itemView` override
**Файл:** `packages/core/src/crystallize_v2/assignToSlotsDetail.js::buildSection`
**Проблема.** `buildSubItemView` выбирает первое non-system поле как bind. Для Response получили `bind:"executorId"` — показывается uuid. Нет способа задать custom через projection.
**Что сделать.** `projection.subCollections[].itemView` — override.

### 4.7 🟡 subCollection: нет `sort` / `where`
**Проблема.** «Сортировать transactions по createdAt desc» / «скрыть withdrawn responses» — нельзя декларативно. Работает только insertion-order, все item'ы показываются.
**Что сделать.** `projection.subCollections[].sort: "-createdAt"`, `.where: "item.status !== 'withdrawn'"`.

### 4.8 🟡 subCollection: нет status-aware item styling
**Кейс.** not_chosen/withdrawn responses должны быть dimmed или badge'нуты.
**Что сделать.** SDK `SubCollectionItem` применяет opacity/className по item[statusField], если entity имеет enum-status field с «terminal» states.

### 4.9 🟡 Role-switcher UX: проекции идентичны для ролей, пользователь не понимает, работает ли тоггл
**Обнаружено:** 2026-04-20 при интеграции SDK P0-backlog (freelance).
**Файл:** `idf/src/runtime/renderer/shell/V2Shell.jsx:142-148` (host).
**Проблема.** При клике на «Исполнитель» из «Заказчика» вся видимая шапка проекций («Каталог задач», «Мои задачи», «Мои сделки», «Мой кошелёк») идентична — R3b + R8 выдают те же ROOT_PROJECTIONS для обеих ролей. Content фильтруется внутри (filterWorldForRole), но пользователь видит стабильный tab-bar и думает, что тоггл не работает. Нужна визуальная affordance смены роли: либо меняющиеся tab-labels («Мои заказы» vs «Мои исполнения»), либо role-badge в header, либо меняющийся primary-accent адаптера.
**Что сделать:** host-feature / SDK-новый паттерн. Нужен brainstorming.

---

## 5. Rules Engine

### 5.1 ✅ `matchTrigger` array support — ПОЧИНЕНО В СЕССИИ
**Файл сейчас:** `idf/server/ruleEngine.js` (локально).
**Что сделать в SDK.** Перенести в `@intent-driven/core` (если rule engine будет extracted в SDK Phase 3) или в официальную schema: `rule.trigger: string | string[]`. Использует OR-семантику.

### 5.2 🟡 `rule.warnAt` не работает
**Проблема.** В rules.js декларация `warnAt:"48h"` — server emit только основной timer. Warning-система не существует.
**Что сделать.** Scheduler v2 emit второго timer с `fireIntent: "__warn"` (или параметризованно из rule) за `warnAt` до основного. `revokeOn` тот же.

### 5.3 🟡 `rule.guard` semantics
**Проблема.** `evalGuard` в `timeEngine.js` — простая проверка, нет документированного формата.
**Что сделать.** Formalize: guard — JS-expression над world + firing effect context. Задокументировать.

---

## 6. Missing stable patterns (Pattern Bank additions)

### 6.1 🟢 `catalog-creator-toolbar`
**Trigger.** Catalog с creator-intent, у которого `particles.parameters.length > 1` или `particles.confirmation === "form"`.
**Apply.** Ставит `{type:"intentButton", opens:"overlay"}` в `slots.toolbar`, НЕ в `slots.hero`. Overlay — formModal.
**Rationale.** heroCreate уместен только для single-text-param creator'ов (todo-list). Multi-param creator'ы типа `create_task_draft` требуют отдельного модального окна.
**Replaces.** Текущий heroCreate fallback, но с более точным матчем.

### 6.2 🟢 `lifecycle-transition-formModal`
**Trigger.** Detail-проекция; intent с `effects = [replace {mainEntity}.status, ...]` + `particles.parameters.length > 0`.
**Apply.** Не в primaryCTA (нет form), а в toolbar с formModal-overlay.
**Rationale.** submit_work_result / request_revision — phase-transitions с параметрами (result, comment). PrimaryCTA их не умеет рендерить.

### 6.3 🟢 `role-scoped-ownership`
**Trigger.** Entity с несколькими owner-like fields (customerId + executorId в Deal).
**Apply.** Расширяет ownershipCond: `(customerId === viewer.id OR executorId === viewer.id)` по intent'у. Конкретный owner выбирается через `intent.permittedFor: "customer" | "executor"`.
**Rationale.** Multi-owner сущности (сделки, contracts, группы) — частый паттерн, SDK сейчас только single-owner.

### 6.4 🟢 `status-terminal-dimming`
**Trigger.** Sub-entity с enum-status field, содержащим «terminal» values: `withdrawn`, `cancelled`, `rejected`, `expired`.
**Apply.** SubCollectionSection применяет `opacity: 0.5`, добавляет `<StatusBadge>` перед itemView.
**Rationale.** not_chosen responses, cancelled deals, withdrawn submissions должны визуально отличаться.

### 6.5 🟢 `timer-countdown-visible`
**Trigger.** Entity с активным ScheduledTimer в `scheduledTimers[*]`, `firedAt=null`.
**Apply.** Вставляет `{type:"countdown", to: timer.firesAt, label: timer.fireIntent}` в detail.header.
**Rationale.** Сейчас `auto_accept_after_3d` scheduler создаёт timer, но customer/executor не видят «осталось 23h до auto-accept». Визуальный countdown — базовая affordance для urgency.

### 6.6 🟢 `catalog-exclude-self-owned`
**Trigger.** Public catalog (filter по status) + `mainEntity.ownerField` существует.
**Apply.** Автоматически добавляет `&& item[ownerField] !== viewer.id` в filter.
**Rationale.** «Каталог задач для executor'а не должен содержать свои собственные» — постоянный паттерн. Сейчас автор домена пишет вручную.

### 6.7 🟢 `subcollection-filter-by-status`
**Trigger.** SubCollection entity имеет enum-status field.
**Apply.** Добавляет в projection filter «скрывать terminal states» по умолчанию, с возможностью toggle «Показать все» в header секции.
**Rationale.** withdrawn responses / reverted transactions / expired sessions — обычно не должны показываться в основном списке.

---

## 7. Documentation / DX gaps

### 7.1 🟢 Список поддерживаемых `confirmation` values
**Сейчас.** "auto", "form", "click", "file", "enter", "investigation" — разбросано в `registerBuiltins()`.
**Что сделать.** Объединить в `docs/intent-spec.md` с таблицей «confirmation → archetype → UX behavior».

### 7.2 🟢 Гайд «как выбрать archetype»
**Пример неочевидного решения.** high-irreversibility + params: confirmDialog (registered first) vs formModal (нужен form). Пришлось использовать `control:"formModal"` override для submit_work_result/request_revision.
**Что сделать.** Decision tree в docs.

### 7.3 🟢 Нет документации на `control` override
**Проблема.** `intent.control: "formModal" | "confirmDialog" | ...` — работает, но не задокументировано. Авторы полагаются на матчеры, которые иногда несоответствуют намерениям.

### 7.4 🟢 `creates:"Entity(variant)"` — undocumented для доменных авторов
**Пример.** `creates: "Task(draft)"`, `"Response(pending)"` — парсится parseCreatesVariant, но доменные авторы не знают синтаксис.

### 7.5 🟢 `getIntentIcon` fallback → `⚡`
**Проблема.** Custom intents (request_revision, submit_work_result) — все fallback'ят на ⚡, конфликт при collapseToolbar dedup.
**Что сделать.** Icon rules mergeable из domain ontology (`ontology.iconRules`), не только hardcoded default + явный `intent.icon`.

---

## 8. Server fixes в idf (candidates for `@intent-driven/server` Phase 3)

### 8.1 ✅ `matchTrigger` array — done (см. 5.1)
### 8.2 ✅ `POST /api/timer/fast-forward` — done (server/index.js)
### 8.3 🟡 Invariant-handler exceptions не должны ронять effect
**Файл:** `server/routes/effects.js:93-124` + `@intent-driven/core/invariants/index.js::checkInvariants`.
**Проблема.** Handler throws → treated as `{severity:"error"}`. Рекурсивно reject'ается подтверждённый effect + cascaded children.
**Что сделать.** Treat thrown handler errors as `severity:"warning"` + log to stderr. Effect остаётся confirmed.

---

## Appendix: workaround-файлы в idf, которые можно удалить после SDK-фикса

Все три патча в `src/runtime/DomainRuntime.jsx`:
- `patchAntdButtonsChildrenAsLabel` → исправляется в 2.1
- `patchAntdDateTimeWithTime` (AntdDateTimeWithTime) → 2.2
- `patchAntdParameterExtras` (AntdPriceNumber, AntdTextInputWithValidation) → 2.3 + 2.4

`src/runtime/renderer/auth/AuthGate.jsx` — можно переиспользовать SDK-шный, если появится (см. 3.5).

`projections.js::patterns.disabled:["footer-inline-setter"]` на deal-детальях — можно убрать после 4.3.

`creates` в `confirm_deal` (и `top_up_wallet_by_card`) пришлось снять — heroCreate/deal-catalog routing неправильный. После 4.1 + 6.1 можно вернуть семантическое creates.

---

## Приоритет

**P0 (блокирует нативные domain-authoring):**
- 1.1, 1.4 (инварианты)
- 2.1, 2.2, 2.3, 2.4 (antd-адаптер)
- 3.1, 3.2 (primaryCTA + ownership)
- 4.1, 4.2, 4.3 (archetype matching)

**P1 (существенно улучшает DX):**
- 1.2, 1.3 (expression kind + composite groupBy)
- 4.4, 4.6, 4.7, 4.8 (collapseToolbar + subCollection)
- 6.1, 6.2, 6.3, 6.4 (новые patterns)

**P2 (nice-to-have):**
- 2.5, 2.6, 3.3, 3.4, 3.5
- 5.2, 5.3
- 6.5, 6.6, 6.7
- 7.* (docs)
