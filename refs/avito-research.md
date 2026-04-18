# Avito Услуги — UX-исследование для Pattern Bank

Дата: 2026-04-18
Источник: открытые материалы Avito (career.avito.com, avito.tech, sostav.ru, habr.com/companies/avito) + публичные обзоры продвижения (elama.ru, vc.ru, kp.ru, synapse-studio.ru), практика использования платформы. PII / скриншоты с персональными данными не сохранялись.

Цель: извлечь UX-паттерны из пяти ключевых экранов Avito Услуг и оформить 3-5 кандидатов в `pattern-bank/candidate/` в формате, совместимом со stable-банком IDF.

---

## 1. Каталог задач / каталог исполнителей с фильтром по карте

### Что делает экран

Два режима одной и той же коллекции `ServiceListing` / `Specialist`:

- **List-вид** — вертикальная лента карточек (превью, заголовок, цена «от», рейтинг, метки «Премиум / Выделено»).
- **Map-вид** — карта региона с пинами-кластерами. Пин раскрывается в мини-карточку. Боковая колонка синхронизирована со списком видимых в viewport объявлений: скролл списка двигает центр карты, клик по пину — скролл к карточке в списке.
- Переключатель «Список / На карте» в хедере, радиус-фильтр («рядом со мной 1/3/5/10 км» + выбор метро в Москве/Питере).

### UX-решения

1. **Map-as-filter**. Карта — не отдельный экран-канвас, а фильтр: viewport ≡ query (bbox coords). Любое панорамирование/зум переписывает `filter.bbox` и перезагружает список. Это превращает spatial fieldRole (`coordinate` / `address`) в интерактивный предикат каталога, не в отдельный архетип.
2. **Dual-pane синхронизация**. List-pane и map-pane — один источник (catalog), два рендера. Hover в списке подсвечивает пин, клик по пину прокручивает список. Shared selection.
3. **Category tree со счётчиками**. Левая колонка: дерево «Услуги → Ремонт → Сантехника» со счётчиком `(1243)` у каждого узла. Активный узел раскрыт, siblings свёрнуты. Переход в подкатегорию не уводит на новую страницу — это параметр фильтра.

### Паттерны-кандидаты

- **`map-filter-catalog`** — spatial viewport как фильтр catalog-архетипа. Trigger: ontology имеет fieldRole `coordinate` или `address` + catalog-архетип + есть intent `α:"replace"` на фильтр с coord-ролью.
- **`category-tree-with-counter`** — иерархический Category selector с aggregate-счётчиком дочерних объявлений. Trigger: self-referential entity (Category с parentId) + counter aggregation + main entity имеет FK на Category.

---

## 2. Карточка исполнителя с рейтингом и услугами

### Что делает экран

Detail-архетип `Specialist`:

- Hero: фото, имя, профессия, агрегированный рейтинг («4.9 · 128 отзывов»), бейдж «Проверенный мастер / Документы подтверждены».
- Tabs / секции: «Услуги» (подколлекция `Service` с ценой «от»), «Отзывы» (подколлекция `Review` с фильтром по звёздам), «О себе», «Портфолио».
- Primary CTA внизу: «Написать / Позвонить / Пригласить на задачу».
- Если исполнитель оплатил «Премиум» — верхняя плашка «Рекомендовано Avito» + карусель баннеров.

### UX-решения

1. **Aggregate-over-sub-entity в hero**. Rating — не поле `Specialist`, а `avg(Review.stars) + count(Review)` поверх подколлекции. Crystalize_v2 сам этого не деривирует — нужен паттерн.
2. **Category-scoped price strip**. Под hero — горизонтальный strip «Цены от 1500 ₽» с переключателем услуг (мини-tabs), пересчитывающий price-strip.
3. **Review-filter-chip cluster**. Fлажки «5 звёзд (98) / 4 (24) / 3 (4)» — filter-chip'ы с aggregate-счётчиком.

### Паттерны-кандидаты

- **`rating-aggregate-hero`** — сводный рейтинг в hero-slot поверх sub-entity с `fieldRole: "rating"`. Trigger: detail-архетип + sub-entity с `rating` + рекомендуемо `createdAt` для sort.
- **`review-filter-chip-cluster`** — inline фильтр-чипы по дискретному rating-полю с counter-постфиксом. Trigger: sub-entity с enum-полем + ≥3 option'ов + есть intent `α:"replace"` на фильтр sub-коллекции.

---

## 3. Оформление платного размещения задачи (промо-слот)

### Что делает экран

Wizard / form с выбором тарифа продвижения `Promotion`:

- Карточки-радио: «Бесплатно / Выделить (+300₽) / Премиум (+500₽) / XL (+1500₽)». У каждой — ожидаемый эффект («до ×5 просмотров», sparkline forecast).
- Toggle «Срок: 1/7/30 дней» с пересчётом стоимости.
- «К оплате: 1500₽» — в sticky footer с disable-гвардом (интент `purchase_promotion` необратим, `__irr:{point:"high"}`).
- Счётчик баланса / промокод (reference-поле).

### UX-решения

1. **Promotion-tier radio-cards с forecast-hint**. Радио-выбор не «text list», а grid из карточек с визуальным hint'ом (sparkline / badge / цена). Каждая карточка — ровно одно enum-значение.
2. **Forecast-preview для enum selection**. Рядом с активной карточкой — «что будет»: ×5 просмотров / верхняя позиция / N дней. Это `computed-preview-setter` в частном случае — forecast, не temporal.
3. **Irreversibility-footer с disabled до valid state**. Sticky bottom bar с ценой + CTA «Оплатить». CTA disabled пока promotion тариф не выбран; confirmation требует повторного свайпа.

### Паттерны-кандидаты

- **`paid-promotion-slot`** — grid радио-карточек для тарифа промо-размещения с forecast-preview. Trigger: catalog/feed-архетип + есть intent creates `Promotion` / `Boost` сущности + у Promotion поле `tier: enum` с ≥3 опциями + fieldRole `money`.

---

## 4. Direct-invite исполнителю (приглашение на задачу)

### Что делает экран

Из detail-карточки `Specialist` или из каталога — кнопка «Пригласить», открывающая sidebar/drawer:

- Dropdown «Выберите задачу из ваших» (`reference` many → выбрать `Task` которую я разместил).
- Опциональное сообщение (textarea).
- CTA «Отправить приглашение» → создаётся `Invite` (assignment bridge: specialistId + taskId + customerId).
- После отправки: inline toast «Приглашение отправлено», CTA превращается в disabled «Приглашение отправлено · отменить».

### UX-решения

1. **Direct-invite sidebar с task-picker**. Инициируется с detail-view исполнителя, но результирующий intent создаёт entity в другом домене (Invite). Sidebar не перекрывает detail — остаётся контекст исполнителя.
2. **Context-carry**. Когда sidebar открыт из карточки `Specialist` с `specialistId=42`, поле specialistId в `Invite` уже pre-filled и locked — пользователь не может его поменять. Это особый случай form-context-inheritance.
3. **Toggle state после отправки**. CTA меняет надпись и становится antagonist-toggle (отправить ↔ отозвать приглашение).

### Паттерны-кандидаты

- **`direct-invite-sidebar`** — side-drawer из detail-view, который создаёт assignment-bridge с pre-filled контекстом родителя. Trigger: detail-архетип + intent creates assignment-entity с двумя FK, один из которых = `$mainEntity`, другой picker'ом.

---

## 5. Чат с откликом (переписка заказчика и исполнителя)

### Что делает экран

Feed-архетип `Message` в рамках `Conversation` (bridge между `Task` и `Specialist`):

- Composer внизу — инлайн text + attach.
- Над composer'ом — sticky «контекстная плашка задачи»: мини-карточка Task с заголовком, ценой, статусом + CTA «Выбрать этого исполнителя» / «Оплатить».
- Первое сообщение — системное: «Исполнитель откликнулся на вашу задачу». Все последующие — обычные.
- Бейджи сверху: «Безопасная сделка», «Документы проверены», «Последний визит 2ч назад».

### UX-решения

1. **Context-header в feed**. Над message-feed закреплена карточка parent-сущности (Task), к которой привязан разговор. Не просто title — это интерактивная карточка с CTA.
2. **System vs human messages — разный рендер**. Первое `Message` с `type: "system"` и `createdBy: null` рендерится как серая плашка, без аватара/bubble.
3. **Primary CTA завязан на фазу сделки**. «Выбрать исполнителя» (status=open) → «Оплатить» (status=chosen) → «Подтвердить выполнение» (status=paid). Это `phase-aware-primary-cta` (уже в stable).

### Паттерны-кандидаты

- **`context-parent-sticky-header`** — feed-архетип (conversation) имеет FK на parent entity (Task/Order/Deal). Над composer'ом — sticky preview-card parent'а с phase-aware CTA. Trigger: feed + FK на external entity + есть lifecycle-intent над parent'ом.
- *(phase-aware-primary-cta — уже stable, здесь работает как подтверждение)*

---

## Итоги: 5 candidate-паттернов

| ID | Архетип | Суть | Приоритет (по заданию) |
|----|---------|------|------------------------|
| `map-filter-catalog` | catalog | Spatial viewport как фильтр каталога | **фокус** (map-filter) |
| `category-tree-with-counter` | cross | Self-ref category tree с aggregate counter | **фокус** |
| `paid-promotion-slot` | form/wizard | Grid радио-карточек promotion-тарифа с forecast | **фокус** |
| `direct-invite-sidebar` | detail | Sidebar из detail, создающий assignment с pre-fill | **фокус** |
| `rating-aggregate-hero` | detail | Hero с aggregate rating поверх sub-entity Review | бонус (общий) |

Все 5 оформлены как JSON-файлы в `pattern-bank/candidate/avito-*.json`.

## Примечания о методологии

- Trigger-формат следует `VALID_KINDS` из `packages/core/src/patterns/schema.js` (9 kinds: entity-field, intent-effect, intent-creates, entity-kind, has-role, field-role-present, sub-entity-exists, intent-confirmation, intent-count).
- `falsification.shouldMatch/shouldNotMatch` ссылаются на существующие домены прототипа (booking/sales/delivery/invest/lifequest/planning/reflect/messenger/workflow), чтобы можно было прогнать против реальных ontology.
- `structure` описывает обогащение слота без `apply`-функции (candidate-stage matching-only; apply — roadmap после продвижения в stable).
- `rationale.evidence` — Avito как primary + один-два cross-industry референса, чтобы исключить domain-specific false positive.
