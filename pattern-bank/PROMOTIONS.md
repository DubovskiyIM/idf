# Pattern Promotions Queue

Promote candidate → stable. Φ-источник — meta-домен,
intent `request_pattern_promotion`. Compile делает `npm run meta-compile`.

**Не редактировать руками** между маркерами ниже.

<!-- meta-compile: pattern-promotions -->

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
