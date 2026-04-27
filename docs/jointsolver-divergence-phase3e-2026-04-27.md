# JointSolver divergence — A2 Phase 3e validation re-run

**Generated:** 2026-04-27T08:40:03.737Z

> Re-run Phase 3a/3c'' divergence collection с активированным `opts.respectRoleCanExecute: true` (Phase 3d.1/3d.2 SDK opt-in). Per-role symmetric comparison: derived per-role (через crystallizeV2 opts) vs alternate per-role (через computeAlternateAssignment).

## Per-domain summary

| Domain | Records | Total | Divergent | Derived-only | Alternate-only | Agreed |
|--------|---------|-------|-----------|--------------|----------------|--------|
| booking | 15 | 58 | 18 | 13 | 25 | 2 |
| planning | 2 | 18 | 4 | 0 | 12 | 2 |
| workflow | 5 | 22 | 4 | 1 | 13 | 4 |
| messenger | 12 | 100 | 32 | 24 | 42 | 2 |
| sales | 38 | 452 | 49 | 338 | 45 | 20 |
| lifequest | 5 | 32 | 5 | 20 | 6 | 1 |
| reflect | 6 | 12 | 3 | 6 | 3 | 0 |
| invest | 5 | 5 | 0 | 0 | 5 | 0 |
| delivery | 4 | 4 | 0 | 0 | 4 | 0 |
| freelance | 3 | 8 | 2 | 0 | 6 | 0 |
| compliance | 10 | 10 | 0 | 0 | 10 | 0 |
| keycloak | 55 | 225 | 165 | 0 | 5 | 55 |
| argocd | 40 | 130 | 55 | 0 | 40 | 35 |
| notion | 20 | 62 | 36 | 21 | 5 | 0 |
| automation | 2 | 8 | 7 | 1 | 0 | 0 |
| gravitino | 24 | 86 | 76 | 8 | 1 | 1 |
| meta | 4 | 10 | 8 | 0 | 2 | 0 |
| **TOTAL** | — | **1242** | **464** | **432** | **224** | **122** |

**Agreement rate:** 9.8% (122/1242)
**Divergence rate:** 37.4% (464/1242)

## Phase 3a vs 3c'' vs 3e comparison

| Metric | Phase 3a baseline | Phase 3c'' empirical | **Phase 3e + canExec** | Δ vs 3a |
|--------|-------------------|---------------------|-------------------|---------|
| Total intents | 1673 | 1673 | 1242 | -431 |
| Agreed | 99 | 119 | **122** | +23 |
| Divergent | 470 | 450 | 464 | -6 |
| Derived-only | 873 | 873 | **432** | -441 |
| Alternate-only | 231 | 231 | 224 | -7 |
| **Agreement rate** | 5.9% | 7.1% | **9.8%** | 3.9pp |
