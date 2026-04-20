# Domain audit — 2026-04-20

**Generated:** 2026-04-20T08:51:06.500Z
**Total findings:** 180 (error: 0, warning: 96, info: 84)

> Report-only. Regeneration: `node scripts/audit-report.mjs`. Design rationale — `docs/superpowers/specs/2026-04-20-domain-audit-design.md` (local).

## Summary leaderboard

| Axis | Findings |
|------|----------|
| idiom | 55 |
| format | 45 |
| collision | 42 |
| structural | 19 |
| derivation | 9 |
| testing | 7 |
| patterns | 3 |

**Top доменов по количеству findings:**

| Domain | Findings |
|--------|----------|
| <cross> | 42 |
| invest | 37 |
| delivery | 28 |
| freelance | 22 |
| sales | 11 |

## Axis 2 — Derivation health

| Domain | Authored | Derived | Total | Override | 0-patt | 1-patt | 2-patt | 3+patt | Apply/MatchOnly | Alpha-fb | Disabled |
|--------|----------|---------|-------|----------|--------|--------|--------|--------|------------------|----------|----------|
| booking | 6 | 0 | 6 | 1 | 0 | 0 | 0 | 6 | 19/18 | 0 | 0 |
| planning | 3 | 0 | 3 | 1 | 0 | 0 | 0 | 3 | 10/10 | 0 | 0 |
| workflow | 4 | 0 | 4 | 1 | 0 | 0 | 0 | 4 | 9/11 | 0 | 0 |
| messenger | 5 | 0 | 5 | 1 | 0 | 0 | 0 | 5 | 16/21 | 0 | 0 |
| sales | 15 | 0 | 15 | 1 | 0 | 0 | 0 | 15 | 57/86 | 4 | 0 |
| lifequest | 12 | 0 | 12 | 1 | 0 | 0 | 0 | 12 | 36/32 | 0 | 0 |
| reflect | 13 | 0 | 13 | 1 | 0 | 0 | 0 | 13 | 23/31 | 0 | 0 |
| invest | 23 | 0 | 23 | 1 | 0 | 0 | 9 | 14 | 46/38 | 0 | 0 |
| delivery | 25 | 0 | 25 | 1 | 0 | 0 | 12 | 13 | 48/39 | 0 | 0 |
| freelance | 9 | 0 | 9 | 1 | 0 | 0 | 0 | 9 | 27/41 | 0 | 2 |

## Axis 3 — SDK idiom currency

| Domain | Intents | Salience | Plain entities |
|--------|---------|----------|----------------|
| booking | 22 | 14% (3/22) | 0 |
| planning | 17 | 6% (1/17) | 0 |
| workflow | 15 | 7% (1/15) | 0 |
| messenger | 100 | 1% (1/100) | 0 |
| sales | 225 | 4% (8/225) | 0 |
| lifequest | 56 | 9% (5/56) | 0 |
| reflect | 47 | 4% (2/47) | 0 |
| invest | 61 | 0% (0/61) | 0 |
| delivery | 45 | 0% (0/45) | 0 |
| freelance | 46 | 2% (1/46) | 0 |

## Axis 4 — Test coverage proxy

| Domain | .test files | Smoke scripts | E2E doc |
|--------|-------------|---------------|---------|
| booking | 0 | 0 | — |
| planning | 0 | 0 | — |
| workflow | 0 | 0 | — |
| messenger | 0 | 0 | — |
| sales | 0 | 1 | — |
| lifequest | 0 | 0 | — |
| reflect | 0 | 0 | — |
| invest | 0 | 0 | — |
| delivery | 0 | 1 | — |
| freelance | 6 | 3 | ✓ |

## Axis 5 — Cross-domain collisions

### Shared entities

| Entity | Domains |
|--------|---------|
| Review | booking, sales, delivery, freelance |
| Participant | planning, messenger |
| User | messenger, sales, lifequest, reflect, invest, delivery, freelance |
| Message | messenger, sales |
| Category | sales, freelance |
| Order | sales, delivery |
| Watchlist | sales, invest |
| Notification | sales, delivery |
| Goal | lifequest, invest |
| Task | lifequest, freelance |
| Transaction | invest, freelance |
| AgentPreapproval | invest, delivery |

### Shared intents (non-system)

| Intent | Domains |
|--------|---------|
| leave_review | booking, sales, freelance |
| delete_review | booking, sales |
| edit_review | booking, sales |
| respond_to_review | booking, sales |
| close_poll | planning, messenger |
| send_message | messenger, sales |
| delete_message | messenger, sales |
| reply_to_message | messenger, sales |
| report_message | messenger, sales |
| update_profile | messenger, sales, lifequest, reflect, invest, freelance |
| set_avatar | messenger, sales, lifequest, reflect |
| set_privacy_settings | messenger, sales |
| set_language | messenger, sales |
| enable_2fa | messenger, sales |
| delete_account | messenger, sales, lifequest, reflect |
| ban_user | messenger, sales |
| unban_user | messenger, sales |
| confirm_delivery | sales, delivery |
| cancel_order | sales, delivery |
| request_refund | sales, delivery |
| add_to_watchlist | sales, invest |
| remove_from_watchlist | sales, invest |
| filter_by_category | sales, freelance |
| set_price_alert | sales, invest |
| create_goal | lifequest, invest |
| edit_goal | lifequest, invest |
| edit_task | lifequest, freelance |
| update_streak | lifequest, reflect |
| export_data | lifequest, reflect |
| reset_progress | lifequest, reflect |

## Axis 6 — Pattern application

| Domain | Projections | With apply | Behavioral | Matching-only |
|--------|-------------|------------|------------|---------------|
| booking | 6 | 6 | 6 | 0 |
| planning | 3 | 3 | 0 | 0 |
| workflow | 4 | 4 | 0 | 0 |
| messenger | 5 | 5 | 5 | 0 |
| sales | 15 | 15 | 15 | 0 |
| lifequest | 12 | 12 | 12 | 0 |
| reflect | 13 | 13 | 0 | 0 |
| invest | 23 | 23 | 23 | 0 |
| delivery | 25 | 25 | 25 | 0 |
| freelance | 9 | 9 | 9 | 0 |

## Axis 7 — Structural health

| Domain | Entities | Intents | Projections | Unclassified | Dead |
|--------|----------|---------|-------------|--------------|------|
| booking | 6 | 22 | 6 | 3 | 3 |
| planning | 5 | 17 | 3 | 4 | 4 |
| workflow | 6 | 15 | 4 | 1 | 2 |
| messenger | 6 | 100 | 5 | 14 | 2 |
| sales | 11 | 225 | 15 | 50 | 1 |
| lifequest | 10 | 56 | 12 | 6 | 6 |
| reflect | 10 | 47 | 13 | 14 | 4 |
| invest | 14 | 61 | 23 | 22 | 2 |
| delivery | 14 | 45 | 25 | 0 | 6 |
| freelance | 12 | 46 | 9 | 11 | 5 |

## Axis 1 — Format conformance (severity summary per domain)

| Domain | Error | Warning | Info |
|--------|-------|---------|------|
| booking | 0 | 0 | 0 |
| planning | 0 | 0 | 0 |
| workflow | 0 | 0 | 0 |
| messenger | 0 | 0 | 0 |
| sales | 0 | 0 | 1 |
| lifequest | 0 | 0 | 0 |
| reflect | 0 | 0 | 0 |
| invest | 0 | 14 | 1 |
| delivery | 0 | 15 | 1 |
| freelance | 0 | 12 | 1 |

---

## Per-domain details

### booking

- ⚠️ **sdkIdiom** — Intent "cancel_booking" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "bulk_cancel_day" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "cancel_client_booking" — legacy irreversibility:"high" без context.__irr
- ⚠️ **testCoverage** — Домен booking без тестов/smoke/e2e-docs
- ℹ️ **derivationHealth** — Override-coefficient 100% (6/6 authored)
- ℹ️ **structuralHealth** — 3 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: ServiceCategory, Specialist, Review

### planning

- ⚠️ **sdkIdiom** — Intent "cancel_poll" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "cancel_meeting" — legacy irreversibility:"high" без context.__irr
- ⚠️ **testCoverage** — Домен planning без тестов/smoke/e2e-docs
- ℹ️ **patternApplication** — 3/3 проекций без behavioral-pattern
- ℹ️ **structuralHealth** — 4 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: TimeOption, Participant, Vote, Meeting

### workflow

- ⚠️ **sdkIdiom** — Intent "delete_workflow" — legacy irreversibility:"high" без context.__irr
- ⚠️ **testCoverage** — Домен workflow без тестов/smoke/e2e-docs
- ℹ️ **patternApplication** — 4/4 проекций без behavioral-pattern
- ℹ️ **structuralHealth** — 1 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: Edge, NodeResult

### messenger

- ⚠️ **sdkIdiom** — Intent "report_message" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "delete_conversation" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "clear_history" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "delete_account" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "transfer_ownership" — legacy irreversibility:"high" без context.__irr
- ⚠️ **testCoverage** — Домен messenger без тестов/smoke/e2e-docs
- ℹ️ **derivationHealth** — Override-coefficient 100% (5/5 authored)
- ℹ️ **structuralHealth** — 14 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: Participant, Reaction

### sales

- ⚠️ **derivationHealth** — 4 alphabetical-fallback witness'ов (intent.salience не объявлена)
- ⚠️ **sdkIdiom** — Intent "remove_listing" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "suspend_user" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "ban_user" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "bulk_delete_listings" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "delete_category" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "delete_account" — legacy irreversibility:"high" без context.__irr
- ℹ️ **formatConformance** — Order single ownerField="buyerId"; возможно multi-owner с sellerId
- ℹ️ **derivationHealth** — Override-coefficient 100% (15/15 authored)
- ℹ️ **structuralHealth** — 50 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: Review

### lifequest

- ⚠️ **sdkIdiom** — Intent "reset_progress" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "delete_account" — legacy irreversibility:"high" без context.__irr
- ⚠️ **testCoverage** — Домен lifequest без тестов/smoke/e2e-docs
- ℹ️ **derivationHealth** — Override-coefficient 100% (12/12 authored)
- ℹ️ **structuralHealth** — 6 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: Sphere, HabitLog, Task, SphereAssessment, VisionItem, Quote

### reflect

- ⚠️ **sdkIdiom** — Intent "reset_progress" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "delete_account" — legacy irreversibility:"high" без context.__irr
- ⚠️ **testCoverage** — Домен reflect без тестов/smoke/e2e-docs
- ℹ️ **derivationHealth** — Override-coefficient 100% (13/13 authored)
- ℹ️ **patternApplication** — 13/13 проекций без behavioral-pattern
- ℹ️ **structuralHealth** — 14 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: EntryActivity, HypothesisEvidence, Reminder, EntryTag

### invest

- ⚠️ **formatConformance** — Entity User без entity.type (kind)
- ⚠️ **formatConformance** — Entity Portfolio без entity.type (kind)
- ⚠️ **formatConformance** — Entity Position без entity.type (kind)
- ⚠️ **formatConformance** — Entity Asset без entity.type (kind)
- ⚠️ **formatConformance** — Entity Transaction без entity.type (kind)
- ⚠️ **formatConformance** — Entity Goal без entity.type (kind)
- ⚠️ **formatConformance** — Entity RiskProfile без entity.type (kind)
- ⚠️ **formatConformance** — Entity Recommendation без entity.type (kind)
- ⚠️ **formatConformance** — Entity Alert без entity.type (kind)
- ⚠️ **formatConformance** — Entity Watchlist без entity.type (kind)
- ⚠️ **formatConformance** — Entity MarketSignal без entity.type (kind)
- ⚠️ **formatConformance** — Entity AgentPreapproval без entity.type (kind)
- ⚠️ **formatConformance** — Entity Rule без entity.type (kind)
- ⚠️ **formatConformance** — Entity Assignment без entity.type (kind)
- ⚠️ **sdkIdiom** — Intent "close_goal" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "archive_portfolio" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "delete_watchlist" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "delete_rule" — legacy irreversibility:"high" без context.__irr
- ⚠️ **testCoverage** — Домен invest без тестов/smoke/e2e-docs
- ℹ️ **formatConformance** — Assignment single ownerField="advisorId"; возможно multi-owner с clientId
- ℹ️ **derivationHealth** — Override-coefficient 100% (23/23 authored)
- ℹ️ **sdkIdiom** — Field Portfolio.totalValue fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Portfolio.pnl fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Position.avgPrice fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Position.currentPrice fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Position.unrealizedPnL fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Position.stopLoss fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Position.takeProfit fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Transaction.price fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Transaction.fee fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Transaction.total fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Goal.targetAmount fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Goal.currentAmount fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field AgentPreapproval.maxOrderAmount fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field AgentPreapproval.dailyLimit fieldRole:"money" (v1.6+ "price")
- ℹ️ **structuralHealth** — 22 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: Position, AgentPreapproval

### delivery

- ⚠️ **formatConformance** — Entity User без entity.type (kind)
- ⚠️ **formatConformance** — Entity Merchant без entity.type (kind)
- ⚠️ **formatConformance** — Entity MenuItem без entity.type (kind)
- ⚠️ **formatConformance** — Entity Zone без entity.type (kind)
- ⚠️ **formatConformance** — Entity DispatcherAssignment без entity.type (kind)
- ⚠️ **formatConformance** — Entity Order без entity.type (kind)
- ⚠️ **formatConformance** — Entity OrderItem без entity.type (kind)
- ⚠️ **formatConformance** — Entity Delivery без entity.type (kind)
- ⚠️ **formatConformance** — Entity Address без entity.type (kind)
- ⚠️ **formatConformance** — Entity CourierLocation без entity.type (kind)
- ⚠️ **formatConformance** — Entity Payment без entity.type (kind)
- ⚠️ **formatConformance** — Entity Notification без entity.type (kind)
- ⚠️ **formatConformance** — Entity Review без entity.type (kind)
- ⚠️ **formatConformance** — Entity AgentPreapproval без entity.type (kind)
- ⚠️ **formatConformance** — Invariant "order_item_references_order" referential в alt-shape {entity,field,references}
- ⚠️ **sdkIdiom** — Intent "cancel_order" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "request_refund" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "reject_order" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "confirm_pickup" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "confirm_delivery" — legacy irreversibility:"high" без context.__irr
- ℹ️ **formatConformance** — Order single ownerField="customerId"; возможно multi-owner с merchantId
- ℹ️ **derivationHealth** — Override-coefficient 100% (25/25 authored)
- ℹ️ **sdkIdiom** — Field MenuItem.price fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Order.totalAmount fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Order.tip fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field OrderItem.price fieldRole:"money" (v1.6+ "price")
- ℹ️ **sdkIdiom** — Field Payment.amount fieldRole:"money" (v1.6+ "price")
- ℹ️ **structuralHealth** — Возможно dead entities: DispatcherAssignment, OrderItem, CourierLocation, Payment, Notification, Review

### freelance

- ⚠️ **formatConformance** — Entity User без entity.type (kind)
- ⚠️ **formatConformance** — Entity CustomerProfile без entity.type (kind)
- ⚠️ **formatConformance** — Entity ExecutorProfile без entity.type (kind)
- ⚠️ **formatConformance** — Entity Skill без entity.type (kind)
- ⚠️ **formatConformance** — Entity ExecutorSkill без entity.type (kind)
- ⚠️ **formatConformance** — Entity Category без entity.type (kind)
- ⚠️ **formatConformance** — Entity Task без entity.type (kind)
- ⚠️ **formatConformance** — Entity Response без entity.type (kind)
- ⚠️ **formatConformance** — Entity Deal без entity.type (kind)
- ⚠️ **formatConformance** — Entity Wallet без entity.type (kind)
- ⚠️ **formatConformance** — Entity Transaction без entity.type (kind)
- ⚠️ **formatConformance** — Entity Review без entity.type (kind)
- ⚠️ **sdkIdiom** — Intent "confirm_deal" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "submit_work_result" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "accept_result" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "auto_accept_result" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "request_revision" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "submit_revision" — legacy irreversibility:"high" без context.__irr
- ℹ️ **formatConformance** — Deal single ownerField="customerId,executorId"; возможно multi-owner с customerId, executorId
- ℹ️ **derivationHealth** — Override-coefficient 100% (9/9 authored)
- ℹ️ **structuralHealth** — 11 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: CustomerProfile, ExecutorProfile, ExecutorSkill, Transaction, Review
