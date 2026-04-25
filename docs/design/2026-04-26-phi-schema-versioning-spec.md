# Design — Φ schema-versioning + ontology evolution + reader gap policy

**Дата:** 2026-04-26
**Статус:** Draft / problem statement (не implementation plan).
**Источник:** External design review 2026-04-26.
**Backlog item:** `docs/backlog.md` §2.8.
**Связь с manifest v2.1:** требует добавления главы «Эволюция онтологии» в Часть III (Алгебра); расширяет `drift-protection-spec.md` четвёртым detector'ом «legacy-data-equivalence».

---

## 1. Тезис

Манифест v2 формализует `world = fold(Φ_confirmed)` как timeless-формулу. Это **верно при фиксированной онтологии**. В реальности онтология эволюционирует; формат сегодня **не имеет** структурного ответа на эволюцию.

Это:

1. **Технически неизбежно** — у любого production-tenant'а через полгода накапливается legacy Φ, в схеме которого автор хочет менять поля/энумы/сущности/роли.
2. **Архитектурно блокирующе позже, чем сейчас** — цена решения растёт квадратично с числом доменов и линейно с возрастом каждого Φ. Решать **до** первого production pilot'а с Φ ≥ 10k effects и ≥ 6mo истории.
3. **Соблазнительно для LLM-shortcut** — «LLM прочитает legacy effect и поймёт его в новой онтологии» — поэтому ответ должен быть **жёстким архитектурным запретом** runtime-LLM в upcast-pipeline. Иначе смерть детерминизма формата.
4. **Размножает сложность по 4 reader'ам** — pixels / voice / agent / document по-разному реагируют на legacy gap. Reader-equivalence (§23 axiom 5) **уже формально нарушается** на legacy data.

---

## 2. Текущее состояние

### Что есть как полу-ответ

| Механизм | Где | Что покрывает |
|---|---|---|
| `spec.renames` | studio PR #28 | Декларативное переименование entity/field, idempotent JSONB update. **Только** renames, **только** одна транзакция. |
| Breaking-commit gate | studio #26 | Превентивная блокировка deploy'я, ломающего legacy data. **Отказ**, не миграция. |
| Φ snapshot/restore | studio #27 | «Откатимся к pre-deploy». Не «прочтём legacy в новой схеме». |
| `effect.context.actor` | runtime | Provenance события (кто эмиттил), не схемы. |
| `materializeAuditLog` | core | Read Φ для observer-роли, без schema-aware lens. |

### Чего нет

1. **`effect.context.schemaVersion`** — эффект не помнит свою онтологию. Сейчас `fold(Φ)` интерпретирует все эффекты через **текущий** `domain.json`, без учёта момента эмиссии.
2. **Φ-аналог для самой онтологии** — append-only лог evolution, где каждая запись = `{ hash, parentHash, timestamp, diff, upcasters }`. Сейчас `domain.json` живёт как plain JSONB в `projects.domainJson` в Postgres — git-история есть, но не в формате, не в Φ.
3. **`ontology.upcasts: [{ fromHash, toHash, fn }]`** — first-class artifact, который превращает legacy effect в new-schema effect. Декларативно или функционально (см. §4).
4. **Reader gap policy** — формальный контракт «как reader N ведёт себя при missing field / unknown enum value / removed entity reference». Сейчас 4 reader'а graceful'ничают как могут, без общего контракта. Именно здесь reader-equivalence ломается на legacy data.

---

## 3. Четыре сценария боли (проверены внешним review)

| Сценарий | Сейчас | Куда хотим |
|---|---|---|
| **Новое поле** `task.priority` появилось в v2; в v1 не было. | `fold` возвращает `undefined`. Pixels рендерят пусто. Voice промолчит. Agent JSON отдаст без ключа. Document — «—». 4 поведения, не одно. | Reader gap policy декларирует default per reader для new-field-gap. Опц. — upcast подставляет declarative default из ontology. |
| **Сжатый enum** `status: open\|done` → `draft\|active\|done\|archived`. Legacy effect пишет `"open"`, которого больше нет в `valueLabels`. | `assignToSlotsCatalog` встречает unknown в `valueLabels` → renderer crash (был на практике). Транзишн-инвариант проверялся на confirm, не пере-валидируется. | Upcast: `"open" → "active"` (mapping в `upcasts[]`). Без upcast — reader gap policy: `placeholder` для unknown enum. |
| **Split entity** `task` → `task` + `subtask`. | Никак. Старые `task.created` остаются в старом entity. Совмещения нет — список tasks показывает только новые. | Upcast: `task.kind === "child"` row → emit synthetic `subtask.created` effect. Lineage: `subtask.derivedFrom: <originalEffectId>`. |
| **Ужесточение роли** `viewer` потеряла право на read of `Salary.amount`. | Эффекты в Φ не пере-валидируются (audit trail не переписывается). Но `filterWorldForRole` фильтрует на чтении по **текущей** ontology — viewer перестаёт видеть свою историю. | Per-row schemaVersion → role-policy on read. «На момент этого эффекта viewer **имел** право — показать с пометкой `[legacy-permission]`». |

---

## 4. Предлагаемый минимальный контракт

### 4.1 Schema-tag per effect

```ts
type Effect = {
  id: string;
  alpha: "create" | "replace" | "remove" | "update" | "read";
  entity: string;
  fields: Record<string, unknown>;
  context: {
    actor: string;
    schemaVersion: string;  // ← новое: hash domain.json на момент confirm
    __irr?: { point: "high"; at: string; reason?: string };
    [key: string]: unknown;
  };
};
```

**Stability:** zero migration через JSON. Старые эффекты получают `schemaVersion: "unknown"` — это значит «применять текущую онтологию без upcast» (текущее поведение).

### 4.2 Ontology evolution log

```ts
type OntologyVersion = {
  hash: string;
  parentHash: string | null;
  timestamp: string;
  authorId: string;
  diff: {
    addedFields: Array<{ entity: string; field: string; default?: unknown }>;
    removedFields: Array<{ entity: string; field: string }>;
    renamedFields: Array<{ entity: string; from: string; to: string }>;
    enumChanges: Array<{ entity: string; field: string; mapping: Record<string, string | null> }>;
    splitEntities: Array<{ from: string; into: string[]; discriminator: string }>;
    roleChanges: Array<{ role: string; diff: unknown }>;
    invariantsAdded: string[];
    invariantsRemoved: string[];
  };
  upcasters: Upcaster[];
};
```

Хранится append-only в самом домене — `ontology.evolution[]` или отдельный `evolution.json` рядом с `domain.json`.

### 4.3 Upcasters

```ts
type Upcaster = {
  fromHash: string;
  toHash: string;
  // декларативные миграции (большинство случаев)
  declarative?: {
    setDefault?: Array<{ entity: string; field: string; value: unknown }>;
    enumMap?: Array<{ entity: string; field: string; mapping: Record<string, string> }>;
    rename?: Array<{ entity: string; from: string; to: string }>;
    splitDiscriminator?: Array<{ from: string; field: string; mapping: Record<string, string> }>;
  };
  // функциональные миграции (escape hatch для сложных)
  fn?: (effect: Effect, world: World) => Effect | Effect[] | null;
};
```

**Жёсткий запрет:** `fn` — design-time TypeScript / JS код, написанный человеком (опц. сгенерированный LLM, но **зафиксированный в репо** и протестированный). **Никогда** не runtime-LLM. Это размывает детерминизм формата — главный аргумент против «LLM в рантайме».

### 4.4 fold с upcast

```ts
// было:
world = fold(Φ_confirmed);

// стало:
world = fold(upcast(Φ_confirmed, currentSchema));

function upcast(effects: Effect[], target: OntologyVersion): Effect[] {
  return effects.flatMap(e => {
    const path = pathFromTo(e.context.schemaVersion, target.hash);
    return path.reduce((acc, step) => acc.flatMap(eff => applyUpcaster(eff, step)), [e]);
  });
}
```

**Caching:** upcast deterministic per (effects-prefix, target-hash) — кэшировать в Φ-снапшотах.

### 4.5 Reader gap policy

Каждый reader декларирует strategy в core:

```ts
type ReaderGapPolicy = {
  missingField: "hidden" | "omit" | "placeholder" | "error";
  unknownEnumValue: "passthrough" | "placeholder" | "error";
  removedEntityRef: "broken-link" | "omit" | "error";
};

const POLICIES = {
  pixels:   { missingField: "hidden",      unknownEnumValue: "passthrough", removedEntityRef: "broken-link" },
  voice:    { missingField: "omit",        unknownEnumValue: "omit",        removedEntityRef: "omit" },
  agent:    { missingField: "omit",        unknownEnumValue: "passthrough", removedEntityRef: "broken-link" },
  document: { missingField: "placeholder", unknownEnumValue: "placeholder", removedEntityRef: "broken-link" },
};
```

**Reader-equivalence** обновляется: «equivalent **information content under the same gap policy**». Это аксиома формата — все 4 reader'а должны давать одинаковый набор «здесь была информация / здесь её не было / здесь она stale» под одной policy.

Layer 4 detector в `drift-protection-spec.md`: проверяет, что output 4 reader'ов на одной legacy slice Φ имеет совпадающий gap-set (где-то поле missing → у всех или ни у кого).

---

## 5. Что это меняет в манифесте v2.1

1. **Часть III (Алгебра):** глава «Эволюция онтологии». Формула обновляется: `world = fold(upcast(Φ, schema_t))`. Доказательство: `upcast` композициональна (`upcast(upcast(Φ, A→B), B→C) = upcast(Φ, A→C)`); `fold` over `upcast` det'енн при det'енных upcasters.
2. **Часть IV (Четыре читателя):** каждый reader декларирует gap policy как часть своего контракта. Reader-equivalence — под единой policy.
3. **Часть VI (Conformance):** L3 conformance class добавляет «schema evolution support»: реализация должна принимать `schemaVersion` в context, применять upcasters, поддерживать reader gap policy.

---

## 6. Что не делает этот документ

- Не пишет имплементацию. Это design draft под backlog item §2.8.
- Не покрывает federation Φ (cross-tenant). Это §2.10 в backlog.
- Не покрывает design-time provenance (кто LLM/human принял intent). §2.9 в backlog.
- Не отвечает «когда мы это делаем». Решение — **до первого production pilot'а с Φ ≥ 10k effects**, на рефлекторно-предохранительном горизонте.

---

## 7. Open questions

- **Upcaster generation by LLM в design-time** — допустимо? (Я считаю да, при обязательном code review + тесты на golden Φ.)
- **Кто пишет upcasters** — автор онтологии или платформа? У OpenAPI / GraphQL нет аналога; ближайшие — Liquibase / Flyway / Prisma migrate. Вероятно — autoor + LLM-suggest, как сейчас с invariants.
- **Lossy upcasts** — что если split-entity не реверсивен? Markirovat' `lossy: true`, требовать explicit author confirmation в studio.
- **Φ federation + schema-versioning** — два orthogonal вопроса; их пересечение (cross-tenant cross-version) — отдельная боль.

---

## 8. Acceptance — что должно быть готово, чтобы закрыть backlog §2.8

- [ ] `effect.context.schemaVersion` принимается ядром, persists в Φ, не ломает legacy fold.
- [ ] `ontology.evolution[]` append-only лог формализован в JSON Schema.
- [ ] `applyUpcaster` (declarative + fn) реализован в `@intent-driven/core`.
- [ ] `fold(upcast(Φ, schema))` в production-ready для всех 4 readers.
- [ ] Reader gap policy реализована и документирована.
- [ ] Layer 4 detector в drift-protection-spec — runtime check.
- [ ] Manifest v2.1 — глава «Эволюция онтологии» merged.
- [ ] L3 conformance class — fixtures + L3 test runner.
- [ ] Минимум 2 реальных upcast'а в production tenant'е (один declarative, один functional).
