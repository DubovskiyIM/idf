# 3. Conformance

Эта глава определяет, что значит «conformant IDF implementation». Цель — сделать формат пригодным для параллельной реализации на любом стеке, с чётким контрактом того, что ожидается от каждой реализации, и явным механизмом декларации её возможностей.

## 3.1 Два вопроса

Conformance разделяется на два независимых вопроса:

1. **Что реализация потребляет?** — парсинг артефакта v2, онтологии, эффектов; валидация формы; соблюдение семантики ядра (§2).
2. **Что реализация производит?** — одна или несколько материализаций (§3.5): pixels / voice / agent-API / document.

Реализация **MAY** отвечать только на первый вопрос (`L1 Basic Parser`) — это валидно и полезно (например, validator-CLI, кешер, трансформер).

## 3.2 Оси conformance

Conformance declaration реализации — кортеж из четырёх ортогональных осей:

| Ось | Обозначение | Значения |
|---|---|---|
| Archetype coverage | `archetypes` | Подмножество `{feed, catalog, detail, form, dashboard, canvas, wizard}` |
| Control-archetype coverage | `controls` | Подмножество 10 control-архетипов v0.1 |
| Materialization tracks | `tracks` | Подмножество `{pixels, voice, agent-api, document}` |
| Feature capabilities | `features` | Список флагов (`capability-surface`, `invariants`, `scheduler`, `irreversibility`, ...) |

**Conformance class** (`L1`-`L4`, см. §3.6) — готовая комбинация этих осей, покрывающая типовые use case'ы.

## 3.3 Archetype coverage

Реализация **MUST** уметь корректно обрабатывать (parsing + соответствующий output для заявленного track'а) артефакты с архетипами из `archetypes`. Для архетипов вне `archetypes` реализация **MUST** одно из двух:

- отвергать артефакт с явной ошибкой (`unsupported archetype: X`); или
- молчаливо пропускать (не рендерить), логируя warning.

Реализация **MUST NOT** падать, получив артефакт с неизвестным/не-заявленным архетипом.

**Уровни coverage:**

| Уровень | Набор архетипов | Use case |
|---|---|---|
| **A1** | `catalog`, `detail` | Минимальный CRUD: списки + просмотр. |
| **A2** | A1 + `form`, `feed` | Стандартное приложение: + редактирование + поток. |
| **A3** | A2 + `wizard`, `dashboard` | Guided flow + главная страница. |
| **A4** | A3 + `canvas` | Полный набор. Canvas — domain-specific render. |

Реализация **MAY** декларировать дробный уровень (`A2 + canvas` без `wizard/dashboard`) — класс тогда объявляется списком архетипов явно.

## 3.4 Control-archetype coverage

Реализация **MUST** корректно обрабатывать slot-item'ы с `type` из `controls`. Для `type`, не входящих в `controls`, реализация **MUST** одно из двух:

- не рендерить такой item (игнорировать), логируя warning;
- рендерить через generic-fallback (например, показывая `intentButton` вместо `inlineSearch`).

Реализация **MUST NOT** падать на неизвестном `type` контрола.

**Уровни:**

| Уровень | Controls | Use case |
|---|---|---|
| **C1** | `auto`, `clickForm`, `formModal`, `confirmDialog` | Минимум: кнопки + формы + подтверждения. |
| **C2** | C1 + `composerEntry`, `heroCreate`, `filePicker`, `inlineSearch` | Стандартное приложение. |
| **C3** | C2 + `bulkWizard`, `customCapture` | Полный канонический набор v0.1. |
| **C-ext** | C3 + registration API для новых control-архетипов | Расширяемая реализация. |

## 3.5 Materialization tracks

Материализация — трансформация артефакта v2 в конкретный выход. Реализация декларирует один или несколько track'ов; каждый track имеет собственный output-контракт.

### 3.5.1 Pixels (track `pixels`)

**Output:** React / SwiftUI / Android / любое UI-дерево, предназначенное для человеческого восприятия.

**Минимальный контракт (L2+):**
- Реализация **MUST** рендерить все слоты заявленных архетипов.
- Реализация **MUST** исполнять `exec(intentId, ctx)` при активации intent-триггера, передавая результат в host.
- Реализация **MUST** вызывать `onItemClick` с передачей параметров ребра (§1.5).
- Реализация **SHOULD** поддерживать переключение темы (light / dark) и locale через host-уровень.
- Реализация **SHOULD** поддерживать graceful fallback при отсутствующих capability (§3.7).

Reference-реализация: `@intent-driven/renderer` + 4 UI-адаптера.

### 3.5.2 Voice (track `voice`)

**Output:** turn-structured поток для TTS / voice-agent:

```json
{
  "turns": [
    { "role": "system" | "assistant" | "prompts", "text": "...", "items"?: [...] }
  ]
}
```

**Минимальный контракт:**
- Реализация **MUST** производить turn-массив для архетипов `catalog`, `feed`, `detail`, `dashboard`.
- Реализация **MUST** ограничивать количество items (**SHOULD** top-3 для catalog / feed).
- Реализация **SHOULD** трансформировать специальные типы (`money`, `percentage`, `ticker`) в human-readable строки (`"2.5 миллиона рублей"`, `"12 процентов"`).
- Реализация **MUST** поддерживать хотя бы один из форматов: JSON (raw turns), SSML, plain text.
- Canvas и wizard архетипы **MAY** не поддерживаться; реализация **MUST** вернуть явный `unsupported`-маркер.

Reference-реализация: `server/schema/voiceMaterializer.cjs`.

### 3.5.3 Agent-API (track `agent-api`)

**Output:** REST / RPC endpoints — `schema`, `world`, `exec`.

**Минимальный контракт:**
- Реализация **MUST** предоставить:
  - `GET /schema` — JSON-схема всех интентов, доступных для role `agent` (whitelisted через `roles.agent.canExecute`);
  - `GET /world` — текущий `World(t)`, отфильтрованный через `filterWorldForRole(viewer)` (§5 манифеста);
  - `POST /exec` — выполнить intent с параметрами.
- Реализация **MUST** enforce'ить `roles.agent.canExecute`: попытка выполнить не-whitelisted intent возвращает 403.
- Реализация **MUST** enforce'ить `roles.agent.preapproval` если декларирован (§17 манифеста, 5 типов check-предикатов).
- Реализация **MUST** возвращать структурированные ошибки с полем `failedCondition` / `failedCheck`, чтобы агент мог восстановить причину отказа.
- Реализация **SHOULD** включать блок `relations` для каждого intent в `/schema` (последовательные / антагонистические / исключающие / параллельные связи, §12 манифеста).

Reference-реализация: `server/routes/agent.js`.

### 3.5.4 Document (track `document`)

**Output:** HTML / PDF / JSON document-граф для чтения и архива:

```json
{
  "title": "...",
  "subtitle": "...",
  "meta": { "date": "...", "viewer": "...", "domain": "...", "projection": "...", "materialization": "document" },
  "sections": [
    { "id": "...", "heading": "...", "kind": "table" | "paragraph", "columns"?: [...], "rows"?: [...], "content"?: "..." }
  ],
  "footer": { "note": "...", "auditTrail": "..." }
}
```

**Минимальный контракт:**
- Реализация **MUST** производить document для `catalog`, `feed`, `detail`, `dashboard`.
- Реализация **MUST** использовать тот же `filterWorldForRole(viewer)`, что и agent-API (viewer-scoped).
- Canvas и wizard **MAY** возвращать placeholder-секцию.
- Реализация **MUST** поддерживать хотя бы формат `json`; `html` — **SHOULD**; `pdf` / `docx` — **MAY** (server-rendered через puppeteer и т.п.).

Reference-реализация: `server/schema/documentMaterializer.cjs`.

## 3.6 Conformance classes

Предопределённые комбинации осей для типовых use case'ов. Реализация **MAY** декларировать и кастомную комбинацию, если стандартные классы не подходят.

### L1 — Basic Parser / Validator

- `archetypes`: все семь (только парсинг);
- `controls`: все десять (только парсинг);
- `tracks`: ∅ (реализация не производит outputs);
- `features`: `parse`, `validate`.

**Контракт:** реализация **MUST** парсить артефакт v2 согласно [`artifact.schema.json`](artifact.schema.json), эффекты согласно [`effect.schema.json`](effect.schema.json), корректно применять `fold` (§2.6), причинный порядок (§2.4), TTL (§2.7).

**Use case:** validator-CLI, кеш / трансформер артефактов, контрибьюция в build-pipeline.

### L2 — Standard Renderer

- `archetypes`: минимум **A2** (feed + catalog + detail + form);
- `controls`: минимум **C2**;
- `tracks`: **≥1** из `{pixels, voice, agent-api, document}`;
- `features`: L1 + заявленный track.

**Use case:** типовое приложение на одном track'е (например, pixel-only или agent-only).

### L3 — Full Renderer

- `archetypes`: **A4** (все семь);
- `controls`: **C3** (все канонические 10);
- `tracks`: **≥1**;
- `features`: L2 + `capability-surface` (§3.7) + `irreversibility` (§2.11) + `invariants` (§2.14).

**Use case:** reference-quality реализация на одном track'е. Соответствует `@intent-driven/renderer` для pixels.

### L4 — Multi-track

- Всё из L3;
- `tracks`: **≥2**.

**Use case:** полная imp, покрывающая человеческое / голосовое / агентное / документное использование — соответствует прототипу `idf`.

## 3.7 Capability surface

Реализация, заявляющая `features: ["capability-surface"]`, **MUST** публиковать декларацию возможностей в форме:

```json
{
  "capabilities": {
    "primitive": {
      "chart":     { "chartTypes": ["line", "pie", "column", "area"] },
      "sparkline": true,
      "statistic": true,
      "map":       { "layerKinds": ["marker", "route", "polygon"] }
    },
    "shell":  { "modal": true, "tabs": true },
    "button": { "primary": true, "overflow": true }
  }
}
```

Helper-функции **MUST** возвращать consistent ответ:

- `getCapability(kind, type) → descriptor | true | false | null` — `null` означает «capability не декларирован», реализация **MUST** трактовать как `true` (forward compatibility).
- `supportsVariant(kind, type, variantKey, variant) → boolean` — проверка поддержки конкретного варианта.

**Нормативные правила fallback:**

1. Если consumer запрашивает variant, не поддерживаемый адаптером, — адаптер **MUST** возвращать либо SVG-fallback (для primitive), либо generic-замену (для control'ов), и **MUST** логировать warning. Падение — запрещено.
2. Добавление нового `kind`/`type` в capability surface — **additive** изменение формата; старые реализации **MUST** игнорировать неизвестные keys без падения.

## 3.8 Conformance declaration

Реализация **SHOULD** публиковать `conformance.json` в корне своего npm-пакета (или аналогичной артефакт-дистрибуции):

```json
{
  "$schema": "https://intent-design.tech/spec/v0.1/conformance.schema.json",
  "spec": "https://intent-design.tech/spec/v0.1/",
  "implementation": "@intent-driven/renderer",
  "version": "0.4.0",
  "class": "L3",
  "archetypes": ["feed", "catalog", "detail", "form", "dashboard", "canvas", "wizard"],
  "controls": ["auto", "clickForm", "formModal", "confirmDialog", "composerEntry",
               "heroCreate", "filePicker", "inlineSearch", "bulkWizard", "customCapture"],
  "tracks": ["pixels"],
  "features": ["parse", "validate", "capability-surface", "irreversibility", "invariants"],
  "testSuite": {
    "passes": "100/100",
    "reportUrl": "https://..."
  }
}
```

Поля `spec`, `class`, `tracks` — **MUST**. Остальные — **SHOULD**.

Schema файла `conformance.json` зарезервирован в `conformance.schema.json` (planned).

## 3.9 Поведение при неизвестном

Нормативные правила forward compatibility:

1. **Unknown archetype** — `parser` **MUST** отвергать со структурированной ошибкой; `renderer` **MUST** не падать.
2. **Unknown slot** — реализация **MUST** игнорировать, не падая.
3. **Unknown control type** — аналогично §3.4: игнорировать или fallback на generic.
4. **Unknown context key** — `parser` **MUST** сохранять без интерпретации (round-trip safe).
5. **Unknown invariant kind** — реализация **MAY** отказаться валидировать мир с таким инвариантом; **SHOULD** логировать warning.
6. **Unknown materialization** в `/api/:m/:domain/:proj` — **MUST** вернуть 404 с явной ошибкой.

## 3.10 Доказательство conformance

Реализация, декларирующая `class: "LN"`, **MUST** быть способной пройти conformance-тест-сьют соответствующего уровня (§4). Доказательство состоит из:

1. Прогон conformance test suite (см. §4) с публичным отчётом (пройденные / пропущенные / провалившиеся fixtures).
2. Декларация `conformance.json` с точным указанием `archetypes` / `controls` / `tracks` / `features`.
3. Публичная ссылка на источник кода или бинарь реализации (для воспроизводимости).

Четыре UI-адаптера reference-impl (`@intent-driven/adapter-{mantine, shadcn, apple, antd}`) рендерят один и тот же артефакт v2 — это **первое доказательство conformance** на уровне pixels. Независимые реализации на других стеках (SwiftUI, Jetpack Compose, Flutter) — открытое приглашение.

## 3.11 Взаимодействие материализаций

Реализация, поддерживающая несколько track'ов (L4), **MUST** обеспечивать **viewer-scope consistency**: все track'и видят один и тот же World через один и тот же `filterWorldForRole(viewer)`.

Это значит, что одинаковый запрос к одной проекции в четырёх track'ах возвращает:

- pixels: UI со списком услуг, видных текущему клиенту;
- voice: аудио-turn, зачитывающий top-3 услуги из того же списка;
- agent-API: JSON-ответ с массивом услуг из того же списка;
- document: HTML-страница с табличкой услуг из того же списка.

**Не допускается** расхождение между тем, что человек видит глазами, и тем, что агент получает через `/api/agent/world`.

## 3.12 Open items для v0.2

- **Conformance test suite формализация** — §4 зарезервирован. В v0.1 — корпус из 119 артефактов из 9 доменов в reference-impl.
- **`conformance.json` schema** — `conformance.schema.json` зарезервирован.
- **Track-specific test tiers** — текущая спецификация не различает «базовый pixel-renderer» и «production-quality pixel-renderer» (a11y, i18n, responsive). Это оставлено для track-specific extensions.
- **Profiles** — отраслевые профили (fintech, healthcare, e-commerce) могут накладывать дополнительные требования (audit-trail, observer-invariant, KYC-flow). Профили — v0.3+.
