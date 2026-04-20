# Session Backlog — Deferred Items, Insights, Observations

**Назначение.** Отдельная очередь задач, инсайтов и находок, отложенных между сессиями. В отличие от `sdk-improvements-backlog.md` (специфичен для SDK и дискавери freelance'а), этот файл — cross-cutting: всё, что всплыло при работе, но не попало в текущий PR.

**Контракт.**

- При завершении сессии — пройтись по «что хотел сделать но отложил» и записать сюда.
- При старте новой сессии — проверить backlog перед planning'ом.
- Пункты с датой находки, коротким контекстом, предлагаемым action'ом.
- Когда пункт взят в работу — удалить из backlog'а и перевести в плановый workstream.
- Если пункт устарел (решён параллельно, отменён решением) — удалить, не оставлять как «исторический».

---

## 1. Deferred implementation

Задачи, где scope / timing вытеснил их из текущего PR.

### 1.1 `invariant.kind: "expression"` — custom row-level predicate

**Дата:** 2026-04-20
**Контекст:** Freelance session — `Deal.customerId !== Deal.executorId` нельзя выразить как простой kind. Сейчас enforce вручную в `buildCustomEffects::submit_response`.
**Action:** Добавить `kind: "expression"` с evaluator'ом JS-выражения над row. Документировать `registerKind` API.
**Owner:** `@intent-driven/core/invariants/`
**Связано:** `docs/sdk-improvements-backlog.md` §1.2

### 1.2 Composite `groupBy` в `cardinality`

**Дата:** 2026-04-20
**Контекст:** «Один активный Response на пару (executorId, taskId)» — сейчас enforce'ится в host `buildCustomEffects`.
**Action:** `groupBy: ["executorId", "taskId"]` — массив, handler конкатенирует в ключ группы.
**Owner:** `@intent-driven/core/invariants/cardinality.js`
**Связано:** `docs/sdk-improvements-backlog.md` §1.3

### 1.3 `__domain` провенанс в Φ (auto-discriminator)

**Дата:** 2026-04-20
**Контекст:** `lifequest.tasks` и `freelance.tasks` делят SQL table. SDK invariant'ы без discriminator пересекаются. В Cluster A — решаем через `invariant.where` (author responsibility). Long-term нужен автоматический `__domain` provenance.
**Action:** Host server пишет `effect.context.__domain` в Φ при confirm. SDK fold подхватывает как row field. Invariants used as `where: "__domain === 'freelance'"`.
**Owner:** Host `server/routes/effects.js` + SDK `fold.js`
**Связано:** `docs/sdk-improvements-backlog.md` §1.4 (partial fix in Cluster A PR)

### 1.4 Antd adapter patches — Cluster B (четыре P0 бага)

**Дата:** 2026-04-20
**Контекст:** Freelance field-test выявил 4 workaround'а в `idf/src/runtime/DomainRuntime.jsx`. Cluster B — самостоятельный PR.
**Action:** Отдельная сессия:
- **2.1** Button `label` vs `children` API mismatch — принимать оба, label приоритет
- **2.2** `AntdDateTime` без времени — respect `spec.withTime` / `spec.precision: "minute"`
- **2.3** `AntdNumber` не видит `fieldRole:"price"` — `isMoney = fieldRole ∈ {money, price}`
- **2.4** `AntdTextInput` игнорирует `maxLength`/`minLength`/`pattern` — пробросить в `<Input>`
**Owner:** `@intent-driven/adapter-antd`
**Связано:** `docs/sdk-improvements-backlog.md` §2.1-2.4

### 1.5 `PrimaryCTAList` для multi-param phase-transitions

**Дата:** 2026-04-20
**Контекст:** `onClick={() => ctx.exec(spec.intentId, {id: target.id})}` — параметры `spec.parameters` теряются. Workaround: форсировать `irreversibility:"high"` на `submit_work_result`.
**Action:** PrimaryCTAList рендерит overlay-form когда `spec.parameters.length > 0`. Или `assignToSlotsDetail` не кладёт multi-param intents в primaryCTA slot.
**Owner:** `@intent-driven/renderer/archetypes/ArchetypeDetail.jsx`
**Связано:** `docs/sdk-improvements-backlog.md` §3.1

### 1.6 `IrreversibleBadge` auto-placement

**Дата:** 2026-04-20
**Контекст:** Primitive создан в SDK renderer, но не инжектится автоматически. Домены с `__irr:{high}` (invest/delivery/freelance) не показывают badge.
**Action:**
- `buildDetailBody` добавляет `irreversibleBadge` node в header-row для mainEntity с `__irr`
- `ConfirmDialog` рендерит badge + причину из `__irr.reason` если `spec.irreversibility === "high"`
- ConfirmDialog `confirmLabel` configurable (вместо фиксированного «Удалить»)
**Owner:** `@intent-driven/core` + `@intent-driven/renderer`
**Связано:** `docs/sdk-improvements-backlog.md` §3.3

### 1.7 Pattern Bank: hero-create.apply — blocked

**Дата:** 2026-04-20
**Контекст:** При попытке добавить apply к hero-create выяснилось: логика hero slot assignment уже в `assignToSlotsCatalog.js` как crystallize-rule. Pattern-bank apply был бы duplicate.
**Insight:** Правильное решение — **migrate** hero слот из crystallize-pipeline в pattern-bank. Это refactor, не additive feature. Отделяет origin-rules (R1–R8) от behavioral patterns.
**Action:** Brainstorm полноценного migration workstream:
- Какие R-правила в `assignToSlots*.js` концептуально являются patterns?
- Как преподнести refactor без breaking существующих доменов?
- Cost vs benefit (сейчас hero работает — refactor ради чистоты архитектуры)
**Owner:** `@intent-driven/core/crystallize_v2/` + `@intent-driven/core/patterns/`
**Связано:** Open items v1.12 — «Pattern Bank: structure.apply для оставшихся 17 stable паттернов»

### 1.8 Remaining 16 of 17 matching-only patterns — structure.apply

**Дата:** 2026-04-20
**Контекст:** В v1.12 SDK три паттерна имеют apply (`subcollections`, `grid-card-layout`, `footer-inline-setter`). Остальные 16 stable — matching-only.
**Action:** По одному — от простых к сложным. Hero-create исключён (см. 1.7 — blocked). Next candidates: `bulk-action-toolbar`, `global-command-palette`, `m2m-attach-dialog`.
**Owner:** `@intent-driven/core/patterns/stable/`

### 1.9 Domain audit findings — baseline 2026-04-20 (187 findings)

**Дата:** 2026-04-20
**Контекст:** `node scripts/audit-report.mjs` сгенерировал baseline (`docs/domain-audit.md` + `.json`). 0 error, 103 warning, 84 info. Ключевые clusters:
**Actions (по убыванию импакта):**
- **Salience coverage ≈0%** во всех 10 доменах (55 idiom findings). Intent-salience v2.1 ratify (backlog §2.3 manifest) остаётся — но также нужна **massовая аннотация в доменах**. Sales (225 intents, 1%), messenger (100, 0%), invest (61, 0%), lifequest (56, 2%). Можно начать с primary actions в sales/messenger.
- **Override-coefficient 1.0** во всех 10 доменах (derivation findings). `deriveProjections` не вызывается в crystallize pipeline → R1–R8 witnesses не добавляются. Blocker от `debugging-derived-ui-spec.md` baseline 2026-04-20 остаётся — решение через `ontology.features.autoDerive` opt-in.
- **Test coverage gap** — 8 из 10 доменов не имеют domain-local `.test.js`. Freelance лидирует (6 files), остальные 0-1. Priority: добавить интеграционные тесты для invest (61 intent, самый сложный), sales (225), lifequest (56).
- **Cross-domain collisions** — 42 shared entity-names. Legit (User везде) + некоторые warning ("Task" — lifequest + freelance; "Category" — sales + freelance). Нужен namespacing либо явное declarative allowlist.
- **Format findings (45)** — legacy fields string-array в некоторых доменах (`entity.fields: ["a", "b"]` vs object-shape), FK-поля не типизированные как entityRef.
**Owner:** Per-domain стабилизация (следующие сессии), не single-PR scope.
**Regen:** `npm run audit-report` (idempotent, commits report в docs/).

### 1.11 Invest Phase 3 — custom-id feeds → composeProjections rename

**Дата:** 2026-04-20
**Контекст:** После PR #83 invest authored-проекций: 23 → 17. Оставшиеся 17 включают 10 custom-id feed'ов (`portfolios_root`, `goals_root`, `watchlists_root`, `recommendations_inbox`, `alerts_feed`, `transactions_history`, `advisor_clients`, `assets_catalog`, `rules_list`, `market_trends`), на которые ссылается `ROOT_PROJECTIONS` как навигация.

Derivation даёт им канонические имена (`portfolio_list`, `goal_list` и т.д.), но UI нужны осмысленные ids для URL-маршрутов и табов. Прямой removal = breaking UI.

**Action:** Workstream после V2Shell smart-merge:
1. SDK добавляет `composeProjections(derived, authored, { renames: { portfolio_list: "portfolios_root" } })` — rename semantic без изменения derived metadata.
2. `src/domains/invest/projections.js` использует `OVERRIDES` + `RENAMES` + `EXTRA` паттерн вместо плоского `PROJECTIONS`.
3. `ROOT_PROJECTIONS` остаётся стабильным.
4. Derivation-coefficient invest: 0.44 → 0.05-0.10 (остаются только dashboards/wizards/canvas, которые реально custom).

**Blocker:** V2Shell.jsx сейчас принимает `domain.PROJECTIONS` как flat dict. Refactor требует либо (a) domain экспортирует function `getProjections(derived)` и V2Shell вызывает после derive, либо (b) SDK экспортирует `composeProjections` с renames и V2Shell использует явно.

**Owner:** host V2Shell + `@intent-driven/core/crystallize_v2/composeProjections.js` + `src/domains/invest/projections.js`
**Связано:** PR #83 (6 invest detail derived), этот PR (smart-merge сохраняет `derivedBy`), backlog §2.3 (deriveProjections в production)

### 1.10 Studio integration: audit report viewer

**Дата:** 2026-04-20
**Контекст:** `docs/domain-audit.json` имеет structured schema (axes + perDomain + summary). Текущий consumer — human через markdown.
**Action:** Studio tab «Audit» — UI над JSON-report'ом. Severity badges per domain, per-axis filter, drill-down per finding. Либо fixture-driven (consume committed JSON), либо live через server endpoint `/api/studio/audit`.
**Owner:** host + SDK renderer
**Depends on:** stable schema `domain-audit.json` (этот PR даёт baseline)

---

## 2. Architectural research / insights

Философские находки, на которые стоит вернуться.

### 2.1 Reader-policy formalization — content-set abstraction

**Дата:** 2026-04-20
**Контекст:** `drift-protection-spec.md` ввёл reader-equivalence как §23 аксиому 5. Но формальное определение `content-set` (абстракция, над которой сверяются reader'ы) — open question.
**Action:** Отдельный design `reader-equivalence-protocol.md` когда появится differential-test harness. Определить: text content + structure + available-actions? Или только «какие сущности viewer может видеть»?
**Owner:** `idf-manifest-v2.1/docs/design/`

### 2.2 Per-domain override-coefficient thresholds

**Дата:** 2026-04-20
**Контекст:** Baseline 2026-04-20 показал: `invest` — 1.00 authored, `sales` — 0.61. Invest концептуально CRUD-heavy, возможно норма. Нужны per-domain expected ranges.
**Action:** Empirically определить на 10 доменах: для каждого archetype-mix указать ожидаемый coefficient. Добавить в `drift-protection-spec.md` как reference данные.
**Owner:** `idf-manifest-v2.1/docs/design/drift-protection-spec.md`

### 2.3 deriveProjections в production — gap или feature

**Дата:** 2026-04-20
**Контекст:** Baseline debugging-derived-ui-spec: 88.5% проекций authored, `deriveProjections` не вызывается ни host, ни SDK pipeline. Три интерпретации (gap / feature / mixed via `ontology.features.autoDerive`).
**Action:** Decision-point после CrystallizeInspector + near-miss witnesses — когда ясно, какая interpretation правильная. Не форсировать.
**Owner:** `@intent-driven/core/crystallize_v2/` + host

### 2.4 Cross-stack differential test harness

**Дата:** 2026-04-20
**Контекст:** `drift-protection-spec` Detector 1 формализован, но harness нет. idf-go/idf-rust/idf-swift работают на `idf-spec/fixtures/` изолированно, не diff'ятся друг против друга.
**Action:** CI в каждом cross-stack repo запускает conformance + differential `fold(Φ)` output на shared fixtures. Требует coordination across 4 repos.
**Owner:** `idf-spec/` + 4 implementations
**Связано:** Манифест §26 «Нормативная спека» + «Второй reference implementation»

### 2.5 Salience declaration-order → numeric sub-ranks

**Дата:** 2026-04-20
**Контекст:** Declaration-order ladder (SDK #88 + #90) довёл alpha-fb witnesses до 0 во всех 10 доменах. Open direction из manifesto §26 — **numeric salience для fine-ranking внутри одного tier** (e.g. несколько primary intents требуют явного ordering). Сейчас поверх discrete labels `{primary|secondary|tertiary|utility}` работает declaration-order; numeric (100, 110, 120) даёт автору explicit fine-rank без reorder.
**Action:** Design в `idf-manifest-v2.1` — примеры use cases, heuristics для computed numeric из particles, migration path от labels → numbers. Implementation — уже поддерживается в SDK (computeSalience принимает numbers).
**Owner:** `idf-manifest-v2.1/docs/design/` + SDK core documentation

### 2.6 Pattern bank promotion heuristics — computed defaults

**Дата:** 2026-04-20
**Контекст:** При нехватке explicit salience, computed fallback в `salience.js` даёт 80/70/60/40/30/10 на основе effect shape. Но не покрывает все cases (например: phase-transition с `revokeOn` → больший salience? intent с `preapproval` → меньший visibility?). Эти правила — implicit heuristics, накапливаются в SDK без формальной спеки.
**Action:** Собрать все правила computed в § design-spec; задокументировать «когда computed mispredict'ает» на реальных доменах (можно через audit tool — detection pattern).
**Owner:** `idf-manifest-v2.1/docs/design/intent-salience-spec.md` extension

### 2.7 Manifesto ↔ code drift как first-class metric

**Дата:** 2026-04-20
**Контекст:** Сегодняшняя ревизия `manifesto-v2.md` vs `implementation-status.md` vs реальный код показала: манифест §26 говорил «Цель довести alpha-fb до 0» как aspiration, а код уже это достиг. Implementation-status отставал на 2+ версии SDK. README — на 4 домена. Это sample of §24 methodological note в действии.
**Observation:** Нужен auto-link между manifest claim и concrete state. Один из подходов — manifest теги `[impl-status: ...]` с regex-probe from implementation-status. Drift-protection detector-0. Но это инструментальный слой, не blocking.
**Action:** Deferred — требует design о semantic-tag format.
**Owner:** `idf-manifest-v2.1/docs/design/` (будущий `manifest-drift-linking-spec.md`)

---

## 3. Cross-cutting observations

Наблюдения, не привязанные к одному workstream'у.

### 3.1 `CLAUDE.md` в `.gitignore`

**Дата:** 2026-04-20
**Контекст:** `docs/superpowers/`, `CLAUDE.md` — все в `.gitignore`. Они local-only. Backlog — нет (чтобы был shared across sessions и визбли во всех worktree'ях).
**Observation:** Backlog файл должен быть **committed**, в отличие от CLAUDE.md. Иначе новая сессия в чистом worktree не увидит.

### 3.2 Changeset bot vs manual version bumps

**Дата:** 2026-04-20
**Контекст:** X-ray PR — changeset сработал на SDK, но когда main успел выпустить 0.22.0 до моего merge, collision. Ручной rebump до 0.23.0 решил.
**Observation:** При параллельной работе двух агентов над SDK — rebase conflicts нормальны. Changeset bot не знает про pending PRs. Нужно держать в уме при coordination.

### 3.3 `.worktrees/` scoping — один воркфлоу, один worktree

**Дата:** 2026-04-20
**Контекст:** За сегодняшнюю сессию создано 4+ worktree'ев (derivation-xray в idf + idf-sdk, drift-protection в manifest, session-backlog в idf). Изоляция помогает.
**Observation:** Конвенция: один worktree = один coherent PR workstream. Cleanup через `git worktree remove` после merge.

### 1.X Renderer-support для новых filter-форматов (R7b / R10 / R11 v2)

**Дата:** 2026-04-20
**Контекст:** SDK правила R7b (multi-owner disjunction), R10 (m2m-via scope), R11 v2 (owner-scoped temporal feed) выводят structured-filter поля новых форм:
- `{ kind: "disjunction", fields: [...], op, value }` — R7b
- `{ kind: "m2m-via", via, viewerField, joinField, localField, ... }` — R10
- `{ field, op: "=", value: "me.id" }` + `sort: "-<ts>"` — R11 v2

`List` primitive сейчас интерпретирует только простой `evalCondition` string-filter.
Новые форматы игнорируются → projection генерируется, но в UI не фильтруется.
**Action:** обновить `@intent-driven/renderer/primitives/containers.jsx::List` (и аналоги в ArchetypeDetail) чтобы распознавать `filter.kind` и применять соответствующую логику.
**Owner:** `@intent-driven/renderer` + adapter (возможно server-side `filterWorldForRole` уже знает эту семантику — shared helper).
**Связано:** SDK PR'ы #73, #64 (merged), #84 (open).

### 1.Y Renderer-support для singleton-detail без idParam (R3b)

**Дата:** 2026-04-20
**Контекст:** R3b генерирует `my_<entity>_detail` без idParam + `singleton: true`. Сейчас `ArchetypeDetail` требует routeParams[idParam]. Для singleton нужно fallback на `world[entity].find(e => e[ownerField] === viewer.id)`.
**Action:** `ArchetypeDetail` читает `projection.singleton`, resolve target через ownerField+viewer.
**Owner:** `@intent-driven/renderer/archetypes/ArchetypeDetail.jsx`
**Связано:** SDK PR #76 (merged), idf#60 (merged).

### 1.Z R11b — multi-owner disjunction feed (future)

**Дата:** 2026-04-20
**Контекст:** R11 v2 поддерживает только single-string `ownerField`. Array ownerField (multi-owner) — не триггерит `my_*_feed`. Аналог R7b для temporal streams. Пока не было реального domain case, но будет: shared-stream с множественными ownership (e.g. `Notification.recipientIds`).
**Action:** extend R11 witness builder `disjunction` mode по образцу `witnessR7bMultiOwnerFilter`.
**Owner:** `@intent-driven/core/crystallize_v2/`

### 1.W Near-miss witnesses для R11/R11 v2

**Дата:** 2026-04-20
**Контекст:** `collectNearMissWitnesses` покрывает R3/R1b/R7/R10. Не покрывает R11 (entity с `createdAt` полем, но без `temporal:true`).
**Action:** heuristic — если entity имеет field с суффиксом `-At` или fieldRole `datetime`, но без `temporal` флага — emit near-miss с suggestion добавить `temporal:true`.
**Owner:** `@intent-driven/core/crystallize_v2/nearMissWitnesses.js`

## 2. Architectural insights (не задачи, а наблюдения)

### 2.5 R-rule evolution — deep-fix effect

**Дата:** 2026-04-20
**Контекст:** R7 v2 (relax precondition R1→R3 fallback) — **7-строчный patch** закрыл 8 uncovered cases across 4 доменов. R9 (cross-entity composite, 45 LOC + 16 тестов) — 0 cases до filter refinement.
**Observation:** **audit existing rules for internal coupling перед добавлением новых**. Implicit design-constraints (R7 требует R1) пряли большие impact pockets. Surfaces через один домен (freelance.Deal), но latent impact был скрыт в sales/invest/delivery тоже.
**Template:** при добавлении нового R-правила — проверять, есть ли pre-existing правило с precondition, которое избыточно для semantic'а (как R1 catalog для R7 был избыточен — нужен только для witnesses, не для фильтра).

### 2.6 Classifier heuristic filter-presence bit

**Дата:** 2026-04-20
**Контекст:** `uncovered-classification.mjs` heuristic match по `!!authored.filter === !!derived.filter` — бинарный filter-presence. Блокирует rename когда filter semantics совпадают но format отличается (R11 public vs authored owner-scoped).
**Observation:** Heuristic достаточен для первичной классификации, но не для fine-grained Δ measurement. Будущие finding'и могут скрываться за "derived не matched из-за filter mismatch" — проверять прямо через probe script, не полагаться только на classifier.

### 2.7 R-rule roadmap finalized — 13 правил

**Дата:** 2026-04-20
**Контекст:** Debugging-derived-ui workstream завершён. Итог: 13 правил деривации (R1, R1b, R2, R3, R3b, R4, R6, R7 v2, R7b, R8, R9, R10, R11 v2) + composeProjections + explainCrystallize + resolveCompositions + near-miss witnesses + CrystallizeInspector (§27 host).

**Metrics финальные:**
- Baseline: U = 24 (21%) при 88.5% authored.
- После всех правил + ontology audit + R11 v2 activation: **U = 11 (9.5%)** (predicted).
- Realization: **100% от spec-predicted -13**.
- Остающиеся 11 — **genuine edge cases** (admin-only, 3-level composite, cross-role scope, complex OR filter, специфические patterns без universal rule).

**Observation:** Format подошёл к natural ceiling R-правил. Следующие 5% gap (от 9.5% до 5%) потребуют либо очень узкие rules (diminishing returns), либо пересмотр фундаментальных допущений (composable filter DSL). Не urgent.

---

## History — completed items

*(здесь накапливаются пункты, которые были закрыты; для истории и чтобы видно прогресс. По достижении большого объёма — архивировать в `docs/archive/backlog-YYYY-MM.md`.)*
