# 4. Conformance Test Suite

Эта глава определяет формат и состав corpus'а тестов, которые conformant implementation **SHOULD** пройти для доказательства соответствия спецификации v0.1.

Физическое расположение: [`tests/`](tests/) внутри директории спецификации.

## 4.1 Структура

```
tests/
├── manifest.json               индекс всех тестов
├── artifacts/                  canonical артефакты v2 из 9 reference-доменов
│   ├── booking/*.json
│   ├── planning/*.json
│   ├── ... (9 доменов)
├── effects/
│   └── sample-confirmed.json   100 confirmed-эффектов из runtime-БД
├── composition/
│   └── table.json              таблица алгебры §2.5
├── fold/
│   └── basic.json              базовые свёртки Φ → World
└── anchoring/
    └── basic.json              кейсы anchoring gate §2.13
```

## 4.2 Формат fixture

Все fixture — **JSON**. Язык-независимо: реализация на любом стеке (JS / TS / Swift / Kotlin / Rust / Python) запускает тесты через парсинг + проверку ожидаемого поведения.

### 4.2.1 Artifact fixture

Файл `tests/artifacts/<domain>/<projection>.json` — один валидный артефакт v2, сериализованный из `crystallizeV2()`. Фиксация произведена с `generatedAt: 0` для стабильности между прогонами.

**Контракт теста:**

1. Реализация **MUST** успешно парсить файл.
2. Реализация **MUST** валидировать его через [`artifact.schema.json`](artifact.schema.json) без ошибок.
3. Реализация уровня **L2+** для заявленного track'а **MUST** без падения произвести output соответствующей материализации (см. §3.5).

### 4.2.2 Effect corpus

Файл `tests/effects/sample-confirmed.json`:

```json
{
  "description": "...",
  "effects": [ Effect, Effect, ... ]
}
```

**Контракт:**

1. Каждый эффект **MUST** валидироваться против [`effect.schema.json`](effect.schema.json).
2. Реализация **MUST** применять `fold(sort≺(effects))` без исключений.
3. Порядок применения — любой, совместимый с causal DAG (§2.4).

### 4.2.3 Composition table

Файл `tests/composition/table.json`:

```json
{
  "cases": [
    { "name": "...", "a": Effect, "b": Effect, "expected": "ok" | "bottom" | "ok-late-wins" | "ok-union" | "ok-order-late-wins" | "ok-batch-always-valid" | "ok-different-targets" }
  ]
}
```

**Контракт:** для каждого case реализация **MUST** возвращать composition-result, совпадающий с `expected`. Ожидаемые значения соответствуют таблице §2.5.

### 4.2.4 Fold cases

Файл `tests/fold/basic.json`:

```json
{
  "cases": [
    { "name": "...", "effects": [...], "expectedWorld": {...}, "note"?: "..." }
  ]
}
```

**Контракт:** `fold(sort≺(case.effects))` **MUST** возвращать ровно `case.expectedWorld`.

### 4.2.5 Anchoring cases

Файл `tests/anchoring/basic.json`:

```json
{
  "cases": [
    {
      "name": "...",
      "intent": Intent,
      "ontology": OntologyFragment,
      "expected": {
        "passes": boolean,
        "mode"?: "strict" | "soft",
        "reliability"?: "structural" | "rule-based" | "heuristic",
        "basis"?: string,
        "errorKind"?: "AnchoringError",
        "warning"?: boolean,
        "info"?: boolean
      }
    }
  ]
}
```

**Контракт:** поведение `checkAnchoring(intent, ontology, opts)` **MUST** соответствовать `expected`.

## 4.3 Манифест

`tests/manifest.json` — машино-читаемый индекс для программной прогонки:

```json
{
  "tests": [
    { "kind": "artifact", "domain": "booking", "projection": "service_catalog",
      "archetype": "catalog", "fixture": "artifacts/booking/service_catalog.json" },
    ...
    { "kind": "effect-corpus", "source": "...", "count": 100,
      "fixture": "effects/sample-confirmed.json" }
  ]
}
```

Поле `kind` **MUST** быть одним из: `"artifact"`, `"effect-corpus"`, `"composition"`, `"fold"`, `"anchoring"` (последние три — зарезервированы для будущих автогенераций). Реализация прогоняющего harness **MUST** диспатчить по `kind`.

## 4.4 Минимальный набор тестов по уровню

| Уровень | Обязательные тесты (SHOULD pass) |
|---|---|
| **L1** | все artifacts (парсинг + schema); все effects (schema); composition table; fold/basic; anchoring/basic |
| **L2** | L1 + для заявленного track'а: materialize без падения всех artifacts с `archetypes ∩ {заявленные}` |
| **L3** | L2 + capability surface helpers возвращают consistent descriptor |
| **L4** | L3 × N track'ов + viewer-scope consistency между track'ами |

## 4.5 Формат отчёта

Реализация **SHOULD** публиковать отчёт о прогоне в формате:

```json
{
  "implementation": "@intent-driven/renderer",
  "version": "0.4.0",
  "spec": "v0.1",
  "class": "L3",
  "summary": {
    "total": 120,
    "passed": 118,
    "failed": 1,
    "skipped": 1
  },
  "results": [
    { "fixture": "artifacts/booking/service_catalog.json", "status": "pass" },
    { "fixture": "artifacts/reflect/insights_feed.json", "status": "fail",
      "reason": "/slots/composer: must be object" },
    { "fixture": "artifacts/booking/booking_wizard.json", "status": "skip",
      "reason": "wizard archetype not in declared coverage" }
  ]
}
```

Статусы: `"pass"`, `"fail"`, `"skip"` (архетип вне coverage), `"error"` (реализация упала, не ожидалось).

## 4.6 Вклад в тест-сьют

Тест-сьют — **общественное достояние** под той же CC BY 4.0, что и спецификация. Новые fixtures добавляются через:

1. **Regression** — если обнаружен баг в reference-impl, фикс сопровождается fixture, воспроизводящим баг.
2. **Extension** — новые архетипы / controls / invariants требуют соответствующих fixtures перед добавлением в спецификацию.
3. **Third-party contribution** — независимые имплементаторы могут прислать fixtures, которые их реализация поддерживает, а reference — не поддерживает. Такие fixtures маркируются `{source: "third-party/<name>"}`.

## 4.7 Текущий статус v0.1

| Категория | Фикстуры | Генерация | Состояние |
|---|---|---|---|
| Artifacts (9 доменов) | 119 файлов | `scripts/spec-export-fixtures.mjs` | 118 проходят [`artifact.schema.json`](artifact.schema.json), 1 known issue (reflect/insights_feed) |
| Effects | 100 записей | тот же скрипт (из `server/idf.db`) | все 100 валидируются |
| Composition table | 6 cases | hand-written | ручная нормативная база |
| Fold basic | 7 cases | hand-written | ручная нормативная база |
| Anchoring basic | 6 cases | hand-written | ручная нормативная база |

**Всего:** ~138 индивидуальных нормативных проверок. Это минимальная база v0.1; v0.2 расширит automatic-generation (property-based от ontology + intents) и добавит track-specific тесты (voice output golden files, document HTML golden).

## 4.8 Open items для v0.2

- **Property-based generators** — вместо ручных fold/composition/anchoring кейсов автоматически генерировать их из ontology + intents на основе правил R1-R7 деривации (§16 манифеста).
- **Golden-file сравнение для track'ов** — voice-output и document-HTML — детерминированные; snapshot-тесты дадут regression-safety для рендереров.
- **Adversarial corpus** — intentionally-невалидные fixtures (duplicate overlay keys, unknown archetype, missing required slot) с `expected: fail`, чтобы проверить правильность отклонения.
- **Multi-role viewer tests** — fixtures с `viewer: "investor"` vs `viewer: "advisor"` для проверки `filterWorldForRole` across track'ами (§3.11 viewer-scope consistency).
- **SDK harness** — готовый npm-пакет `@intent-driven/conformance-runner`, прогоняющий `manifest.json` через произвольный implementation adapter.
