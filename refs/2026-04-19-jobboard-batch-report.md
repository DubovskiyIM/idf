# Pattern Bank Batch Report — Job-Boards

**Дата:** 2026-04-19
**Elapsed:** 9.6 минут (batch без сбоев, timeout 300s достаточен)
**Источники:** 3 мобильных job-board'а (LinkedIn Jobs / Indeed / hh.ru)
**Результат:** 3 extractions, **26 candidate-паттернов**, 10 observation'ов purged (covered / anti-pattern / out-of-scope)

## Ход пайплайна

Батч прошёл чисто с уже-поднятым 300s timeout. Распределение:

| Источник | Candidates | Covered / Out-of-scope | Время |
|----------|-----------|------------------------|-------|
| linkedin-jobs-mobile | 8 | — | 2.9 мин |
| indeed-jobs-mobile | 7 | 7 (2 covered + 5 anti-pattern) | 2.6 мин |
| hh-ru-mobile | 11 | 3 (1 covered + 2 out-of-scope) | 4.2 мин |
| **Итого** | **26** | **10** | **9.6 мин** |

Все 26 кандидатов прошли format-валидацию и имена-не-перекрываются со stable. Особенность прогона: Indeed явно зафиксировал **5 anti-pattern'ов**, что полезнее кандидатов для Pattern Bank'а (раздел candidate/anti/).

## Триангуляция — самое ценное

### Два независимых открытия `saved-search-with-notify`

- **linkedin-jobs-mobile** → `saved-search-subscription` (feed, toolbar slot)
- **indeed-jobs-mobile** → `saved-query-with-notify` (catalog, header slot)

Оба обнаружили: `SavedSearch` entity с полями `query / filters / notifyEnabled / newResultsCount`, intent `replace savedSearch.notifyEnabled`. Паттерн превращает ad-hoc запрос в именованную push-подписку с unread-badge на tab'е.

**→ P1 stable.** Триггер через entity-kind="reference" + `notifyEnabled` bool field + `intent-creates SavedSearch`. Связан с §22 Rules Engine (notify = schedule-style rule), но UX-layer живёт в crystallize. Structure.apply: добавляет toolbar-action "Save current search" + My-section tab с subscription feed.

### Три независимых открытия `boolean-attribute-badges`

- **linkedin-jobs-mobile** → `badge-stack-markers` (catalog/body, ≥3 boolean fields)
- **indeed-jobs-mobile** → `hero-attribute-badges` (detail/hero, boolean+enum ≥2)
- **hh-ru-mobile** → `trust-attribute-badges` (catalog/body, trust-семантика)

Сильнейшая триангуляция батча. Все три: entity с ≥2-3 boolean/enum-полями → компактный ряд icon-badges с цветовым кодированием. LinkedIn кладёт в угол карточки, Indeed — в hero detail'а, hh-ru — под заголовком. Структурное различие только в slot, семантика идентична.

**→ P1 stable.** Универсальный low-level паттерн для density-optimized сканирования. Структура.apply: если ≥2 boolean fields на mainEntity → рендерим `badge-stack` primitive в выбранный slot, иконка derivable через fieldRole или name heuristic. Для Premium-gated badges (Top Applicant в LinkedIn) нужен hook на capability layer (§5/§17).

### Cross-batch триангуляция: `chips-filter-bar`

- **linkedin** → `filter-chip-bar` (LinkedIn chips over feed)
- **hh-ru** → `chips-plus-advanced-sheet` (chips + bottom-sheet для extended params)
- **freelance batch 2026-04-19** → `faceted-filter-panel` (**3x: profi-ru / workzilla / kwork**)

Вместе это **5 независимых открытий** одной универсалии в 7 продуктах. Семейство схлопывается в единый stable с вариациями по layout:
- `mode: "chips"` — поверх feed (LinkedIn/Instagram/X)
- `mode: "sidebar"` — sticky колонка (kwork, Indeed desktop)
- `mode: "toolbar"` — над feed (profi-ru, workzilla)
- `mode: "chips+sheet"` — chips + overflow в bottom-sheet (hh-ru)

**→ P0 stable (самый горячий кандидат дня).** Объединить с предыдущей триангуляцией из freelance-batch. Структура.apply должна детектить mode по device-form-factor + количеству фильтров (≥7 → sheet-overflow).

### Cross-batch: `promoted-inline-slot`

- **indeed** → `sponsored-segregated-feed`
- **hh-ru** → `promo-banner-injection`
- **freelance batch** → `promoted-slot-injection` + `paid-visibility-elevation` + `highlight-important-flag` + `emphasis-priority-card` (4 варианта)

6 независимых открытий темы "paid/featured item elevates position in feed". В freelance batch это было названо как merge-кандидат — теперь есть подтверждение.

**→ P0 stable после merge.** Сигнал: entity имеет поле `isPromoted | sponsored | tier: "featured"`. Structure.apply: вставка в pinned-section над органикой + visual-bleed overlay + "Promoted/Рекламное" бейдж (обязательно — требование транспарентности индустрии).

## Жёстко single-shot находки (novel, high signal)

### `personalization-score-badge` (hh-ru)

> `mainEntity.matchPercent` с semantic role `percentage` → prominent badge в верху карточки feed/catalog.

Это **ключевой паттерн job-board-индустрии** (user явно назвал его эталоном в пре-промпте: "Подходит вам на 82%"). Снижает cognitive load при скроллинге списка на 2 секунды / item. Универсален для любого match-based discovery (не только job-boards: dating-apps, product-recommenders, freelance-matching).

Индустриальная важность выше, чем триангуляция — рекомендую **P1 stable** даже без второго открытия. Trigger: `mainEntity.matchPercent` derived field + `field-role: percentage`. Structure.apply: вынос в top-right/top-left карточки, цветовое кодирование (>80 green / 60-80 yellow / <60 grey), conditional hide на маленьких карточках.

### `dual-cta-branching` (LinkedIn)

> Primary CTA раздваивается в зависимости от entity-state: `Easy Apply` (внутренняя 2-3-step wizard с pre-filled profile) vs `Apply on company site` (external redirect).

Универсальная модель "internal fast-path vs external fallback". Применима к любому marketplace с опциональным embedded-flow. Trigger: `intent.branch` field на intent-уровне + `fastPath: true/false` на каждом item. Structure.apply: рендер CTA с branched icon/label + external-indicator (↗) для external.

**→ P2 stable candidate.** Нужно второе открытие (skyeng/other marketplace с "Book inside / Visit website" branching).

### `lateral-similar-items` (LinkedIn)

> В detail-проекции внизу — горизонтальный scroll "Similar jobs" (related-entity feed через structural similarity).

Уже частично покрыт general renderer'ом, но явное заявление паттерна полезно. Связан с existing `subcollections`, но работает не через FK, а через вычислимое similarity (embeddings / tags / co-visit signals). Может быть расширением `subcollections.apply` с `mode: "similar"` и custom projection.

### `completeness-progress` (LinkedIn) + `contextual-wizard-tooltips` (hh-ru)

Оба про gamification заполнения профиля:
- LinkedIn: "87% complete" progress + actionable hints ("add 2 skills to reach 95%")
- hh-ru: inline tooltip/help-bubble на каждом шаге wizard'а с контекстными подсказками

Вместе формируют паттерн **`guided-completion`**: derived percent-field + step-suggestions + per-field tooltips. Применим к profile/resume wizards в любом домене (messenger onboarding, sales seller profile, booking specialist profile).

**→ P2 merge-кандидат.** Stable после ещё одного открытия.

### `related-entity-rating-chip` (Indeed) + `multi-axis-rating-breakdown` (Indeed)

Оба про inline-рейтинги связанной сущности (компании) в карточке вакансии:
- `related-entity-rating-chip`: звёзды + число отзывов кликабельны, открывают sub-view
- `multi-axis-rating-breakdown`: рейтинг разложен по 5 осям (work-life / compensation / management / culture / opportunities)

Вместе формируют **`embedded-related-entity-rating`** — встроенная 2-level индикация качества связанной сущности. Применим везде, где мейн-entity связан с reference-entity имеющей reputation (listings/seller в sales, specialist/service в booking).

### `inline-event-timeline` (hh-ru)

> Под detail — таймлайн событий по entity ("2 апреля — просмотрел", "5 апреля — пригласил"). Sub-entity `Event` с `timestamp + type`.

Новая sub-entity rendering strategy — не stamp-only, а rich timeline. Применим к sales (dispute events), delivery (order state transitions), messenger (read-receipts).

**→ P2 stable candidate.** Trigger: sub-entity с `timestamp + type` + `mainEntity.status`. Structure.apply: вертикальная полоска с chip-events, icon по `type`, relative-time.

### `status-segmented-tabs` (hh-ru) + cross-reference `status-tab-feed` (kwork, freelance batch)

Тот же паттерн в двух батчах — tabs по `entity.status` поверх общего feed. **2x триангуляция** фактически.

**→ P1 stable candidate.** Структура.apply: если `mainEntity.status` — enum с ≥3 discrete values → tab-bar по top-level статусам. Связан с существующим `phase-aware-primary-cta` но работает на feed-уровне, а не на detail.

### `context-pinned-header` (hh-ru)

> В чате работодателя контекст вакансии всегда sticky сверху — заголовок + компания + дата отклика.

Sticky-context для sub-feed views. Применим к любому master-detail view со sub-stream (messenger conversations, sales dispute discussions).

### `template-library-quickfire` (hh-ru)

> Pre-built templates для chat-ответов ("Готов к собеседованию", "Удобное время?"). Массовая работа с типовыми ответами.

Универсальный UX для high-throughput messaging (support chats, hh-ru, sales chat). Trigger: entity `Message` + `intent-category: reply` + pre-authored `MessageTemplate` reference-entity.

**→ P2 stable candidate.**

### `primary-scanning-anchor-field` (hh-ru)

> На карточке одно поле (зарплата) визуально доминирует — bold, контраст, крупнее. Scanning-anchor для принятия решения за секунду.

Низкоуровневый рендеринг-паттерн. Field-level emphasis через fieldRole: "scanning-anchor" или эвристика по decision-relevance. Уже частично есть в renderer (money-emphasis), но формальное правило полезно.

### `quick-apply-subentity-cta` (hh-ru)

> Primary CTA требует выбора sub-entity (резюме) перед запуском. Pre-apply disambiguation: если у пользователя >1 резюме → модалка выбора.

Pattern обобщаем: "primary action требует разрешения reference-entity ambiguity". Применим к sales (choose delivery address), invest (choose portfolio), booking (choose calendar).

**→ P2 stable candidate.**

### `unified-dual-tracker-tab` (Indeed)

> Один экран трекер для разных сущностей (applied jobs + saved jobs + interviews) с сегментированным фильтром.

Близко к `status-segmented-tabs`, но работает на cross-entity level. Обычно эти разделы разделены, Indeed объединил для cognitive coherence.

## Anti-patterns (отдельная ценность)

Indeed extraction явно назвал 5 anti-pattern'ов. Банк должен иметь раздел `pattern-bank/anti/`:

| Anti-pattern | Источник | Суть |
|--------------|----------|------|
| `app-install-interstitial` | Indeed | Pop-up "get better results in app", блокирующий UI на web |
| `opaque-algorithmic-filter` | Indeed | AI-движок убирает 90% вакансий без возможности отключить |
| `stale-listing-no-expiry` | Indeed | Ghost-вакансии висят месяцами без механизма сигнала |
| `single-document-no-customization` | Indeed | Resume как единственный документ без per-application кастомизации |
| `weak-post-apply-feedback` | Indeed + LinkedIn | Статус "viewed" и тишина месяцами — чёрная дыра в candidate-experience |

Также потенциально:
- `premium-blur-dark-pattern` (LinkedIn) — заблюренные данные "кто смотрел ваш профиль"
- `intrusive-paid-banner-in-inbox` (hh-ru) — промо-баннеры в ленте откликов

**→ Создать `pattern-bank/anti/` директорию. Anti-patterns — это тоже derivation rules, но с `status: "anti"` и rationale с эмпирическими данными о вреде (NPS impact, install uninstall rate, trustpilot отзывы).**

## Out-of-scope (корректная фильтрация)

hh-ru pipeline корректно отфильтровал:
- "Bottom tab bar с 5 разделами" → shell-level navigation, не crystallize-phase pattern
- "Push при смене статуса" → Reactive Rules Engine (§22) concern

Правильное разделение между UX-pattern-layer и другими механизмами формата. Проверил: `resolvePattern` сейчас работает только внутри crystallize — shell / rules / scheduler — другие этажи.

## Приоритеты промоции в stable

**P0 (немедленно, жёсткая триангуляция ≥2 источников):**
1. **`chips-filter-bar` + merge с `faceted-filter-panel`** — 5 независимых открытий (cross-batch). Universal primary discovery pattern.
2. **`boolean-attribute-badges`** — 3 независимых открытия в одном батче. Universal card-density optimization.
3. **`promoted-inline-slot` merge** — 6 независимых открытий (cross-batch). Universal marketplace monetization pattern.

**P1 (industry-defining, single-shot но канонический):**
4. **`personalization-score-badge`** — match% в карточке, явно эталон индустрии (подтверждено пре-промптом).
5. **`saved-search-with-notify`** — 2 независимых открытия, closes gap между feed и push.
6. **`status-segmented-tabs`** — 2 открытия (hh-ru + kwork), feed-level status filtering.

**P2 (novel + сильный, нужен ещё один source):**
7. `dual-cta-branching` (LinkedIn) — internal fast-path vs external
8. `inline-event-timeline` (hh-ru) — sub-entity timeline rendering
9. `template-library-quickfire` (hh-ru) — pre-built reply templates
10. `quick-apply-subentity-cta` (hh-ru) — pre-apply entity disambiguation
11. `embedded-related-entity-rating` (merge indeed 2) — inline reputation

**P3 (нужен peer, но интересно):**
12. `lateral-similar-items` (similar через similarity, а не FK)
13. `context-pinned-header` (sticky context для sub-feed)
14. `primary-scanning-anchor-field` (field-level emphasis)

**Anti-bank (новая директория `pattern-bank/anti/`):**
15. 5 anti-patterns из Indeed extraction — ценность для "что НЕ делать"

## Cross-batch consolidation (два дня, две темы)

После двух батчей (freelance 2026-04-19 + job-boards 2026-04-19):

**Total:** 7 источников, 77 candidates, ~25 неоверлапящих тем, из них:
- **4 P0-P1** темы с cross-batch триангуляцией (филтры / бейджи / промоушн / статусы)
- **2 P1** single-shot индустриальных эталона (match-score, saved-search)
- **6-8 P2** сильных кандидатов требующих ещё одного открытия
- **5-7** anti-patterns для anti/ раздела

Предложение: после 3-го батча (возможно marketplace-classics — Amazon / Ozon / Avito) можно сделать консолидацию с merge-сессией и промотить 10-12 паттернов в stable одной пачкой.

---

Candidate-файлы: `refs/candidates/2026-04-19-{linkedin,indeed,hh-ru}-*.json`
Extracted models: `refs/extracted/2026-04-19-{linkedin,indeed,hh-ru}-*.json`
Лог: `refs/2026-04-19-jobboard-batch.log`
Параллельный отчёт freelance: `refs/2026-04-19-freelance-batch-report.md`
