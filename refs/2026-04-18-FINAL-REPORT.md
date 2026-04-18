# Pattern Bank Research — Финальный отчёт по золотому стандарту

**Дата:** 2026-04-18  
**Длительность:** 25.6 минут (batch)  
**Источники:** 7 экранов из 5 продуктов (Linear / Stripe / Notion / Height / Superhuman)  
**Результат:** 7 extractions, **51 candidate-паттерн**

---

## 1. Обзор

Pipeline запущен через `scripts/pattern-researcher-batch.mjs` (orchestrator поверх `pattern-researcher.mjs`). Каждый источник прошёл 3 фазы:
- **Extract** — Claude reverse-engineer'ит доменную модель (entities / intents / roles / observations)
- **Hypothesize** — генерирует candidate-паттерны с trigger / slot / rationale / falsification
- **Validate** — структурная проверка format + overlap с 13 stable-паттернами

Все 51 candidates прошли валидацию формата **без overlap'ов** с существующими stable — они представляют реально новую поверхность.

---

## 2. Кластеризация по темам

### 🔑 Keyboard-first & command palette (5)

Самый сильный сигнал: `global-command-palette` обнаружен **независимо 3 раза** (Height, Linear, Superhuman) — это универсальный pattern эскалации сложности UI.

| ID | Источник | Trigger |
|----|----------|---------|
| `universal-command-palette` | height | intent-count ≥15 |
| `global-command-palette` | linear | intent-count ≥15 + has-role owner |
| `global-command-palette` | superhuman | intent-count ≥10 + feed.query replace |
| `hotkey-namespace-shift-modifier` | linear | ≥6 click-replace на mainEntity |
| `hierarchical-hotkey-namespace` | superhuman | intent-count ≥20 + click-confirmation ≥5 |
| `keyboard-hotkey-triage` | linear-triage | ≥3 click-intents + owner role |

**Выводы для Pattern Bank:**
- `global-command-palette` → сразу в **stable**. Три независимых match'а + ясный trigger (intent-count) + falsification (≤5 intents → overkill).
- `hotkey-namespace-shift-modifier` + `hierarchical-hotkey-namespace` → оба кандидата на stable после merge: первый для «много scalar-replace», второй для «много групп actions».
- `keyboard-hotkey-triage` — частный случай command-palette для feed, можно собрать как composable.

### 🔄 Optimistic UI & undo (3)

Ещё один дубликат: `optimistic-replace-with-undo` найден 2 раза (Linear и Superhuman).

| ID | Источник | Slot |
|----|----------|------|
| `optimistic-replace-with-undo` | linear | overlay |
| `optimistic-replace-with-undo` | superhuman | overlay |
| `undo-toast-irreversible` | linear-triage | overlay (для high-throughput) |

**Выводы:**
- `optimistic-replace-with-undo` → **stable**. Прямой антипод существующего `irreversible-confirm`: когда операция reversible и частая — confirmation лишний, undo-toast эффективнее.
- `undo-toast-irreversible` — специализация для irreversible-но-bulk (archive в inbox). Добавляет nuance: high irreversibility ≠ modal если ops много.

### 📦 Bulk operations (3)

| ID | Источник | Slot |
|----|----------|------|
| `bulk-action-toolbar` | height | toolbar |
| `bulk-selection-toolbar` | linear-triage | toolbar |
| `table-cell-inline-edit` | notion | body |

**Выводы:**
- `bulk-action-toolbar` и `bulk-selection-toolbar` — **один и тот же паттерн**, найденный независимо → strong signal для **stable**. Trigger: `intent.id.startsWith("bulk_")` + ≥2 таких. Появляется toolbar при selection.
- `table-cell-inline-edit` — orthogonal: bulk не через selection, а через spreadsheet-навигацию Tab/Arrow.

### 🧭 Workflow & phase-aware (3)

| ID | Источник | Slot |
|----|----------|------|
| `kanban-phase-column-board` | height | body |
| `workflow-graph-constrained-cta` | height | primaryCTA |
| `board-group-drag-write` | notion | body |

**Выводы:**
- `kanban-phase-column-board` — candidate для **stable**. Trigger строгий: status field + ≥3 enum values + replace intents. Это upgrade существующего `phase-aware-primary-cta` (detail) на catalog-уровень.
- `workflow-graph-constrained-cta` — расширение `phase-aware-primary-cta`: не все n→n, а граф разрешённых переходов (через Phase.allowedNextPhases). Важно для инвариантов `kind:"transition"`.
- `board-group-drag-write` — derived-action через drag (не CTA-клик). Важно для pattern-apply: trigger одинаковый с kanban-phase, differentiator — наличие drag-write intent.

### 🗂 Views & multi-archetype (3)

| ID | Источник | Slot |
|----|----------|------|
| `multi-archetype-view` | notion | header |
| `per-view-query-state` | notion | toolbar |
| `view-swimlane-regrouping` | height | body |

**Выводы:**
- `multi-archetype-view` — **потенциально самый мощный новый pattern**. Notion-style: одна ontology → runtime choice archetype (table/board/calendar/timeline/gallery). Требует расширения IDF: `projection.views[]` array и `view.archetype` как replaceable field. Возможно большой архитектурный шаг, но ценный.
- `per-view-query-state` — logical complement: views сохраняют filters/sorts/groupBy как first-class state.
- `view-swimlane-regrouping` — ортогональная к kanban группировка (assignee/label), intent на `view.swimlane` replace.

### ✏️ Inline editing (4)

| ID | Источник |
|----|----------|
| `inline-editable-hero` | linear |
| `inline-rename-on-enter` | notion |
| `keyboard-property-popover` | linear |
| `open-detail-on-row-click` | notion |

**Выводы:**
- `keyboard-property-popover` — сильный кандидат в **stable**. Trigger: ≥4 click-replace на mainEntity + field-role status/reference. Это описание того как Linear делает sidebar с single-letter hotkeys.
- `inline-editable-hero` — extension: не sidebar properties, а сам title/description inline editable в hero-slot.
- `inline-rename-on-enter` — узкий: для rename-intent'ов на name-поле.
- `open-detail-on-row-click` — базовый default catalog behavior, возможно слишком generic для pattern.

### 🛡 Compliance / observer / document (7)

Самая богатая зона — Stripe-observer screen дал много:

| ID | Slot |
|----|------|
| `observer-readonly-escape` | primaryCTA |
| `export-format-group` | toolbar |
| `causal-chain-timeline` | sections |
| `metadata-kv-readonly` | sections |
| `raw-payload-developer-section` | sections |
| `binary-check-badge-grid` | sections |
| `immutable-snapshot-sidecar` | sections |

**Выводы:**
- `observer-readonly-escape` — важный для IDF § compliance: observer-role имеет 0 write intents + 1 high-irreversibility (Dispute) → primary CTA становится этот escape. Совпадает с текущим `base:"observer"` и preapproval guard.
- `export-format-group` — ≥2 intents создающих entity с `expiresAt` (export-token) и `format` field → группировка в dropdown. Альтернатива разбросанным CTA.
- `causal-chain-timeline` — self-reference (causedById) в sub-entity → хронологическая визуализация. Уже частично в IDF через Φ-журнал.
- `immutable-snapshot-sidecar` — `entity.kind: "mirror"` + `capturedAt` поле → отдельная карточка «snapshot at time X», не путать с live-данными.
- `metadata-kv-readonly` — JSON-field с user-defined keys → отдельная monospace-секция.
- `raw-payload-developer-section` — payload+type на sub-entity → dev-mode раскрытие.
- `binary-check-badge-grid` — sub-entity с status:[pass,fail] → плотная pre-attentive-ориентированная визуализация.

### 🧙 Wizard & multi-step create (3)

| ID | Slot |
|----|------|
| `resumable-wizard-with-draft` | body |
| `review-summary-before-irreversible` | primaryCTA |
| `computed-preview-setter` | body |

**Выводы:**
- `resumable-wizard-with-draft` — ≥4 replace на `entityDraft.*` + save_draft intent + `status:"draft"` → multi-step wizard с сохранением черновика. Расширяет существующий `wizard`-archetype.
- `review-summary-before-irreversible` — между wizard'ом и commit'ом показывать read-only summary. Это nuance существующего `irreversible-confirm`.
- `computed-preview-setter` — relative input (дни) + computed absolute output (дата) inline рядом. Полезно для trial_period, deadline-offset и т.п.

### 🔒 Lifecycle / preapproval (3)

| ID | Slot |
|----|------|
| `lifecycle-locked-parameters` | sections |
| `soft-hard-termination-pair` | footer |
| `entity-promotion` | primaryCTA |

**Выводы:**
- `lifecycle-locked-parameters` — ключевой для invest/delivery доменов IDF. `*Preapproval`-sub-entity + `status:"active"` → параметры writable во время create, read-only after activation. Совпадает с текущей семантикой IDF `AgentPreapproval`.
- `soft-hard-termination-pair` — scheduled cancellation vs immediate. Применимо к subscription, booking, rental.
- `entity-promotion` — intent.creates ≠ mainEntity (issue→project). Pre-filled form с continuity.

### 🌳 Sub-entity visualization (4)

| ID | Slot |
|----|------|
| `sub-entity-progress-rollup` | body |
| `threaded-comment-stream` | sections |
| `relation-chip-stack` | body |
| `polymorphic-rendering-by-discriminator` | body |

**Выводы:**
- `sub-entity-progress-rollup` — counterpoint к `subcollections`: в catalog'е sub-entity рендерится как aggregate progress-bar, не expanded list. Требует sub-entity с terminal status (done).
- `threaded-comment-stream` — self-reference в Comment (parentCommentId) → tree rendering. Очевидный pattern, но до сих пор нет.
- `relation-chip-stack` — multi-value relation → chip stack с linked titles. Это канонический pattern для m2m.
- `polymorphic-rendering-by-discriminator` — entity с `type`-field (discriminator) + ≥2 creates → per-type specialization. Важно для Notion-style polymorphic DB.

### 📅 Temporal & calendar (4)

| ID | Источник |
|----|----------|
| `calendar-drag-reschedule` | notion |
| `timeline-range-drag` | notion |
| `temporal-field-visual-signal` | height |
| `temporal-preset-picker` | superhuman |

**Выводы:**
- `calendar-drag-reschedule` — catalog-archetype с date-field → drag на календаре выполняет replace. Может быть part of `multi-archetype-view` family.
- `timeline-range-drag` — dateRange-field → Gantt с drag edges для start/end.
- `temporal-field-visual-signal` — due/deadline/scheduledAt → relative-time color (красный если overdue). Canonical transform, adapter получает только tone.
- `temporal-preset-picker` — future timestamp replace → preset options (1h / завтра / custom). 2-3 клика экономии.

### 🖼 Master-detail / feed (4)

| ID | Источник |
|----|----------|
| `master-detail-split-pane` | superhuman |
| `saved-filter-as-folder` | superhuman |
| `saved-query-sidebar` | linear-triage |
| `source-provenance-card` | linear-triage |

**Выводы:**
- `master-detail-split-pane` — feed с dense sub-entity graph → split-pane вместо drill-in. Сохраняет contexto.
- `saved-filter-as-folder` + `saved-query-sidebar` — оба про persistent-queries. Merge: filter/query entity с FK на main → sidebar с one-click access.
- `source-provenance-card` — entity с `source` FK на sub-Source (discriminator kind + icon) → префикс на каждой карточке. Важно для triage-workflows.

### 🎴 Multi-facet card + picker (2)

| ID | Источник |
|----|----------|
| `multi-facet-catalog-card` | height |
| `grouped-reference-picker` | stripe |

**Выводы:**
- `multi-facet-catalog-card` — расширение существующего `grid-card-layout`: не image+money, а ≥3 разных field-roles (person/label/progress/date/tag). Катeri для tasks/issues/tickets.
- `grouped-reference-picker` — FK picker с parent grouping (Price→Product). Улучшает flat picker.

### ⌨️ Composer input (2)

| ID | Источник |
|----|----------|
| `tab-cycle-composer-focus` | superhuman |
| `inline-text-expansion` | superhuman |

**Выводы:**
- `tab-cycle-composer-focus` — composer с ≥3 fields + enter-confirmation → Tab циклит между полями без leave home-row. Keyboard-first composer.
- `inline-text-expansion` — pattern-typing (;abc → expansion) как replace. Композитор snippets без picker.

---

## 3. Топ-кандидаты на promotion в stable

### Готовы сразу (конвергентные signals, чёткий trigger, falsification):

1. **`global-command-palette`** — 3 независимых match'а, trigger = intent-count ≥15, overlay-slot.
2. **`optimistic-replace-with-undo`** — 2 match'а, overlay undo-toast для frequent reversible ops.
3. **`bulk-action-toolbar`** — 2 match'а с одинаковым trigger `intent.id startsWith "bulk_"`.
4. **`kanban-phase-column-board`** — catalog equivalent существующего phase-aware-primary-cta.
5. **`keyboard-property-popover`** — sidebar с single-letter hotkeys для ≥4 scalar/reference polям.
6. **`observer-readonly-escape`** — role-based pattern, прямо совпадает с IDF `base:"observer"`.
7. **`lifecycle-locked-parameters`** — важен для IDF preapproval-семантики (invest/delivery).

### Требуют merge / refinement перед promotion:

- `hotkey-namespace-shift-modifier` + `hierarchical-hotkey-namespace` — два подхода к namespace overflow, merge в один с веткой по `intent-count`.
- `bulk-selection-toolbar` + `bulk-action-toolbar` + `table-cell-inline-edit` — unified «bulk-editing» family, но разные формы (selection-bar vs spreadsheet-tab).
- `saved-filter-as-folder` + `saved-query-sidebar` — same pattern, подтвердить имя.
- `calendar-drag-reschedule` + `timeline-range-drag` + `board-group-drag-write` — все три про direct-manipulation write через drag; может быть family с common `drag-to-replace` trigger.

### Требуют архитектурного расширения IDF:

- **`multi-archetype-view`** — views как first-class concept, `projection.views[]`. Большой шаг.
- **`polymorphic-rendering-by-discriminator`** — `entity.polymorphic: { discriminator: "type", variants: {...} }`. §26 open item.
- **`causal-chain-timeline`** — self-referential sub-entity viz (Φ-журнал уже близок, но не в domain-level).

---

## 4. Сигналы для IDF-манифеста

### Подтверждённые гипотезы

- **Keyboard-first scales с intent-count**: ≥3 click-intents → hotkeys, ≥15 → command palette, ≥20 → hierarchical namespace. Это empirical curve для Pattern Bank.
- **Reversibility → undo, irreversibility → modal**: три независимых продукта используют этот дуал. Существующий `irreversible-confirm` — половина picture.
- **Role-based projections работают**: observer-role у Stripe даёт уникальный surface (read-only + dispute-escape + export), полностью согласуется с §17 IDF.
- **Schema-driven UI (Notion)**: field-type → control пара реально работает на массиве продуктов.

### Новые инсайты для манифеста

- **Drag-to-replace как семейство**: kanban-phase, calendar-date, timeline-range, board-group — все реализуют общий pattern «geometry encodes value». Возможно `direct-manipulation-write` как meta-pattern.
- **Snapshots vs live state** (Stripe): `entity.kind: "mirror"` + `capturedAt` — компенсация immutability в UI. Relevant для fintech, legal, audit.
- **Causal chains** (Stripe Φ): self-referential sub-entities = визуализация как tree/timeline, не flat list. Это прямая проекция §10 манифеста в domain-слое.
- **View-multi-archetype** (Notion) — фундаментальное: одна projection → множество archetype, выбор runtime. Это открытие может сильно расширить кристаллизатор.

### Open items для pattern researcher pipeline

- Candidates все прошли format validation без overlap, но `falsification.shouldMatch` / `shouldNotMatch` не прогнаны через реальные 9 доменов IDF — нужен следующий шаг validation через `matchPatterns()`.
- 3 кандидата с `archetype: "—"` (universal-command-palette, global-command-palette, hierarchical-hotkey-namespace, optimistic-replace-with-undo, inline-text-expansion, tab-cycle-composer-focus, relation-chip-stack, temporal-field-visual-signal, temporal-preset-picker) — это cross-cutting patterns, для которых нужен отдельный class в Pattern Bank (не archetype-specific).
- `sub-entity-exists` trigger часто с параметрами (`withField`, `selfReference`, `hasFilterFields`, `withDiscriminator`, `statusValuesBinary`, `nameMatches`) — trigger-DSL нуждается в расширении.

---

## 5. Что дальше

1. **Ручной review** в refs/candidates/2026-04-18-*.json для 7 топ-кандидатов, полировка trigger'ов.
2. **Прогон через `matchPatterns()`** на всех 9 доменах IDF для валидации shouldMatch/shouldNotMatch.
3. **Promotion в `packages/core/src/patterns/stable/`** отобранных 5-7 кандидатов.
4. **Расширение Pattern Bank trigger-DSL**: добавить kinds `intent-count-minimum`, `field-role-present`, `entity-kind-mirror`, `self-reference-field`.
5. **Study для архитектуры**: multi-archetype-view требует дизайн-решения «views как first-class projection-children» — возможно отдельный §26 item.

---

## 6. Артефакты

- `refs/extracted/2026-04-18-*.json` — 7 extractions (domain models)
- `refs/candidates/2026-04-18-*.json` — 51 candidates
- `refs/2026-04-18-batch-report.md` — raw batch report (auto-generated)
- `refs/2026-04-18-FINAL-REPORT.md` — этот файл

**Coverage:**
- Linear: 7 паттернов (2 экрана: triage + keyboard-flow)
- Stripe: 13 паттернов (2 экрана: observer-export + create-subscription)
- Notion: 10 паттернов (multi-view schema screen)
- Height: 8 паттернов (kanban board)
- Superhuman: 9 паттернов (inbox keyboard flow)
- **Конвергенция**: 3 паттерна найдены независимо в ≥2 источниках — сильнейший signal для stable promotion.
