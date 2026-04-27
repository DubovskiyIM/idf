# JointSolver divergence — A2 Phase 3e validation re-run

**Generated:** 2026-04-27T10:46:17.581Z

> Re-run Phase 3a/3c'' divergence collection с активированным `opts.respectRoleCanExecute: true` (Phase 3d.1/3d.2 SDK opt-in). Per-role symmetric comparison: derived per-role (через crystallizeV2 opts) vs alternate per-role (через computeAlternateAssignment).

## Per-domain summary

| Domain | Records | Total | Divergent | Derived-only | Alternate-only | Agreed |
|--------|---------|-------|-----------|--------------|----------------|--------|
| booking | 12 | 30 | 7 | 10 | 12 | 1 |
| planning | 2 | 14 | 5 | 0 | 8 | 1 |
| workflow | 5 | 17 | 5 | 0 | 9 | 3 |
| messenger | 11 | 62 | 17 | 0 | 28 | 17 |
| sales | 38 | 441 | 150 | 115 | 68 | 108 |
| lifequest | 4 | 11 | 6 | 0 | 5 | 0 |
| reflect | 5 | 6 | 3 | 0 | 3 | 0 |
| invest | 5 | 5 | 0 | 0 | 5 | 0 |
| delivery | 4 | 4 | 0 | 0 | 4 | 0 |
| freelance | 1 | 4 | 1 | 0 | 2 | 1 |
| compliance | 10 | 10 | 0 | 0 | 10 | 0 |
| keycloak | 55 | 225 | 15 | 0 | 5 | 205 |
| argocd | 40 | 130 | 15 | 0 | 40 | 75 |
| notion | 20 | 73 | 30 | 0 | 16 | 27 |
| automation | 2 | 8 | 2 | 0 | 0 | 6 |
| gravitino | 24 | 86 | 31 | 0 | 1 | 54 |
| meta | 8 | 26 | 13 | 0 | 4 | 9 |
| **TOTAL** | — | **1152** | **300** | **125** | **220** | **507** |

**Agreement rate:** 44.0% (507/1152)
**Divergence rate:** 26.0% (300/1152)

## Phase 3a vs 3c'' vs 3e comparison

| Metric | Phase 3a baseline | Phase 3c'' empirical | **Phase 3e + canExec** | Δ vs 3a |
|--------|-------------------|---------------------|-------------------|---------|
| Total intents | 1673 | 1673 | 1152 | -521 |
| Agreed | 99 | 119 | **507** | +408 |
| Divergent | 470 | 450 | 300 | -170 |
| Derived-only | 873 | 873 | **125** | -748 |
| Alternate-only | 231 | 231 | 220 | -11 |
| **Agreement rate** | 5.9% | 7.1% | **44.0%** | 38.1pp |
