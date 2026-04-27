# A2 Calibration Journey — closure (2026-04-27)

Финальный документ A2 series. От 5.9% до 47.9% agreement за 19 PR'ов и 3 calendar дня.

## Final metric (post default-flip, validated via #441 tarball)

| Метрика | Значение | Δ vs baseline |
|---|---:|---:|
| Total intents | 1155 | -518 (per-role × per-projection) |
| **Agreed** | **553** | **+454 (+5.6×)** |
| Divergent | 266 | −204 |
| Derived-only | 113 | −760 |
| Alternate-only | 223 | −8 |
| **Agreement rate** | **47.9%** | **+42.0pp** |

## Phase progression

| Phase | Agreement | Δ | Key change |
|---|---:|---:|---|
| 3a (baseline) | 5.9% | — | initial measurement |
| 3c'' empirical | 7.1% | +1.2pp | empirical slot model |
| 3d.1/3d.2 (opt-in canExec) | (not measured global) | — | opt-in pre-filter |
| 3d.3 (default flip canExec) | 44.0% | +36.9pp | sales 583→0 violations |
| **post tier-routing default-flip** | **47.9%** | **+3.9pp** | creator-of-main → hero auto |

## Per-domain final breakdown

| Domain | Records | Total | Divergent | Derived-only | Alternate-only | Agreed | Agreement |
|---|---|---|---:|---:|---:|---:|---:|
| keycloak | 55 | 225 | 15 | 0 | 5 | 205 | 91.1% |
| argocd | 40 | 130 | 15 | 0 | 40 | 75 | 57.7% |
| gravitino | 24 | 86 | 31 | 0 | 1 | 54 | 62.8% |
| notion | 20 | 73 | 17 | 0 | 16 | 40 | 54.8% |
| sales | 38 | 444 | 136 | 103 | 71 | 134 | 30.2% |
| messenger | 11 | 62 | 21 | 0 | 28 | 13 | 21.0% |
| meta | 8 | 26 | 12 | 0 | 4 | 10 | 38.5% |
| automation | 2 | 8 | 0 | 0 | 0 | 8 | 100.0% |
| compliance | 10 | 10 | 0 | 0 | 10 | 0 | 0.0% |
| invest | 5 | 5 | 0 | 0 | 5 | 0 | 0.0% |
| delivery | 4 | 4 | 0 | 0 | 4 | 0 | 0.0% |
| reflect | 5 | 6 | 1 | 0 | 3 | 2 | 33.3% |
| booking | 12 | 30 | 4 | 10 | 12 | 4 | 13.3% |
| workflow | 5 | 17 | 4 | 0 | 9 | 4 | 23.5% |
| planning | 2 | 14 | 4 | 0 | 8 | 2 | 14.3% |
| lifequest | 4 | 11 | 5 | 0 | 5 | 1 | 9.1% |
| freelance | 1 | 4 | 1 | 0 | 2 | 1 | 25.0% |
| **TOTAL** | — | **1155** | **266** | **113** | **223** | **553** | **47.9%** |

## Notable post-flip movements

- **notion**: 27 → **40 agreed** (+13). Block creators (block_text, block_heading, block_image, etc.) auto-promoted в hero
- **booking**: 1 → 4 agreed (+3). add_service, create_booking moved toolbar → hero
- **automation**: 6 → 8 agreed (+2). 100% agreement в этом домене
- **reflect**: 0 → 2 agreed (+2). create_activity, create_tag (audit's propose-primary closure)

## A2 PR sequence (19 SDK + 9 host = 28 total)

### Phase 3a-3c (data + empirical model)
- idf #151/#153: Phase 3a baseline
- idf-sdk #398, idf #155: Phase 3c'/3c'' empirical (5.9% → 7.1%)

### Phase 3d (filter alignment)
- idf #156, idf-sdk #400: Phase 3d/3d.1/3d.2 opt-in
- idf-sdk #403: pass-through fix
- idf-sdk #406, idf #157/#159: Phase 3e/3f (9.8 → 14.3%)
- idf-sdk #410, idf #161: 873 → 0 derivedOnly + bridge normalize
- idf-sdk #414: Phase 3g bridge symmetry (15.7%)
- idf-sdk #420/#422/#424/#427: Phase 4-7 slot-model calibration (21.9% → 54.5% interim)
- **idf-sdk #430 + idf #165: Phase 3d.3 default flip + sales 583 audit (44.0%)**

### Author audit (post-3d.3)
- **idf #166: 245 divergent intents triage + empirical finding**
- idf-sdk #434: tier-driven slot routing extension (opt-in)
- idf-sdk #436: catalog-creator-toolbar dedup
- idf #167: reflect host pilot (validated tier routing works)
- idf-sdk #438: classifyIntentRole consultation generalize
- **idf #168: default-flip readiness audit — 42 implicit-primary intents**
- idf-sdk #441 (re-targeted #439): default-flip — opt-in → opt-out

## Closed roadmap items

| # | Item | PR |
|---|---|---|
| 1 | SDK opt-in tier routing | #434 ✓ |
| 2 | Pattern dedup fix | #436 ✓ |
| 3 | Host pilot (reflect) | idf #167 ✓ |
| 4 | classifyIntentRole consultation | #438 ✓ |
| 5 | Default-flip audit + SDK flip | idf #168 + #441 (open) |
| 6 | Symmetric utility tier routing | deferred (low value: см. ниже) |

## Why Step 6 deferred

Симметричное routing для utility-tier (`salience < 30`) intents оказалось менее ценным после анализа:

- **Catalog**: low-salience intents автоматически попадают в overflow subgroup через `bySalienceDesc` + `toolbar.splice(5)`. Дополнительный slot routing требует unification slot model между derived (`overlay` = modal panels) и alternate (`overlay` = overflow tier). Архитектурный change, не surgical.
- **Detail**: footer slot whitelist-based. Расширение на tier-driven routing размывает explicit footerIntents semantics.
- **Audit data**: 45 propose-utility intents — в основном sales lifecycle gates (cancel/publish_listing) и dispute workflow. Их divergence — UX questions ("должен ли cancel_listing быть hero CTA?"), не SDK gaps.

**Recommendation**: оставить Step 6 в backlog как "slot model unification project" — отдельная работа когда метрика снова окажется bottleneck'ом.

## A2 series cumulative impact

- **Agreement boost**: 5.9% → 47.9% (×8.1 multiplicative, +42.0pp absolute)
- **Derived-only collapse**: 873 → 113 (-87%)
- **Sales canExec violations**: 583 → 0 (Phase 3d.3 closure)
- **Author annotation requirement**: 0 — все improvements автоматические через SDK
- **PR count**: 28 (19 SDK + 9 host)
- **Calendar days**: 3 (2026-04-25 to 2026-04-27)

## Open follow-ups (post-A2)

1. SDK PR #441 merge → core@0.106.0 publish → host package.json bump
2. Roll-out на остальные 7 доменов из dormant dataset (idf #166): автоматически активируется после default-flip merge — sidecar annotations не требуются для primary tier
3. Manual-review batch (70 intents в idf #166) — отдельный sprint
4. Symmetric utility tier routing — backlogged
