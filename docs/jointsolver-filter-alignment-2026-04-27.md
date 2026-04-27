# JointSolver filter alignment — A2 Phase 3d

**Generated:** 2026-04-27T08:03:29.003Z

> Категоризация причин почему `derivedOnly` intents (intent в slot existing `assignToSlots*` output, но `computeAlternateAssignment` его не выдаёт) отсутствуют в alternate. 17 доменов включая meta (idf-on-idf).

**Total derivedOnly observations:** 893

## Reason frequency (top-level)

| Reason | Count | % |
|--------|-------|---|
| `role-canExecute-restriction` | 846 | 89.3% |
| `missing-entity-reference` | 98 | 10.3% |
| `permittedFor-mismatch` | 3 | 0.3% |

## Reason distribution per archetype

| Archetype | `role-canExecute-restriction` | `missing-entity-reference` | `permittedFor-mismatch` |
|-----------|---|---|---|
| catalog | 464 | 74 | 0 |
| detail | 382 | 24 | 3 |

## Per-domain breakdown

| Domain | Records | `role-canExecute-restriction` | `missing-entity-reference` | `permittedFor-mismatch` |
|--------|---------|---|---|---|
| booking | 24 | 24 | 0 | 0 |
| planning | 0 | 0 | 0 | 0 |
| workflow | 4 | 4 | 0 | 0 |
| messenger | 44 | 41 | 9 | 0 |
| sales | 609 | 593 | 32 | 0 |
| lifequest | 26 | 26 | 0 | 0 |
| reflect | 14 | 14 | 0 | 0 |
| invest | 0 | 0 | 0 | 0 |
| delivery | 0 | 0 | 0 | 0 |
| freelance | 6 | 6 | 0 | 0 |
| compliance | 0 | 0 | 0 | 0 |
| keycloak | 0 | 0 | 0 | 0 |
| argocd | 0 | 0 | 0 | 0 |
| notion | 113 | 94 | 45 | 3 |
| automation | 25 | 24 | 4 | 0 |
| gravitino | 8 | 0 | 8 | 0 |
| meta | 20 | 20 | 0 | 0 |

## Examples (first 5 per reason)

### `role-canExecute-restriction` (846)

- **booking**/service_catalog × client (catalog, mainEntity: Service): `add_service` → derived `toolbar`
- **booking**/service_catalog × client (catalog, mainEntity: Service): `update_service` → derived `overlay`
- **booking**/service_catalog × agent (catalog, mainEntity: Service): `add_service` → derived `toolbar`
- **booking**/service_catalog × agent (catalog, mainEntity: Service): `update_service` → derived `overlay`
- **booking**/specialist_schedule × client (catalog, mainEntity: TimeSlot): `block_slot` → derived `overlay`

### `missing-entity-reference` (98)

- **messenger**/conversation_list × self (catalog, mainEntity: Conversation): `search_messages` → derived `toolbar`
- **messenger**/conversation_list × contact (catalog, mainEntity: Conversation): `search_messages` → derived `toolbar`
- **messenger**/conversation_list × agent (catalog, mainEntity: Conversation): `search_messages` → derived `toolbar`
- **messenger**/contact_list × self (catalog, mainEntity: Contact): `search_messages` → derived `toolbar`
- **messenger**/contact_list × contact (catalog, mainEntity: Contact): `search_messages` → derived `toolbar`

### `permittedFor-mismatch` (3)

- **notion**/page_detail × commenter (detail, mainEntity: Page): `unarchive_page` → derived `overlay`
- **notion**/page_detail × viewer (detail, mainEntity: Page): `unarchive_page` → derived `overlay`
- **notion**/page_detail × agent (detail, mainEntity: Page): `unarchive_page` → derived `overlay`

## Decision: filter alignment path forward

Top blocker: **`role-canExecute-restriction`** (89.3%, 846 cases).

### Path A: align `computeAlternateAssignment` filter под `assignToSlots*`

Заменить `accessibleIntents` (strict) внутри `computeAlternateAssignment` на тот же filter chain, что и `assignToSlots*` (включая `appliesToProjection`, IB whitelist, custom checks).

- ✅ Closes derivedOnly bottleneck.
- ❌ Couples bridge module к internal assignToSlots* logic. Bridge перестаёт быть чистой утилитой над ontology.
- ❌ Вид filter logic дублируется или импортируется в bridge.

### Path B: pre-filter derived через `accessibleIntents` для honest like-for-like

В Phase 3a/3c'' validation script post-filter'овать derivedAssignment через `accessibleIntents` перед сравнением.

- ✅ Bridge остаётся чистой утилитой.
- ✅ `accessibleIntents` becomes canonical filter — derived non-conformant cases помечаются как drift.
- ❌ Не фактически меняет UI behaviour — только метрика.

### Path C: hybrid — `assignToSlots*` использует `accessibleIntents` как pre-filter

Внутри `assignToSlotsCatalog/Detail` добавить opt-in pre-filter через `accessibleIntents`. Default off (back-compat). Активация в host'е через opts.

- ✅ Single source of truth для accessible intents.
- ✅ Co-located filter logic.
- ⚠️ Behavioral change — некоторые intents которые derived раньше принимал, после opt-in перестанут попадать. Risk regression in real domains.

### Recommendation

Зависит от dominant reason class. Если `missing-entity-reference` (intent не упоминает mainEntity) — это **author bug**, intent неправильно структурирован → Path B + warn в derived. Если `role-canExecute-restriction` — это **strict role policy in ontology**, derived должен respect → Path C.

Конкретно (на основе данных):
- 89.3% случаев — **`role-canExecute-restriction`**: derived не respects role.canExecute. **Path C** — opt-in pre-filter в derived для honest UI.
