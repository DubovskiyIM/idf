# JointSolver residue 432 — A2 Phase 3f categorization

**Generated:** 2026-04-27T08:51:32.399Z

> Phase 3e показал что после opts.respectRoleCanExecute активации derivedOnly падает с 873 до 432 (−50.5%). Phase 3f categorize'ит оставшиеся 432 на root causes.

**Total residue observations:** 49

## Reason frequency

| Reason | Count | % |
|--------|-------|---|
| `missing-entity-reference` | 49 | 100.0% |

## Per-domain × reason

| Domain | Records | `missing-entity-reference` |
|--------|---------|---|
| booking | 0 | 0 |
| planning | 0 | 0 |
| workflow | 0 | 0 |
| messenger | 3 | 3 |
| sales | 16 | 16 |
| lifequest | 0 | 0 |
| reflect | 0 | 0 |
| invest | 0 | 0 |
| delivery | 0 | 0 |
| freelance | 0 | 0 |
| compliance | 0 | 0 |
| keycloak | 0 | 0 |
| argocd | 0 | 0 |
| notion | 21 | 21 |
| automation | 1 | 1 |
| gravitino | 8 | 8 |
| meta | 0 | 0 |

## Examples (first 5 per top reason)

### `missing-entity-reference` (49)

- **messenger**/conversation_list × contact (catalog, mainEntity: Conversation): `search_messages` → `toolbar` _(entities=[])_
- **messenger**/contact_list × contact (catalog, mainEntity: Contact): `search_messages` → `toolbar` _(entities=[])_
- **messenger**/people_list × contact (catalog, mainEntity: User): `search_messages` → `toolbar` _(entities=[])_
- **sales**/listing_feed × buyer (catalog, mainEntity: Listing): `search_listings` → `toolbar` _(entities=[])_
- **sales**/my_listings × buyer (catalog, mainEntity: Listing): `search_listings` → `toolbar` _(entities=[])_
