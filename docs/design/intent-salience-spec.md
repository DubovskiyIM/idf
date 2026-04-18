# Intent Salience — формальный tiebreaker для slot-contention

**Статус**: draft / PoC (2026-04-18)
**Связано с**: §14 (онтология), §16 (кристаллизация), функториальный фикс `feat/crystallize-functoriality-order`
**Scope PoC**: `assignToSlotsDetail.collapseToolbar` — сортировка standalone кнопок

---

## Проблема

Функториальный фикс (sort-on-entry в `crystallizeV2`) сделал результат **детерминированным**, но не **семантически оптимальным**. Когда M > N intent'ов конкурируют за слот capacity N, алгоритм теперь выбирает по алфавитному id. Пример:

```
sales.listing_detail.toolbar  (capacity: 3 visible + overflow)
  до функториального фикса:  [edit_listing, remove_listing, overflow]      # зависит от авторского порядка
  после функториального фикса: [apply_template, block_bidder, overflow]    # алфавитный, но «мусорный»
  после salience PoC:         [edit_listing, apply_template, overflow]     # primary впереди
```

Алфавит — формальный tiebreaker, но `apply_template` не primary для Listing лишь потому, что его id начинается с `a`.

## Цель

Сделать приоритизацию intent'ов **первоклассной частью спецификации**, чтобы:
1. Crystallize возвращал семантически устойчивый результат.
2. Когда salience отсутствует, artefact содержал **видимый маркер** неполноты спеки.
3. Existing intent'ы продолжали работать без миграции (computed default).

## Дизайн

### Два уровня объявления

**1. Explicit** — автор объявляет `intent.salience`.

```js
edit_listing: intent("Редактировать лот", …, { salience: "primary" })
```

- **Число** (`salience: 777`) — прямая величина. Больше = primary.
- **Строка-label** (`"primary" | "secondary" | "tertiary" | "utility"`) — раскрывается в `{100, 50, 20, 5}`.

**2. Computed** — вывод из `intent.particles` по правилам:

| Критерий | Value | reason |
|---|---|---|
| `creates === mainEntity` | 80 | creator-of-main |
| `effect.α === "replace" && target.endsWith(".status")` | 70 | phase-transition |
| `effect.α === "replace" && touches(main)` | 60 | edit-main |
| (default: effect на другую сущность) | 40 | default |
| `effect.α === "remove" && touches(main)` | 30 | destructive-main |
| `effects.length === 0` | 10 | read-only |

`computeSalience(intent, mainEntity)` → `{ value, source: "explicit" | "computed", reason }`.

### Tie-break

При равных значениях salience — алфавитный порядок по `intentId`. Это делает алфавитный выбор **явным финальным fallback'ом**, а не скрытой логикой.

### Применение (PoC scope)

**Только в `assignToSlotsDetail.js`**:

1. При push в `slots.toolbar`: к кнопке добавляется `.salience: <value>`.
2. В `collapseToolbar`: standalone кнопки сортируются `bySalienceDesc` **перед** срезом `visible.length < 3`.

Catalog (`assignToSlotsCatalog`), hero, fab, primaryCTA — пока не затронуты. Сознательно: у них есть собственные правила выбора (hero — первый creator, primaryCTA — phase-transitions). Salience применяется там, где сейчас **чистый alphabetic tiebreak** на capacity cutoff.

## Эффект на domain-аннотации

- **Обратная совместимость**: 0 необходимых правок. Computed defaults покрывают 100% existing intent'ов.
- **Рекомендуемая миграция**: добавить `salience: "primary"` к ~2-3 ключевым intent'ам per detail-проекция. В sales для Listing это `edit_listing`, `publish_listing`, `cancel_listing` (последние два уже в primaryCTA через phase-transition detection — не нужны).
- **Объём**: 9 доменов × ~5 ключевых intent'ов = ~45 аннотаций для idf/.

## Открытые вопросы

### ✓ Witness «alphabetical-fallback» (реализован)

Tied salience → запись в `artifact.witnesses[]`:

```js
{
  basis: "alphabetical-fallback",
  reliability: "heuristic",    // не rule-based!
  slot: "toolbar",
  projection: "listing_detail",
  salience: 60,
  chosen: "add_listing_image",
  peers: ["add_to_bundle", "apply_template", ...],
  recommendation: "Проставьте intent.salience одному из [...] чтобы зафиксировать порядок явно."
}
```

Studio может подсвечивать такие witnesses как «spec smell». Spec-debt измеряется `scripts/functoriality-spec-debt.mjs`:

```
# По 9 доменам после базовых аннотаций:
Грандтотал: 16 alphabetical-fallback witnesses
  sales:     7  (listing_detail ×2, listing_feed ×1, my_listings ×1, ...)
  lifequest: 4  (habit_detail ×2, goal_detail ×1, all_time_stats ×1)
  workflow:  2
  booking:   1
  messenger: 1
  reflect:   1
  planning:  0  ✓
  invest:    0  ✓
  delivery:  0  ✓
```

Цель — 0: все ties разрешены explicit `intent.salience`.

### Salience для catalog (roadmap)

Catalog slot'ы `toolbar` тоже имеют capacity overflow (line 169 в `assignToSlotsCatalog.js`: `slots.toolbar.length > 5`). Тот же механизм применим, но требует аналогичного сопровождения вокруг `hero` (первый creator) и `fab`.

### Composition of multiple primary intent'ов

Что если две detail-проекции имеют разные primary? Пока salience живёт на уровне intent'а, не на уровне (intent, projection). Для multi-projection доменов это может быть ограничением. Roadmap: `projection.salienceOverride: { intentId: value }` как escape-hatch.

### Salience как ordinal vs scalar

PoC использует числа (100, 80, 70, ...). Для формального poset стоит рассмотреть ordinal labels без арифметики — тогда операции типа `avg(salience)` не имеют смысла, и это фича, а не баг. Но для tie-break достаточно total order. Держим scalar как внутреннее представление, labels как user-facing API.

## Артефакты PoC

- SDK: `packages/core/src/crystallize_v2/salience.js` (82 LOC)
- SDK: `packages/core/src/crystallize_v2/salience.test.js` (12 тестов)
- SDK: правка `assignToSlotsDetail.js` (3 строки в collapseToolbar + 2 места push)
- host: `scripts/functoriality-slots.mjs` — до/после инспектор
- host: аннотация `edit_listing.salience: "primary"` в `src/domains/sales/intents.js` — demo

## Проверка

```
Пробы на sales.listing_detail.toolbar (detail, Listing):
  baseline (до всего)                : [edit_listing, remove_listing, overflow]   # semantic, non-functorial
  +sort-on-entry                     : [apply_template, block_bidder, overflow]   # functorial, non-semantic
  +sort-on-entry +salience           : [edit_listing, apply_template, overflow]   # functorial, semantic
```

Регрессия функториальности сохраняется: probe на 9 доменах возвращает 121/121 identical после PoC.
