# 2. Core semantics

Эта глава описывает семантику ядра IDF: потоки данных, форму эффекта, его жизненный цикл, причинный порядок, алгебру композиции, свёртку мира (`fold`), TTL, анкеринг и инварианты.

Нормативные JSON Schema'ы глав: [`effect.schema.json`](effect.schema.json) (v0.1).

## 2.1 Потоки данных

Система различает **четыре** потока эффектов. Реализация **MUST** обрабатывать их как логически отдельные коллекции, даже если физически хранит в одной таблице с различающим полем.

| Поток | Символ | Назначение | Участвует в `fold` |
|---|---|---|---|
| Поток эффектов | **Φ** | Первичная субстанция состояния. Хранит факты об изменениях мира. | да (`Φ_confirmed`) |
| Черновой поток | **Δ** | Персистентные, но не закоммиченные эффекты (корзина, черновик формы). | нет; свёртывается отдельно для зрителя-владельца |
| Поток сигналов | **Σ** | Транзиентные события (уведомления, внешние вызовы). | нет |
| Поток презентации | **Π** | Косметические эффекты (`scope: "presentation"`). | нет; применяется отдельным проходом `applyPresentation()` |

Поток **Φ** разбит на стадии жизненного цикла: `proposed`, `confirmed`, `rejected` (см. §2.3).

## 2.2 Effect shape

Эффект — атомарное декларативное утверждение об изменении мира. Нормативный shape:

```json
{
  "id": "ef_01JR...",
  "intent_id": "create_booking",
  "alpha": "add",
  "target": "bookings",
  "value": { ... },
  "scope": "account",
  "parent_id": null,
  "status": "confirmed",
  "ttl": null,
  "context": { "id": "b_1", "clientId": "u_2" },
  "created_at": 1776371410023,
  "resolved_at": 1776371410045
}
```

**Нормативные поля:**

| Поле | Тип | Нормативность | Значение |
|---|---|---|---|
| `id` | string | **MUST** | Уникальный идентификатор эффекта. |
| `alpha` | enum | **MUST** | `"add"` \| `"replace"` \| `"remove"` \| `"batch"`. |
| `target` | string | **MUST** | Путь — `"collection"` или `"collection.field"` (для `replace`). |
| `scope` | enum | **MUST** | `"session"` \| `"device"` \| `"account"` \| `"shared"` \| `"global"` \| `"presentation"`. |
| `status` | enum | **MUST** | `"proposed"` \| `"confirmed"` \| `"rejected"`. |
| `parent_id` | string \| null | **MUST** | Каузальный родитель; `null` — root-эффект. |
| `created_at` | integer | **MUST** | UNIX timestamp в миллисекундах. |
| `context` | object | **SHOULD** | Содержит `id` затрагиваемой сущности, плюс произвольные метаданные. |
| `value` | any | **MAY** | Данные (для `add` / `replace`/ `batch`). |
| `ttl` | integer \| null | **MAY** | Миллисекунды до автоматического `rejected`; `null` — без TTL. |
| `intent_id` | string | **SHOULD** | ID намерения-источника. |
| `resolved_at` | integer | **MAY** | UNIX ms, когда эффект перешёл в `confirmed` или `rejected`. |

Дополнительные поля в `context` **MAY** присутствовать. Два из них имеют специальную семантику:

- `context.__irr` — irreversibility marker (см. §2.11);
- `context.__witness` — witness-of-action (см. §2.12).

Conformant parser **MUST** игнорировать неизвестные поля в `context`, не падая.

## 2.3 Effect lifecycle

Эффект проходит линейную цепь состояний:

```
         (ingest)           (validate)
   ∅  ──────────▶ proposed ──────────▶ confirmed ──┐
                       │                           │
                       └──────────▶ rejected ◀─────┘
                                      ▲  (TTL expired | parent rejected | invariant violation)
                                      │
                                (cascade reject)
```

**Нормативные правила:**

1. Эффект **MUST** родиться в состоянии `proposed`.
2. Эффект **MUST** перейти в `confirmed` **или** `rejected`; оба состояния финальны.
3. Реализация **MUST** выполнить валидацию перед переходом в `confirmed`:
   - `parent_id`, если не null, **MUST** ссылаться на эффект, не находящийся в состоянии `rejected`;
   - intent-conditions **MUST** быть истинны в `World(t)`, где `t` — момент валидации;
   - если `alpha === "batch"` — **MUST** рекурсивно валидировать каждый под-эффект; **любой** невалидный под-эффект отвергает весь batch (all-or-nothing).
4. Если эффект переходит в `rejected`, реализация **MUST** каскадно отвергнуть все эффекты-потомки (`parent_id === id` транзитивно).
5. Переход `confirmed → rejected` допустим **только** по одной из причин: TTL-expiration, cascade reject от родителя, нарушение глобального инварианта (§2.14). В иных случаях `confirmed` — финальное состояние.

## 2.4 Causal order

Эффекты образуют DAG по полю `parent_id`. Перед свёрткой Φ **MUST** быть отсортирован топологически: родители применяются до потомков.

**Нормативный алгоритм (reference):** DFS с guard от циклов, `roots` (эффекты с `parent_id === null` или ссылающиеся на несуществующий/фильтрованный эффект) сортируются по `created_at` по возрастанию; siblings одного родителя — аналогично.

**Нормативные правила:**

1. Реализация **MUST** применять эффекты в порядке, совместимом с DAG `parent_id` (любой топологический порядок).
2. При равенстве каузального приоритета реализация **SHOULD** использовать `created_at` по возрастанию (для детерминированности).
3. Orphan-`parent_id` (ссылка на отсутствующий/отфильтрованный эффект) **MUST** трактоваться как root.
4. Циклы в DAG — некорректное состояние, но реализация **MUST NOT** падать; поведение при цикле не нормативно (reference falls back на `created_at`-сортировку).

## 2.5 Composition algebra

Два эффекта считаются **композиционными**, если они применяются к одной сущности (одинаковый `context.id`) и одному таргету (одинаковый `target`).

Нормативная таблица композиции для композиционных пар:

| `α₁` \ `α₂` | `replace` | `add` | `remove` | `batch` |
|---|---|---|---|---|
| **replace** | ok (late-wins по ≺) | ⊥ | ⊥ | ok |
| **add** | ⊥ | ok (union) | order (≺-late wins) | ok |
| **remove** | ⊥ | order | ok (union) | ok |
| **batch** | ok | ok | ok | ok |

- **ok** — эффекты совместимы без конфликта;
- **order** — разрешение по причинному порядку: `≺`-поздний побеждает;
- **⊥** — запрещённая пара. Кристаллизация **MUST** эмитить ошибку при обнаружении `⊥`-пары в множестве эффектов одного намерения. Рантайм **MAY** отвергать такой эффект при валидации.

Некомпозиционные пары (разные `target` или разные `context.id`) **MUST** считаться совместимыми.

**`batch` — особый случай:** под-эффекты `batch` внутри его `value` проверяются рекурсивно (каждый под-эффект проходит собственную валидацию и участвует в композиции как самостоятельный эффект).

## 2.6 World via fold

```
World(t) = fold(⊕, ∅, sort≺(Φ_confirmed ↓ t))
```

Мир в момент `t` — свёртка всех `confirmed`-эффектов, созданных до или в `t`, в топологическом порядке, с применением оператора `⊕` согласно таблице алгебры.

**Нормативные правила свёртки (per effect):**

| `alpha` | Действие |
|---|---|
| `add` | `world[target][context.id] = { ...value, ...context }` — создать или заменить. |
| `replace` | `world[target.collection][context.id][target.field] = value`. Если сущности нет — создать частичную `{ id: context.id, [target.field]: value }`. |
| `remove` | `delete world[target][context.id]`. |
| `batch` | Развернуть `value: Effect[]`, применить каждый под-эффект рекурсивно. |

**Фильтрация при свёртке:**

1. Реализация **MUST NOT** включать в `fold` эффекты, чей `target` начинается с префикса зарезервированных системных коллекций (например, `drafts`) — такие эффекты свёртываются **отдельным** проходом `foldDrafts()` для зрителя-владельца.
2. Реализация **MUST NOT** включать в `fold` эффекты со `scope: "presentation"` — они применяются отдельным проходом `applyPresentation(world)` для рендера.
3. Реализация **MUST NOT** включать в `fold` эффекты в состоянии `proposed` или `rejected`.

**Мир не персистируется.** Реализация **MUST** вычислять World заново из Φ при необходимости. Кеш / снапшоты допустимы как оптимизация, но **MUST** быть инвалидированы при любом новом confirmed-эффекте.

## 2.7 TTL

Эффект с `ttl: N` (где N — миллисекунды и N > 0) **MUST** переходить в состояние `rejected` автоматически по истечении `N` миллисекунд с момента перехода в `confirmed` (**не** с `proposed`).

Нормативные правила:

1. TTL-таймер **MUST** запускаться при переходе в `confirmed` и **NOT** при `proposed`.
2. TTL-expiration **MUST** каскадно отвергать всех потомков (§2.3, правило 4).
3. Реализация **MAY** использовать любой механизм таймера (`setTimeout`, cron, scheduled job), при условии корректности поведения при рестарте рантайма (см. §4 scheduler).

## 2.8 Drafts (Δ)

Поток Δ — персистентные эффекты, видимые только автору, не участвующие в `fold(Φ_confirmed)`.

Нормативные правила:

1. Эффекты с `target`, начинающимся с `drafts` (или иного зарезервированного префикса `systemCollections`), **MUST** маршрутизироваться в Δ.
2. При коммите намерения-источника черновые эффекты **MUST** быть промотированы: трансформированы в обычные Φ-эффекты (с соответствующими не-draft targets) и добавлены в `Φ_proposed`.
3. При отказе от черновика соответствующие Δ-эффекты **MUST** быть удалены или маркированы как неактивные.
4. Мир, оцениваемый при рассмотрении намерения `I`, вычисляется как:

   ```
   World_for(I) = World(t) ⊕ Overlay(I) ⊕ Δ(viewer)
   ```

   где `Δ(viewer)` — подмножество Δ, принадлежащее текущему зрителю.

## 2.9 Signals (Σ)

Поток Σ — транзиентные события: уведомления, внешние вызовы, аналитические события.

Нормативные правила:

1. Σ-события **MUST NOT** участвовать в `fold` и **MUST NOT** влиять на `World(t)`.
2. Σ-события **MUST** эмитироваться **только** при `proposed → confirmed` перехода порождающего эффекта. Если эффект отвергнут — сигналы не уходят.
3. Σ-события **MUST** быть необратимы: после эмиссии не могут быть отозваны. Компенсация — через отдельное намерение.
4. Запланированные сигналы (time-triggered) **MUST** быть привязаны к якорю — полю сущности. При смещении якоря (перенос датывремени) сигнал **MUST** быть перепланирован; при удалении якоря — отменён.

## 2.10 Presentation (Π)

Эффекты со `scope: "presentation"` — косметические: позиция узла, порядок карточек, UI-state перекомпоновки.

Нормативные правила:

1. Π-эффекты **MUST NOT** участвовать в `fold`.
2. Π-эффекты **MUST** применяться отдельным проходом `applyPresentation(world)` поверх уже свёрнутого World, исключительно для рендера.
3. Семантические консьюмеры (анализ World, алгебра, инварианты) **MUST NOT** видеть Π-эффекты.

## 2.11 Irreversibility (`__irr`)

Эффект **MAY** декларировать точку невозврата через `context.__irr`:

```json
{
  "__irr": {
    "point": "low" | "medium" | "high" | "none",
    "at": 1776371410023,
    "reason": "payment captured via Stripe webhook"
  }
}
```

**Нормативное правило:** при валидации эффекта `α: "remove"` на сущности `E` реализация **MUST** отвергнуть эффект, если в истории существует хотя бы один confirmed-эффект с тем же `context.id`, для которого:

```
effect.context.__irr.point === "high"
 AND
effect.context.__irr.at !== null
```

Иными словами: прошлый confirmed-эффект с `point: "high"` и непустым `at` делает сущность нерушимой через `remove`. Forward-correction через `α: "replace"` **MUST** оставаться разрешённой. Значения `point: "medium" | "low"` — информативные, не блокируют.

## 2.12 Witness-of-action (`__witness`)

Runtime-механизмы (scheduler, Rules Engine, invariant checker), порождающие derived-эффекты, **SHOULD** писать в `context.__witness` обоснование:

```json
{
  "__witness": {
    "basis": "rule 'quorum_autoclose' fired",
    "example": "action: confirm_poll",
    "ruleId": "quorum_autoclose",
    "firedAt": 1776371410023
  }
}
```

Нормативные правила:

1. Поле `basis` (**SHOULD**) — короткая человеко-читаемая причина.
2. Поле `example` (**MAY**) — пример конкретного действия / параметра.
3. Дополнительные механизм-специфичные поля (`ruleId`, `firedAt`, `causedByTimer`, ...) **MAY** присутствовать.

Witness-of-action — convention, а не runtime-enforced contract. Реализации, не записывающие `__witness`, остаются conformant. Consumer'ы **MUST** использовать optional chaining.

## 2.13 Anchoring

Частицы намерения делятся на:

- **Конструктивные** — `entities[]`, `effect.target.collection`, `creates`. Определяют структуру.
- **Описательные** — `conditions.field`, `witnesses.field`, `effect.target.field`. Уточняют наблюдаемость.

Нормативные правила:

1. **Конструктивный анкеринг MUST быть бинарным.** Каждая конструктивная частица либо успешно резолвится в `ontology.entities[X]` (для entity) или в существующую коллекцию (для target.collection), либо кристаллизация отвергает артефакт с ошибкой `AnchoringError`.
2. Коллекции без доменной сущности **MUST** декларироваться через `ontology.systemCollections: string[]` (`["drafts", "users", "scheduledTimers", ...]`).
3. Plural-резолюция имён (`"user"` → `"users"`) — нормативна: кристаллизатор **MUST** пытаться резолвить имя эффекта как plural онтологической сущности.
4. **Описательный анкеринг MAY быть soft.** Ссылки на несуществующие поля в `witnesses`/`conditions` эмитят warning/info, но не блокируют кристаллизацию.

### 2.13.1 Reliability taxonomy

Каждый anchoring finding **SHOULD** содержать `reliability` одного из трёх значений:

| Значение | Семантика |
|---|---|
| `"structural"` | Прямая привязка через `ontology.entities[X]` или `systemCollections`. |
| `"rule-based"` | Привязка через `ontology.predicates` или `ontology.invariants`. |
| `"heuristic"` | Привязка через name-convention, plural-lookup или иную имя-эвристику. |

Поле `witness.basis` (**SHOULD**) — короткая строка, описывающая механизм вывода (`"direct match"`, `"plural rule"`, `"name pattern"`, `"explicit declaration"`).

Reliability-labeling — не enforcement. Consumer'ы ожидающие reliability **MUST** использовать optional chaining (finding-создатели без labeling остаются conformant в v0.1).

### 2.13.2 Режимы gate'а

- `anchoring: "strict"` — структурные misses эмитят `AnchoringError`.
- `anchoring: "soft"` — структурные misses эмитят warning, кристаллизация продолжается.

Default в v0.1 — `"soft"`. Default в v1.0 спецификации будет `"strict"` после завершения ontology-completion sprint'ов в reference-прототипе.

## 2.14 Invariants

Инварианты — ∀-свойства `World(t)`, проверяемые после каждой свёртки `fold(Φ_confirmed)`.

Декларация — `ontology.invariants: Invariant[]`. Каждый инвариант имеет `kind`, определяющий handler. Нормативное множество `kind`'ов v0.1:

| `kind` | Семантика | Минимальный shape |
|---|---|---|
| `role-capability` | Роль имеет/не имеет определённый `canExecute`. | `{ kind, role, require: { canExecute: [] } }` |
| `referential` | `row[field]` существует в target-коллекции. | `{ kind, from: "Entity.field", to: "TargetCollection", allowNull? }` |
| `transition` | Допустимые переходы значения поля. | `{ kind, entity, order?: [...] }` или `{ kind, entity, transitions?: [[from, to]] }` |
| `cardinality` | `count(rows)` после `where` + `groupBy`. | `{ kind, entity, where?, groupBy?, min?, max? }` |
| `aggregate` | `sum`/`count` коллекции ≈ значение target-поля. | `{ kind, op, from, where?, target, tolerance? }` |

**Нормативные правила:**

1. Реализация **MUST** проверять инварианты после каждого confirmed-эффекта (или batch-а).
2. Violation с `severity: "error"` **MUST** вызывать откат эффекта: перевод в `rejected` с cascade reject потомков.
3. Violation с `severity: "warning"` или `"info"` **SHOULD** логироваться, но **MUST NOT** блокировать эффект.
4. Violation **SHOULD** содержать: `name`, `kind`, `severity`, `message`, `details` (machine-readable).
5. Расширение множества `kind` через `registerKind(name, handler)` — ненормативно в v0.1. Reference-impl поддерживает регистрацию, но conformant parser **MAY** отвергать артефакты с неизвестными `kind`'ами.

**Observer-invariant** (все роли с `base: "observer"` имеют `canExecute: []`) — первый применимый случай `kind: "role-capability"`, канонический пример.

## 2.15 Scope дальнейших версий

Не входит в v0.1 (зарезервировано для v0.2+):

- **Distributed transactions** на границе с внешним миром — однонаправленная граница (pull) покрыта; многоpartition eventual consistency — нет.
- **CRDT типы эффектов** (`increment`, `cas`) — декларировались в ранних версиях манифеста, удалены как cut bait; возвращаются вместе с реализацией при обнаружении use-case.
- **Conflict resolution между mirror-сущностями** — декларирован через `authority` (external / local / last-write-wins / merge), но нормативная семантика merge не описана.
- **Event sourcing компактификация** — поток Φ растёт бесконечно; стратегия snapshot'ов / компакции не нормативна.
