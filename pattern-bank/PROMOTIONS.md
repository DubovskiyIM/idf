# Pattern Promotions Queue

Promote candidate → stable. Φ-источник — meta-домен,
intent `request_pattern_promotion`. Compile делает `npm run meta-compile`.

**Не редактировать руками** между маркерами ниже.

<!-- meta-compile: pattern-promotions -->

### 🟡 pending (10)

- **`candidate__polymorphic-block-canvas`** → detail · 2026-04-27
  Auto-triage score=9. evidence×3, slot-only, trigger×3, archetype:detail, rationale-ok. Source: 26-coda.
- **`candidate__partial-publish-subset-config`** → detail · 2026-04-27
  Auto-triage score=9. evidence×3, slot-only, trigger×3, archetype:detail, rationale-ok. Source: 26-coda.
- **`candidate__live-formula-preview-inline`** → detail · 2026-04-27
  Auto-triage score=9. evidence×4, slot-only, trigger×3, archetype:detail, rationale-ok. Source: 26-coda.
- **`candidate__external-source-sync-status-header`** → detail · 2026-04-27
  Auto-triage score=9. evidence×3, slot-only, trigger×3, archetype:detail, rationale-ok. Source: 26-coda.
- **`candidate__extension-marketplace-install-with-credentials`** → catalog · 2026-04-27
  Auto-triage score=9. evidence×4, slot-only, trigger×3, archetype:catalog, rationale-ok. Source: 26-coda.
- **`candidate__controlled-view-author-lock`** → detail · 2026-04-27
  Auto-triage score=9. evidence×3, slot-only, trigger×3, archetype:detail, rationale-ok. Source: 26-coda.
- **`candidate__marketplace-browse-install-enable`** → catalog · 2026-04-27
  Auto-triage score=10. evidence×3, slot-only, trigger×4, archetype:catalog, deep-rationale. Source: 26-obsidian.
- **`candidate__fuzzy-quick-switcher`** → cross · 2026-04-27
  Auto-triage score=10. evidence×4, slot-only, trigger×3, archetype:cross, deep-rationale. Source: 26-obsidian.
- **`candidate__soft-archive-with-restore-and-hard-delete`** → detail · 2026-04-27
  Auto-triage score=10. evidence×4, slot-only, trigger×4, archetype:detail, deep-rationale. Source: 26-confluence.
- **`candidate__trigger-condition-action-rule-form`** → detail · 2026-04-27
  Auto-triage score=12. evidence×5, slot-only, trigger×4, archetype:detail, rationale-ok. Source: 26-coda.

### ✅ shipped (1)

- **`candidate__paid-promotion-slot__avito`** → catalog → [SDK PR](https://github.com/DubovskiyIM/idf-sdk/pull/999) · 2026-04-27
  Наблюдается в 3 продуктах (avito/profi/ozon). Apply: badge + sort. Falsification: shouldNotMatch — projection без paidPromotionField в ontology.
  fixtures: shouldMatch: avito_listing_list (paidPromotionField=isPaidBoosted). shouldNotMatch: notion_page_list (нет такого поля).

<!-- /meta-compile -->

## Workflow

1. Curator открывает `/meta` → Pattern Bank → «Очередь промоций»
2. Hero → `request_pattern_promotion` (выбирает candidate, archetype, rationale)
3. После apply intent — запись с `status: pending` появляется в Φ
4. Approver: `approve_pattern_promotion` → status=approved
5. После создания SDK PR: `ship_pattern_promotion` (с sdkPrUrl) → status=shipped
6. На каждом шаге `npm run meta-compile` обновляет этот файл
