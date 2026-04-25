# Design — Эргономические законы как формальные предсказания над артефактом

**Дата:** 2026-04-26
**Статус:** Draft / direction note + operational extracts (§2.13a, §2.13b — P2, реализуемы сейчас).
**Категория:** Операционное (не «формализация ядра» как §2.12 sheaf).
**Severity:** Вторичное. Не на критическом пути M1.x.
**Источник:** External design review 2026-04-26 (седьмое письмо).
**Backlog item:** `docs/backlog.md` §2.13.
**Связь с manifest v2.1:** возможный абзац в Часть IV (Четыре читателя): ergonomic prediction как часть pixel-reader contract.

---

## 1. Тезис

Crystallize сейчас выбирает архетип / pattern / slot assignment через эвристики (signal classifier, salience ladder, Pattern Bank apply). Эти эвристики **rule-based и качественные**. Эргономические законы добавляют **количественный слой** — predictive model из geometry + structure артефакта.

В отличие от §2.12 (sheaf) — это **не reframing существующего**, а **внешняя наука** с собственными законами. Reference: Card/Moran/Newell 1983 (фундамент quantitative HCI), CogTool (Bonnie John 2004+), 50+ лет экспериментальной валидации Fitts.

**Что закрывает.** §2.13/§2.14/§2.15 (термодинамика / IB / variational — отклонённые) имели общий blocker: требовали ground truth / production telemetry / measurable cognitive_load. Эргономика **дает apriori predictive model**, computable из static artifact'а — без production users.

---

## 2. Релевантные законы

### 2.1 Fitts (1954)

```
MT = a + b · log₂(D / W + 1)
```

Время достижения цели мышью / тачем = функция от расстояния `D` и размера цели `W`. Constants `a, b` зависят от input device (mouse: `b ≈ 0.1`; touch: `b ≈ 0.18`).

**В IDF:** clickable elements должны respect minimum target size. WCAG 2.5.5 (AA) = 44×44 CSS px — это baseline. На touch devices — больше. Pattern Bank `pattern.structure.apply` генерирует clickable nodes; их размер зависит от adapter rendering — нужна декларация в `adapter.capabilities`.

### 2.2 Hick-Hyman (1953)

```
RT = a + b · log₂(N + 1)
```

Время выбора из `N` вариантов — логарифм от N. **Точность падает на complex visual stimuli** (модель работает для simple choice tasks, не для product catalog). Но базовый трейд-офф «больше choices = больше cognitive cost» — устойчив.

**В IDF:** slot с большим N items (toolbar с 15 кнопками, top-level nav из 12 проекций) — choice overload. Threshold по разной литературе ~7±2. Используем 7 как conservative bound.

### 2.3 Cowan (2001), обновлённый Miller (1956)

```
working_memory ≈ 4 chunks (careful experimental control)
                ≈ 7±2 (relaxed estimate, оригинал Miller)
```

Cowan 2001 показал: при careful experimental control simultaneous WM capacity ≈ **4**, не 7. Это **не «items на экране»**, а **simultaneously held in mind** chunks для task execution.

**В IDF:** не имеет смысла warning'ить за catalog с 30 cards (user скан'ит, не удерживает). Имеет смысл warning'ить за:
- Top-level navigation > 4 distinct visual groups (transitions между ними нагружают WM)
- Form с > 7 visible fields одновременно (parallel filling нагружает WM)
- Wizard step с > 5 decisions (combinatorial WM при transitions)

### 2.4 Cognitive Load Theory (Sweller 1988+)

Три типа load:
- **Intrinsic** — inherent to task (нельзя минимизировать без изменения task)
- **Extraneous** — добавлен интерфейсом сверх задачи (минимизировать)
- **Germane** — load на schema construction для будущего (учиться использовать UI)

**В IDF:** extraneous load = «UI noise» = поля и controls, не нужные для текущего intent'а. §2.14 IB предложил formalize через `I(field; intent_set)` — отклонено как requiring P(intent|world). Эргономика даёт **более прагматичный подход**: count «irrelevant visual elements» per intent — heuristic, не optimizer.

### 2.5 GOMS (Card-Moran-Newell 1983)

Predicted task completion time из:
- **Goals** (что делает user)
- **Operators** (atomic actions: keypress 0.2s, point 1.1s, mental prep 1.35s)
- **Methods** (sequence operators для goal)
- **Selection rules** (когда какой method)

**Tools:** **CogTool** (Bonnie John 2004+) — software, который из storyboard / static UI генерирует GOMS prediction. Open-source, mature.

**В IDF:** для каждого `(intent, adapter, ontology)` triple можно посчитать predicted task completion time. Это даёт **quantitative comparison** двух adapter'ов на одной projection — без telemetry. **Это самый амбициозный extract** и возможный original вклад в industry.

---

## 3. Операционные подзадачи (P2, реализуемы сейчас)

### 3.1 §2.13a Fitts target-size axis

**В `adapter.capabilities`** добавить declared constants:

```ts
type AdapterCapabilities = {
  // ... existing fields
  minTargetSize: { width: number; height: number };  // CSS px
  density: "compact" | "comfortable";
};
```

Defaults: `{ width: 44, height: 44 }` (WCAG 2.5.5 AA baseline).

**В `scripts/audit-report.mjs`** — новая ось «target-size»:
- Для каждого pattern, генерирующего clickable element, проверить declared size против `adapter.capabilities.minTargetSize`.
- Warning «target below WCAG AA» для violations.

Реализуется без change crystallize logic — declarative + lint.

### 3.2 §2.13b Working-memory axis

**В `scripts/audit-report.mjs`** — новая ось «working-memory» с тремя проверками:

```js
// 1. Choice overload (Hick-Hyman)
for (slot of artifact.slots) {
  if (slot.items.length > 7) {
    warn(`choice overload at ${slot.id}: ${slot.items.length} items, рассмотри faceted-filter-panel или paginate`);
  }
}

// 2. Top-level navigation (Cowan)
const rootGroups = countDistinctVisualGroups(ROOT_PROJECTIONS, role);
if (rootGroups > 4) {
  warn(`working-memory overload at top level: ${rootGroups} groups, рассмотри R8 hub-absorption или group via shape`);
}

// 3. Form complexity
for (proj of projections.filter(p => p.archetype === "form" || p.archetype === "wizard")) {
  const visibleFields = proj.slots.body.fields.length;
  if (visibleFields > 7) {
    warn(`form complexity at ${proj.id}: ${visibleFields} fields, рассмотри tabbedForm или wizard split`);
  }
}
```

Полиномиальный pass (counting). Не требует GOMS-симуляции.

### 3.3 §2.13c GOMS-prediction для adapter benchmarking (deferred research)

**Что реализуется:** для каждого `(intent, adapter, ontology)` triple — predicted task completion time через GOMS-style operators.

**Зачем:** quantitative `adapter recommendation`. Author создаёт projection → IDE предлагает «mantine: 4.2s, antd: 3.8s, shadcn: 4.5s — рекомендуем antd по time + a11y». Это **operational вклад в industry**.

**Когда:** после первого production tenant'а с usage logs для validation predictions. До этого — pure prediction без grounding.

**Что нужно:**
- Adapter renders с position/size info (можно симулировать с jsdom + computed styles).
- Task script per intent (последовательность user actions для achieving intent).
- GOMS operators library.
- Validation harness (predictions vs measured times на N users).

**Reference:** CogTool architecture (Bonnie John 2004), KLM (Card 1980).

---

## 4. Что **не** делает этот документ

- Не пишет полную «эргономическую теорию IDF» — overengineering.
- Не реализует GOMS-prediction в core (deferred до production telemetry).
- Не заменяет Pattern Bank rule-based логику optimization framework'ом — сила Pattern Bank в **explicit rules**, не в **emergent optimization**.
- Не претендует на predictive accuracy > 70% — GOMS practical accuracy ≈ 20-40%, используется для **screening** и **comparing alternatives**, не fine-grained ranking.

---

## 5. Open questions

1. **Adapter touch / keyboard / mouse mode.** Fitts constants разные. Capability surface должна декларировать input modality assumptions.
2. **Density variants per adapter.** AntD «compact» density меняет minTargetSize. Capability surface — variant-aware?
3. **GOMS task script generation.** Из intent declaration → user action sequence. Для simple intents (CRUD) tractable; для complex (multi-step wizard, dependent fields) — tricky.
4. **Cross-cultural ergonomics.** RTL languages, fingers vs cursor — Fitts constants культурно-зависимы. Calibration?
5. **Mobile vs desktop.** Адаптеры пока desktop-first (mantine, antd, apple). lifequest на shadcn — mobile-first. Capability должна учитывать viewport assumptions.

---

## 6. Acceptance — что должно быть готово, чтобы закрыть §2.13

- [ ] §2.13a реализована: `adapter.capabilities.minTargetSize` объявлено для всех 4 bundled-адаптеров; «target-size» ось в audit-report — green на всех 13 доменах после первого прогона.
- [ ] §2.13b реализована: «working-memory» ось warning'ит реальные находки в текущих доменах (sales 225 intents, messenger 100, keycloak 256 — кандидаты на choice overload).
- [ ] (Deferred) §2.13c — GOMS-prediction harness, после первого production tenant'а.
- [ ] (Optional) Manifest v2.1 — новый абзац в Часть IV (Четыре читателя) о ergonomic prediction как части pixel-reader contract.

§2.13a и §2.13b — **самостоятельные** P2-tasks, делать в обычном потоке. §2.13c — research-grade, не commitment.
