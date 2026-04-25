# IR-stages — типизированные границы внутри `crystallize_v2`

**Дата:** 2026-04-26
**Статус:** design-spec, backlog §2.14 (P2 research, depends on §2.8 closeout)
**Origin:** внешний reviewer 2026-04-26 (8-е письмо), MLIR-style лестница как референс

---

## 1. Проблема

`crystallize_v2(intents, ontology, projection) → artifact` — сейчас «магическая функция» с inline pipeline:

```
crystallize_v2(intents, ontology, projection):
  1. anchoring (отбросить intent'ы без entity/field witness'а)
  2. assignToSlots* (catalog/detail/feed/...) — intent → slot
  3a. deriveShape (timeline/directory/default)
  3b. absorbHubChildren (R8 — hub-detail впитывает child catalogs)
  3c. computeProvenance (witness'ы по slot'ам)
  3d. applyStructuralPatterns (35 stable patterns, фаза «patterned»)
  4. wrapByConfirmation (confirm-обёртки на destructive intents)
  → artifact { slots, witnesses[], shape, hubSections, ... }
```

Между шагами **нет типизированных границ**. Снаружи виден только финальный `artifact`. Когда автор получает «78% правильный» результат, он не знает, какая фаза провалилась — anchoring (intent отбросился), assignment (попал не в тот slot), shape (не сработал hub-absorb), apply (паттерн не подцепился) или final wrap.

**Witness trail (`artifact.witnesses[]`)** уже даёт «аннотацию через уровни» (`basis: "structural-rule" | "pattern-bank" | "declaration-order" | ...`), но без `stage`-поля. Witness не привязан к конкретной фазе pipeline'а — drill-down невозможен.

**Property-tests есть только на final artifact.** Свойство «никакой intent не пропал тихо» — invariant-by-convention. Свойство «навигация достижима за ≤K кликов» — никем не тестируется. Свойство «pattern apply идемпотентен» — никем не тестируется. Свойство «4 reader'а отдают изоморфный information content» (§23 axiom 5) — спека, не runtime check.

## 2. Зацепка от reviewer'а

> «Не одна функция `crystallize`, а лестница:
> intents + ontology + projection → semantic IR → structural IR → layout IR → pattern-matched IR → adapter-specific output. Каждый язык можно проверять отдельно. Это превращает `crystallize` из магической функции в верифицируемый pipeline. Pattern bank становится правилами на pattern-matched IR, witnesses становятся аннотациями через уровни. Reference: MLIR.»

**Что верно:** лестница де-факто существует (см. §1), просто без названий и границ. Stages и witness-`stage` поле дают то, что reviewer описал.

**Что натяжка:**

- **Layout IR с Fitts's-Law-предикатами** — у нас семантические слоты, не геометрия. Геометрия делегирована адаптерам через `adapter.capabilities`. Fitts's Law на абстрактном «slots.body / slots.header» — категориальная ошибка. Эргономические законы (Fitts/Hick-Hyman/Cowan/CLT/GOMS) — отдельный direction (§2.13 backlog), живут на адаптерном уровне как axis'ы в `audit-report.mjs`, не внутри IR-stages.
- **«4 адаптера = 4 codegen-backend'а одного UI»** — неверно. Voice / agent-API / document — другие read-проекции Φ через материализаторы (`voiceMaterializer`, `documentMaterializer`, agent route с `filterWorldForRole` + `preapprovalGuard`), а не lowering targets pixels-IR. Manifesto v2 Часть IV формулирует их как **равноправные**, не как backends. Pixels-материализация уже сама расщепляется на 4 adapter codegen (Mantine / shadcn / Apple / AntD) — это уровень внутри одной материализации, не отдельная ось.
- **Полная MLIR-инфраструктура** — over-engineering под ≤ 10 авторов формата. Брать `tablegen` / typed dialects / lowering — поднять цену на порядок без proportional value.

## 3. Контракт IR-stages

### 3.1 Стадии

```
crystallize_v2(intents, ontology, projection) →
  ┌─ semanticArtifact   (anchoring + slot assignment)
  ├─ structuralArtifact (+ shape + hubAbsorption)
  ├─ layoutArtifact     (+ provenance, slots уложены)
  ├─ patternedArtifact  (+ apply 35 паттернов)
  └─ artifact           (+ wrapByConfirmation)
```

| Стадия | Вход | Выход | Что меняется |
|---|---|---|---|
| `semantic` | `intents`, `ontology`, `projection` | `{ slots: { intent, entity, fieldRefs }, anchorRejections, witnesses[stage:semantic] }` | Каждый intent либо попадает в slot, либо отбрасывается с witness'ом «no entity/field anchor». |
| `structural` | `semanticArtifact` | `+ { shape, hubSections, absorbedBy }` | `deriveShape` (timeline/directory/default), `absorbHubChildren` (R8). |
| `layout` | `structuralArtifact` | `+ { slots.{header,body,footer,hero,toolbar,subCollections}, slotProvenance }` | Полная раскладка по 6 slot'ам + composer. |
| `patterned` | `layoutArtifact` | `+ { patternMatches[], slotAttribution }` | 35 паттернов apply'ятся в фазе 3d. |
| `final` | `patternedArtifact` | `artifact + { confirmations: { __irr-wraps } }` | `wrapByConfirmation` для destructive intents. |

### 3.2 Witness contract

Текущая форма `artifact.witnesses[]`:

```js
{ basis: "structural-rule" | "pattern-bank" | "declaration-order" | "alphabetical-fallback" | ...,
  reliability: "structural" | "rule-based" | "heuristic",
  pattern?: "subcollections" | "hero-create" | ...,  // если basis == "pattern-bank"
  ... }
```

Расширение:

```js
{ basis: ...,
  reliability: ...,
  stage: "semantic" | "structural" | "layout" | "pattern" | "final",  // NEW
  pattern?: ...,
  ... }
```

Аддитивно. Существующие witness'ы получают `stage` по факту фазы, в которой emit'ятся (например, `basis: "pattern-bank"` ⇒ `stage: "pattern"`; `basis: "structural-rule"` ⇒ `stage: "semantic"` или `"structural"` в зависимости от правила).

### 3.3 Property-tests per stage

Новый каталог `packages/core/src/__tests__/per-stage-properties/`:

**`semantic-conservation.test.js`** — для каждого домена (13 полевых тестов):

```js
test("every intent ends up in slot or anchorRejections", ({ domain }) => {
  const { semanticArtifact } = crystallize(domain.intents, domain.ontology, projection);
  const allIntentIds = Object.keys(domain.intents);
  const placed = semanticArtifact.slots.flatMap(s => s.intentIds);
  const rejected = semanticArtifact.anchorRejections.map(r => r.intentId);
  expect(new Set([...placed, ...rejected])).toEqual(new Set(allIntentIds));
});
```

**`structural-reachability.test.js`** — после R8 hub-absorption:

```js
test("every projection reachable from root in ≤ 4 clicks", ({ domain }) => {
  const navGraph = buildNavGraph(domain);
  for (const projId of domain.rootProjections) {
    expect(distance(navGraph, "root", projId)).toBeLessThanOrEqual(4);
  }
});
```

**`pattern-idempotency.test.js`** — apply должен быть детерминирован:

```js
test("applyStructuralPatterns is idempotent", ({ domain, projection }) => {
  const layout = crystallize(domain).layoutArtifact;
  const once = applyStructuralPatterns(layout);
  const twice = applyStructuralPatterns(once);
  expect(twice.slots).toEqual(once.slots);
});
```

**`reader-equivalence-semantic.test.js`** — на `semanticArtifact` 4 reader'а должны видеть одно и то же множество intent → entity bindings:

```js
test("4 readers see same intent→entity bindings on semantic artifact", ({ domain }) => {
  const sa = crystallize(domain).semanticArtifact;
  const pixelsBindings = projectForReader(sa, "pixels");
  const voiceBindings = projectForReader(sa, "voice");
  const agentBindings = projectForReader(sa, "agent");
  const documentBindings = projectForReader(sa, "document");
  expect(voiceBindings).toEqual(pixelsBindings);
  expect(agentBindings).toEqual(pixelsBindings);
  expect(documentBindings).toEqual(pixelsBindings);
});
```

Расхождение между reader'ами **разрешено только на `layout`-стадии и позже** (voice вытаскивает top-3 для catalog, agent применяет `preapprovalGuard`, document плоский). Расхождение на `semantic` = нарушение axiom 5 в зародыше.

### 3.4 `explainCrystallize()` shape

Сейчас (ожидаемый shape per `debugging-derived-ui-spec.md`):

```js
explainCrystallize(domain, projection) → {
  witnesses: [...],  // flat list
  rules: [...],      // R1-R10 + R8 fired/not-fired
}
```

После IR-stages:

```js
explainCrystallize(domain, projection) → {
  stages: {
    semantic: {
      input: { intents, ontology, projection },
      output: semanticArtifact,
      witnesses: [...],     // только stage:semantic
      transformations: [...] // anchoring rejections, slot assignments
    },
    structural: { ... },
    layout: { ... },
    patterned: { ... },
    final: { ... }
  },
  // diff-friendly: можно сравнивать stages между двумя версиями ontology
}
```

`derivation-diff.mjs --stage semantic` показывает, что изменилось только на этом уровне между двумя версиями.

### 3.5 Что НЕ входит в spec

- **MLIR `tablegen` / typed dialects / lowering API** — не делаем. Stages — это organizational pattern в `crystallize_v2/index.js`, не библиотека.
- **Layout-IR с Fitts's-Law-предикатами** — категориальная ошибка (см. §2). Slots — семантика, геометрия делегирована адаптерам. Behavioral predictions через ergonomic laws — отдельное направление (§2.13).
- **Voice / agent / document как отдельные codegen targets из layout-IR** — они materializer'ы поверх Φ + ontology, не lowering из pixels-IR. Reader-equivalence per stage проверяет это явно.
- **Breaking witness contract** — `stage`-поле аддитивно. Старый код, читающий `witnesses[].basis`, продолжает работать.

## 4. Реализация

### 4.1 SDK PR sequence (~3-4 PR'а)

**PR 1 — extract stages в `crystallize_v2/index.js`.**
- Inline pipeline разбивается на 5 named stages с return'ом промежуточных артефактов
- `crystallize` возвращает `{ artifact, stages: { semanticArtifact, structuralArtifact, layoutArtifact, patternedArtifact } }` (back-compat: `artifact` остаётся root-level export'ом)
- 0 breaking changes, существующие тесты прогоняются

**PR 2 — witness `stage`-поле.**
- `witnessBuilders/*.js` emit'ят `stage: "semantic" | "structural" | "layout" | "pattern" | "final"` в зависимости от фазы
- `derivationWitnesses.js` (R-rules) получают `stage` по таблице правил → фаз
- `applyStructuralPatterns.js` всегда emit'ит `stage: "pattern"`
- 0 breaking changes (поле опциональное)

**PR 3 — property-tests per stage.**
- `packages/core/src/__tests__/per-stage-properties/*.test.js` — 4 файла:
  - semantic-conservation
  - structural-reachability
  - pattern-idempotency
  - reader-equivalence-semantic
- Прогоняются для всех 13 host доменов (через test fixtures)

**PR 4 (optional) — `explainCrystallize()` per-stage tree.**
- Уже зафиксирован в `debugging-derived-ui-spec.md` как часть §28 v2.1
- IR-stages меняет только shape результата (stages-tree вместо flat-list)

### 4.2 Manifest v2.1 главa

Новая глава в Часть III («Алгебра») или §28.bis в Часть V («Авторство»):

> **§29. IR-stages — внутренняя структура `crystallize`.**
>
> Функция `crystallize(intents, ontology, projection)` факторизуется через 5 промежуточных артефактов: `semantic → structural → layout → patterned → final`. Каждая стадия — pure function от предыдущей. Каждый witness в `artifact.witnesses[]` несёт поле `stage`, идентифицирующее фазу emission'а. Property-tests проверяют conservation / reachability / idempotency / reader-equivalence на каждой стадии независимо.
>
> **Почему это в формате, а не в реализации.** Внешние авторы (cross-stack idf-go / idf-rust / idf-swift) должны видеть одинаковую stage-декомпозицию, иначе drift-protection Layer 3 reader-equivalence не реализуем дифференциально. Поэтому stage-факторизация и witness `stage`-поле — часть L2 conformance, не L3.

### 4.3 idf-spec L2/L3 (опционально)

L2 conformance class **MAY** require что artifact exposes per-stage snapshots. L3 (если когда-нибудь придёт) **MUST**: cross-stack differential test пропускает только если все 4 реализации совпадают per-stage, не только final.

## 5. Зависимости и порядок

**§2.8 Φ schema-versioning первым.** IR-stages работает на «срезе во времени» одной онтологии. Без schema-versioning legacy Φ интерпретируется через текущую онтологию — stages становятся undefined behavior на старых эффектах. Сделать stages раньше = переделывать после §2.8.

**Manifest v2.1 finalize вторым.** §28 (Debugging derived UI) уже содержит witness-`basis`. IR-stages добавляет `stage`-ось ортогонально. Логично: §28 формулирует, IR-stages финализирует структуру witness-trail'а.

**Параллельно §2.12 (sheaf) и §2.13 (ergonomic).**
- Sheaf — горизонтальная композиция (по ролям, cross-domain, formal structure).
- Ergonomic — apriori behavioral predictions поверх final artifact'а.
- IR-stages — вертикальная композиция (внутри одной crystallize-проходки).

Три направления независимы и дополняют друг друга на разных осях.

**Drift-protection (manifest v2.1, 3 detector layers)** — IR-stages даёт structural foundation для layered detector'ов:
- Layer 1 (conformance-drift override-coefficient) — на `patternedArtifact`
- Layer 2 (alpha-fb salience) — на `semanticArtifact`
- Layer 3 (reader-equivalence) — на `semanticArtifact`, не на final
- Layer 4 (legacy-data-equivalence, добавлен §2.8) — на `semanticArtifact` × Φ schema versions

Без stages эти detector'ы flat и взаимно-зависимы; со stages они становятся независимо реализуемыми.

## 6. Метрика успеха

- **Diff-able артефакты** — `derivation-diff --stage X` показывает per-stage delta для двух ontology-версий одного домена
- **Property-test coverage** — 4 test'а per-stage прогоняются в SDK CI для 13 host доменов
- **`explainCrystallize()` tree-shape** — Studio Crystallize Inspector (§27) показывает stages-drill-down вместо flat-witnesses
- **Drift-protection Layer 3 реализован** — reader-equivalence runtime-check существует поверх `semanticArtifact` (a не пытается это делать на final output, что сейчас невозможно)
- **Через 6 mo internal ADR** — нужна ли реальная typed-IR-инфраструктура (MLIR-style) или organizational stages достаточно

## 7. Риски

- **Stage-границы не идеально совпадают с MLIR абстракциями.** Reviewer ожидает чистую лестницу; реальный `crystallize_v2` имеет cross-stage dependencies (например, `applyStructuralPatterns` может ре-anchor'ить intent'ы при apply hero-create). Решение: stage — это «point of inspection», не «point of immutability». Allow cross-stage feedback но фиксируй witness'ы перехода.
- **Property-tests могут оказаться medium-effort.** Particularly reader-equivalence-semantic требует formal model четырёх reader'ов. Mitigation: первый PR закрывает 2 простых property (conservation + reachability), reader-equivalence — отдельный PR после §2.8 closeout.
- **Pattern Bank rewrite-rules с pre/post-condition'ами** — звучит хорошо, но 35 существующих паттернов не написаны под этот контракт. Migration cost высокий. Решение: новые паттерны с pre/post, существующие — graceful (без pre/post условий, описание в `rationale`).
- **Over-formalization risk.** MLIR-style лестница — sales-pitch для математически-настроенных reviewer'ов; для domain authors (PM-grade) она бесполезна. Mitigation: stages exposed только в `explainCrystallize()` для Studio Inspector; в обычной authoring-сессии invisible.

## 8. Альтернативы

- **«Ничего не делать, witness'ов достаточно»** — текущий статус. Работает для simple cases, ломается на «78% правильный» артефакт (§28 problem statement).
- **«Полная MLIR-инфраструктура»** — typed dialects, tablegen, lowering. Цена 10× value. Отвергнуто как over-engineering.
- **«Stages только в documentation, не в коде»** — назвать фазы в манифесте, но pipeline оставить inline. Не даёт diff-able артефактов и property-tests. Промежуточный compromise — отвергнуто как half-measure.

## 9. Open questions

- **`stage`-поле на witness'ах R8 hub-absorption** — где emit'ить? Hub-absorb меняет structural shape (`stage: "structural"`), но witness обращается к R-rule (`basis: "structural-rule"`). Решение: `stage` — фаза emission'а, `basis` — источник правила. Они независимы.
- **Final stage `wrapByConfirmation`** — стоит ли это отдельной стадией или подэтапом `patterned`? Argument'ы за: confirmation — это transformation slots, не pattern. Argument'ы против: для большинства доменов final ≡ patterned (нет destructive intents с `__irr`). Решение: deferred до PR 1 implementation, посмотреть что естественнее.
- **Cross-stack consistency** — должны ли idf-go / idf-rust / idf-swift exposes те же 5 стадий с identical names? Argument'ы за: differential test reader-equivalence per-stage. Argument'ы против: implementations могут иметь разные decomposition'ы для perf reasons. Решение: L2 conformance MAY, L3 MUST (если L3 когда-нибудь reach'ится).

## 10. References

- External review 2026-04-26 (8th letter) — origin зацепки, MLIR-аналогия
- `~/WebstormProjects/idf/docs/manifesto-v2.md` Часть III (Алгебра), Часть IV (4 reader'а), §23 (axiom 5 reader-equivalence)
- `~/WebstormProjects/idf-manifest-v2.1/docs/design/debugging-derived-ui-spec.md` §28 — witness-`basis`, репo hierarchy
- `~/WebstormProjects/idf-manifest-v2.1/docs/design/drift-protection-spec.md` — 3 detector layers (conformance / override-coeff / reader-equivalence)
- `~/WebstormProjects/idf-sdk/packages/core/src/crystallize_v2/index.js` — текущий inline pipeline
- `~/WebstormProjects/idf-sdk/packages/core/src/crystallize_v2/derivationWitnesses.js` — R1-R10 witness builders
- `docs/backlog.md` §2.8 (Φ schema-versioning, P0-arch, blocking) / §2.12 (sheaf, parallel) / §2.13 (ergonomic, parallel) / §2.14 (этот item)
- `docs/design/2026-04-26-phi-schema-versioning-spec.md` (P0-arch dependency)
- `docs/design/2026-04-26-sheaf-formulation-spec.md` (parallel — horizontal composition)
- `docs/design/2026-04-26-ergonomic-laws-spec.md` (parallel — behavioral predictions)
- MLIR — https://mlir.llvm.org/ — reference, не dependency

---

**Owner:** `@intent-driven/core/crystallize_v2/*` (extract stages, witness `stage`) + manifest v2.1 (новая глава §29 или §28.bis) + `idf-spec` (опционально L2/L3 conformance).

**Когда закрывать.** После §2.8 closeout, до публикации manifest v2.1. Реализационная стоимость — 3-4 SDK PR'а (extract + witness + property-tests + explainCrystallize tree).
