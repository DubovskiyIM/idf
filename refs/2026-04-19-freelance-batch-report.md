# Pattern Bank Batch Report — Freelance Marketplaces

**Дата:** 2026-04-19
**Elapsed:** 13.0 минут (Phase 2+3 для 4 источников после increase timeout 120s → 300s)
**Источники:** 4 фриланс-биржи (profi.ru / workzilla / kwork / fl.ru)
**Результат:** 4 extractions, **51 candidate-паттерн**, 15 observation'ов покрыты существующими stable

## Ход пайплайна

Первый прогон `scripts/freelance-pattern-batch.mjs` упал на Phase 2 timeout (120s) после 2 sources: profi-ru и workzilla прошли только extract. Увеличил `callClaude` timeout до 300s в `scripts/pattern-researcher.mjs` и запустил `scripts/freelance-hypothesize.mjs` (resume-mode: skip Phase 1 для 3 already-extracted + full pipeline для fl.ru). Resume занял 13 мин. Финальный распределение:

| Источник | Candidates | Covered by existing | Время Phase 2+3 |
|----------|-----------|--------------------|-----------------|
| profi-ru-catalog | 14 | 3 | 3.3 мин |
| workzilla-marketplace | 12 | 6 | 3.0 мин |
| kwork-service-packages | 16 | 3 | 3.1 мин |
| fl-ru-projects-board | 9 | 3 | 2.9 мин |
| **Итого** | **51** | **15** | **12.3 мин** |

Все 51 кандидатa прошли format-валидацию; overlap с 13 stable не зафиксирован ни у одного (name-collision filter прошёл).

## Триангуляция: кандидаты независимо обнаружены ≥2 раз

Это сильнейший сигнал — когда несколько источников приходят к одному и тому же решению независимо, паттерн почти готов для **stable-промоции**.

### `faceted-filter-panel` — **3 независимых открытия**

- **profi-ru** (catalog, slot=toolbar): sticky-панель справа с numeric range + multi-select + booleans
- **workzilla** (catalog/feed, slot=body): левая колонка, live-apply без submit
- **kwork** (catalog, slot=sidebar): несколько независимых осей как typed controls по field-role

Триггер сходится: `entity` имеет ≥3-4 filter-поля + intent'ы `filter_*` / `session.filters.*` с α=replace. Структура различается только slot'ом (sidebar/toolbar/body) — это candidate для параметризации в `structure.apply`. **→ Рекомендация: stable, с `apply` построенным поверх field-role mapping (money→range, enum→checklist, boolean→toggle).**

### `hierarchy-tree-nav` — 2 независимых открытия

- profi-ru + kwork: оба имеют категорию с `parentId` self-reference и entity-aggregate field (`specialistCount`/`itemCount`).

Триггер: self-reference `parentId` + aggregate `count`-поле. Структура: sidebar tree с свёрткой/счётчиками. **→ Рекомендация: stable после merge, `apply` рендерит `slots.navigation` древовидно.**

### `composite-default-sort` — 2 независимых открытия

- profi-ru: сортировка "Оптимально" по композитному score
- kwork: "По умолчанию" algorithmic sort

Явный сигнал на naming convention: первый sort-option — algorithmic composite, остальные — scalar. **→ Рекомендация: stable кандидат; полезен через `projection.sort.default === "composite"`.**

### Семейство capability-gated — 2 независимых открытия

- profi-ru: `capability-gated-cta` (action зависит от role.scope / capability)
- fl.ru: `capability-gated-section` (section зависит от role-tier)

Один паттерн, применённый к разным scope'ам (CTA vs section). **→ Рекомендация: объединить в stable `capability-gated-visibility` с `scope: cta | section | field`.**

## Темы без триангуляции (сильные single-shot'ы)

### Monetization / promotion (4 варианта одной идеи)

- `promoted-slot-injection` (profi-ru) — фиксированная top-позиция через PromotionSlot entity
- `paid-visibility-elevation` (fl.ru) — флаг `isPromoted` с visual bleed
- `highlight-important-flag` (workzilla) — "Супер-задача" boolean
- `emphasis-priority-card` (fl.ru) — "Проект дня" featured

Один underlying concept (paid/featured lift), три разных trigger-signature. **→ Требуется merge-сессия: унифицировать в один pattern с сигнатурой `fieldRole: promotion|featured`.**

### Trust / tier signals (4 варианта)

- `tier-badge-marker` (fl.ru)
- `derived-tier-badge` (workzilla) — discrete tier из числовых метрик
- `trust-signal-mini-card` (kwork)
- `trust-signal-badges-on-card` (workzilla)

Сближаются в: entity имеет enum-поле `level/tier` с discrete ordering + visual hierarchy (цвет/иконка). **→ Merge-кандидат: `reputation-tier-badge` c trigger через `fieldRole: reputation-tier`.**

### Wizard composition (5 ortogonal компонентов)

- `multi-step-wizard-with-progress` (profi-ru) — линейный progress
- `polymorphic-form-step` (profi-ru) — conditional form-step по родительскому enum
- `draft-resume-entry` (profi-ru) — возврат к брошенному wizard'у
- `preview-before-publish` (profi-ru) — финальный review-step перед irreversible
- `autosave-draft-wizard` (kwork) — auto-save draft'а

Эти 5 работают вместе в одном wizard-pipeline (публикация заказа / создание кворка) но описаны как ортогональные. **→ Рекомендация: оставить как composable units, не объединять; preview-before-publish наиболее близок к промоции (сочетается с уже-existing `irreversible-confirm`).**

### Role-scoped UI (4 варианта)

- `role-scoped-state-transitions` (workzilla) — разные buttons для customer vs executor vs arbiter
- `role-scoped-action-set` (kwork) — seller vs buyer actions
- `role-scoped-dual-view` (fl.ru) — полный список откликов (заказчик) vs только свой (фрилансер)
- `escalation-observer-readonly-bundle` (workzilla) — arbiter role имеет readonly-доступ к переписке

Все — проявления §5 (roles) + §23 (irreversibility). **→ Вероятно, не новые паттерны, а применение existing `filterWorldForRole` — валидировать через `apply` существующего механизма.**

### Derived totals / live-compute

- `multi-select-extras-live-total` (kwork) — live-пересчёт суммы при выборе extras
- `derived-total-in-cta` (kwork) — итоговая сумма в CTA-кнопке
- `paid-modifier-composer` (fl.ru) — платные опции при публикации с live-сумой

Трио описывает один и тот же механизм: **"CTA label = f(mutable form state)"**. **→ Merge-кандидат: `computed-cta-label` с правилом derivation через formula в ontology.**

### Irreversibility nuances

- `undo-toast-irreversible` (profi-ru) — soft-undo буфер
- `countdown-auto-transition` (workzilla) — taimer до auto-release escrow с visible countdown
- `single-select-siblings-reject` (workzilla) — выбор одного сразу отклоняет siblings irreversibly
- `bounded-revision-buffer` (kwork) — ограниченное число revision'ов (3) до финализации

Все — уточнения к `irreversible-confirm`. `countdown-auto-transition` наиболее сильный: связан с §4 timer-scheduler, готов для `structure.apply`. **→ Рекомендация: countdown-auto-transition → stable с `apply`, остальные — остаются как modifier'ы к irreversible-confirm.**

### Sub-collection variants

- `sidebar-subcollection` (workzilla) — дочерняя сущность в sidebar
- `secondary-filters-on-subcollection` (kwork) — фильтр над sub-entity списком
- `inline-sub-creator-in-card` (workzilla) — inline-форма создания sub-entity внутри card

Расширения существующего `subcollections` паттерна. **→ Merge в opportunistic: расширить existing `subcollections.apply(slots, context)` чтобы принимать `layout: sidebar|tabs|inline` и optional `secondaryFilters`.**

## Уникальные находки (single-shot, novel)

Эти паттерны нашлись в одном источнике но выглядят универсальными:

| ID | Источник | Суть |
|----|----------|------|
| `reverse-invite-flow` | fl.ru | Заказчик находит фрилансера в каталоге → "Пригласить в проект" → создаёт bid к конкретному проекту в обратном направлении |
| `derived-presence-indicator` | fl.ru | "Онлайн сейчас" как derived-поле из `last_seen_at` + sort-option |
| `hover-peek-preview` | kwork | Hover раскрывает дополнительные preview-images + описание |
| `gallery-hero-detail` | kwork | Detail-проекция с multi-image carousel в hero-слоте |
| `status-tab-feed` | kwork | Tab-bar по entity.status над общим feed (в работе / на проверке / завершённые) |
| `temporal-witness-chip` | kwork | Due-date как chip с red-signal при overdue |
| `category-partitioned-feed` | fl.ru | Feed с вертикальной группировкой по категории |
| `feed-summary-header` | profi-ru | Aggregated-счётчики + средние над feed ("12 откликов, средняя 2 300 ₽") |
| `stat-breakdown-header` | profi-ru | Сводка через kv-rows ("Стаж 5 лет / Откликов за час 85% / Повторных клиентов 32%") |
| `sticky-cta-bar` | profi-ru | Fixed-bottom CTA-панель на detail-проекции |
| `profile-level-bulk-toggle` | kwork | Master-toggle "Отпуск" массово меняет состояние всех child-сущностей |
| `dashboard-kpi-plus-per-item-stats` | kwork | Top-level KPI + per-item micro-stats в edge-column |
| `elevated-facet-toggle` | profi-ru | Primary facet (Онлайн/Очно/Выезд) вынесен из фильтр-панели в hero |
| `sort-as-parameter` | workzilla | Sort options как first-class intent'ы |
| `polymorphic-value-field` | workzilla | Поле `price` с двумя shape'ами (фиксированная vs диапазон) |
| `inline-sub-creator-in-card` | workzilla | "Откликнуться" разворачивает форму внутри feed-card без модалки |

## Рекомендации по промоции в stable

Приоритеты промоции (P1 → P3):

**P1 — готовы к stable с `apply`:**
1. `faceted-filter-panel` (3x триангуляция, универсальный)
2. `hierarchy-tree-nav` (2x триангуляция, закрывает category-explosion в sales/messenger)
3. `countdown-auto-transition` (связан с §4 scheduler, готов к timer-based apply)
4. `promoted-slot-injection` / `paid-visibility-elevation` merge (универсальный для marketplace-доменов)

**P2 — merge-sessions перед stable:**
5. Trust-tier семейство → один `reputation-tier-badge`
6. `computed-cta-label` из multi-select-extras-live-total + derived-total-in-cta + paid-modifier-composer
7. Расширение existing `subcollections` с `layout` и `secondaryFilters` парметрами

**P3 — novel но нужна валидация в втором источнике:**
8. `reverse-invite-flow`, `derived-presence-indicator`, `polymorphic-form-step`, `preview-before-publish`, `sticky-cta-bar`

**Не рекомендуется в stable (уже закрыто existing):**
- Role-scoped паттерны → это применение filterWorldForRole, не новый паттерн
- `sort-as-parameter` → уже покрыт architecture
- `feed-summary-header` / `stat-breakdown-header` → слишком близкие к dashboard-архетипу

## Что покрыто существующими stable (15 observation'ов)

Сильный сигнал, что банк уже даёт fair coverage для freelance-доменов:

| Observation | Stable pattern | Источники |
|-------------|----------------|-----------|
| Карточка исполнителя = composite (avatar + price + rating + tier) | `grid-card-layout` | profi-ru, kwork |
| Отклонение bid'а irreversible с undo | `irreversible-confirm` | profi-ru, workzilla |
| Табы на detail (О себе / Цены / Отзывы) | `subcollections` | profi-ru |
| Safe-deal state-machine с phase-dependent CTA | `phase-aware-primary-cta` | workzilla, fl.ru |
| Publish task (form → feed) | `hero-create` | workzilla |
| Escrow-lifecycle | `irreversible-confirm` | workzilla, fl.ru |
| Moderation queue (draft → on_moderation → approved) | `phase-aware-primary-cta` | kwork |
| Sub-entities в detail (ChatMessage, Attachment) | `subcollections` | workzilla |
| Portfolio gallery в detail | `grid-card-layout` | fl.ru |

## Что дальше

1. **Merge-сессии** по трём семействам (trust-tier, paid-promotion, live-compute) → 3 новых stable pattern'а (вместо 11 overlapping candidates)
2. **P1-промоция** faceted-filter-panel + hierarchy-tree-nav → `structure.apply` → ≥2 использования в existing domains (sales filters / messenger contact tree)
3. **fl.ru zazor check:** всего 9 candidates — меньше остальных, возможно Phase 2 недо-добыла. Проверить stat'ы extracted-model (entities: 11, intents: 24) — норма для описания объёма.

Всего: **11 паттернов с потенциалом merge → stable**, **16 novel single-shot'ов для peer-review**, **9 role/архитектурных не-паттернов для отсечения**. Чистый прирост банка: ~20 stable-ready candidates после merge.

---

Полные candidate-файлы: `refs/candidates/2026-04-19-*.json`
Extracted models: `refs/extracted/2026-04-19-*.json`
Лог пайплайна: `refs/2026-04-19-freelance-batch.log`
