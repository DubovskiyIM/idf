# Debugging derived UI — measurement scripts

Набор скриптов для замера spec-debt метрик, эмпирических проверок работы R-правил,
diff derived vs authored. Все импортируют из `@intent-driven/core`.

## Зависимости

Требуется `@intent-driven/core >= 0.17` со следующими экспортами:
- `deriveProjections(intents, ontology)` — publicly exported, PR #61
- `composeProjections(intents, ontology, overrides, extra)` — PR #61
- `crystallizeV2(...)` — всегда
- R1–R10 witness trail — PR'ы #61, #63, #64, #65
- `explainCrystallize`, `resolveCompositions`, `collectNearMissWitnesses` — PR'ы #66, #67, #69

До npm release SDK после merge этих PR'ов — можно запускать через локальный
`pnpm link` на sibling-checkout idf-sdk, собранный из соответствующей ветки.

## Скрипты

| Файл | Что измеряет |
|---|---|
| `derivation-spec-debt.mjs` | Witness trail per-домен — какие правила R1–R10 срабатывают (по 10 доменам). |
| `uncovered-classification.mjs` | L1 / L2 / U classification по 10 доменам с signature-паттернами uncovered'а. Главный источник spec-debt метрики `U / total`. |
| `derivation-diff-sales.mjs` | Side-by-side сравнение authored vs derived для sales. Показывает, сколько rename-based и сколько реальных overrides. |
| `derivation-diff-invest.mjs` | То же для invest. Plus гипотетический impact если объявить `ontology.compositions`. |
| `layered-authoring-sales.mjs` | Прототип `composeProjections` на sales — сравнивает current hand-authored `PROJECTIONS` с композированным результатом. LOC, semantic-equivalence, witness coverage. |
| `ontology-audit.mjs` | FK-drift findings — поля `<entity>Id: type:"text"` вместо `entityRef`. 39 findings в invest/delivery/freelance на момент 2026-04-20. |

## Запуск

```bash
npm run invest-ml &  # опц.: некоторые домены ожидают backend'ы
node scripts/uncovered-classification.mjs
node scripts/ontology-audit.mjs
```

## Интерпретация метрики

**spec-debt v2.1** = `U / total`, где:
- `L1` — derivable через R1–R10 с opt-in rename
- `L2` — archetype-free first-class authored (dashboard/canvas/wizard/form)
- `U` — неоткрытый gap в R-правилах

Цель: монотонно убывающий `U / total` по минорным версиям формата.

Спецификация: `idf-manifest-v2.1/docs/design/debugging-derived-ui-spec.md`.
