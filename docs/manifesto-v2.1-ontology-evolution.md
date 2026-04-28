# Manifesto v2.1 — Глава «Эволюция онтологии»

**Статус:** draft chapter, готов к интеграции в Часть III манифеста v2.1.
**Источник:** [Design-spec](design/2026-04-26-phi-schema-versioning-spec.md) от 2026-04-26 (внешний review).
**Имплементация:** Phase 0–5 shipped в `@intent-driven/core@0.107.0..0.111.0` (idf-sdk PRs #443/#445/#447/#449/#451/#453, все merged 2026-04-28).

---

## Тезис

Манифест v2 формализует `world = fold(Φ_confirmed)` как timeless-формулу. Эта формула **верна при фиксированной онтологии**. В реальности онтология эволюционирует; эффект, эмиттенный год назад, мог использовать поля, которых сегодня нет, или enum-значения, которые были переименованы.

Без структурного ответа на эволюцию формат через 6 месяцев production'а у любого pilot-tenant'а получает silent corruption: `fold(Φ)` интерпретирует legacy-эффекты через **текущий** `domain.json`, не помня момента эмиссии.

Эта глава нормирует ответ:

```
world = fold(upcast(Φ_confirmed, schema_t))
```

`upcast` — детерминированная функция, читающая `effect.context.schemaVersion`, ища цепочку `Upcaster`'ов в `ontology.evolution[]` от исходной до целевой схемы и применяя её. **Никакого runtime-LLM** в цепочке — это аксиоматический запрет, иначе теряется детерминизм формата.

---

## §A. Schema-version per effect

### Контракт

Каждый эффект в Φ обязан содержать `effect.context.schemaVersion: string` — стабильный хэш онтологии на момент `confirm`.

```ts
type Effect = {
  // ... существующие поля ...
  context: {
    actor?: string;
    __irr?: { point: "high"; at: string };
    schemaVersion: string;  // ← новое
    [key: string]: unknown;
  };
};
```

### Sentinel `"unknown"`

Эффекты, эмиттенные **до** Phase 1 имплементации, не имеют тега. При чтении такие эффекты получают sentinel `UNKNOWN_SCHEMA_VERSION = "unknown"`.

`upcast` интерпретирует `unknown` как «применять полную цепочку upcaster'ов от root до target». Это даёт zero-migration: legacy Φ работает без переписывания.

### Hash function

`schemaVersion` вычисляется через детерминированный алгоритм:

1. Канонизация JSON: рекурсивная сортировка ключей объектов; массивы сохраняют порядок (он семантичен).
2. cyrb53 (53-bit pure-JS hash) поверх канонизированной строки.
3. Hex zero-pad до 14 символов.

Алгоритм формализован в `@intent-driven/core/schemaVersion.js` JSDoc. **Cross-stack импл'ы (idf-go / idf-rust / idf-swift) обязаны соблюдать тот же алгоритм** — иначе хэши не совпадут и cross-stack Φ не будет shareable.

Замена на SHA-256 в будущем — отдельный versioning-event самой hash-функции, требующий координации всех stack'ов.

---

## §B. Evolution log

Онтология хранит **append-only** лог своей эволюции:

```ts
type Ontology = {
  // ... существующие поля ...
  evolution?: OntologyVersion[];
};

type OntologyVersion = {
  hash: string;              // совпадает с hashOntology(ontologyAtThisVersion)
  parentHash: string | null; // null для root
  timestamp: string;          // ISO-8601
  authorId: string;
  diff: EvolutionDiff;       // см. §C
  upcasters?: Upcaster[];    // см. §D — обычно непусто, кроме root
};
```

Лог — линейная цепочка (DAG без branches). Каждый entry знает свой parent через `parentHash`. Цепочка от любого entry до root — детерминирована.

### Инварианты

- `addEvolutionEntry(ontology, entry)` обязан проверять: `entry.parentHash === getCurrentVersionHash(ontology)`.
- Дублирование `hash` запрещено.
- Безопасное чтение цепочки (`getAncestry`) защищено от циклов и broken-chain состояний — возвращает `[]` если root недостижим.

### Где хранить

Лог живёт **в самой онтологии** — `ontology.evolution[]`. Это даёт:

- Self-contained: онтология возит свою историю с собой; cross-stack reader получает всё в одном файле.
- Single source of truth: git-история редактирований domain.json не теряется при copy / fork / migration.
- Проверяемость: hash entry должен совпадать с `hashOntology(ontology_at_that_time)`, что даёт independent validation.

---

## §C. Evolution diff

`EvolutionDiff` декларирует, **что именно** изменилось от parent до этой версии:

```ts
type EvolutionDiff = {
  addedFields:    Array<{ entity: string; field: string; default?: unknown }>;
  removedFields:  Array<{ entity: string; field: string }>;
  renamedFields:  Array<{ entity: string; from: string; to: string }>;
  enumChanges:    Array<{ entity: string; field: string; mapping: Record<string, string | null> }>;
  splitEntities:  Array<{ from: string; into: string[]; discriminator: string }>;
  roleChanges:    Array<{ role: string; diff: unknown }>;
  invariantsAdded:    string[];
  invariantsRemoved:  string[];
};
```

Diff — **информационный**. Сам по себе он не делает миграции; миграции делают `upcasters[]` (§D), которые обычно соответствуют diff'у 1-к-1 (rename → applyRename и т.д.), но могут расходиться (например, `removedFields` может не требовать upcaster'а если поле fading-out терпимо к gap'у).

---

## §D. Upcasters

`Upcaster` — это шаг трансформации эффекта при upcast'е от одной онтологии до соседней (`fromHash → toHash`).

```ts
type Upcaster = {
  fromHash: string;
  toHash: string;
  declarative?: {
    rename?:             Array<{ entity, from, to }>;
    splitDiscriminator?: Array<{ from, field, mapping }>;
    setDefault?:         Array<{ entity, field, value }>;
    enumMap?:            Array<{ entity, field, mapping }>;
  };
  fn?: (effect: Effect, world: World) => Effect | Effect[] | null;
};
```

### Декларативные шаги (фиксированный порядок)

Применяются в **нормативном порядке** для cross-stack совместимости:

1. **`rename`** — канонизация имён полей (`context[from] → context[to]` + target rewrite).
2. **`splitDiscriminator`** — переезд эффекта в новую сущность по дискриминатору; lineage `__derivedFrom`.
3. **`setDefault`** — заполнение missing-полей (только для `α=add`, partial-merge для replace/remove не трогаем).
4. **`enumMap`** — old → new value mapping.

Изменение порядка = breaking change самого upcast-протокола.

### Functional escape hatch

`fn` — JS-функция `(effect, world) => Effect | Effect[] | null`:

- `Effect` — обычная single-effect трансформация
- `Effect[]` — split (один эффект в несколько производных)
- `null` — drop эффекта (legacy noop, sensitive removal)

**Жёсткий запрет:** `fn` — design-time JS-код, написанный человеком (опц. сгенерированный LLM, но **зафиксированный в репо** и протестированный). **Никогда** не runtime-LLM. Это размывает детерминизм формата — главный аргумент против «LLM в рантайме». Reviewer обязан отвергнуть PR, в котором `fn` тянет наружу к LLM API.

### Композиция

Цепочка upcaster'ов через несколько versions композициональна:

```
upcast(upcast(Φ, A→B), B→C) ≡ upcast(Φ, A→C)
```

Доказательство: каждый upcaster — детерминированная pure-функция `Effect | World → Effect | Effect[] | null`. Композиция таких функций ассоциативна; порядок применения определён ancestry'ем в evolution log; результат не зависит от того, считаем ли мы шаги по-одному или композицию сразу.

Если в цепочке есть `fn`, требующий доступ к `world`, то `world` пере-фолдится после каждого split'а — это часть определения композиции, не нарушение её.

### Deterministic при det'енных шагах

`fold(upcast(Φ, schema_t))` детерминирован при выполнении:

1. Все `declarative`-шаги pure (тривиально по определению).
2. Все `fn` — pure-функции without I/O без runtime-randomness (нормативное требование §D «жёсткий запрет»).
3. Hash-функция детерминирована (нормирована в §A).

Любой реализатор, нарушивший один из трёх пунктов, не conformant к L3-evolution.

---

## §E. Reader gap policy

§E **обновляет §17 (Voice) / §18 (Document) / §15 (Pixels) / §16 (Agent API)** манифеста v2 единым контрактом обработки legacy-data gap'ов.

### Три типа gap

- **`missingField`** — поле отсутствует в эффекте (legacy effect до того, как поле было добавлено).
- **`unknownEnumValue`** — значение не входит в текущий enum (упразднено или переименовано без upcaster'а).
- **`removedEntityRef`** — ref-поле указывает на сущность, которой нет в world.

### Шесть стратегий разрешения

| Action | Семантика |
|---|---|
| `hidden` | скрыть в UI, отметить в a11y / debug |
| `omit` | не упоминать вовсе (для voice / brevity) |
| `placeholder` | показать «—» / customizable |
| `passthrough` | показать original value as-is |
| `broken-link` | для refs: показать с отметкой broken |
| `error` | strict mode — surface как ошибку |

### Дефолтные policies

```
pixels:   { missing: hidden,      enum: passthrough, ref: broken-link }
voice:    { missing: omit,        enum: omit,        ref: omit }
agent:    { missing: omit,        enum: passthrough, ref: broken-link }
document: { missing: placeholder, enum: placeholder, ref: broken-link }
```

Эти дефолты — **нормативные** для conformant-импл'ов L3-evolution. Реализация может предложить per-tenant override, но дефолт обязан совпадать.

---

## §F. Reader-equivalence (обновление §23 axiom 5)

Манифест v2 §23 axiom 5 формулирует reader-equivalence: «4 материализации pixels / voice / agent / document на одной Φ-срезе должны отдавать изоморфный information content».

§F **уточняет** эту аксиому в условиях evolved Φ:

> Reader-equivalence = «equivalent information content **under the same gap policy**».

То есть: 4 reader'а должны быть согласованы по **gap-presence** (где-то поле missing → у всех или ни у кого), но **action может разниться** по policy. Это контракт.

Drift event = cell в scope ≥ 2 reader'ов, где gap-presence различается.

### Layer 4 detector

Runtime-проверка reader-equivalence через `detectReaderEquivalenceDrift(world, ontology, observations)`:

1. Compute canonical gap-set по core-логике (`computeCanonicalGapSet`).
2. Принять observations от N reader'ов.
3. Для каждой cell, попадающей в scope ≥ 2 reader'ов, проверить consistency.
4. Дивергенция → `DriftEvent` с агрегированными `agreeing[]` / `disagreeing[]` reader'ами.

Detector не сравнивает rendered output (HTML vs SSML vs JSON — incomparable shapes) и не проверяет equivalence actions (это контракт). Проверяется gap-presence — и только это.

---

## §G. L3 conformance class

L3-evolution — отдельная conformance class в `idf-spec`. Реализация L3-evolution conformant ↔ выполняет:

1. **§A** — `effect.context.schemaVersion` принимается, persists, не ломает legacy fold.
2. **§B** — `ontology.evolution[]` парсится по нормативной схеме.
3. **§D declarative** — все 4 шага в фиксированном порядке.
4. **§D fn** — fn выполняется без runtime-LLM.
5. **§D композиция** — цепочка `A → B → C` даёт тот же результат, что `A → C`.
6. **§E** — 4 reader policy дефолты совпадают со spec.
7. **§F** — Layer 4 detector доступен как runtime API.
8. **Hash compatibility** — cross-stack импл'ы дают одинаковый hash для одной онтологии.

L3-evolution дополняет существующий **L3-document** (нормирован в idf-spec v0.2.0). Полный L3 = L3-document + L3-evolution + L3-voice + L3-agent (последние две — Reserved для v0.3+).

---

## §H. Что эта глава **не** делает

- Не нормирует automated diff extraction `diffOntologies(prev, next)` — отложено до Studio-интеграции, где автор будет редактировать и diff будет считаться UI-side.
- Не покрывает Φ federation (cross-tenant). Это отдельный sprint в backlog §2.10.
- Не покрывает design-time provenance (кто LLM/human принял intent). §2.9 в backlog.
- Не отвечает на вопрос «когда мы это делаем». Решение — **до первого production pilot'а с Φ ≥ 10k effects**, на рефлекторно-предохранительном горизонте.

---

## §I. Acceptance — закрытие backlog §2.8

| # | Acceptance criterion | Status | Where |
|---|---|---|---|
| 1 | `effect.context.schemaVersion` принимается ядром | ✅ | core@0.107.0 (PR idf-sdk#443) |
| 2 | `ontology.evolution[]` формализован | ✅ | core@0.108.0 (PR idf-sdk#447) |
| 3 | `applyUpcaster` (decl + fn) реализован | ✅ | core@0.109.0 (PR idf-sdk#449) |
| 4 | `fold(upcast(Φ, schema))` production-ready | ✅ | core@0.109.0 — `foldWithUpcast` |
| 5 | Reader gap policy реализована | ✅ | core@0.110.0 (PR idf-sdk#451) |
| 6 | Layer 4 detector — runtime check | ✅ | core@0.111.0 (PR idf-sdk#453) |
| 7 | Manifest v2.1 — глава «Эволюция онтологии» merged | ✅ | этот документ (PR idf#TBD) |
| 8 | L3 conformance class — fixtures + runner | 🔜 | idf-spec L3-evolution (отдельный PR) |
| 9 | Минимум 2 реальных upcast'а в production tenant'е | 🔜 | первый production pilot |

Пункты 1–7 закрыты. Пункт 8 — отдельный PR в `idf-spec`. Пункт 9 — milestone первого production pilot'а (зависит от M1 контура — identity / runtime / studio plane'ы).
