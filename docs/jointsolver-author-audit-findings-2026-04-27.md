# JointSolver author audit — findings (2026-04-27)

Follow-up к A2 calibration journey closure (Phase 3d.3). Цель аудита — manual
review divergent intents между `assignToSlots*` (derived) и `computeAlternateAssignment`
(alternate), с проверкой гипотезы «explicit numeric salience boost'ит agreement».

## Baseline (post-Phase 3d.3)

| Метрика | Значение |
|---|---|
| Total intents (per-role × per-projection) | 1152 |
| Agreed | 507 (44.0%) |
| Divergent | 300 (26.0%) |
| Derived-only | 125 |
| Alternate-only | 220 |

(см. `docs/jointsolver-divergence-phase3e-2026-04-27.json`)

## Triage classification

`scripts/jointsolver-author-audit-triage.mjs` классифицирует каждый divergent
diff record по сильнейшему semantic signal'у:

| Категория | Records | Unique intents |
|---|---:|---:|
| explicit-already (intent.salience уже задан) | 6 | 4 |
| propose-primary (creator-of-main → primary slot) | 7 | 5 |
| propose-secondary (phase-transition → secondary slot) | 0 | 0 |
| propose-navigation (search → toolbar) | 0 | 0 |
| propose-utility (replace/remove на mainEntity → overflow) | 91 | 45 |
| slot-model-mismatch (один solver не разместил intent) | 345 | 121 |
| manual-review (divergent без strong signal) | 196 | 70 |
| **Total unique intents** | — | **245** |

Proposable annotations покрывают 50 unique intents (5 primary + 45 utility) с
понятным author signal'ом. Распределение по доменам:

| Domain | propose-primary | propose-utility | Total |
|---|---:|---:|---:|
| booking | 1 | 2 | 3 |
| planning | 0 | 1 | 1 |
| workflow | 1 | 0 | 1 |
| messenger | 1 | 10 | 11 |
| sales | 0 | 30 | 30 |
| lifequest | 0 | 1 | 1 |
| reflect | 2 | 0 | 2 |
| notion | 0 | 1 | 1 |

## Эмпирическая проверка: salience не двигает метрику

Гипотеза: добавление `intent.salience` (numeric, 80=primary / 70=secondary /
40=navigation / 10=utility) на 50 proposable intents улучшит agreement
(должно сократить divergence в `derived → alternate` парах).

Проверка: применил sidecar pattern (`src/domains/<dom>/intent-salience.js` +
`domain.js` merge layer) для 8 доменов с numeric salience. Re-run divergence:

| Метрика | До (baseline) | После annotations | Δ |
|---|---:|---:|---:|
| Agreed | 507 | 501 | **−6** |
| Divergent | 300 | 316 | **+16** |
| Derived-only | 125 | 115 | −10 |
| Alternate-only | 220 | 225 | +5 |

**Метрика не улучшилась — слегка ухудшилась.** Cause: structural divergence
между двумя solver'ами:

- `computeAlternateAssignment` использует `classifyIntentRole(intent, mainEntity)`
  — салиенс numeric → tier (primary/secondary/navigation/utility) → `allowedRoles`
  → slot. **Salience drives slot routing**.
- `assignToSlotsCatalog/Detail` использует control-type-based routing:
  - `wrapped.type === "inlineSearch"` → toolbar
  - `wrapped.type === "heroCreate"` → hero
  - `isCreator && !isPerItem` → toolbar
  - `isPerItem && hasOverlay` → overlay
  - default `intentButton` → toolbar
  - `salience` используется только для **in-slot ordering** (`bySalienceDesc`),
    не для slot decision.

Следствие: explicit `intent.salience` в host'е изменяет alternate placement,
но не двигает derived. Если новое alternate placement отличается от derived —
divergence растёт.

## Recommendation

**SDK follow-up:** ввести в `assignToSlotsCatalog/Detail` consultation с
`classifyIntentRole(intent, mainEntity)` для slot-routing decisions. Сейчас
функция вызывается только в `buildCostMatrix` (alternate path). Если
`intent.salience >= 80` (primary tier) — направлять в `primaryCTA`/`hero`
независимо от control-type. Это сделает author signal активным во всех путях
кристаллизации и активирует annotation dataset.

Alternative: формализовать derived/alternate как два режима с известной
divergence бюджетом и не пытаться форсировать convergence через author
annotations — agreement metric перестаёт быть meaningful когда два solver'а
делают разные вещи by design.

## Deliverables

| Файл | Назначение |
|---|---|
| `scripts/jointsolver-author-audit-triage.mjs` | Categorizer (245 unique divergent intents → 7 категорий) |
| `scripts/jointsolver-apply-salience.mjs` | Annotation generator (data-only mode по умолчанию; `--apply-host` опасно — см. findings) |
| `docs/jointsolver-author-audit-triage-2026-04-27.{json,md}` | Triage output |
| `docs/salience-overrides/<dom>.json` | Per-domain numeric salience hints (8 доменов, 50 intents) |
| `docs/jointsolver-author-audit-findings-2026-04-27.md` | Этот документ |

Manual-review batch (70 unique intents) сохранён в triage MD для отдельного
sprint'а. Ключевые группы:
- **sales lifecycle gates** (cancel_listing, publish_listing, accept_offer,
  approve/reject_return) — divergent потому что lifecycle UX уже spec'ифицирована
  через phase-transition'ы; alternate их не "видит" как primary.
- **dispute workflow** (close_dispute, escalate_dispute, respond_to_dispute) —
  divergent primaryCTA→overlay; reviewer должен решить должны ли быть hero CTA.
- **notion config-on-toolbar** (rename_page, move_page, create_view, add_property,
  add_database_row, share_page, invite_member) — все toolbar→overlay/hero;
  вопрос: configuration intents в hero (notion-style toolbar) vs overflow.
