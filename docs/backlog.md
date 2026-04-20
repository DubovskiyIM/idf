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

---

## History — completed items

*(здесь накапливаются пункты, которые были закрыты; для истории и чтобы видно прогресс. По достижении большого объёма — архивировать в `docs/archive/backlog-YYYY-MM.md`.)*
