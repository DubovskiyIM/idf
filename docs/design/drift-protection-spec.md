# Drift-protection — формализация границ между нормой и реализацией

**Статус**: draft (2026-04-20)
**Связано с**: §23 (инварианты), §24 (что формат не решает), §26 (направления развития), [`debugging-derived-ui-spec.md`](debugging-derived-ui-spec.md), [`intent-salience-spec.md`](intent-salience-spec.md)
**Scope**: три observable метрики drift'а + один новый инвариант (reader-equivalence) в §23

---

## Проблема

Манифест v2 в §24 уже явно признаёт drift как свойство манифеста-как-документа:

> Манифест имеет три вида drift — числовой (счётчики устаревают), aspirational (заявлено, не реализовано), фактический (значения документа расходятся с кодом). v2 проектируется с зазором между нормой (этот документ) и статусом (`implementation-status.md`), чтобы drift'ы не накладывались.

Это заявление — честное, но **несимметричное**. Оно даёт документу-автору способ быть честным (разделять норму и статус). Оно **не даёт второму автору** (который читает формат и пишет домен) способ **обнаружить**, что в конкретной точке формат и реализация разошлись. Автор видит работающий код, думает, что это норма, переносит это знание в новый домен — drift распространяется.

Три уязвимые поверхности:

1. **Спека ↔ реализация.** Манифест в §16 заявляет «максимальная деривация». Референсная реализация — 89% authored проекций, `deriveProjections` не вызывается в production. Формат обещает X, реализация делает Y, и читатель манифеста не знает, что это drift, а не фича.

2. **Онтология ↔ projection-overrides.** Author декларирует `ontology.entities.Deal.ownerField = "customerId"` и одновременно `projection.deal_detail.patterns.disabled = ["subcollections"]`. Оба legitimate отдельно, композиция может блокировать деривацию, которая должна была произойти по ontology-контракту. Нет observable-сигнала, что это произошло.

3. **Reader ↔ reader.** Манифест в §1 заявляет *«все четыре материализации параллельно работают через viewer-scoping»*. Но каждая материализация идёт своим кодом (`pixels` через `ProjectionRendererV2`, `voice` через `voiceMaterializer`, `agent` через `/api/agent/*`, `document` через `documentMaterializer`). Divergence между ними не отлавливается ни юнит-тестами, ни конформанс-fixtures — каждый тестируется изолированно.

Drift-protection — это **формализация** того, что у §24 уже декларативно заявлено, но не вооружено измерением.

## Цель

Сделать drift **observable** и **измеримым** без расширения манифеста новыми главами. Конкретно:

1. **Три detector'а** с bound/actor контрактом — по одному на каждую поверхность.
2. **Один новый инвариант** в §23 — `reader-equivalence` — формализующий §1 заявление «четыре материализации одинаковы».
3. **Усиление §24 methodological note** — ссылка на эту спеку как на документ, формализующий три detector'а.

Drift-protection **не** добавляет новое направление в §26. Layer 1 покрывается уже существующими направлениями («Второй reference implementation», «Нормативная спека»); Layer 2 — существующим debugging-derived-ui-spec; Layer 3 — единственный новый фрагмент (в виде §23 инварианта).

## Design

### Detector 1 — conformance-drift (Layer 1: спека ↔ реализация)

**Определение**. Несоответствие между поведением референсной (или любой конформной) реализации и нормативными ответами на conformance-fixtures из `idf-spec/fixtures/`.

**Observable**. `conformance-drift(impl) = |{ fixture ∈ fixtures | answer(impl, fixture) ≠ expected(fixture) }|`.

**Bound**. Для конформной реализации: `conformance-drift = 0`. Нарушение — блокер релиза данной реализации.

**Actor**. Разработчик конкретной реализации (host/go/rust/swift). Detector запускается в CI каждого репозитория.

**Relationship**. §26 уже называет «нормативную спеку `docs/spec-v0.1/`» как направление. Эта спека и **есть** источник expected-ответов. `conformance-drift` — observable измеритель прогресса по §26-направлению, а не его замена. Когда появится второй reference implementation — появится и **cross-stack-drift** (`conformance-drift(impl_A) ∪ conformance-drift(impl_B)`), тот же detector, применённый к каждой реализации независимо.

### Detector 2 — override-coefficient (Layer 2: ontology ↔ projection-overrides)

**Определение**. Доля проекций, которые не получают ни одного witness'а от crystallize-rules (R1–R8). Высокое значение = авторы активно overrid'ят вместо того, чтобы пополнять ontology или расширять правила.

**Observable**. `override-coefficient(domain) = authored-projections / total-projections`, где `authored-projection = projection без crystallize-rule witness'ов`. Источник — `artifact.witnesses[]` из v1.12 + `scripts/derivation-spec-debt.mjs`.

**Baseline 2026-04-20** (из `debugging-derived-ui-spec.md`):
```
all 10 domains: 131 projections, 0.89 average
```

**Bound**. **Нет жёсткого порога**. `override-coefficient` — диагностическая метрика, не блокер. Интерпретация трёх режимов:
- `< 0.3` — деривация работает, authored — осознанный выбор для спец-случаев.
- `0.3..0.7` — смешанный режим; автор частично использует правила.
- `> 0.7` — либо правила деривации не покрывают случаи домена, либо автор не знает про них. Сигнал для: (а) расширения `ontology.features`, (б) обогащения Pattern Bank, (в) пересмотра `deriveProjections` invocation policy.

**Actor**. Автор домена (видит метрику → решает, поднимать ли fix на ontology-уровень) + команда формата (агрегированный drift между доменами → сигнал для §26 направлений).

**Relationship**. Не дублирует debugging-derived-ui repair-hierarchy. Repair-hierarchy — **процесс** (как чинить конкретный симптом); override-coefficient — **метрика** (насколько процесс застревает на уровне 1). Они ортогональны.

**Override-recommendation (soft)**. `ownerField`, `role.scope`, `entity.kind`, `invariants[]` — концептуально **ontology-level** свойства. Если projection их «обходит» (через `disabled` паттерны, manual sections, explicit `absorbed: false` и т.п.), это не ошибка, но **сигнал для ревью**: автор либо должен поднять правду на ontology-уровень, либо принять локальный override как технический долг. Это **рекомендация**, не hard validator error — соответствует §21 «авторское намерение первично».

### Detector 3 — reader-equivalence-drift (Layer 3: reader ↔ reader)

**Определение**. Несоответствие между ответами четырёх материализаций на один (world, role, projection). Формально: не существует абстрактной content-set интерпретации, эквивалентной у всех четырёх.

**Observable**. `reader-equivalence-drift(world, role, projection) = |{ (R1, R2) ∈ readers × readers | content-set(R1) ≠ content-set(R2) }|`, где `content-set` — абстракция, извлекающая логический контент поверх конкретной формы (DOM дерево, voice turns, JSON graph, HTML-узлы).

**Bound**. Для конформной реализации: `reader-equivalence-drift = 0` для любой (world, role, projection). Нарушение — hard bug референсной реализации.

**Actor**. Команда формата (разрабатывает abstract content-set definition); разработчики каждой реализации (прогоняют differential test).

**Relationship**. Это **новый инвариант §23**. Следует из §1 но не был формально зафиксирован. См. секцию «Новый инвариант» ниже.

### Новый инвариант §23 — reader-equivalence

Добавить в §23 пятую аксиому:

> **5. Reader-equivalence — четыре материализации семантически согласованы.**
>
> Для любого `(world, viewer, projection)` содержание, видимое через четыре reader'а (pixels, voice, agent, document), должно быть согласованным: ни один reader не показывает факт, который другие три скрывают (нет **утечки**); каждый reader показывает подмножество фактов, определённое его **явной reader-policy** (brevity для voice — легитимное сокращение, не drift).
>
> Формально: пусть `visible(R, W, V, P)` — множество фактов, которые reader `R` делает достижимыми для viewer `V` на world `W` при projection `P`. Тогда ∀ R1, R2 ∈ readers: `visible(R1, ...) ⊆ reader-policy(R1, full-content)` **и** `visible(R1, ...) ∪ visible(R2, ...) ⊆ filterWorldForRole(W, V)`. Reader-policy должна быть задекларирована, не эмерджентна.
>
> Следствие: изменение правила fold / кристаллизации / filter-by-role не требует параллельных правок в каждом reader'е — эквивалентность проверяется конформанс-harness'ом.
>
> Эта аксиома усиливает viewer-scoping (§23, аксиома 2): viewerWorld — тип данных для viewer'а, но аксиома 5 требует, чтобы этот тип данных **одинаково интерпретировался** всеми читателями. Новый reader добавляется с гарантией, что не расширит множество видимого контента сверх существующих; старый reader не может «потерять» факт, который другие три видят.
>
> Для простоты: differential test между pixels и document — первая защита; voice и agent — вторая (они обычно ограничены, не расширены).

Эта аксиома **не** обсуждаема (как и первые четыре). Любая реализация, нарушающая её, не является конформной.

### Manifesto touch-points (две, не три)

1. **§23 Инварианты формата** — добавить аксиому 5 (см. выше).
2. **§24 Методологическая заметка** — расширить:
   > *«Для второго автора (читающего формат) drift становится observable через три детектора, формализованных в [`drift-protection-spec.md`](design/drift-protection-spec.md): conformance-drift (спека ↔ реализация), override-coefficient (ontology ↔ authored projection), reader-equivalence-drift (четыре материализации ↔ друг друга). Первая — блокер конформности, вторая — диагностическая, третья — аксиома §23.»*

§26 **не трогаем** — drift-protection не добавляет нового направления. Layer 1 покрыт «Вторым reference implementation» + «Нормативная спека»; Layer 3 закрывается аксиомой 5; Layer 2 — часть debugging-derived-ui-spec.

## Границы

**В scope спеки**:
- Формальные определения трёх detector'ов
- Reader-equivalence как аксиома §23
- Ссылки на уже существующие документы / метрики

**Вне scope**:
- Implementation конкретного differential test harness (это SDK/tooling работа, не формат)
- `content-set` abstraction определение с точностью до JSON-схемы (отдельный документ, `reader-equivalence-protocol.md`, когда начнётся реализация)
- Hard enforcement override-recommendation (противоречит §21)
- Cross-stack differential harness имплементация (часть §26 «Второй reference implementation»)
- Расширение debugging-derived-ui repair-hierarchy (уже формализована)

## Relationship с другими specs

**debugging-derived-ui-spec.md** (2026-04-20). Repair hierarchy + spec-debt metric. Drift-protection-spec использует `override-coefficient` из baseline этой спеки как Detector 2. Repair-hierarchy — процесс, override-coefficient — метрика.

**intent-salience-spec.md**. Alphabetical-fallback witness как spec-debt — частный случай overrides-индикатора. Drift-protection не дублирует; salience остаётся specific механизм для tie-breaking.

**rule-R9-cross-entity-spec, rule-R1b, rule-R10-role-scope**. Конкретные правила деривации. Drift-protection агрегирует их через `override-coefficient` — чем больше правил сработает, тем ниже коэффициент.

**layered-authoring-draft**. Декларирует множественность слоёв авторства. Override-recommendation (soft) в Detector 2 уважает это: override — legitimate выбор, метрика — сигнал для ревью, не запрет.

## Open questions

1. **Content-set abstraction** — какова минимальная логическая интерпретация, над которой сверяются reader'ы? Text content + structure + available-actions? Или только «какие сущности viewer может видеть»? Это определяет practicality differential test. Переносится в будущий `reader-equivalence-protocol.md`.

2. **Per-domain override-coefficient thresholds**. `invest` — 1.00 authored, `sales` — 0.61. `invest` концептуально CRUD-heavy (dashboard + chart-primitives), высокий authored — возможно норма. Нужны per-domain expected-ranges или хотя бы per-archetype-mix ожидания.

3. **Cross-stack content-set**. Когда второй reference implementation начнёт conformance test, content-set abstraction должна быть platform-independent (не зависеть от React-specific DOM структур). Это возможно через JSON-schema content-set, но подтверждается только на второй реализации.

## Definition of done (PoC для manifest v2.1)

Manifest-level:
- [ ] §23 получает аксиому 5 (reader-equivalence)
- [ ] §24 methodological note получает ссылку на эту спеку
- [ ] §26 не меняется
- [ ] debugging-derived-ui-spec получает cross-ref на drift-protection-spec

Spec-level:
- [x] Detector 1 — conformance-drift определён, ссылается на `idf-spec/fixtures/`
- [x] Detector 2 — override-coefficient определён, baseline в debugging-derived-ui
- [x] Detector 3 — reader-equivalence-drift определён, bound = 0 как hard constraint

Implementation-level (out of scope этой спеки, но ожидается в v2.1 timeline):
- [ ] Abstract content-set definition (reader-equivalence-protocol.md)
- [ ] Differential test harness в idf (pixels vs document vs voice vs agent на sales/order_detail как первый fixture)
- [ ] Extended `npm run conformance` покрывающий 4 readers
