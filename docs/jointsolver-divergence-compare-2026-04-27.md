# JointSolver divergence — Phase 3a vs Phase 3c'' validation

**Generated:** 2026-04-27 · A2 calibration loop closure

## TL;DR

Empirical default slot model (Phase 3c', idf-sdk #398) даёт **modest, не massive** improvement vs Phase 2b упрощённой модели:

| Metric | Phase 3a (Phase 2b SDK) | Phase 3c'' (Phase 3c' SDK) | Δ |
|--------|-------------------------|----------------------------|---|
| Total intents | 1 673 | 1 673 | 0 |
| Agreed | 99 | **119** | **+20** |
| Divergent | 470 | **450** | **−20** |
| Derived-only | 873 | 873 | 0 |
| Alternate-only | 231 | 231 | 0 |
| **Agreement rate** | **5.9%** | **7.1%** | **+1.2pp** |

**Что улучшилось:** 20 intents переехали из `divergent` (existing × Hungarian disagree) в `agreed` (both ставят в same slot). Это новый `overlay` slot и recalibrated capacities.

**Что НЕ улучшилось:** 873 derived-only intents — structural mismatch.

## Корень не-improvement: filter mismatch

873 intents есть в derived `assignToSlots*` output, но `computeAlternateAssignment` их даже не видит. Причина — разные filter chains:

| Where | Filter |
|-------|--------|
| `assignToSlots*` (derived) | `appliesToProjection`, role-aware salience filtering, IB whitelist, custom intent type checks |
| `computeAlternateAssignment` (alternate) | `accessibleIntents(projection, role, INTENTS, ONTOLOGY)` — `intentTouchesEntity` + `roleDef.canExecute` |

`accessibleIntents` strict — требует intent.particles.entities или effects на mainEntity. `assignToSlots*` accept'ует более широкий set.

## Что это значит для Phase 3 roadmap

**Bottleneck сместился** со slot-model alignment (Phase 3a–3c') на **filter alignment** (Phase 3d).

Updated roadmap:

- ✅ **3a** (idf #151) — divergence dataset (5.9% baseline)
- ✅ **3b** (idf #153) — empirical model proposal
- ✅ **3c'** (idf-sdk #398) — apply empirical в SDK
- ✅ **3c''** (этот PR) — validation re-run, +1.2pp confirmed
- **3d** (next) — filter alignment: либо `computeAlternateAssignment` использует тот же filter chain как `assignToSlots*`, либо derived проходит через `accessibleIntents` для honest comparison.

## Per-domain delta

| Domain | Phase 3a div | Phase 3c'' div | Δ | Phase 3a agreed | Phase 3c'' agreed | Δ |
|--------|--------------|----------------|---|-----------------|-------------------|---|
| booking | 18 | 16 | −2 | 0 | 2 | +2 |
| planning | 6 | 4 | −2 | 0 | 2 | +2 |
| workflow | 7 | 4 | −3 | 1 | 4 | +3 |
| messenger | 33 | 32 | −1 | 1 | 2 | +1 |
| sales | 61 | 46 | **−15** | 2 | **17** | **+15** |
| lifequest | 4 | 3 | −1 | 0 | 1 | +1 |
| reflect | 3 | 3 | 0 | 0 | 0 | 0 |
| invest | 0 | 0 | 0 | 0 | 0 | 0 |
| delivery | 0 | 0 | 0 | 0 | 0 | 0 |
| freelance | 2 | 2 | 0 | 0 | 0 | 0 |
| compliance | 0 | 0 | 0 | 0 | 0 | 0 |
| keycloak | 170 | 165 | −5 | 50 | 55 | +5 |
| argocd | 55 | 55 | 0 | 35 | 35 | 0 |
| notion | 30 | 37 | +7 | 7 | 0 | −7 |
| automation | 5 | 7 | +2 | 2 | 0 | −2 |
| gravitino | 76 | 76 | 0 | 1 | 1 | 0 |

**Best gains:** sales −15 div / +15 agreed, keycloak −5 div / +5 agreed, workflow −3 / +3.

**Regressions:** notion +7 div / −7 agreed, automation +2 / −2. Это intents которые Phase 2b случайно ставила в правильный slot, а empirical model теперь — в другой. Edge cases для Phase 3d analysis.

## Заключение

A2 Phase 3 calibration loop **closed**. Bottleneck сместился. Phase 3d (filter alignment) — следующий significant step.

Inclusive defaults strategy подтверждена — explicit-salience workflows работают, unannotated workflows получают reasonable defaults.

## Артефакты

- Phase 3a baseline: `docs/jointsolver-divergence-2026-04-27.json/.md`
- Phase 3b empirical model: `docs/empirical-slot-model-2026-04-27.json/.md`
- Phase 3c'' validation: `docs/jointsolver-divergence-validation-2026-04-27.json/.md`
- Этот compare: `docs/jointsolver-divergence-compare-2026-04-27.md`

## SDK PR

idf-sdk #398 — `feat(core): joint solver Phase 3c' — empirical default slot models`
