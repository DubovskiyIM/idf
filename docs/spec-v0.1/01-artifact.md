# 1. Artifact v2

Артефакт v2 — детерминированный выход функции кристаллизации. Один артефакт описывает одну проекцию приложения на одном слое (`canonical` в v0.1).

Нормативный JSON Schema — [`artifact.schema.json`](artifact.schema.json). Эта глава — человеко-читаемое сопровождение: объясняет смысл полей, их взаимосвязь и известные расширения.

## 1.1 Top-level shape

Артефакт v2 **MUST** быть JSON-объектом со следующими полями:

| Поле | Тип | Нормативность | Описание |
|---|---|---|---|
| `version` | integer (= 2) | **MUST** | Major-версия формата артефакта. |
| `projection` | string | **MUST** | Идентификатор проекции (уникален в пределах домена). |
| `archetype` | string | **MUST** | Один из семи архетипов (см. §1.2). |
| `slots` | object | **MUST** | Контейнер слотов (см. §1.3). |
| `domain` | string | **MUST** | Идентификатор домена. |
| `name` | string | **SHOULD** | Человеко-читаемое имя. |
| `layer` | string | **SHOULD** | `"canonical"` в v0.1. Зарезервировано. |
| `generatedAt` | integer | **MAY** | UNIX timestamp (миллисекунды). |
| `generatedBy` | enum | **MAY** | `"rules"` \| `"llm-enriched"`. |
| `inputsHash` | string | **MAY** | Стабильный хеш INTENTS + PROJECTIONS + ONTOLOGY. |
| `nav` | object | **SHOULD** | Навигационный граф (см. §1.5). |
| `editProjection` | string \| null | **MAY** | Для detail: ID производной form-проекции. |
| `sourceProjection` | string \| null | **MAY** | Для form: ID исходной detail-проекции. |

Дополнительные поля **MAY** присутствовать; conformant parser **MUST** их игнорировать, не падая (forward compatibility).

## 1.2 Archetypes

Артефакт **MUST** декларировать один из семи архетипов. Архетип задаёт скелет артефакта и определяет обязательные слоты.

| Archetype | Семантика | Обязательные слоты | Типичное применение |
|---|---|---|---|
| `feed` | Поток сообщений / событий, новые внизу | `body`, `composer` | chat, комментарии, лента уведомлений |
| `catalog` | Коллекция однородных сущностей | `body` | списки товаров, каталог услуг, список бронирований |
| `detail` | Одна сущность с её полями и действиями | `body` | просмотр заказа, карточка услуги |
| `form` | Синтетическая edit-форма | `body` | редактирование сущности |
| `canvas` | 2D-пространство (domain-specific render) | `body` | workflow-редактор, map-view |
| `dashboard` | Агрегат под-проекций как виджетов | `body` | главный экран, домашняя страница |
| `wizard` | Многошаговый guided flow | (нет; использует `steps`) | онбординг, запись к специалисту |

**Нормативные требования:**

- Реализация (parser) **MUST** отвергать артефакты с неизвестным `archetype`.
- Реализация **MUST** проверять обязательные слоты для архетипа; отсутствие обязательного слота — ошибка валидации.
- Реализация **MAY** расширять набор слотов произвольно (например, `sections`, `primaryCTA`, `progress`, `footer` присутствуют в reference-impl для detail-архетипа). Новые слоты **MUST NOT** нарушать нормативные требования архетипа.

## 1.3 Slots

`slots` — JSON-объект с именованными позициями. Каждый слот — либо массив `SlotItem`, либо структурированный объект (`body`, `composer`).

### 1.3.1 Канонические слоты

| Слот | Тип значения | Назначение |
|---|---|---|
| `header` | `SlotItem[]` | Верхняя панель: toggle'ы, информационные индикаторы. |
| `toolbar` | `SlotItem[]` | Основная панель действий. |
| `hero` | `SlotItem[]` | Inline-создатель над списком (обычно `heroCreate` control). |
| `body` | `Body` (объект с `type` или `SlotItem[]`) | Основное содержимое. |
| `context` | `SlotItem[]` | Вспомогательная информация (sidebar-стиль). |
| `fab` | `SlotItem[]` | Плавающие кнопки действия. |
| `overlay` | `Overlay[]` | Модальные окна и диалоги. |
| `composer` | `Composer` | Input-линия внизу для feed (см. §1.3.3). |

Дополнительные слоты, используемые reference-impl для `detail`-архетипа: `sections`, `primaryCTA`, `progress`, `footer`, `voterSelector`. Они ненормативны в v0.1 — отдельные conformance levels в §3 описывают ожидания.

### 1.3.2 SlotItem

Минимальная форма элемента слота — JSON-объект с полем `type` (строка). Остальные поля зависят от значения `type` (control-архетипа — см. §1.4).

Общие опциональные поля:

- `intentId` — ID намерения, к которому привязан элемент;
- `label` — человеко-читаемая метка;
- `icon` — строка (эмодзи / имя иконки) **или** объект state-map (`{"true": "🔔", "false": "🔇"}`) для toggle-control;
- `placeholder`, `hint` — подсказки;
- `condition` — строка или массив строк, предикат видимости в формате filter-DSL (см. §2).

Conformant рендерер **MUST** игнорировать неизвестные значения `type`, не падая. Рекомендованное поведение — не рендерить такой элемент и (опционально) логировать предупреждение.

### 1.3.3 Composer

Composer-слот — специальный тип для архетипа `feed`. Представляет input-линию внизу экрана.

**Нормативные поля:**

- `primaryIntent` (**MUST**): ID намерения, исполняемого при подтверждении (обычно `confirmation: "enter"`).
- `primaryParameter` (**SHOULD**): имя параметра намерения, привязанного к основному input.
- `placeholder` (**MAY**): плейсхолдер для input.
- `attachments` / `params` (**MAY**): дополнительные параметры / вложения.

### 1.3.4 Overlay

Каждый элемент `slots.overlay` — объект со следующими нормативными полями:

- `type` (**MUST**): `"formModal"` \| `"confirmDialog"` \| `"customCapture"` \| `"bulkWizard"` (каноничные значения). Реализация **MAY** определять дополнительные типы.
- `key` (**MUST**): уникальный ID в пределах массива `overlay`. Дубликаты `key` — ошибка валидации.

Опциональные поля (зависят от `type`):

- `intentId` / `triggerIntentId` — ID намерения, открывающего оверлей.
- `title`, `message` — человеко-читаемые тексты.
- `irreversibility` — `"low"` \| `"medium"` \| `"high"` (для `confirmDialog`).
- `parameters` — массив `Parameter` (для `formModal`, `bulkWizard`).
- `witnessPanel` — массив `SlotItem` с превью-данными (для `formModal`).
- `widgetId`, `targetEntity` — для `customCapture`.
- `source`, `filter` — для `bulkWizard`.
- `confirmBy` / `confirmedBy` — способ подтверждения в `confirmDialog`: `{type: "typeText", expected: "<path>"}` или `{type: "button"}`.

## 1.4 Control archetypes

Control-архетип определяет, как намерение материализуется в UI-контрол. Кристаллизатор выбирает control-архетип по частицам намерения (confirmation, irreversibility, creates, extended, control-override). Выход — slot-item, либо пара `{trigger, overlay}`, либо целый composer.

Каноничные control-архетипы v0.1:

| Архетип | Match-правило | Выход | Куда попадает |
|---|---|---|---|
| `auto` | `confirmation === "auto"` | null (не рендерится) | — |
| `composerEntry` | `confirmation === "enter"` | `Composer` | `slots.composer` |
| `inlineSearch` | witnesses содержат `query` + `results` и нет entities | `SlotItem` с `type: "inlineSearch"` | `slots.toolbar` |
| `formModal` | `confirmation === "form"` | `{trigger: SlotItem, overlay: Overlay}` | `slots.toolbar` + `slots.overlay` |
| `confirmDialog` | `irreversibility: "high"` \| `"medium"` | `{trigger: SlotItem, overlay: Overlay(confirmDialog)}` | `slots.toolbar` + `slots.overlay` |
| `clickForm` | `confirmation === "click"` | `SlotItem` или `{trigger, overlay}` (если есть параметры) | `slots.toolbar` |
| `filePicker` | `confirmation === "file"` | `SlotItem` с `filePicker: true` | `slots.toolbar` |
| `heroCreate` | creator главной сущности + одно текстовое поле + `kind: "catalog"` | `SlotItem` с `type: "heroCreate"` | `slots.hero` |
| `customCapture` | match virt'уальных виджетов (voiceRecorder / emojiPicker / entityPicker) | `{trigger, overlay(customCapture)}` | `slots.toolbar` + `slots.overlay` |
| `bulkWizard` | `extended: true` | `{trigger, overlay(bulkWizard)}` | `slots.toolbar` + `slots.overlay` |

Расширение множества control-архетипов **MAY** производиться через реестр (см. reference-impl `crystallize_v2/controlArchetypes.js`). Новые архетипы не считаются нормативной частью спецификации v0.1.

## 1.5 Navigation graph

`nav` — граф переходов между проекциями в пределах домена.

```json
{
  "outgoing": [ NavEdge, ... ],
  "incoming": [ NavEdge, ... ]
}
```

`NavEdge`:

```json
{
  "from": "service_catalog",
  "to": "service_detail",
  "kind": "item-click",
  "itemEntity": "Service",
  "params": { "serviceId": "item.id" }
}
```

Граф выводится кристаллизатором из пересечений `entities` проекций (когда одна проекция показывает коллекцию, другая — detail той же сущности, создаётся ребро `item-click`). Ручная декларация рёбер **MAY** дополнять вывод.

Conformant рендерер **MUST** уметь реагировать на `onItemClick` действие вида `{action: "navigate", to: "<projection>", params: {...}}` внутри `body.onItemClick` или на уровне отдельных `SlotItem`.

## 1.6 Parameters

`Parameter` — описание одного поля формы:

```json
{
  "name": "startTime",
  "label": "Начало",
  "control": "datetime",
  "bind": "booking.startTime",
  "editable": true,
  "required": false,
  "inferredFrom": "phase-investigation"
}
```

**Нормативно:**

- `name` (**MUST**) — идентификатор параметра в контексте намерения;
- `control` (**SHOULD**) — один из 17 значений из whitelist:
  `text`, `textarea`, `datetime`, `url`, `email`, `tel`, `number`, `file`, `image`, `multiImage`, `select`, `entityPicker`, `assetPicker`, `multiSelect`, `entityRef`, `enum`, `boolean`.

Реализация валидатора **MUST** отвергать артефакт с `parameter.control`, не входящим в whitelist, **если** параметр находится внутри `formModal` или `bulkWizard` оверлея. В других позициях (composer params, slot-item params) whitelist остаётся рекомендательным.

Добавление нового значения `control` — **additive minor-change** формата; старые реализации **MUST** игнорировать незнакомое значение (или падать; v0.2 уточнит требование).

## 1.7 Отсутствующая нормативность в v0.1

Следующие аспекты **намеренно** оставлены ненормативными в v0.1. Они фиксируются в следующих версиях спецификации по мере накопления опыта:

- **Точный shape `Body`** для каждого архетипа — reference-impl использует разные формы (`{type: "list", source, item, ...}` для catalog, `{type: "column", children: [...]}` для detail, `{type: "dashboard", widgets: [...]}` для dashboard). v0.2 планирует отдельные `BodyFeed`, `BodyCatalog`, `BodyDetail` определения.
- **Wizard steps** — формат `steps[]` для wizard-архетипа не зафиксирован. Ссылка на reference-impl.
- **Canvas delegation protocol** — canvas-архетип делегирует рендер domain-specific компоненту. Контракт между артефактом и этим компонентом не формализован.
- **Style spec'ы** — поля `gap`, `sx`, `style` в reference-impl используются для визуальной подстройки, но нормативная часть должна жить в адаптере, не в артефакте. v0.2 удалит эти поля из формата или явно сделает их ненормативными.

## 1.8 Known issues

- **reflect/insights_feed** (prototype v1.9): декларирован как `feed`, но не содержит `composer`-намерения (нет intent с `confirmation: "enter"` на entity `insights`). SDK-валидатор в reference-impl предупреждает, но не блокирует возврат артефакта. Спецификация v0.1 формально отвергает такой артефакт как невалидный. Это ontology-gap в домене `reflect`, а не несоответствие спецификации и reference-impl.
