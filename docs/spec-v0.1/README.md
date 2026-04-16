# Intent-Driven Frontend — Specification v0.1

**Статус:** Draft / Working Draft
**Дата:** 2026-04-16
**Соответствует прототипу:** v1.9 / SDK `@intent-driven/core@0.7.0`
**Nature:** нормативный документ, описывающий **формат**, а не реализацию.

## Что это такое

Это спецификация **формата артефакта IDF** — структуры данных, описывающей приложение независимо от UI-стека, исполнительной среды и рантайма.

Формат определяет:

- **Артефакт v2** — JSON-объект, описывающий одну проекцию приложения (экран / голосовой диалог / агентский эндпоинт / документ).
- **Онтологию** — схему сущностей, ролей, правил и инвариантов домена.
- **Намерения (intents)** — атомарные единицы возможных действий.
- **Проекции** — читающие структуры, порождающие артефакты v2 через кристаллизацию.

Формат **не описывает**:

- Как артефакт рендерится в React / SwiftUI / Android / CLI.
- Какой язык программирования используется в рантайме.
- Как хранятся эффекты (SQLite / Postgres / в памяти).
- Как работает транспорт (REST / WebSocket / Anthropic MCP).

Эти решения делают **conformant implementations** — см. §6 Reference Implementations.

## Отношение к манифесту

- **Манифест** (`docs/manifesto-v1.7.md`) — философский документ: *почему* парадигма такая, *что* в ней священно, *какие* полевые тесты её проверяли.
- **Спецификация** (этот документ) — нормативный документ: *что именно* должен принимать / производить код, чтобы считаться IDF-совместимым.

Манифест может измениться без изменения формата. Формат может измениться без изменения философии. Документы живут независимо и версионируются отдельно.

## Структура документа

| Файл | Содержание | Статус |
|---|---|---|
| [`00-abstract.md`](00-abstract.md) | Abstract, Status, Conformance language (RFC 2119) | draft |
| [`01-artifact.md`](01-artifact.md) | Формат артефакта v2: top-level, archetype, slots, control-archetypes | draft |
| [`02-core-semantics.md`](02-core-semantics.md) | Семантика ядра: потоки Φ/Δ/Σ/Π, fold, causal order, composition algebra, TTL, anchoring, invariants | draft |
| [`03-conformance.md`](03-conformance.md) | Классы L1–L4, ось coverage (archetypes × controls × tracks × features), materialization tracks (pixels/voice/agent/document), capability surface, conformance declaration | draft |
| [`04-test-suite.md`](04-test-suite.md) | Формат conformance-тестов, индекс fixture'ов, минимальные наборы по уровням | draft |
| [`05-reference-implementations.md`](05-reference-implementations.md) | 8 пакетов `@intent-driven/*` + host-прототип как reference impls | draft |
| [`06-versioning.md`](06-versioning.md) | SemVer для спецификации и формата артефакта, forward/backward compat, deprecation policy | draft |
| [`artifact.schema.json`](artifact.schema.json) | Формальный JSON Schema артефакта v2 (draft-2020-12) | draft |
| [`effect.schema.json`](effect.schema.json) | Формальный JSON Schema эффекта (+ irreversibility, witness) | draft |
| [`ontology.schema.json`](ontology.schema.json) | Формальный JSON Schema онтологии (entities, roles, rules, invariants) | draft |
| [`intent.schema.json`](intent.schema.json) | Формальный JSON Schema намерения (particles, creates, irreversibility, ...) | draft |
| [`projection.schema.json`](projection.schema.json) | Формальный JSON Schema проекции (kind, witnesses, subCollections, steps, ...) | draft |
| [`conformance.schema.json`](conformance.schema.json) | JSON Schema `conformance.json` (для реализаций, §3.8) | draft |
| [`tests/`](tests/) | Corpus fixtures (artifacts + effects + composition + fold + anchoring) + manifest | draft |

## Валидация

Два скрипта (ненормативные, для разработчика):

```bash
node scripts/spec-validate.mjs                 # все 119 артефактов из 9 доменов
node scripts/spec-validate.mjs --domain X      # один домен
node scripts/spec-validate.mjs --effects       # ≤200 confirmed-эффектов из server/idf.db

node scripts/spec-export-fixtures.mjs          # перегенерация tests/ corpus'а
```

Текущий статус v0.1:

- **118/119** артефактов соответствуют [`artifact.schema.json`](artifact.schema.json) (один known issue — см. §1.8 `01-artifact.md`);
- **200/200** confirmed-эффектов соответствуют [`effect.schema.json`](effect.schema.json);
- **9/9** онтологий × **605/605** intent'ов × **105/105** проекций соответствуют [`ontology.schema.json`](ontology.schema.json) / [`intent.schema.json`](intent.schema.json) / [`projection.schema.json`](projection.schema.json);
- **~138** нормативных проверок в [`tests/`](tests/) (119 artifacts + 100 effects corpus + 6 composition + 7 fold + 6 anchoring).

## Conformance language

Ключевые слова **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY** в этом документе интерпретируются согласно [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) и [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) (только когда они выделены **жирным** в нормативном контексте).

## Reference implementations

- **Parser / fold / anchoring** — [`@intent-driven/core`](https://www.npmjs.com/package/@intent-driven/core) (BSL 1.1)
- **Pixel renderer** — [`@intent-driven/renderer`](https://www.npmjs.com/package/@intent-driven/renderer) + четыре UI-адаптера (MIT):
  - [`@intent-driven/adapter-mantine`](https://www.npmjs.com/package/@intent-driven/adapter-mantine) — corporate / data-dense
  - [`@intent-driven/adapter-shadcn`](https://www.npmjs.com/package/@intent-driven/adapter-shadcn) — handcrafted / sketch
  - [`@intent-driven/adapter-apple`](https://www.npmjs.com/package/@intent-driven/adapter-apple) — premium / visionOS-glass
  - [`@intent-driven/adapter-antd`](https://www.npmjs.com/package/@intent-driven/adapter-antd) — enterprise-fintech
- **Voice materializer** — `server/schema/voiceMaterializer.cjs` (прототип `idf`, MIT)
- **Document materializer** — `server/schema/documentMaterializer.cjs` (прототип `idf`, MIT)
- **Agent-API materializer** — `server/routes/agent.js` (прототип `idf`, MIT)
- **Canvas utilities** — [`@intent-driven/canvas-kit`](https://www.npmjs.com/package/@intent-driven/canvas-kit) (MIT)
- **Domain authoring CLI** — [`@intent-driven/cli`](https://www.npmjs.com/package/@intent-driven/cli) (MIT)

Четыре независимых UI-адаптера, рендерящие один и тот же артефакт, — **живое доказательство conformance**.

## Вклад

Текущий владелец спецификации: `ignatdubovskiy@gmail.com`.
Обратная связь / правки — через issues в репозитории прототипа (`github.com/DubovskiyIM/idf`).

## Лицензия

Спецификация публикуется под CC BY 4.0 (выравнивается с практикой W3C / IETF для спецификаций).
Reference implementations лицензированы отдельно — см. индивидуальные пакеты.
