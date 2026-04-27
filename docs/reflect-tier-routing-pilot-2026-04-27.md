# Reflect tier-routing pilot (2026-04-27)

Активация `ontology.features.salienceDrivenRouting` (idf-sdk #434) на reflect-домене с переносом 2 sidecar-аннотаций из A2 author-audit (idf #166).

## Изменения

| Файл | Что |
|---|---|
| `src/domains/reflect/ontology.js` | `features.salienceDrivenRouting: true` |
| `src/domains/reflect/intent-salience.js` (new) | `INTENT_SALIENCE = { create_activity: 80, create_tag: 80 }` |
| `src/domains/reflect/domain.js` | merge layer: `RAW_INTENTS + INTENT_SALIENCE` |
| `package.json` | `@intent-driven/core ^0.101.1 → ^0.105.0` |

## Validation

Re-run `scripts/jointsolver-divergence-collect-with-canexec.mjs`:

| Метрика | Audit baseline (0.101.1) | Pilot (0.105.0 + reflect features) | Δ |
|---|---:|---:|---:|
| **reflect agreed** | 0 | **2** | +2 |
| **reflect divergent** | 3 | **1** | −2 |
| Reflect total | 6 | 6 | — |
| **Global agreed** | 507 | 533 | +26 |
| **Global agreement rate** | 44.0% | 46.1% | +2.1pp |

Только reflect получил opt-in; остальные домены изменились из-за SDK
intermediate'ов (0.102 → 0.105 включая Phase 3d.3 default flip + других PR'ов).

## Verified placement

`create_activity` и `create_tag` теперь корректно в `slots.hero` без
дубликата в `slots.toolbar` (требует SDK PR #436 patch для
`catalog-creator-toolbar` pattern dedup).

## Зависимость от SDK PR #436

Без `idf-sdk#436` (catalog-creator-toolbar dedup) tier-routing работает
для creator'ов с `confirmation: "click"` или single-text creator'ов, но
для `confirmation: "form"` creator'ов pattern добавляет duplicate в toolbar
после hero promotion. Reflect creator'ы используют `confirmation: "form"`,
поэтому pilot ждёт merge #436 для clean derived-output без дублей.

Метрика divergence (533/1157) уже отражает поведение с обоими fix'ами
(verified локально через tarball install).
