# JointSolver filter alignment — DECISION (A2 Phase 3d)

**Date:** 2026-04-27
**Backlog:** idf-sdk § A2 Phase 3d
**Sources:** `docs/jointsolver-filter-alignment-2026-04-27.{json,md}`

## TL;DR

Phase 3d research показало, что 89.3% всех `derivedOnly` mismatches (846 из 893) — это **`role-canExecute-restriction`**. Existing `assignToSlots*` показывает intents даже если активная role не имеет их в `canExecute` whitelist.

Это **не calibration issue**, а **show-but-fail UX anti-pattern + security gap**: user видит CTA-кнопку, кликает, получает 403 от backend (или silent no-op).

**Decision: Path C (hybrid migration)** — opt-in pre-filter `assignToSlots*` через `accessibleIntents`, gradual rollout через 3 версии.

## Reason distribution

| Reason | Count | % | Tier |
|--------|-------|---|------|
| `role-canExecute-restriction` | 846 | **89.3%** | **Policy bug** (show-but-fail) |
| `missing-entity-reference` | 98 | 10.3% | **Author bug** (incomplete particles) |
| `permittedFor-mismatch` | 3 | 0.3% | Edge case |

## Per-domain hot-spots

| Domain | Total | role-canExec | missing-entity-ref | permittedFor |
|--------|-------|--------------|-------------------|--------------|
| sales | 609 | **593** | 32 | 0 |
| notion | 113 | 94 | 45 | 3 |
| messenger | 44 | 41 | 9 | 0 |
| lifequest | 26 | 26 | 0 | 0 |
| automation | 25 | 24 | 4 | 0 |
| booking | 24 | 24 | 0 | 0 |
| meta (idf-on-idf) | 20 | 20 | 0 | 0 |
| reflect | 14 | 14 | 0 | 0 |
| gravitino | 8 | 0 | 8 | 0 |
| freelance | 6 | 6 | 0 | 0 |
| workflow | 4 | 4 | 0 | 0 |

**Clean (0 derivedOnly):** invest, delivery, compliance, keycloak, argocd, planning. Эти домены либо **не определяют `role.canExecute`** (роли видят всё — derived = alternate), либо корректно структурированы.

**Sales — extreme outlier** (66% всех `role-canExec` cases). Содержит 11 ролей с тонкой grain'овой разграничением canExecute. `assignToSlots*` игнорирует это полностью.

## Concrete examples

### role-canExecute-restriction (89.3%)

```
booking/service_catalog × client (catalog, mainEntity: Service)
  add_service → derived toolbar
  → role.canExecute['client'] не включает add_service
  → user видит кнопку, но не может execute
```

### missing-entity-reference (10.3%)

```
messenger/conversation_list × self (catalog, mainEntity: Conversation)
  search_messages → derived toolbar
  → search_messages.particles НЕ упоминает Conversation
  → accessibleIntents отбрасывает; derived всё равно показывает
```

### permittedFor-mismatch (0.3%)

```
notion/page_detail × commenter (detail, mainEntity: Page)
  unarchive_page → derived overlay
  → unarchive_page.permittedFor = ['workspaceOwner', 'editor']
  → commenter не в списке; derived всё равно показывает
```

## Decision

### Path C selected: hybrid migration через opt-in pre-filter

**Phase 3d.1 — Opt-in flag (этот PR):**
- `assignToSlots*` принимает `opts.respectRoleCanExecute: boolean` (default `false`).
- Если `true`: до построения slots отбрасываем intents где `role.canExecute` defined и не включает `intent.id`.
- Default `false` → backward-compat, no regression.

**Phase 3d.2 — Witness emission:**
- Если `opts.respectRoleCanExecute === false` AND есть intents которые **были бы** отфильтрованы → emit witness `basis: "role-canExecute-violation"` reliability `rule-based`.
- Author видит в Studio: «эти CTA не должны быть видны для этой role».
- Не behavior change, только diagnostic.

**Phase 3d.3 — Default flip (major version, по готовности):**
- `respectRoleCanExecute` default `true` в новом major.
- 16 доменов нужно re-validate; sales особенно (593 показанных-но-неисполнимых intents — некоторые могут быть intentional UI).
- Migration guide: для каждого домена либо
  (a) дополнить `role.canExecute` чтобы включить intent (intentional UI),
  либо (b) принять removal (true show-but-fail bug).

### Параллельно: `missing-entity-reference` warnings (10.3%)

Это **author bugs**, не filter design. В `assignToSlots*`:

- Если intent в derived output, но `intentTouchesEntity(intent, mainEntity) === false` — emit witness `basis: "missing-entity-reference"` reliability `rule-based`.
- Author видит → дополняет `particles.entities` либо `particles.effects[].target` либо `intent.creates`.

Это сразу actionable, не нужен migration.

## Why not Path A or B

### Path A (align computeAlternateAssignment под assignToSlots*) — REJECTED
- Couples bridge module к internal logic.
- Bridge перестаёт быть чистой утилитой над ontology.
- Lose canonical reference filter для cross-modality consistency (§23 axiom 5).

### Path B (post-filter derived через accessibleIntents для метрики) — INSUFFICIENT
- Не меняет UI behaviour.
- 593 sales-intents продолжают показываться users которые не могут execute.
- Метрика становится honest, но real bug остаётся.

### Path C — selected
- Single source of truth: `accessibleIntents` becomes canonical.
- Gradual rollout не breaks existing.
- Witness emission даёт author surface до behavior change.
- Sales может явно `respectRoleCanExecute: false` если действительно intentional show-with-permission-error pattern.

## SDK API design (Phase 3d.1)

```js
// packages/core/src/crystallize_v2/assignToSlots*.js
export function assignToSlotsCatalog(INTENTS, projection, ONTOLOGY, strategy, shape, opts = {}) {
  // ...

  // Phase 3d.1: opt-in pre-filter через role.canExecute
  let effectiveIntents = INTENTS;
  if (opts.respectRoleCanExecute && opts.role) {
    const allowed = ONTOLOGY?.roles?.[opts.role]?.canExecute;
    if (Array.isArray(allowed)) {
      const allowedSet = new Set(allowed);
      effectiveIntents = Object.fromEntries(
        Object.entries(INTENTS).filter(([id]) => allowedSet.has(id))
      );
    }
  }

  // ...rest использует effectiveIntents вместо INTENTS
}
```

## Witness shapes

```js
// role-canExec-violation (Phase 3d.2)
{
  basis: "role-canExecute-violation",
  reliability: "rule-based",
  intentId, role, archetype,
  message: `Intent ${intentId} shown в derived UI но role ${role} не имеет его в canExecute`,
}

// missing-entity-reference (parallel author warning)
{
  basis: "missing-entity-reference",
  reliability: "rule-based",
  intentId, mainEntity, projection,
  message: `Intent ${intentId} в slot ${slot} но не упоминает ${mainEntity} в particles`,
  recommendation: `Add particles.entities: ["${mainEntity}"] или effects[].target = "${mainEntity}*"`,
}
```

## Validation strategy

После Phase 3d.1+3d.2 implementation:

1. Re-run `scripts/jointsolver-divergence-collect.mjs` с `respectRoleCanExecute: true` flag.
2. Expected: derivedOnly 873 → ~30 (только missing-entity-reference + permittedFor-mismatch).
3. Agreement rate должен подняться до ~30-40% (если все 16 доменов остаются valid).
4. Если sales/notion regress (intents исчезают из UI которые автор хотел показывать) — author правит `role.canExecute`.

## Roadmap impact

A2 Phase 3 calibration **completed** as research:
- ✅ 3a — divergence dataset (5.9% baseline)
- ✅ 3b — empirical model proposal
- ✅ 3c' — apply empirical в SDK (PR #398)
- ✅ 3c'' — validation re-run (+1.2pp)
- ✅ 3d — filter alignment **decision** (этот PR)

A2 Phase 3 closure: implementation goes в **Phase 3d.1/3d.2** (separate idf-sdk PR — opt-in flag + witness emission). Phase 3d.3 (default flip) — long-term, требует per-domain migration.

После 3d.1/3d.2 — **A2 functionally + research complete**. Production ready через 3d.3 в новом major.
