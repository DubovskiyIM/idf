# Empirical archetype slot model — A2 Phase 3b

**Generated:** 2026-04-27T07:44:00.931Z

> Извлечено из existing `assignToSlots*` output на 16 доменах. Per archetype × slot: capacity (p95), observed roles, destructive ratio, projection coverage. Drop-in для `getDefaultSlotsForArchetype` в Phase 3c'.

## catalog

| Slot | Capacity (p95) | Allowed roles | Domains | Projections | Median count | Max count | Destructive ratio |
|------|---------------|---------------|---------|-------------|--------------|-----------|-------------------|
| `toolbar` | 5 | `navigation` | 10 | 29 | 1 | 5 | 0 |
| `overlay` | 9 | `destructive, navigation` | 12 | 54 | 3 | 32 | 0.019 |
| `hero` | 2 | `navigation` | 6 | 23 | 1 | 1 | 0 |

## detail

| Slot | Capacity (p95) | Allowed roles | Domains | Projections | Median count | Max count | Destructive ratio |
|------|---------------|---------------|---------|-------------|--------------|-----------|-------------------|
| `toolbar` | 3 | `navigation` | 10 | 29 | 2 | 3 | 0 |
| `overlay` | 9 | `navigation` | 10 | 30 | 3 | 30 | 0 |
| `primaryCTA` | 10 | `navigation` | 6 | 9 | 3 | 10 | 0 |
| `footer` | 35 | `navigation` | 7 | 14 | 4 | 35 | 0 |

## feed

| Slot | Capacity (p95) | Allowed roles | Domains | Projections | Median count | Max count | Destructive ratio |
|------|---------------|---------------|---------|-------------|--------------|-----------|-------------------|
| `toolbar` | 5 | `navigation` | 3 | 6 | 4 | 5 | 0 |
| `overlay` | 14 | `destructive, navigation` | 3 | 6 | 13 | 13 | 0.017 |

## Proposed `getDefaultSlotsForArchetype` body (Phase 3c')

```js
const SLOTS_CATALOG = {
  toolbar    : { capacity:  5, allowedRoles: ["navigation"] },
  overlay    : { capacity:  9, allowedRoles: ["destructive", "navigation"] },
  hero       : { capacity:  2, allowedRoles: ["navigation"] },
};

const SLOTS_DETAIL = {
  toolbar    : { capacity:  3, allowedRoles: ["navigation"] },
  overlay    : { capacity:  9, allowedRoles: ["navigation"] },
  primaryCTA : { capacity: 10, allowedRoles: ["navigation"] },
  footer     : { capacity: 35, allowedRoles: ["navigation"] },
};

const SLOTS_FEED = {
  toolbar    : { capacity:  5, allowedRoles: ["navigation"] },
  overlay    : { capacity: 14, allowedRoles: ["destructive", "navigation"] },
};
```

## Diff vs Phase 2b упрощённой модели

| Archetype | Phase 2b slots | Empirical slots | New (added) | Missing |
|-----------|----------------|-----------------|-------------|---------|
| catalog | hero, toolbar, context, fab | toolbar, overlay, hero | overlay | context, fab |
| detail | primaryCTA, secondary, toolbar, footer | toolbar, overlay, primaryCTA, footer | overlay | secondary |
| feed | toolbar, context, fab | toolbar, overlay | overlay | context, fab |
