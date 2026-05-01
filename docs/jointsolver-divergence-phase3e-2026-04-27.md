# JointSolver divergence — A2 Phase 3e validation re-run

**Generated:** 2026-04-27T15:34:17.375Z

> Re-run Phase 3a/3c'' divergence collection с активированным `opts.respectRoleCanExecute: true` (Phase 3d.1/3d.2 SDK opt-in). Per-role symmetric comparison: derived per-role (через crystallizeV2 opts) vs alternate per-role (через computeAlternateAssignment).

## Per-domain summary

| Domain | Records | Total | Divergent | Derived-only | Alternate-only | Agreed |
|--------|---------|-------|-----------|--------------|----------------|--------|
| booking | 12 | 30 | 4 | 10 | 12 | 4 |
| planning | 2 | 14 | 4 | 0 | 8 | 2 |
| workflow | 5 | 17 | 4 | 0 | 9 | 4 |
| messenger | 11 | 62 | 21 | 0 | 28 | 13 |
| sales | 38 | 444 | 136 | 103 | 71 | 134 |
| lifequest | 4 | 11 | 5 | 0 | 5 | 1 |
| reflect | 5 | 6 | 1 | 0 | 3 | 2 |
| invest | 5 | 5 | 0 | 0 | 5 | 0 |
| delivery | 4 | 4 | 0 | 0 | 4 | 0 |
| freelance | 1 | 4 | 1 | 0 | 2 | 1 |
| compliance | 10 | 10 | 0 | 0 | 10 | 0 |
| keycloak | 55 | 225 | 15 | 0 | 5 | 205 |
| argocd | 40 | 130 | 15 | 0 | 40 | 75 |
| notion | 20 | 73 | 17 | 0 | 16 | 40 |
| automation | 2 | 8 | 0 | 0 | 0 | 8 |
| gravitino | 24 | 86 | 31 | 0 | 1 | 54 |
| meta | 8 | 26 | 12 | 0 | 4 | 10 |
| **TOTAL** | — | **1155** | **266** | **113** | **223** | **553** |

**Agreement rate:** 47.9% (553/1155)
**Divergence rate:** 23.0% (266/1155)

## Phase 3a vs 3c'' vs 3e comparison

| Metric | Phase 3a baseline | Phase 3c'' empirical | **Phase 3e + canExec** | Δ vs 3a |
|--------|-------------------|---------------------|-------------------|---------|
| Total intents | 1673 | 1673 | 1155 | -518 |
| Agreed | 99 | 119 | **553** | +454 |
| Divergent | 470 | 450 | 266 | -204 |
| Derived-only | 873 | 873 | **113** | -760 |
| Alternate-only | 231 | 231 | 223 | -8 |
| **Agreement rate** | 5.9% | 7.1% | **47.9%** | 42.0pp |
