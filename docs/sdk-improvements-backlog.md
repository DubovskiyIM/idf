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

### 3.3 ✅ `IrreversibleBadge` auto-placed
**Статус:** ЗАКРЫТО. `assignToSlotsDetail.js:827` инжектит `{type: "irreversibleBadge", bind: "__irr"}` в header-row для detail-проекций mainEntity с irreversible-action. Тесты в `assignToSlotsDetail.test.js:208-267` («IrreversibleBadge auto-placed (backlog 3.3)»). `ConfirmDialog.jsx:7-16` поддерживает `spec.__irr` (decl) и `item.__irr` (post-confirm) с reason. `confirmLabel` configurable. Renderer primitive в `packages/renderer/src/primitives/IrreversibleBadge.jsx`.

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

## 8. Workzilla-clone dogfood findings (2026-04-21)

**Источник:** `~/WebstormProjects/workzilla-clone/docs/findings.md`. Dogfood-сессия на scaffold-пути (Этапы 1-3 SDK + W1-W4 walkthrough).

### 8.1 ⛔ Action-CTA не автогенерятся в catalog/detail (P0 систематический blocker)

**Файлы:** `packages/core/src/crystallize_v2/assignToSlotsCatalog.js`, `assignToSlotsDetail.js`, `packages/core/src/patterns/stable/`.

**Проблема.** `intent.permittedFor + target === mainEntity` декларируется, но UI **не получает action-кнопок**. Scaffold производит read-only UI. Все write-actions требуют manual JSX через `run(intentName, params)`.

**Что сделать.**
1. Pattern `catalog-action-cta` — item-slot trailing action-button для replace-intent'ов, фильтр по `permittedFor` + current role.
2. Pattern `detail-phase-aware-cta` — detail читает `current.status` и показывает buttons для allowed transitions (из `transition` invariant).
3. Synthetic form-projection (см. 8.2).

### 8.2 ⛔ Form-archetype не синтезируется из insert-intent (P0)

**Файл:** `packages/core/src/crystallize_v2/index.js:generateEditProjections` — только replace, не insert.

**Что сделать.** Scan'ить insert-intent'ы, генерить `{entity}_create` с `kind: "form"`. Renderer ArchetypeForm рендерит по `intent.parameters`.

### 8.3 ⛔ `projection.witnesses[]` на catalog игнорируется (P0)

**Файл:** `packages/core/src/crystallize_v2/assignToSlotsCatalog.js:buildItemCard`.

**Что сделать.** Если `projection.witnesses` задан — strict использовать + ontology field.role для выбора primitive (money / datetime / contact / status-flag).

### 8.4 🟡 Inline primitives не в item-children (P1)

**Файл:** `packages/renderer/src/SlotRenderer.jsx`. `statistic / sparkline / chart / map / countdown / badge` → `Unknown type` inline. Расширить child-resolver на полный primitive-registry.

### 8.5 🟡 `text.style` vocabulary неполный (P2)

Добавить `money / money-positive / badge-info / badge-success / etc` во всех text-adapter'ах.

### 8.6 🟡 `toneMap` / `toneBind` в badge-primitive (P1)

Badge хардкодит tone. Нужно либо `toneMap: { status→tone }`, либо `toneBind: "_tone"` (client-computed). Default: если bind = enum + в ontology есть optional `tone` per value — использовать.

### 8.7 🟡 Native-format importer'ы ≠ полный семантический output (P1)

Import-generated ontology не имеет: compositions (R9), invariants (transition из enum), authored projections, `__irr`. Требует manual дополнение. Enricher-claude частично закрывает, но heuristic-importer тоже может больше.

### Порядок работ для unlock scaffold → production

1. **8.3** (witnesses) — ~1 день
2. **8.1** (action-CTA patterns) — ~3 дня
3. **8.2** (form synthesis) — ~3-5 дней
4. 8.4 + 8.6 — параллельно, по дню

**После 8.1-8.3:** Workzilla-clone пройдёт 13 UX-step happy-path без manual JSX.

---

## Приоритет

**P0 (блокирует нативные domain-authoring):**
- 1.1, 1.4 (инварианты)
- 2.1, 2.2, 2.3, 2.4 (antd-адаптер)
- 3.1, 3.2 (primaryCTA + ownership)
- 4.1, 4.2, 4.3 (archetype matching)
- **8.1, 8.2, 8.3** (Workzilla — action-CTA / form / witnesses — systematic)

**P1 (существенно улучшает DX):**
- 1.2, 1.3 (expression kind + composite groupBy)
- 4.4, 4.6, 4.7, 4.8 (collapseToolbar + subCollection)
- 6.1, 6.2, 6.3, 6.4 (новые patterns)
- **8.4, 8.6, 8.7** (Workzilla — inline primitives / toneMap / importer-enrich)

**P2 (nice-to-have):**
- 2.5, 2.6, 3.3, 3.4, 3.5
- 5.2, 5.3
- 6.5, 6.6, 6.7
- 7.* (docs)
- **8.5** (Workzilla — text.style vocabulary)

---

## 9. Workzilla-clone post-bump findings (2026-04-21)

**Источник:** session после релиза 8.1-8.7 — интеграция workzilla-clone с SDK 0.50.0/0.26.0. Часть проблем лежит между SDK и host'ом; здесь — только SDK-fixable.

**Статус закрытия (2026-04-22):** 9.1-9.4 + 9.6 ЗАКРЫТЫ в idf-sdk PR #179 (core 0.52.0 / renderer 0.28.0 / adapter-antd 1.4.0). Workzilla-clone bumped до SDK 0.52/0.28. 9.5 (guard на projection.name), 9.7 (legacy `role:` warning), 9.8 (checklist в docs) — остаются. 9.10-9.12 открыты в ветке `fix/heroCreate-badge-align-9.10-9.12` (heroCreate multi-param + Badge sx + witness alignSelf), pending merge.

### 9.1 ✅ `type: "string"` в parameters роняет validateArtifact
**Файл:** `packages/core/src/crystallize_v2/inferControlType.js:65` + `mapOntologyTypeToControl`.
**Проблема.** `inferControlType` возвращает `param.type` напрямую, без map. Native-format importer + manual ontology авторы часто пишут `type: "string"` (Prisma/OpenAPI vocabulary). validateArtifact эмитит `unknown parameter control type: "string" in overlay overlay_X`.
**Что сделать.**
- В `mapOntologyTypeToControl` добавить `string: "text", int: "number", float: "number", integer: "number"`.
- В `inferControlType` line 65: прогонять `param.type` через `mapOntologyTypeToControl` (не возвращать raw).
- Опционально: `normalizeIntentNative` из 8.1 должен мапить parameters type → canonical.

### 9.2 ✅ `deriveProjections` не ставит `idParam` на standalone detail
**Файл:** `packages/core/src/crystallize_v2/deriveProjections.js`.
**Проблема.** detail-проекции без parent-FK scope получают `idParam: undefined`. ArchetypeDetail требует `idParam`, иначе не резолвит target из routeParams → EmptyState. Автор вынужден authored:`idParam: "taskId"` на каждую detail.
**Что сделать.** Default `idParam = <entityLower>Id` для всех detail без singleton. Singleton — оставить без idParam.

### 9.3 ✅ `onItemClick` для list выбирает wrong detail из nav-graph
**Файл:** `packages/core/src/crystallize_v2/index.js:19711` (первый edge → slots.body.onItemClick).
**Проблема.** Для task_list edge-list содержит и task_detail, и response_detail; первый-по-алфавиту = `response_detail`. Клик по task открывает response EmptyState.
**Что сделать.** Предпочитать edge, где `to.mainEntity === from.mainEntity`. Fallback — первый.

### 9.4 ✅ `ArchetypeForm` header Apple-specific, не адаптирован
**Файл:** `packages/renderer/src/archetypes/ArchetypeForm.jsx:158+`.
**Проблема.** Навигационный бар (←Отмена / title / Сохранить) hardcoded iOS-style (`backdrop-filter`, SF-style fonts, blue `#007aff`). Для AntD/Mantine-хоста — Apple-glass смотрится чужеродно.
**Что сделать.**
- Вынести навбар в `getAdaptedComponent("shell", "formHeader")`.
- Дефолт — нейтральный `<header>` через CSS-vars (`--idf-primary`).
- AntD/Mantine адаптеры предоставляют свой.

### 9.5 🟡 `ArchetypeForm` bare `projection.name` access
**Файл:** `packages/renderer/src/archetypes/ArchetypeForm.jsx` (h1 title).
**Проблема.** Когда host не передаёт `projection` prop (только artifact) — крэш `Cannot read properties of undefined (reading 'name')`. Должен быть `projection?.name ?? artifact.name ?? "Форма"`.
**Что сделать.** Guard везде + fallback. + документировать что host обязан передавать `projection` вместе с `artifact` (см. authoring-checklist §11).

### 9.6 ✅ Synthesized projections не попадают в host'овский allProjections
**Файл:** `packages/core/src/crystallize_v2/index.js::generateCreateProjections` (внутри).
**Проблема.** `generateCreateProjections` / `generateEditProjections` вызываются **внутри** crystallizeV2; создают `task_create / task_edit` projection'ы — но возвращаются только в artifact map. Host получает artifact, не projection definition.
**Что сделать (один из).**
- Вернуть из `crystallizeV2` объект `{ artifacts, allProjections }` (breaking — нужно major bump).
- Или expose `generateCreateProjections` / `generateEditProjections` в top-level exports.
- Или присвоить `artifact.projection` = projectionDef (не projId string как сейчас).

### 9.7 🟢 `inferFieldRole` ignores legacy `role:`
**Файл:** `packages/core/src/crystallize_v2/ontologyHelpers.js::inferFieldRole`.
**Проблема.** Autor пишет `role: "money"` (legacy + естественная интуиция) — игнорируется, считывается только `fieldRole`. Тихий drift: budget рендерится plain number без ₽.
**Что сделать.** Либо warning на `field.role` c hint'ом "use `fieldRole`". Либо принимать оба (с warning).

### 9.8 🟢 Ontology-authoring-checklist не в docs
**Файл:** нет — должен быть в `packages/core/docs/ontology-authoring-checklist.md` или `idf-sdk/docs/`.
**Что сделать.** Создать документ c пунктами 1-12 (см. `idf-sdk/docs/ontology-authoring-checklist.md`).

### Эффект патчей

**ЗАКРЫТО в PR #179 (2026-04-22):** 9.1+9.2+9.3 + 9.4 + 9.6 — scaffold-ontology без authored projections на top-level работает:
- Detail projections получают автоматический idParam.
- List → item-click → правильный detail.
- `type: "string"` не роняет UI.
- Form header адаптивный per UI-kit.
- Synthesized create/edit projections доступны host'у.

Остальное (9.5 guard, 9.7 legacy role warning, 9.8 docs) — DX-polish.

---

## Приоритет (обновлённый)

**P0 (блокирует scaffold workflow):** всё ЗАКРЫТО в PR #177 + #179.

**P1 (pending merge):** 9.10-9.12 (heroCreate multi-param + Badge sx + witness alignSelf) в ветке `fix/heroCreate-badge-align-9.10-9.12`.

**P2 (нет блокеров):**
- 9.5 (bare `projection.name` guard), 9.7 (legacy `role:` warning), 9.8 (ontology-authoring-checklist → sdk/docs/)

---

## 10. ArgoCD dogfood findings (2026-04-24, 16-й полевой тест)

**Контекст.** Первый **status-driven admin** домен после IAM CRUD (Keycloak 15-й) и metadata catalog (Gravitino 14-й). Источник — ArgoCD Swagger 2.0 (82 paths, 262 definitions). Все host-workaround'ы остаются в `src/domains/argocd/` — список ниже для SDK backlog.

### 10.1 ⛔ K8s CRD naming — path-derived vs schema-derived не мёрджится
**Файл:** `packages/importer-openapi/src/{pathToIntent,schemaToEntity}.js`
**Проблема.** На K8s CRD pattern `v<ver><Name>` importer создаёт **две раздельные entities**:
- path-derived `Application` (fields:`{id}`, kind:`internal`) — из URL pattern `/api/v1/applications/{name}` через `entityNameFromPath`
- schema-derived `v1alpha1Application` (4 поля, kind:`embedded`) — из `#/definitions/v1alpha1.Application` через `schemaToEntity`

Они НЕ мёрджатся. `intent.creates="Application"` → dangling reference на stub. То же для AppProject / Cluster / Repository / ApplicationSet / GnuPGPublicKey — 10 entity pairs.

**Workaround в idf (ArgoCD Stage 2, PR #117).** `ontology.js::K8S_CRD_MERGE` table — короткое имя ← полная v1alpha1-сущность, поля копируются, kind="internal". v-сущность сохраняется для wrapper-refs (`v1alpha1ApplicationList.items[]`).

**Что сделать.** SDK PR `importer-openapi.mergeK8sCrdDuplicates` — автоматический pattern `v<digits>(alpha|beta)?<digits>?<Name>` + detection через path-response-schema match. Аналогично `mergeRepresentationDuplicates` (Keycloak trailing-suffix pattern).

### 10.2 🟡 `markEmbeddedTypes` слишком aggressive для K8s root CRDs
**Файл:** `packages/importer-openapi/src/markEmbeddedTypes.js`
**Проблема.** K8s root CRDs (`v1alpha1Application/AppProject/Cluster`) помечены `kind:"embedded"`, хотя они top-level ресурсы через path-collection (`/api/v1/applications`). markEmbedded считает "ссылается ли на тебя другая entity"; K8s root'ы всегда nested в wrapper-types (`*List`) → помечаются embedded.

**Workaround в idf.** `K8S_CRD_MERGE` создаёт новую short-name entity с `kind: "internal"` — оригинал остаётся embedded, но intents уже смотрят на новую.

**Что сделать.** Whitelist или detection через path-coverage: если entity X используется как `response.type` на top-level path-collection (list-path), unmark embedded, даже если она nested в других types.

### 10.3 ✅ Закрыт 2026-04-24 — SDK PR idf-sdk#293
**`column.kind="badge"` cell-renderer** в DataGrid с colorMap/toneMap. Host integration в ArgoCD PR #118 + renderer bump 0.47.0 через host PR #119.

### 10.4 ✅ Inline-children family — ЗАКРЫТО
**Статус:** ЗАКРЫТО. Pipeline для inline-children теперь полный:
1. **10.4a** `importer-openapi.extractInlineArrays` — idf-sdk #306 (inline array-of-object → `entity.inlineCollections[]` metadata).
2. **10.4b** `SubCollectionSection` inline-mode — idf-sdk #315 (items резолвятся прямо из parent's field по `inlineSource` path, без FK-lookup).
3. **10.4c** `renderAs` dispatchers `resourceTree` + `conditionsTimeline` — idf-sdk renderer (`PRIMITIVES.resourceTree` + named exports `ResourceTree` / `EventTimeline`).

ArgoCD host-workaround'ы (`Resource` / `ApplicationCondition` синтетические entities + seed child effects) могут быть удалены в follow-up cleanup PR.

### 10.5 ⛔ Deeply-nested `Application.spec` — tabbed form / YAML-editor
**Файл:** `packages/renderer/src/archetypes/ArchetypeForm.jsx`
**Проблема.** ArgoCD `Application.spec` — deeply-nested (source.helm.parameters[], destination.namespace, syncPolicy.automated.{prune,selfHeal,retry.{limit,backoff}}, ignoreDifferences[]). Flat form не справится: 30+ полей группируются логически на tabs (Settings/Sync/Source/Destination/Advanced).

**Workaround в idf (Stage 7 — pending).** Либо tabbed-form (как Keycloak client_detail 5 tabs), либо Monaco/CodeMirror YAML-editor fallback.

**Что сделать.** Новый control-archetype `yamlEditor` (или `codeEditor`) — renderer с Monaco-like primitive для spec-as-YAML. Author declares `bodyOverride: { type: "yamlEditor", sourceField: "spec", schema: "json-schema.org/..." }`.

### 10.6 ⛔ Swagger 2.0 → OpenAPI 3.0: тип-потеря на nested $ref полях
**Файл:** `packages/importer-openapi/src/{parseSpec,flattenSchema,schemaToEntity}.js`
**Проблема.** ArgoCD использует Swagger 2.0 (`swagger: "2.0"`, `definitions[]`). Текущий importer читает только `components.schemas` (OpenAPI 3.0). Host конвертирует через `swagger2openapi` перед import'ом (`scripts/argocd-reimport.mjs`). После конверсии **все $ref-поля K8s CRD теряют типизацию** — все становятся `{type: "string"}` (metadata/operation/spec/status у Application — 4 поля типа string вместо nested object).

**Workaround в idf.** `ontology.js::SEMANTIC_AUGMENT` — автор декларирует плоские semantic fields поверх nested spec (`syncStatus/healthStatus/project/namespace/source/revision/...`).

**Что сделать.** SDK-level fix: либо встроить swagger2openapi в `parseSpec` (auto-detect версии и convert), либо починить `flattenSchema` чтобы сохранить field-type info после конверсии. Желательно preserve {$ref → inline object shape} связь.

### 10.7 🟡 grpc-gateway operationId не canonicalized
**Файл:** `packages/importer-openapi/src/pathToIntent.js`
**Проблема.** ArgoCD use grpc-gateway с `operationId` вида `<Service>_<Method>` — `ApplicationService_Create`, `ApplicationService_Sync`, `ClusterService_RotateAuth`. Host-код и row-action resolver'ы ожидают canonical `createApplication`/`syncApplication`/`rotateClusterAuth` (Keycloak/Gravitino convention). Без переименования renderer не находит intent по canonical имени.

**Workaround в idf (Stage 2, PR #117).** `intents.js::INTENT_RENAME` table — 53 renames. Оригинал сохраняется как `intent._aliasOf`.

**Что сделать.** SDK PR `importer-openapi.canonicalizeGrpcOperationIds` — detection паттерна `<Service>_<VerbNoun>` → `<verb><Noun>`. Irregular verbs (Sync/Rollback/GetManifests) требуют rule-engine или whitelist.

---

**Приоритет (обновлённый 2026-04-26):**
- ✅ **10.4abc** (inline-children family) — ЗАКРЫТО (idf-sdk #306 / #315 / dispatchers).
- **P1 (качество importer):** 10.1 (K8s CRD merge), 10.6 (Swagger 2.0 type-loss), 10.2 (markEmbedded K8s roots) — host-workaround'ы остаются в `argocd/ontology.js` (K8S_CRD_MERGE / SEMANTIC_AUGMENT / INTENT_RENAME).
- **P2 (полнота):** 10.5 (YAML editor для deeply-nested spec), 10.7 (grpc-gateway canonicalization)

---

## 11. Tri-source field-research P0 sprint (2026-04-25/26)

**Контекст.** Анализ трёх production-стэков (workflow-editor LLM/AI-agent, workflow-editor data-pipeline, Angular-imperative legacy с polymorphic 200+ кубами и 18-fork brand-overlay) выявил convergent evolution на четырёх уровнях. Спринт закрыл четыре фундамента в SDK + один CI-фикс.

### 11.1 ✅ `@intent-driven/host-contracts@0.2.0` extraction
**SDK PR:** [#335](https://github.com/DubovskiyIM/idf-sdk/pull/335)
**Назначение.** Формализация контракта `shell ↔ module` для IDF-хостов и адаптеров micro-frontend. Несколько независимых production-стэков (Vite-MF runtime, статические импорты + DCE feature-flags, IDF host) пришли к одной абстракции «модуль = id + basePath + nav + routes + commands/headerSlots/docs» + «shell даёт контекст: auth/i18n/theme/navigate/events/toast». Type-only по сути (peer-`react` только для типов компонентов), MIT.
**API:** `AppModuleManifest`, `ShellContext`, `NavSection`, `NavItem`, `RouteConfig`, `CommandConfig`, `LoadingTipConfig`, `DocLink`, `HeaderSlotName`, `EventBus`, `ToastAPI`, `AuthAPI`, `I18nInstance`, `ThemeAPI` + runtime helpers `validateModuleManifest(manifest)`, `mergeNavSections(...lists)` (merge nav-секций нескольких модулей с детектом item-id коллизий + sort by order), enum `HEADER_SLOTS`.

### 11.2 ✅ `entity.kind: "polymorphic"` + `discriminator` + `variants[]` API (P0.2)
**SDK PR:** [#347](https://github.com/DubovskiyIM/idf-sdk/pull/347)
**Закрывает Open item:** «Composite / polymorphic entities — union-типы не выражаются через `entity.kind`».
**Назначение.** Расширение taxonomy `entity.kind` (раньше: `internal` / `reference` / `mirror` / `assignment`) — добавлен `polymorphic`. Полевые тесты с 70+ и 200+ подтипами кубов в production workflow-editor стэках показали, что без формализации polymorphic entity host-авторам приходится держать 3 параллельных декларации (frontend type / backend DTO / form-renderer) — итого ~21k LOC ручного бойлерплейта на 70 типов.
**Схема:**
```js
WorkflowNode: {
  kind: "polymorphic",
  discriminator: "type",
  fields: { id, type, label, workflowId },  // base shared
  variants: {
    ManualTrigger: { label: "...", fields: {} },
    TelegramTrigger: { label: "...", fields: { botToken, webhookUrl }, invariants: [...] },
    // ...
  },
}
```
**API:** `isPolymorphicEntity`, `getDiscriminatorField`, `getEntityVariants`, `getEntityVariant`, `listVariantValues`, `getEffectiveFields(entityDef, value?)` (base + active variant с override priority), `getUnionFields(entityDef)` (base + ВСЕ variants для form-archetype synthesis с conditional visibility, first-wins при конфликтах), `getVariantSpecificFields`, `validatePolymorphicEntity` (`{ valid, errors[] }`).
**Status:** matching-only / declarative API. Production-derivation (form-archetype synthesis на discriminator + per-variant fields, filterWorld awareness, materializer-output) — отдельные sub-projects. Backward-compatible: legacy entity без `kind:"polymorphic"` обрабатывается прозрачно.

### 11.3 ✅ Canonical type-map + auto field-mapping FE↔BE (P0.4)
**SDK PR:** [#349](https://github.com/DubovskiyIM/idf-sdk/pull/349)
**Закрывает:** §9.1 (canonical type-map) **полностью** (раньше частично через `mapOntologyTypeToControl` mini-map в `crystallize_v2/ontologyHelpers.js`, теперь — отдельный полноценный модуль с published API), плюс три полевые боли: 70+ ручных трансформ camelCase ↔ snake_case при FE↔BE bridge; 200+ нормалайзеров на разные нестандартные shape'ы; importers (postgres / openapi / prisma) silent-drop при `type:"string"`.
**Содержимое `CANONICAL_TYPES`:** ~40 types — text/textarea/markdown/richText/code/yaml/json, number/integer/decimal/money/percentage, boolean, date/time/datetime/duration, id/uuid/slug, email/url/phone/tel/secret/password, select/multiSelect/enum, entityRef/entityRefArray/foreignKey, image/multiImage/file/color, coordinate/address/zone, ticker/manifest.
**Содержимое `TYPE_ALIASES`:** string/varchar/char/clob/String/TEXT/longtext/mediumtext → text/textarea; int/Int/int4/int8/bigint/smallint/tinyint/serial/bigserial/Integer → integer; float/double/numeric/real/Float/Decimal → decimal; bool/Boolean/bit → boolean; timestamp/timestamptz/DateTime → datetime; jsonb/Json → json; UUID → uuid; currency → money; reference/ref/ManyToOne/OneToMany/ManyToMany → entityRef family.
**API:** `CANONICAL_TYPES` (frozen list), `TYPE_ALIASES` (alias dict), `normalizeFieldType(rawType)`, `normalizeFieldDef(rawFieldDef)` (целое поле + derive `entityRef` shape из `references` / `entityRef` shorthand), `camelToSnake` / `snakeToCamel` (acronym-runs supported: `URLPath → url_path`, `isHTTPSEnabled → is_https_enabled`), `inferWireFieldName(name, { case: "snake"|"camel"|"original" })`, `applyFieldMapping(obj, mapping, "toWire" | "fromWire")` (без мутации), `buildAutoFieldMapping(fields, options)`.
**Status:** utility-layer. Не trigger'ится автоматически в fold/filterWorld; importers и effect-runners (включая third-party) могут начать использовать сразу.

### 11.4 ✅ 4 candidate-паттерна из tri-source field research (P0.3)
**SDK PR:** [#338](https://github.com/DubovskiyIM/idf-sdk/pull/338)
**Назначение.** Matching-only candidate'ы в `packages/core/src/patterns/candidate/`. Все четыре независимо проявились в трёх независимых production-стэках — convergent evolution подтверждает их как стабильные UX-формы.

| Pattern | Архетип | Trigger |
|---|---|---|
| `cross/human-in-the-loop-gate` | cross | `intent-confirmation: "human-input"` — асинхронная пауза execution до confirmation от человека-supervisor'а; отличается от `irreversible-confirm` (другой actor, structured input, timeout). |
| `cross/composition-as-callable` | detail | `entity-kind: "callable"` — entity-as-tool с input/output schema, «Used by» reverse-association, «Run standalone» CTA. |
| `cross/agent-plan-preview-approve` | cross | `has-role: "agent"` + `intent-confirmation: "preapproval"` — multi-effect plan-preview между intent.proposed и intent.confirmed; partial-approve toggle. |
| `detail/lifecycle-gates-on-run` | detail | `entity-field: status (select)` + `intent-confirmation: "lifecycle-gate"` — declarative issue-checklist + disabled run/publish CTA + deep-link к причине. |

`CURATED_CANDIDATES.length` 6 → 10. Все имеют полные `rationale.evidence` (4-7) + `counterexample` (4-5) + `falsification.shouldMatch`/`shouldNotMatch` (4-5/4-5).

### 11.5 ✅ CI scaffold-smoke OOM fix
**SDK PR:** [#339](https://github.com/DubovskiyIM/idf-sdk/pull/339)
**Проблема.** `pnpm -r build` в `.github/workflows/scaffold-smoke.yml` падал на DTS-worker для `packages/core` (1.27 MB бандл) с `ERR_WORKER_OUT_OF_MEMORY` на ubuntu-latest runner'е (>4 GB heap). Не связан с содержимым PR — падал на любой ветке.
**Фикс.** Добавил `env: SKIP_DTS: "true"` в шаг "Build all packages" — тот же подход, что в `ci.yml` (см. коммиты `3fffbc6` / `9024e8c`).

### Roadmap (отдельные sub-projects, не блокируют)

1. **discriminator-wizard.apply** (closes one matching-only) — автогенерация на `listVariantValues`.
2. **Form-archetype synthesis для polymorphic** — conditional visibility per discriminator-value (использует `getUnionFields` + `getVariantSpecificFields`).
3. **`validatePolymorphicEntity`** интеграция в conformance-runner / global ontology validate.
4. **`filterWorld` awareness** — учитывать variant fields в `visibleFields` per role.
5. **Importer-postgres / -openapi**: генерация polymorphic shape из discriminated union в schema (oneOf / type-tag pattern); cleanup local type-aliases в пользу shared `normalizeFieldType`.
6. **Crystallize_v2 input cleanup** — `normalizeFieldDef` поверх raw fields первым шагом (закроет silent drop'ы для всех downstream).
7. **`effect-runner-http`** — экспорт hook `withMapping(handlerOptions)` для авто-bridge на каждый HTTP-endpoint.
8. **Validation для `field.mapping: { wire: "..." }`** — explicit override (authored mapping wins over auto-derive).

### Закрытие после спринта 2026-04-26

- ✅ §9.1 canonical type-map — теперь выделенный модуль с published API.
- ✅ Open item «Composite / polymorphic entities» — declarative API готов; production-derivation — отдельные sub-projects.


---

## §12 — Notion field test (2026-04-26, 18-й полевой тест)

Новый домен `notion` (12 сущностей, 5 ролей, ~60 intent'ов, 15 projections, 30 invariants, polymorphic Block с 15 variants). Стресс-тест на: self-referential page hierarchy, polymorphic Block, multi-view database, permission-inheritance, sparse-FK Comment, four-reader equivalence.

### 12.1 P1 — `projection.archetype` vs `projection.kind` неконсистентны
**Source.** Notion field test (initial smoke).
**Проблема.** Documentation/manifesto использует термин **archetype** (feed/catalog/detail/canvas/dashboard/wizard/form). Runtime materializers и SDK derivation читают `projection.kind`. Author может написать `archetype: "feed"` — кристаллизатор работает (через `inferArchetype` fallback), но materializer'ы не находят catalog/feed в switch'е → пустой output.
**Что нужно.** Либо нормализация в одном месте (на ingest crystallizeV2 проставлять `proj.kind ||= proj.archetype`), либо unified terminology (depredecate один). Сейчас 7 из 13 доменов используют `archetype:`, 6 — `kind:` — drift.
**Workaround в host.** Использовать `kind:` явно. Notion обновлён.

### 12.2 P1 — Voice materializer hard-codes `r.name || r.title` field-fallback
**Source.** Notion field test, axiom 5 manual check.
**Проблема.** `voiceCatalog` / `voiceFeed` / `voiceDetail` хардкодят последовательность `r.name || r.title || r.ticker || r.id`. Notion Page имеет `title` (как у настоящего Notion). После fallback'а title находится, но `projection.name` (display-имя проекции) у нас тоже не задано → "В ленте «undefined»".
**Что нужно.** Заменить hard-code на `getPrimaryFieldValue(row, ontology, mainEntity)` — выбирать поле через `fieldRole: "primary"` или first field. Тот же fix для `projection.name || projection.title || projection.id` для display-имени.
**Workaround.** Author задаёт `projection.name` явно. Notion может добавить.

### 12.3 P2 — `materializeAsDocument` для detail не находит entity при `routeParams`
**Source.** Notion field test.
**Проблема.** `materializeAsDocument(detailProj, world, viewer, { routeParams: { pageId: "..." } })` возвращает `not_found`. Тестировать через `/api/document/notion/page_detail?pageId=p-onboarding` — также проваливается. Возможно `materializeDetail` принимает `routeParams` через 4-й аргумент напрямую, а не из `opts`.
**Что нужно.** Унифицировать сигнатуру или документировать, что routeParams — отдельный 4-й arg (не в opts).

### 12.4 P1 — `domain` пустая в materializer outputs если не передан в opts
**Source.** Notion field test.
**Проблема.** Output: «Ты — голосовой ассистент для домена «»». Materializer не падает на `ontology.domain`, читает только `opts.domain`. Server-side route правильно передаёт; standalone smoke — нет.
**Что нужно.** Fallback `opts.domain || ontology?.domain || "unknown"`. Тривиально.

### 12.5 P2 — `domain-audit.mjs` помечает все entities как `entity-no-type` если нет `kind`
**Source.** Notion field test (60 reported gaps, из них 12 — false positive).
**Проблема.** Default `entity.kind === "internal"` не считается audit'ом — все 12 сущностей помечены `entity-no-type`. Это шум.
**Что нужно.** Audit script default'ит `entity.kind ??= "internal"`.

### 12.6 P1 — Polymorphic Block: derive не валидирует variant.fields
**Source.** Notion field test (Block с 15 variants).
**Проблема.** Sanity-test показал, что `entity.kind === "polymorphic"` принимается без validation. Но в materializer'ах / formArchetype variant fields разрешаются только частично. Production-derivation per-variant form (синтезированный create-form) — пока roadmap (см. §11 → roadmap.2).
**Что нужно.** Закрыть roadmap point 2 (form-archetype synthesis для polymorphic discriminator) либо явно warning'ом помечать «polymorphic entity не получает per-variant create-projections».

### 12.7 P1 — `intent.context.__irr` не распознаётся audit'ом
**Source.** Notion field test (revoke_member / delete_property / archive_database с `__irr.medium`).
**Проблема.** Все 5 intent'ов с `__irr` помечены `irreversibility-missing`. Audit ищет либо отдельное поле `irreversibility`, либо что-то иное вместо `intent.context.__irr.point`.
**Что нужно.** Стандартизировать форму записи irreversibility и обновить audit.

### 12.8 P0 — Permission inheritance (Page → parent → Workspace) не выражается в формате
**Source.** Notion field test (PagePermission).
**Проблема.** Notion-style permission cascade: PagePermission override → если нет, наследовать от parent Page → если корень, читать `Workspace.defaultPermissionLevel`. `filterWorldForRole` не знает о parent-chain. Нет first-class invariant'а / declarative API.
**Что нужно.** Либо `entity.permissionInheritance: { parentField: "parentPageId", fallback: "Workspace.defaultPermissionLevel" }`, либо invariant.kind "inheritance". Без этого — host-level вычисление.
**Применимо к.** Любой self-referential domain с per-row ACL: Notion / Confluence / Filesystem / Org-tree.

### 12.9 P1 — Sparse-FK Comment.pageId XOR blockId
**Source.** Notion field test.
**Проблема.** Comment может быть прикреплён либо к Page, либо к Block (не оба). Закрывается двумя expression invariants — workaround. Polymorphic API закрывает variant'ы внутри одной сущности, не cross-entity attach.
**Что нужно.** `field.kind: "polymorphicFk"` с alternatives `[{entity: "Page", field: "pageId"}, {entity: "Block", field: "blockId"}]` + автоматический cardinality(exactly-one).

### 12.10 P0 — Block-canvas primitive отсутствует
**Source.** Notion field test (page_detail.body = canvas).
**Проблема.** Notion-style block-list (drag handles, slash commands, indent/outdent, kind-conversion) — нет `<BlockEditor>` в renderer/primitives. canvas slot для page_detail рендерится как пустой placeholder.
**Что нужно.** Renderer primitive `BlockEditor` (15+ kind'ов с variant-fields), реагирующий на indent/outdent и slash-command intent'ы. Или признать, что rich-text editing — out of scope формата (`renderer.primitives.canvas` остаётся хост-слотом).

### 12.11 P1 — `proj.views[]` не используется для multi-view database
**Source.** Notion field test (database с 5 view-kind'ами).
**Проблема.** Multi-view database (table/board/gallery/calendar/timeline) на одной сущности (`DatabaseRow`) — formal `projection.views[]` API существует в SDK, но domain рисует 5 отдельных projections. Это нарушает DRY.
**Что нужно.** Doc + example, как использовать `projection.views[]` для notion-style сценария. Возможно, ScientificallyDoesn't закрывает все cases (per-view filter+groupBy+sort).

### 12.12 P1 — Author-defined `defaultPermissionLevel` не работает через filterWorld
**Source.** Notion field test (Workspace.defaultPermissionLevel).
**Проблема.** Field на entity не имеет first-class роли — это просто поле. `filterWorldForRole` его не читает. Public-share через токен (Notion: "Share to web") вообще не выражается.
**Что нужно.** Объявить authoritative semantics, либо отнести к §12.8 (permission-inheritance).

### Action items (priority order)

1. **P0** — §12.8 permission-inheritance (касается ≥3 vertical-ов: Notion/Confluence/Filesystem/Org-tree).
2. **P1** — §12.1 archetype/kind unification.
3. **P1** — §12.2 voice materializer primary-field discovery.
4. **P1** — §12.7 audit recognizes `__irr.point` shape.
5. **P0** — §12.10 BlockEditor primitive (or explicit out-of-scope).
6. **P2** — §12.3 / §12.4 / §12.5 / §12.6 — minor fixes / docs / audit polish.

## §13 — Meta-domain Level 1 (IDF-on-IDF, 2026-04-26, observability-only)

**Source.** Эксперимент «положить IDF на IDF»: построить мета-домен, чьи сущности — Domain / Intent / Projection / Pattern / Witness / RRule / Adapter / Capability. Φ — build-time snapshot из `pattern-bank/`, `src/domains/*`, `~/WebstormProjects/idf-sdk/packages/*`.

**Scope test'а.** Level 1 = read-only observability (write-side intent'ы — Level 2; full Studio replacement через codegen — Level 3). Бутстрап-вопрос «codegen vs reader» отложен до выбора (а)/(б)/(в) — см. §13.0.

**Snapshot summary** (после первого билда): 16 доменов, 339 intents, 196 projections, 44 stable + 11 candidate patterns, 4 adapters, 23 capabilities, 122 witnesses, 41 rules → 778 seed-effects.

### 13.0 Architectural decision — codegen ≠ reader (РЕШЕНО 2026-04-26: вариант б)

**Проблема.** §1 манифеста v2 фиксирует **четыре** equivalent reader'а (pixels / voice / agent-API / document). Любой write-side intent в meta-домене (`create_domain`, `promote_pattern_from_candidate_to_stable`, `register_adapter`) пишет в файловую систему — это codegen, не reader.

**Решение (2026-04-26): soft-authoring (б).** Меняем Φ — отдельный compiler-шаг применяет к файловой системе.

- Φ-effects от write-side intent'ов сохраняются как обычные `confirmed` записи.
- Compiler (`scripts/meta-compile.mjs`) — отдельный CLI, не reader. Читает мета-Φ (через `/api/effects` или прямо `foldWorld()`), эмиттит patch'и в `.md`/`.json`/`.cjs`. Идемпотентен через стабильные маркеры (`<!-- meta-compile: <id> -->`).
- **Compiler — НЕ пятая материализация.** Это writer-of-source, а не reader-of-format. Манифест остаётся timeless с четырьмя reader'ами.
- Двухступенчатость (Φ → compile) даёт reversibility: пока compile не запустился, изменение в Φ можно откатить через `α:replace`. После compile patch в файлы — обычный git artifact.

**Open для Level 2:**
- Какие write-intent'ы первой волны: `add_backlog_item`, `add_witness_review`, `promote_pattern_from_candidate_to_stable`, `mark_intent_irreversible`.
- Compile trigger: ручной (CI / `npm run meta-compile`) или автоматический (post-confirmed-effect SSE → debounced compile).
- Конфликт-разрешение: что если файл изменён руками после compile? — git merge / детекция через hash.

### 13.1 P0 — `pattern.id` не уникален между bank'ами

**Источник.** При seed'е `pattern-bank/candidate/avito-rating-aggregate-hero.json` и `idf-sdk/packages/core/src/patterns/stable/detail/rating-aggregate-hero.js` дают одинаковый `id: "rating-aggregate-hero"`. Workaround в meta-seed — composite `${status}__${patternId}__${sourceProduct}`.

**Проблема.** Identity паттерна де-факто составной ключ (status + id + sourceProduct), но формализован как plain string. Это работает локально внутри `stable/<archetype>/`, но не работает в кросс-bank-аналитике, и не работает в `pattern.witnesses[]` ссылках, если паттерн «начинался как candidate с product-prefix, мигрировал в stable».

**Что нужно.** Либо `pattern.id` уникальный глобально (rename candidate'ов), либо официально composite-ключ + helper `patternKey(p) → "stable__hero-create"` в SDK.

### 13.2 P0 — `role.base: "admin"` не даёт автоматического nav-access

**Источник.** Meta-домен `formatAuthor` объявлен `base: "admin"` с `visibleFields: { Domain: ["*"], … }`. `filterProjectionsByRole(ROOT_PROJECTIONS.formatAuthor, projections, "formatAuthor")` правильно отдаёт проекции с `forRoles: [..., "formatAuthor"]`, но не делает row-override.

**Проблема.** Две независимые системы видимости — `role.base` (row-override через `filterWorldForRole`) и `forRoles` (nav-projection-level). Они ортогональны, что задокументировано, но disconnect создаёт author trap: «admin есть, но проекции не видит». Ожидание автора — admin = bypass и для row, и для nav.

**Что нужно.** Либо документировать «admin требует явного `forRoles` в каждой projection», либо `filterProjectionsByRole` уважает `ontology.roles[role].base === "admin"` как короткое замыкание.

### 13.3 P1 — `pattern-bank/candidate/*.json` shape без `sourceProduct`

**Источник.** Meta-snapshot scanner вынужден извлекать `sourceProduct` из имени файла (`avito-...`, `profi-...`), потому что JSON-shape не имеет declared поля.

**Проблема.** Naming convention `<product>-<patternId>.json` — implicit. `pattern-researcher.mjs` пишет JSON без `sourceProduct`, `observedIn[]`, `productCategory`. Поиск «какой паттерн где наблюдался» требует grep по filename'у.

**Что нужно.** Спецификация candidate-shape (idf-spec / pattern-bank/README): обязательные поля `sourceProduct: string`, `observedIn: string[]`, опциональный `productCategory`.

### 13.4 P2 — JSON-snapshot import работает только в Vite

**Источник.** `import snapshot from "./meta-snapshot.json"` падает в plain Node (`ERR_IMPORT_ATTRIBUTE_MISSING`); требует `with: { type: "json" }`. Vitest и Vite handle сами через transform.

**Проблема.** Build-time snapshot pattern (запекаемые данные в .json + import) ломается, как только meta-домен становится backend-runtime'ом (нужен в `server/routes/meta.js` для `/api/meta/world`). Альтернативно — `JSON.parse(fs.readFileSync(...))`.

**Что нужно.** Решение в SDK / docs: если snapshot-pattern легитимен, прокинуть `with` атрибут или предоставить `@intent-driven/snapshot` helper, читающий через fs.

### 13.5 P0 — Static scanner не AST-aware (helper-style projection authoring)

**Источник.** `src/domains/gravitino/projections.js` использует helper-функции (`metalake_list: catalog("Metalake", "Metalakes", [...])`). Regex-парсер meta-snapshot экстрактит только id+count, body=null. Без depth-aware skipExpression парсер находил фантомные `params:` ключи в helper-аргументах (6 ложных коллизий до фикса).

**Проблема.** Любой meta-domain, читающий формат как сторонний tool (без рантайма domain-loader'а), должен делать **runtime evaluate** (vm / dynamic import) или вызывать TypeScript compiler API. Static scanning не масштабируется на helper-style authoring.

**Что нужно.** Либо `@intent-driven/format-reflect` пакет (runtime evaluate ontology/projections без mounting domain'а), либо обязательное правило «projection authoring = только object-literal» (что ломает gravitino's actual style и снижает leverage helper'ов).

### 13.6 P1 — Witnesses не персистируются (recomputed-per-crystallize)

**Источник.** При scaffold'е meta-онтологии я предположил `Witness` как Φ-stored сущность (history, audit). На деле `artifact.witnesses[]` пересчитывается каждый раз из `crystallizeV2` по текущим intents/ontology/projection — это не events, а derived view. Meta-домен синтезирует «синтетические» witness-rows только для подсчёта.

**Проблема.** Невозможно ответить на вопросы вроде «какой witness был на slot X в projection Y две недели назад» / «когда basis сменился с heuristic на pattern-bank». Witness-как-Φ-event дал бы full audit, но требует рантайм-инжекта в crystallize_v2.

**Что нужно.** Решение: считаем ли witness'ы persistent или derived. Если persistent — нужен `emit_witness` effect-shape; если derived — закрыть как «not applicable».

### 13.7 P1 — Reverse-association от Domain к Intent/Projection/RRule не очевидна

**Источник.** Meta-онтология имеет `Intent.domainId → Domain`, `Projection.domainId → Domain`, `RRule.domainId → Domain`. Это даёт catalog/feed-witness в Intent, но reverse-side (на Domain.detail показать «its intents/projections/rules») требует либо `subCollections: [...]` в projection, либо `reverse-association-browser` pattern.

**Проблема.** Сейчас домен `meta` не использует subCollections (Level 1, минимум авторства), поэтому Domain.detail без вспомогательных проекций бессмысленный.

**Что нужно.** Либо добавить subCollections в `domain_detail` (Level 1.1), либо подтвердить что `reverse-association-browser` pattern автоматически apply'ится.

### 13.8 P0 — `/api/document` и `/api/voice` lowercase'ят role-параметр

**Источник.** Live-probe мета-домена: `GET /api/document/meta/pattern_bank_browser?as=formatAuthor` отдавал `Role "formatauthor" не найдена в ontology`. `server/routes/document.js:42` и `server/routes/voice.js:33` принудительно делали `.toLowerCase()` на `req.query.as`, но онтология использует camelCase идентификаторы (`formatAuthor`, `workspaceOwner`).

**Что сделано.** Удалил `.toLowerCase()` в обоих route'ах (case-sensitive role lookup). Зафиксировано как host-fix в этом эксперименте.

**Что нужно.** Audit остальных мест где роли передаются через query/header (agent-API, possible internal callers).

### 13.9 P0 — Установленный `@intent-driven/core@0.74.0` отстаёт от §12.1 fix

**Источник.** Live-probe: `materializeAsDocument({archetype: "catalog"})` без `kind` → `"Неизвестный архетип undefined"`. `normalizeProjection` присутствует в SDK source (core@0.78+) но не в bundled dist@0.74.0. CLAUDE.md упоминает 0.76, на nm есть 0.79.

**Workaround.** В meta-проекциях задаём оба поля (`archetype: "catalog", kind: "catalog"`). Подтверждение, что §12.1 — реальный live-gap, а не теоретический.

**Что нужно.** Bump core до 0.79+ в host package.json (сразу `npm install --package-lock-only` per memory). Параллельно мета-домен — natural triage point для obsolete bundled deps.

### 13.11 P1 — sales overlay entries без поля `key` (ЗАКРЫТО 2026-04-27, idf-sdk#381 merged + published @0.84.x)

**Источник.** Live runtime-evaluate: `crystallizeV2(salesIntents, ...)` логировал 8+ warnings `overlay entry missing "key"`.

**Сделано.** `undo-toast-window.apply` и `optimistic-replace-with-undo.apply` теперь эмиттят `key: "undoToast__<intentId>"`. После bump core 0.81→0.84.2 в host: snapshot builder выдаёт **0 overlay warnings** (было 8+).

### 13.12 P1 — `subCollection.entity` vs `sub.collection` (ЗАКРЫТО 2026-04-27, idf-sdk#380 merged + published @0.84.x)

**Источник.** Live: `documentMaterializer::materializeDetail` искал `world[sub.collection]`, CamelCase `{entity: "Intent"}` ломалось.

**Сделано.** SDK fix: `materializeDetail` использует `findCollection(world, sub.entity)`. После bump'а в host убран дублирующий workaround в `meta-домен/projections.js` — clean `{entity: "Intent", foreignKey: "domainId"}` work'ает live (booking.detail отдаёт 22 intents / 15 projections / 1 rule / 84 witnesses).

### 13.10 P1 — `src/main.jsx` route registration вручную для каждого домена (ЗАКРЫТО 2026-04-27)

**Источник.** Добавление `/meta` route потребовало двух edit'ов: `src/main.jsx` (React Router) и `vite.config.js` (SPA fallback list). Те же edit'ы пропущены для automation домена.

**Сделано.** `standalone.jsx` экспортирует `DOMAINS_RAW`; `main.jsx` рендерит роуты через `Object.keys(DOMAINS_RAW).map(...)` + `V2_ALIASES = ["booking","planning","messenger"]`; `vite.config.js` читает `src/domains/*` через `readdirSync`. Single source of truth.

### 13.13 P0 — invariant cascade на witness'ах (ЗАКРЫТО 2026-04-27)

**Источник.** Live-probe Level 2: `POST /api/effects` отдавал 500 с `[invariants] откачен: witness_on_projection × 2454`. Cascade-rejection по всем 2454 witness rows.

**Root cause.** Не invariant evaluator (он корректен), а **snapshot builder**: я seed'ил только authored projections (196), но witness'ы из `crystallizeV2` ссылались на **derived** projections (`argocd__account_detail`, `domain_x__my_y`, и т.п.) — referential FK `Witness.projectionId → Projection.id` ломался.

**Сделано.** `scripts/build-meta-snapshot.mjs` теперь seed'ит **merged** projections (authored + derived из `deriveProjections`). Snapshot вырос со 196 → 600 projections. Все witness FK validate.

### 13.14 P0 — server's foldWorld не обрабатывает `α:create` (ЗАКРЫТО 2026-04-27)

**Источник.** Live demo: effect с `alpha: "create"` (canonical из `intent.particles.effects`) → material-er 0 rows.

**Сделано.** `server/validator.js::applyEf` теперь имеет `case "add": case "create":` (fall-through). SDK intent particles c `α:create` корректно сворачиваются как добавление сущности. **0 регрессий** в 502/505 server тестах.

### 13.15 P1 — target case-sensitive vs lowercase plural (ЗАКРЫТО 2026-04-27)

**Источник.** Live: `α:replace target="BacklogItem.status"` не находил entity, потому что server клал rows в `world.backlogItems` (camelCase plural из updateTypeMap), а material-er искал `world.backlogitems` (lowercase pluralize в SDK findCollection).

**Сделано.** `server/validator.js::foldWorld` теперь алиасит lowercase-plural форму поверх camelCase для совместимости с SDK material-er'ами. Сохраняет camelCase plurals для existing scheduledTimer/etc compat.

### 13.16 P1 — `α:replace` ctx-fallback (ЗАКРЫТО 2026-04-27)

**Источник.** Live: положил `status: "closed"` в context, value=null, validator применил `[field]: undefined`.

**Сделано.** `α:replace` fold теперь fallback'ит на `ctx[field]` если `val == null`. SDK intent particles `{α:"replace", target:"X.field", fields:{field: "value"}}` корректно работают через context — без явного `value`-поля.

### Action items (priority)

1. **P0** — §13.0 architectural decision (codegen ≠ reader) до старта Level 2.
2. **P0** — §13.1 pattern.id global uniqueness (или formal composite-key API).
3. **P0** — §13.2 admin nav-access disconnect (документация или filterProjectionsByRole change).
4. **P0** — §13.5 format-reflect package (или строгое ограничение «object-literal only» с migration gravitino).
5. **P1** — §13.3 candidate JSON shape spec.
6. **P1** — §13.6 witness persistence decision.
7. **P1** — §13.7 reverse-association в meta-домене (Level 1.1).
8. **P2** — §13.4 snapshot import portability.

## §14 — Backlog Inbox (meta-домен Level 2 soft-authoring)

Items добавляются через intent `add_backlog_item` в meta-домене, журналируются в Φ. Compiler `scripts/meta-compile.mjs` синхронизирует Φ ↔ файл между маркерами ниже. **Не редактируйте секцию руками** — изменения перезатрутся при следующем compile.

<!-- meta-compile: backlog-inbox -->

### P0 (блокеры)

- ✅ closed **server's foldWorld не обрабатывает `α:create`** · домен `meta` · 2024-04-25
  Live demo: effect с `alpha: "create"` (canonical из `intent.particles.effects`) → material-er 0 rows.
- ✅ closed **invariant cascade на witness'ах** · домен `meta` · 2024-04-25
  Live-probe Level 2: `POST /api/effects` отдавал 500 с `[invariants] откачен: witness_on_projection × 2454`. Cascade-rejection по всем 2454 witness rows.
- 🟢 open **Установленный `@intent-driven/core@0.74.0` отстаёт от §12.1 fix** · домен `meta` · 2024-04-25
  Live-probe: `materializeAsDocument({archetype: "catalog"})` без `kind` → `"Неизвестный архетип undefined"`. `normalizeProjection` присутствует в SDK source (core@0.78+) но не в bundled dist@0.74.0. CLAUDE.md упоминает 0.76, на nm есть 0.79.
- 🟢 open **`/api/document` и `/api/voice` lowercase'ят role-параметр** · домен `meta` · 2024-04-25
  Live-probe мета-домена: `GET /api/document/meta/pattern_bank_browser?as=formatAuthor` отдавал `Role "formatauthor" не найдена в ontology`. `server/routes/document.js:42` и `server/routes/voice.js:33` принудительно делали `.toLowerCase()` на `req.query.as`, но онтология использует
- 🟢 open **Static scanner не AST-aware (helper-style projection authoring)** · домен `meta` · 2024-04-25
  `src/domains/gravitino/projections.js` использует helper-функции (`metalake_list: catalog("Metalake", "Metalakes", [...])`). Regex-парсер meta-snapshot экстрактит только id+count, body=null. Без depth-aware skipExpression парсер находил фантомные `params:` ключи в helper-аргумент
- 🟢 open **`role.base: "admin"` не даёт автоматического nav-access** · домен `meta` · 2024-04-25
  Meta-домен `formatAuthor` объявлен `base: "admin"` с `visibleFields: { Domain: ["*"], … }`. `filterProjectionsByRole(ROOT_PROJECTIONS.formatAuthor, projections, "formatAuthor")` правильно отдаёт проекции с `forRoles: [..., "formatAuthor"]`, но не делает row-override.
- 🟢 open **`pattern.id` не уникален между bank'ами** · домен `meta` · 2024-04-25
  При seed'е `pattern-bank/candidate/avito-rating-aggregate-hero.json` и `idf-sdk/packages/core/src/patterns/stable/detail/rating-aggregate-hero.js` дают одинаковый `id: "rating-aggregate-hero"`. Workaround в meta-seed — composite `${status}__${patternId}__${sourceProduct}`.

### P1 (важно)

- ✅ closed **`α:replace` ctx-fallback** · домен `meta` · 2024-04-25
  Live: положил `status: "closed"` в context, value=null, validator применил `[field]: undefined`.
- ✅ closed **target case-sensitive vs lowercase plural** · домен `meta` · 2024-04-25
  Live: `α:replace target="BacklogItem.status"` не находил entity, потому что server клал rows в `world.backlogItems` (camelCase plural из updateTypeMap), а material-er искал `world.backlogitems` (lowercase pluralize в SDK findCollection).
- ✅ closed **`subCollection.entity` vs `sub.collection`** · домен `meta` · 2024-04-25
  Live: `documentMaterializer::materializeDetail` искал `world[sub.collection]`, CamelCase `{entity: "Intent"}` ломалось.
- ✅ closed **sales overlay entries без поля `key`** · домен `meta` · 2024-04-25
  Live runtime-evaluate: `crystallizeV2(salesIntents, ...)` логировал 8+ warnings `overlay entry missing "key"`.
- ✅ closed **`src/main.jsx` route registration вручную для каждого домена** · домен `meta` · 2024-04-25
  Добавление `/meta` route потребовало двух edit'ов: `src/main.jsx` (React Router) и `vite.config.js` (SPA fallback list). Те же edit'ы пропущены для automation домена.
- 🟢 open **Reverse-association от Domain к Intent/Projection/RRule не очевидна** · домен `meta` · 2024-04-25
  Meta-онтология имеет `Intent.domainId → Domain`, `Projection.domainId → Domain`, `RRule.domainId → Domain`. Это даёт catalog/feed-witness в Intent, но reverse-side (на Domain.detail показать «its intents/projections/rules») требует либо `subCollections: [...]` в projection, либо 
- 🟢 open **Witnesses не персистируются (recomputed-per-crystallize)** · домен `meta` · 2024-04-25
  При scaffold'е meta-онтологии я предположил `Witness` как Φ-stored сущность (history, audit). На деле `artifact.witnesses[]` пересчитывается каждый раз из `crystallizeV2` по текущим intents/ontology/projection — это не events, а derived view. Meta-домен синтезирует «синтетические
- 🟢 open **`pattern-bank/candidate/*.json` shape без `sourceProduct`** · домен `meta` · 2024-04-25
  Meta-snapshot scanner вынужден извлекать `sourceProduct` из имени файла (`avito-...`, `profi-...`), потому что JSON-shape не имеет declared поля.

### P2 (nice-to-have)

- 🟢 open **JSON-snapshot import работает только в Vite** · домен `meta` · 2024-04-25
  `import snapshot from "./meta-snapshot.json"` падает в plain Node (`ERR_IMPORT_ATTRIBUTE_MISSING`); требует `with: { type: "json" }`. Vitest и Vite handle сами через transform.

<!-- /meta-compile -->


