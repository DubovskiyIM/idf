# Domain audit — 2026-04-26

**Generated:** 2026-04-26T06:15:55.943Z
**Total findings:** 1002 (error: 0, warning: 879, info: 123)

> Report-only. Regeneration: `node scripts/audit-report.mjs`. Design rationale — `docs/superpowers/specs/2026-04-20-domain-audit-design.md` (local).

## Summary leaderboard

| Axis | Findings |
|------|----------|
| format | 823 |
| collision | 78 |
| idiom | 58 |
| structural | 29 |
| testing | 8 |
| patterns | 6 |

**Top доменов по количеству findings:**

| Domain | Findings |
|--------|----------|
| argocd | 305 |
| gravitino | 258 |
| keycloak | 206 |
| <cross> | 78 |
| invest | 36 |

## Axis 2 — Derivation health

| Domain | Authored | Derived | Total | Override | 0-patt | 1-patt | 2-patt | 3+patt | Apply/MatchOnly | Alpha-fb | Disabled |
|--------|----------|---------|-------|----------|--------|--------|--------|--------|------------------|----------|----------|
| booking | 6 | 9 | 15 | 0.4 | 0 | 0 | 0 | 15 | 89/16 | 0 | 0 |
| planning | 3 | 11 | 14 | 0.214 | 0 | 0 | 0 | 14 | 81/16 | 0 | 0 |
| workflow | 4 | 10 | 14 | 0.286 | 0 | 0 | 0 | 14 | 53/14 | 0 | 0 |
| messenger | 5 | 14 | 19 | 0.263 | 0 | 0 | 0 | 19 | 129/25 | 0 | 0 |
| sales | 15 | 25 | 40 | 0.375 | 0 | 0 | 0 | 40 | 338/46 | 0 | 0 |
| lifequest | 12 | 20 | 32 | 0.375 | 0 | 0 | 0 | 32 | 169/38 | 0 | 0 |
| reflect | 13 | 22 | 35 | 0.371 | 0 | 0 | 0 | 35 | 140/36 | 0 | 0 |
| invest | 17 | 41 | 58 | 0.293 | 0 | 0 | 0 | 58 | 284/58 | 0 | 0 |
| delivery | 25 | 38 | 63 | 0.397 | 0 | 0 | 12 | 51 | 224/63 | 0 | 0 |
| freelance | 7 | 26 | 33 | 0.212 | 0 | 0 | 0 | 33 | 156/34 | 0 | 2 |
| compliance | 22 | 22 | 44 | 0.5 | 0 | 0 | 13 | 31 | 163/44 | 0 | 0 |
| keycloak | 15 | 77 | 92 | 0.163 | 0 | 0 | 6 | 86 | 252/92 | 0 | 10 |
| argocd | 9 | 33 | 42 | 0.214 | 0 | 13 | 16 | 13 | 46/42 | 0 | 0 |
| gravitino | 24 | 21 | 45 | 0.533 | 0 | 10 | 15 | 20 | 56/45 | 0 | 0 |
| automation | 4 | 15 | 19 | 0.211 | 0 | 3 | 7 | 9 | 27/19 | 0 | 0 |

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
| compliance | 38 | 0% (0/38) | 0 |
| keycloak | 256 | 0% (0/256) | 0 |
| argocd | 106 | 0% (0/106) | 0 |
| gravitino | 120 | 0% (0/120) | 0 |
| automation | 36 | 8% (3/36) | 0 |

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
| freelance | 7 | 3 | ✓ |
| compliance | 3 | 0 | — |
| keycloak | 0 | 1 | — |
| argocd | 0 | 1 | — |
| gravitino | 0 | 2 | — |
| automation | 0 | 0 | — |

## Axis 5 — Cross-domain collisions

### Shared entities

| Entity | Domains |
|--------|---------|
| Service | booking, argocd |
| Review | booking, sales, delivery, freelance |
| Participant | planning, messenger |
| Workflow | workflow, keycloak, automation |
| Node | workflow, keycloak, automation |
| NodeType | workflow, automation |
| Execution | workflow, keycloak, automation |
| User | messenger, sales, lifequest, reflect, invest, delivery, freelance, compliance, keycloak, gravitino, automation |
| Message | messenger, sales |
| Category | sales, freelance |
| Order | sales, delivery |
| Watchlist | sales, invest |
| Notification | sales, delivery |
| Goal | lifequest, invest |
| Task | lifequest, freelance |
| Tag | reflect, gravitino |
| Transaction | invest, freelance |
| AgentPreapproval | invest, delivery |
| Policy | keycloak, gravitino |
| Model | keycloak, gravitino |
| Resource | keycloak, argocd |
| Setting | keycloak, argocd |
| Certificate | keycloak, argocd |
| Generate | keycloak, argocd |
| Role | keycloak, gravitino |
| Group | keycloak, gravitino |
| Event | keycloak, argocd |
| Session | keycloak, argocd |
| Metadata | keycloak, argocd |
| Credential | keycloak, gravitino, automation |
| Template | argocd, gravitino |
| Version | argocd, gravitino |

### Shared intents (non-system)

| Intent | Domains |
|--------|---------|
| leave_review | booking, sales, freelance |
| delete_review | booking, sales |
| edit_review | booking, sales |
| respond_to_review | booking, sales |
| close_poll | planning, messenger |
| create_workflow | workflow, automation |
| add_node | workflow, automation |
| remove_node | workflow, automation |
| move_node | workflow, automation |
| connect_nodes | workflow, automation |
| disconnect_nodes | workflow, automation |
| configure_node | workflow, automation |
| rename_node | workflow, automation |
| delete_workflow | workflow, automation |
| duplicate_workflow | workflow, automation |
| import_workflow | workflow, automation |
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
| removeUser | keycloak, gravitino |
| updateModel | keycloak, gravitino |
| createRole | keycloak, gravitino |
| removeGroup | keycloak, gravitino |
| removeSession | keycloak, argocd |

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
| invest | 17 | 17 | 17 | 0 |
| delivery | 25 | 25 | 25 | 0 |
| freelance | 7 | 7 | 7 | 0 |
| compliance | 22 | 22 | 22 | 0 |
| keycloak | 15 | 15 | 0 | 0 |
| argocd | 9 | 9 | 0 | 0 |
| gravitino | 24 | 24 | 0 | 0 |
| automation | 4 | 4 | 4 | 0 |

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
| invest | 14 | 61 | 17 | 22 | 2 |
| delivery | 14 | 45 | 25 | 0 | 6 |
| freelance | 12 | 46 | 7 | 11 | 8 |
| compliance | 10 | 38 | 22 | 11 | 2 |
| keycloak | 186 | 256 | 15 | 231 | 176 |
| argocd | 301 | 106 | 9 | 89 | 293 |
| gravitino | 253 | 120 | 24 | 117 | 241 |
| automation | 9 | 36 | 4 | 20 | 4 |

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
| freelance | 0 | 12 | 0 |
| compliance | 0 | 10 | 0 |
| keycloak | 0 | 187 | 16 |
| argocd | 0 | 302 | 0 |
| gravitino | 0 | 253 | 2 |
| automation | 0 | 9 | 0 |

---

## Per-domain details

### booking

- ⚠️ **sdkIdiom** — Intent "cancel_booking" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "bulk_cancel_day" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "cancel_client_booking" — legacy irreversibility:"high" без context.__irr
- ⚠️ **testCoverage** — Домен booking без тестов/smoke/e2e-docs
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
- ℹ️ **structuralHealth** — 14 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: Participant, Reaction

### sales

- ⚠️ **sdkIdiom** — Intent "remove_listing" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "suspend_user" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "ban_user" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "bulk_delete_listings" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "delete_category" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "delete_account" — legacy irreversibility:"high" без context.__irr
- ℹ️ **formatConformance** — Order single ownerField="buyerId"; возможно multi-owner с sellerId
- ℹ️ **structuralHealth** — 50 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: Review

### lifequest

- ⚠️ **sdkIdiom** — Intent "reset_progress" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "delete_account" — legacy irreversibility:"high" без context.__irr
- ⚠️ **testCoverage** — Домен lifequest без тестов/smoke/e2e-docs
- ℹ️ **structuralHealth** — 6 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: Sphere, HabitLog, Task, SphereAssessment, VisionItem, Quote

### reflect

- ⚠️ **sdkIdiom** — Intent "reset_progress" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "delete_account" — legacy irreversibility:"high" без context.__irr
- ⚠️ **testCoverage** — Домен reflect без тестов/smoke/e2e-docs
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
- ⚠️ **sdkIdiom** — Intent "accept_result" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "auto_accept_result" — legacy irreversibility:"high" без context.__irr
- ℹ️ **structuralHealth** — 11 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: CustomerProfile, ExecutorProfile, ExecutorSkill, Response, Deal, Wallet, Transaction, Review

### compliance

- ⚠️ **formatConformance** — Entity User без entity.type (kind)
- ⚠️ **formatConformance** — Entity Department без entity.type (kind)
- ⚠️ **formatConformance** — Entity Control без entity.type (kind)
- ⚠️ **formatConformance** — Entity JournalEntry без entity.type (kind)
- ⚠️ **formatConformance** — Entity Approval без entity.type (kind)
- ⚠️ **formatConformance** — Entity AttestationCycle без entity.type (kind)
- ⚠️ **formatConformance** — Entity Attestation без entity.type (kind)
- ⚠️ **formatConformance** — Entity Finding без entity.type (kind)
- ⚠️ **formatConformance** — Entity Evidence без entity.type (kind)
- ⚠️ **formatConformance** — Entity Amendment без entity.type (kind)
- ⚠️ **sdkIdiom** — Intent "approve_journal_entry" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "submit_attestation" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "amend_attestation" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "sign_off_cycle_404" — legacy irreversibility:"high" без context.__irr
- ⚠️ **sdkIdiom** — Intent "file_amendment" — legacy irreversibility:"high" без context.__irr
- ℹ️ **sdkIdiom** — Field JournalEntry.amount fieldRole:"money" (v1.6+ "price")
- ℹ️ **structuralHealth** — 11 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: Approval, Amendment

### keycloak

- ⚠️ **formatConformance** — Entity AbstractPolicyRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity Access без entity.type (kind)
- ⚠️ **formatConformance** — Entity AccessToken без entity.type (kind)
- ⚠️ **formatConformance** — Entity ApplicationRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity AuthDetailsRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity AuthenticationExecutionExportRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity AuthenticationExecutionInfoRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity AuthenticationExecutionRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity AuthenticationFlowRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity AuthenticatorConfigInfoRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity AuthenticatorConfigRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity Authorization без entity.type (kind)
- ⚠️ **formatConformance** — Entity AuthorizationDetailsJSONRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity AuthorizationSchema без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClaimRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientInitialAccessCreatePresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientInitialAccessPresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientMappingsRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientPoliciesRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientPolicyConditionRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientPolicyExecutorRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientPolicyRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientProfileRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientProfilesRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientTypesRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ComponentExportRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ComponentTypeRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity Composites без entity.type (kind)
- ⚠️ **formatConformance** — Entity ConfigPropertyRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity Confirmation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ErrorRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity EvaluationResultRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity GlobalRequestResult без entity.type (kind)
- ⚠️ **formatConformance** — Entity IDToken без entity.type (kind)
- ⚠️ **formatConformance** — Entity IdentityProviderMapperRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity IdentityProviderMapperTypeRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity KeyMetadataRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity KeyStoreConfig без entity.type (kind)
- ⚠️ **formatConformance** — Entity KeysMetadataRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ManagementPermissionReference без entity.type (kind)
- ⚠️ **formatConformance** — Entity MappingsRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity OAuthClientRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity OrganizationDomainRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity OrganizationInvitationRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity Permission без entity.type (kind)
- ⚠️ **formatConformance** — Entity PolicyEvaluationRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PolicyEvaluationResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity PolicyProviderRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity PolicyResultRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity PropertyConfig без entity.type (kind)
- ⚠️ **formatConformance** — Entity ProtocolMapperEvaluationRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity PublishedRealmRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity RealmEventsConfigRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity RequiredActionConfigInfoRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity RequiredActionConfigRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity RequiredActionProviderRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ResourceOwnerRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity ResourceType без entity.type (kind)
- ⚠️ **formatConformance** — Entity RolesRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity SocialLinkRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity UPAttribute без entity.type (kind)
- ⚠️ **formatConformance** — Entity UPAttributePermissions без entity.type (kind)
- ⚠️ **formatConformance** — Entity UPAttributeRequired без entity.type (kind)
- ⚠️ **formatConformance** — Entity UPAttributeSelector без entity.type (kind)
- ⚠️ **formatConformance** — Entity UPConfig без entity.type (kind)
- ⚠️ **formatConformance** — Entity UPGroup без entity.type (kind)
- ⚠️ **formatConformance** — Entity UserConsentRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity UserFederationMapperRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity UserFederationProviderRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity UserProfileAttributeGroupMetadata без entity.type (kind)
- ⚠️ **formatConformance** — Entity UserProfileAttributeMetadata без entity.type (kind)
- ⚠️ **formatConformance** — Entity UserProfileMetadata без entity.type (kind)
- ⚠️ **formatConformance** — Entity WorkflowConcurrencyRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity WorkflowScheduleRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity WorkflowStateRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity WorkflowStepRepresentation без entity.type (kind)
- ⚠️ **formatConformance** — Entity Realm без entity.type (kind)
- ⚠️ **formatConformance** — Entity AdminEvent без entity.type (kind)
- ⚠️ **formatConformance** — Entity User без entity.type (kind)
- ⚠️ **formatConformance** — Entity AuthenticatorProvider без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientAuthenticatorProvider без entity.type (kind)
- ⚠️ **formatConformance** — Entity Config без entity.type (kind)
- ⚠️ **formatConformance** — Entity ConfigDescription без entity.type (kind)
- ⚠️ **formatConformance** — Entity Execution без entity.type (kind)
- ⚠️ **formatConformance** — Entity Flow без entity.type (kind)
- ⚠️ **formatConformance** — Entity FormActionProvider без entity.type (kind)
- ⚠️ **formatConformance** — Entity FormProvider без entity.type (kind)
- ⚠️ **formatConformance** — Entity PerClientConfigDescription без entity.type (kind)
- ⚠️ **formatConformance** — Entity RegisterRequiredAction без entity.type (kind)
- ⚠️ **formatConformance** — Entity RequiredAction без entity.type (kind)
- ⚠️ **formatConformance** — Entity UnregisteredRequiredAction без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientDescriptionConverter без entity.type (kind)
- ⚠️ **formatConformance** — Entity Policy без entity.type (kind)
- ⚠️ **formatConformance** — Entity Profile без entity.type (kind)
- ⚠️ **formatConformance** — Entity Provider без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientScope без entity.type (kind)
- ⚠️ **formatConformance** — Entity AddModel без entity.type (kind)
- ⚠️ **formatConformance** — Entity Model без entity.type (kind)
- ⚠️ **formatConformance** — Entity Protocol без entity.type (kind)
- ⚠️ **formatConformance** — Entity ScopeMapping без entity.type (kind)
- ⚠️ **formatConformance** — Entity Client без entity.type (kind)
- ⚠️ **formatConformance** — Entity Available без entity.type (kind)
- ⚠️ **formatConformance** — Entity Composite без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientSessionStat без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientTemplate без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientType без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientsInitialAccess без entity.type (kind)
- ⚠️ **formatConformance** — Entity ResourceServer без entity.type (kind)
- ⚠️ **formatConformance** — Entity Import без entity.type (kind)
- ⚠️ **formatConformance** — Entity Evaluate без entity.type (kind)
- ⚠️ **formatConformance** — Entity Search без entity.type (kind)
- ⚠️ **formatConformance** — Entity Resource без entity.type (kind)
- ⚠️ **formatConformance** — Entity Attribute без entity.type (kind)
- ⚠️ **formatConformance** — Entity Scope без entity.type (kind)
- ⚠️ **formatConformance** — Entity Setting без entity.type (kind)
- ⚠️ **formatConformance** — Entity Certificate без entity.type (kind)
- ⚠️ **formatConformance** — Entity Generate без entity.type (kind)
- ⚠️ **formatConformance** — Entity GenerateAndDownload без entity.type (kind)
- ⚠️ **formatConformance** — Entity ClientSecret без entity.type (kind)
- ⚠️ **formatConformance** — Entity Rotated без entity.type (kind)
- ⚠️ **formatConformance** — Entity DefaultClientScope без entity.type (kind)
- ⚠️ **formatConformance** — Entity GenerateExampleAccessToken без entity.type (kind)
- ⚠️ **formatConformance** — Entity GenerateExampleIdToken без entity.type (kind)
- ⚠️ **formatConformance** — Entity GenerateExampleUserinfo без entity.type (kind)
- ⚠️ **formatConformance** — Entity ProtocolMapper без entity.type (kind)
- ⚠️ **formatConformance** — Entity Granted без entity.type (kind)
- ⚠️ **formatConformance** — Entity NotGranted без entity.type (kind)
- ⚠️ **formatConformance** — Entity Node без entity.type (kind)
- ⚠️ **formatConformance** — Entity OfflineSessionCount без entity.type (kind)
- ⚠️ **formatConformance** — Entity OfflineSession без entity.type (kind)
- ⚠️ **formatConformance** — Entity OptionalClientScope без entity.type (kind)
- ⚠️ **formatConformance** — Entity PushRevocation без entity.type (kind)
- ⚠️ **formatConformance** — Entity RegistrationAccessToken без entity.type (kind)
- ⚠️ **formatConformance** — Entity Role без entity.type (kind)
- ⚠️ **formatConformance** — Entity Group без entity.type (kind)
- ⚠️ **formatConformance** — Entity ServiceAccountUser без entity.type (kind)
- ⚠️ **formatConformance** — Entity SessionCount без entity.type (kind)
- ⚠️ **formatConformance** — Entity UserSession без entity.type (kind)
- ⚠️ **formatConformance** — Entity Component без entity.type (kind)
- ⚠️ **formatConformance** — Entity SubComponentType без entity.type (kind)
- ⚠️ **formatConformance** — Entity CredentialRegistrator без entity.type (kind)
- ⚠️ **formatConformance** — Entity DefaultDefaultClientScope без entity.type (kind)
- ⚠️ **formatConformance** — Entity DefaultGroup без entity.type (kind)
- ⚠️ **formatConformance** — Entity DefaultOptionalClientScope без entity.type (kind)
- ⚠️ **formatConformance** — Entity Event без entity.type (kind)
- ⚠️ **formatConformance** — Entity GroupByPath без entity.type (kind)
- ⚠️ **formatConformance** — Entity Count без entity.type (kind)
- ⚠️ **formatConformance** — Entity Children без entity.type (kind)
- ⚠️ **formatConformance** — Entity Member без entity.type (kind)
- ⚠️ **formatConformance** — Entity RoleMapping без entity.type (kind)
- ⚠️ **formatConformance** — Entity ImportConfig без entity.type (kind)
- ⚠️ **formatConformance** — Entity Instance без entity.type (kind)
- ⚠️ **formatConformance** — Entity MapperType без entity.type (kind)
- ⚠️ **formatConformance** — Entity Mapper без entity.type (kind)
- ⚠️ **formatConformance** — Entity ReloadKey без entity.type (kind)
- ⚠️ **formatConformance** — Entity UploadCertificate без entity.type (kind)
- ⚠️ **formatConformance** — Entity Key без entity.type (kind)
- ⚠️ **formatConformance** — Entity Localization без entity.type (kind)
- ⚠️ **formatConformance** — Entity Organization без entity.type (kind)
- ⚠️ **formatConformance** — Entity IdentityProvider без entity.type (kind)
- ⚠️ **formatConformance** — Entity Invitation без entity.type (kind)
- ⚠️ **formatConformance** — Entity Resend без entity.type (kind)
- ⚠️ **formatConformance** — Entity InviteExistingUser без entity.type (kind)
- ⚠️ **formatConformance** — Entity InviteUser без entity.type (kind)
- ⚠️ **formatConformance** — Entity PartialExport без entity.type (kind)
- ⚠️ **formatConformance** — Entity PartialImport без entity.type (kind)
- ⚠️ **formatConformance** — Entity RolesById без entity.type (kind)
- ⚠️ **formatConformance** — Entity Session без entity.type (kind)
- ⚠️ **formatConformance** — Entity TestSMTPConnection без entity.type (kind)
- ⚠️ **formatConformance** — Entity UsersManagementPermission без entity.type (kind)
- ⚠️ **formatConformance** — Entity Metadata без entity.type (kind)
- ⚠️ **formatConformance** — Entity ConfiguredUserStorageCredentialType без entity.type (kind)
- ⚠️ **formatConformance** — Entity Consent без entity.type (kind)
- ⚠️ **formatConformance** — Entity Credential без entity.type (kind)
- ⚠️ **formatConformance** — Entity MoveAfter без entity.type (kind)
- ⚠️ **formatConformance** — Entity MoveToFirst без entity.type (kind)
- ⚠️ **formatConformance** — Entity UserLabel без entity.type (kind)
- ⚠️ **formatConformance** — Entity ExecuteActionsEmail без entity.type (kind)
- ⚠️ **formatConformance** — Entity FederatedIdentity без entity.type (kind)
- ⚠️ **formatConformance** — Entity Impersonation без entity.type (kind)
- ⚠️ **formatConformance** — Entity UnmanagedAttribute без entity.type (kind)
- ⚠️ **formatConformance** — Entity Workflow без entity.type (kind)
- ⚠️ **formatConformance** — Entity Migrate без entity.type (kind)
- ⚠️ **formatConformance** — Entity Scheduled без entity.type (kind)
- ⚠️ **formatConformance** — Entity Activate без entity.type (kind)
- ⚠️ **formatConformance** — Entity Deactivate без entity.type (kind)
- ⚠️ **formatConformance** — Role "admin" с нестандартным base="admin"
- ℹ️ **formatConformance** — Entity Profile мог бы иметь ownerField="userId"
- ℹ️ **formatConformance** — Entity OfflineSession мог бы иметь ownerField="userId"
- ℹ️ **formatConformance** — Entity Group мог бы иметь ownerField="userId"
- ℹ️ **formatConformance** — Entity Count мог бы иметь ownerField="userId"
- ℹ️ **formatConformance** — Entity Session мог бы иметь ownerField="userId"
- ℹ️ **formatConformance** — Entity ConfiguredUserStorageCredentialType мог бы иметь ownerField="userId"
- ℹ️ **formatConformance** — Entity Consent мог бы иметь ownerField="userId"
- ℹ️ **formatConformance** — Entity Credential мог бы иметь ownerField="userId"
- ℹ️ **formatConformance** — Entity ExecuteActionsEmail мог бы иметь ownerField="userId"
- ℹ️ **formatConformance** — Entity Impersonation мог бы иметь ownerField="userId"
- ℹ️ **formatConformance** — Entity UnmanagedAttribute мог бы иметь ownerField="userId"
- ℹ️ **formatConformance** — AuthDetailsRepresentation single ownerField="userId"; возможно multi-owner с clientId
- ℹ️ **formatConformance** — PolicyEvaluationRequest single ownerField="userId"; возможно multi-owner с clientId
- ℹ️ **formatConformance** — UserSession single ownerField="userId"; возможно multi-owner с clientId
- ℹ️ **formatConformance** — Event single ownerField="userId"; возможно multi-owner с clientId
- ℹ️ **formatConformance** — RoleMapping single ownerField="userId"; возможно multi-owner с clientId
- ℹ️ **patternApplication** — 15/15 проекций без behavioral-pattern
- ℹ️ **structuralHealth** — 231 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: AbstractPolicyRepresentation, Access, AccessToken, ApplicationRepresentation, AuthDetailsRepresentation, AuthenticationExecutionExportRepresentation, AuthenticationExecutionInfoRepresentation, AuthenticationExecutionRepresentation, AuthenticationFlowRepresentation, AuthenticatorConfigInfoRepresentation, AuthenticatorConfigRepresentation, Authorization, AuthorizationDetailsJSONRepresentation, AuthorizationSchema, ClaimRepresentation, ClientInitialAccessCreatePresentation, ClientInitialAccessPresentation, ClientMappingsRepresentation, ClientPoliciesRepresentation, ClientPolicyConditionRepresentation, ClientPolicyExecutorRepresentation, ClientPolicyRepresentation, ClientProfileRepresentation, ClientProfilesRepresentation, ClientTypesRepresentation, ComponentExportRepresentation, ComponentTypeRepresentation, Composites, ConfigPropertyRepresentation, Confirmation, ErrorRepresentation, EvaluationResultRepresentation, GlobalRequestResult, IDToken, IdentityProviderMapperRepresentation, IdentityProviderMapperTypeRepresentation, KeyMetadataRepresentation, KeyStoreConfig, KeysMetadataRepresentation, ManagementPermissionReference, MappingsRepresentation, OAuthClientRepresentation, OrganizationDomainRepresentation, OrganizationInvitationRepresentation, Permission, PolicyEvaluationRequest, PolicyEvaluationResponse, PolicyProviderRepresentation, PolicyResultRepresentation, PropertyConfig, ProtocolMapperEvaluationRepresentation, PublishedRealmRepresentation, RealmEventsConfigRepresentation, RequiredActionConfigInfoRepresentation, RequiredActionConfigRepresentation, RequiredActionProviderRepresentation, ResourceOwnerRepresentation, ResourceType, RolesRepresentation, SocialLinkRepresentation, UPAttribute, UPAttributePermissions, UPAttributeRequired, UPAttributeSelector, UPConfig, UPGroup, UserConsentRepresentation, UserFederationMapperRepresentation, UserFederationProviderRepresentation, UserProfileAttributeGroupMetadata, UserProfileAttributeMetadata, UserProfileMetadata, WorkflowConcurrencyRepresentation, WorkflowScheduleRepresentation, WorkflowStateRepresentation, WorkflowStepRepresentation, AdminEvent, AuthenticatorProvider, ClientAuthenticatorProvider, Config, ConfigDescription, Execution, Flow, FormActionProvider, FormProvider, PerClientConfigDescription, RegisterRequiredAction, RequiredAction, UnregisteredRequiredAction, ClientDescriptionConverter, Policy, Profile, Provider, AddModel, Model, Protocol, ScopeMapping, Available, Composite, ClientSessionStat, ClientTemplate, ClientType, ClientsInitialAccess, ResourceServer, Import, Evaluate, Search, Resource, Attribute, Scope, Setting, Certificate, Generate, GenerateAndDownload, ClientSecret, Rotated, DefaultClientScope, GenerateExampleAccessToken, GenerateExampleIdToken, GenerateExampleUserinfo, ProtocolMapper, Granted, NotGranted, Node, OfflineSessionCount, OfflineSession, OptionalClientScope, PushRevocation, RegistrationAccessToken, ServiceAccountUser, SessionCount, UserSession, SubComponentType, CredentialRegistrator, DefaultDefaultClientScope, DefaultGroup, DefaultOptionalClientScope, Event, GroupByPath, Count, Children, Member, RoleMapping, ImportConfig, Instance, MapperType, Mapper, ReloadKey, UploadCertificate, Key, Localization, Invitation, Resend, InviteExistingUser, InviteUser, PartialExport, PartialImport, RolesById, Session, TestSMTPConnection, UsersManagementPermission, Metadata, ConfiguredUserStorageCredentialType, Consent, Credential, MoveAfter, MoveToFirst, UserLabel, ExecuteActionsEmail, FederatedIdentity, Impersonation, UnmanagedAttribute, Migrate, Scheduled, Activate, Deactivate

### argocd

- ⚠️ **formatConformance** — Entity accountAccount без entity.type (kind)
- ⚠️ **formatConformance** — Entity accountAccountsList без entity.type (kind)
- ⚠️ **formatConformance** — Entity accountCanIResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity accountCreateTokenRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity accountCreateTokenResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity accountToken без entity.type (kind)
- ⚠️ **formatConformance** — Entity accountUpdatePasswordRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationApplicationManifestQueryWithFiles без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationApplicationManifestQueryWithFilesWrapper без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationApplicationPatchRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationApplicationResourceResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationApplicationRollbackRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationApplicationServerSideDiffResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationApplicationSyncRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationApplicationSyncWindow без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationApplicationSyncWindowsResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationFileChunk без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationLinkInfo без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationLinksResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationLogEntry без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationManagedResourcesResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationResourceActionParameters без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationResourceActionRunRequestV2 без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationResourceActionsListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationSyncOptions без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationsetApplicationSetGenerateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationsetApplicationSetGenerateResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationsetApplicationSetResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationv1alpha1EnvEntry без entity.type (kind)
- ⚠️ **formatConformance** — Entity applicationv1alpha1ResourceStatus без entity.type (kind)
- ⚠️ **formatConformance** — Entity clusterClusterID без entity.type (kind)
- ⚠️ **formatConformance** — Entity clusterConnector без entity.type (kind)
- ⚠️ **formatConformance** — Entity clusterDexConfig без entity.type (kind)
- ⚠️ **formatConformance** — Entity clusterGoogleAnalyticsConfig без entity.type (kind)
- ⚠️ **formatConformance** — Entity clusterHelp без entity.type (kind)
- ⚠️ **formatConformance** — Entity clusterOIDCConfig без entity.type (kind)
- ⚠️ **formatConformance** — Entity clusterPlugin без entity.type (kind)
- ⚠️ **formatConformance** — Entity clusterSettings без entity.type (kind)
- ⚠️ **formatConformance** — Entity clusterSettingsPluginsResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity gpgkeyGnuPGPublicKeyCreateResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity intstrIntOrString без entity.type (kind)
- ⚠️ **formatConformance** — Entity notificationService без entity.type (kind)
- ⚠️ **formatConformance** — Entity notificationServiceList без entity.type (kind)
- ⚠️ **formatConformance** — Entity notificationTemplate без entity.type (kind)
- ⚠️ **formatConformance** — Entity notificationTemplateList без entity.type (kind)
- ⚠️ **formatConformance** — Entity notificationTrigger без entity.type (kind)
- ⚠️ **formatConformance** — Entity notificationTriggerList без entity.type (kind)
- ⚠️ **formatConformance** — Entity oidcClaim без entity.type (kind)
- ⚠️ **formatConformance** — Entity projectDetailedProjectsResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity projectGlobalProjectsResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity projectProjectCreateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity projectProjectTokenCreateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity projectProjectTokenResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity projectProjectUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity projectSyncWindowsResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity protobufAny без entity.type (kind)
- ⚠️ **formatConformance** — Entity repositoryAppInfo без entity.type (kind)
- ⚠️ **formatConformance** — Entity repositoryHelmAppSpec без entity.type (kind)
- ⚠️ **formatConformance** — Entity repositoryHelmChart без entity.type (kind)
- ⚠️ **formatConformance** — Entity repositoryHelmChartsResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity repositoryKustomizeAppSpec без entity.type (kind)
- ⚠️ **formatConformance** — Entity repositoryManifestResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity repositoryParameterAnnouncement без entity.type (kind)
- ⚠️ **formatConformance** — Entity repositoryPluginAppSpec без entity.type (kind)
- ⚠️ **formatConformance** — Entity repositoryRefs без entity.type (kind)
- ⚠️ **formatConformance** — Entity repositoryRepoAppDetailsQuery без entity.type (kind)
- ⚠️ **formatConformance** — Entity repositoryRepoAppDetailsResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity repositoryRepoAppsResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity runtimeError без entity.type (kind)
- ⚠️ **formatConformance** — Entity runtimeRawExtension без entity.type (kind)
- ⚠️ **formatConformance** — Entity runtimeStreamError без entity.type (kind)
- ⚠️ **formatConformance** — Entity sessionGetUserInfoResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity sessionSessionCreateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity sessionSessionResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1Event без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1EventList без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1EventSeries без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1EventSource без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1FieldsV1 без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1GroupKind без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1JSON без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1LabelSelector без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1LabelSelectorRequirement без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1ListMeta без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1LoadBalancerIngress без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1ManagedFieldsEntry без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1MicroTime без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1NodeSwapStatus без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1NodeSystemInfo без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1ObjectMeta без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1ObjectReference без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1OwnerReference без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1PortStatus без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1AWSAuthConfig без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1AppHealthStatus без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1AppProject без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1AppProjectList без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1AppProjectSpec без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1AppProjectStatus без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1Application без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationCondition без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationDestination без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationDestinationServiceAccount без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationList без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationMatchExpression без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationPreservedFields без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSet без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetApplicationStatus без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetCondition без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetGenerator без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetList без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetNestedGenerator без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetResourceIgnoreDifferences без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetRolloutStep без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetRolloutStrategy без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetSpec без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetStatus без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetStrategy без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetSyncPolicy без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetTemplate без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetTemplateMeta без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetTree без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSetWatchEvent без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSource без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSourceDirectory без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSourceHelm без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSourceJsonnet без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSourceKustomize без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSourcePlugin без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSourcePluginParameter без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSpec без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationStatus без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationSummary без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationTree без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ApplicationWatchEvent без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1Backoff без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1BasicAuthBitbucketServer без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1BearerTokenBitbucket без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1BearerTokenBitbucketCloud без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ChartDetails без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1Cluster без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ClusterCacheInfo без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ClusterConfig без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ClusterGenerator без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ClusterInfo без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ClusterList без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ClusterResourceRestrictionItem без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1Command без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1CommitMetadata без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ComparedTo без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ConfigManagementPlugin без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ConfigMapKeyRef без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ConnectionState без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1DrySource без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1DuckTypeGenerator без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ExecProviderConfig без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1GitDirectoryGeneratorItem без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1GitFileGeneratorItem без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1GitGenerator без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1GnuPGPublicKey без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1GnuPGPublicKeyList без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1HealthStatus без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1HelmFileParameter без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1HelmParameter без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1HostInfo без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1HostResourceInfo без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1HydrateOperation без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1HydrateTo без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1Info без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1InfoItem без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1JWTToken без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1JWTTokens без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1JsonnetVar без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1KnownTypeField без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1KustomizeGvk без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1KustomizeOptions без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1KustomizePatch без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1KustomizeReplica без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1KustomizeResId без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1KustomizeSelector без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1KustomizeVersion без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ListGenerator без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ManagedNamespaceMetadata без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1MatrixGenerator без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1MergeGenerator без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1OCIMetadata без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1Operation без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1OperationInitiator без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1OperationState без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1OrphanedResourceKey без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1OrphanedResourcesMonitorSettings без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1OverrideIgnoreDiff без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1PluginConfigMapRef без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1PluginGenerator без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1PluginInput без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ProjectRole без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1PullRequestGenerator без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1PullRequestGeneratorAzureDevOps без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1PullRequestGeneratorBitbucket без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1PullRequestGeneratorBitbucketServer без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1PullRequestGeneratorFilter без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1PullRequestGeneratorGitLab без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1PullRequestGeneratorGitea без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1PullRequestGeneratorGithub без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1RepoCreds без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1RepoCredsList без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1Repository без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1RepositoryCertificate без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1RepositoryCertificateList без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1RepositoryList без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ResourceAction без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ResourceActionParam без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ResourceDiff без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ResourceIgnoreDifferences без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ResourceNetworkingInfo без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ResourceNode без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ResourceOverride без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ResourceRef без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1ResourceResult без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1RetryStrategy без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1RevisionHistory без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1RevisionMetadata без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1RevisionReference без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SCMProviderGenerator без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SCMProviderGeneratorAWSCodeCommit без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SCMProviderGeneratorAzureDevOps без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SCMProviderGeneratorBitbucket без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SCMProviderGeneratorBitbucketServer без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SCMProviderGeneratorFilter без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SCMProviderGeneratorGitea без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SCMProviderGeneratorGithub без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SCMProviderGeneratorGitlab без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SecretRef без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SignatureKey без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SourceHydrator без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SourceHydratorStatus без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SuccessfulHydrateOperation без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SyncOperation без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SyncOperationResource без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SyncOperationResult без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SyncPolicy без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SyncPolicyAutomated без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SyncSource без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SyncStatus без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SyncStrategy без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SyncStrategyApply без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SyncStrategyHook без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1SyncWindow без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1TLSClientConfig без entity.type (kind)
- ⚠️ **formatConformance** — Entity v1alpha1TagFilter без entity.type (kind)
- ⚠️ **formatConformance** — Entity versionVersionMessage без entity.type (kind)
- ⚠️ **formatConformance** — Entity Account без entity.type (kind)
- ⚠️ **formatConformance** — Entity CanI без entity.type (kind)
- ⚠️ **formatConformance** — Entity Password без entity.type (kind)
- ⚠️ **formatConformance** — Entity Token без entity.type (kind)
- ⚠️ **formatConformance** — Entity Application без entity.type (kind)
- ⚠️ **formatConformance** — Entity ManifestsWithFile без entity.type (kind)
- ⚠️ **formatConformance** — Entity ServerSideDiff без entity.type (kind)
- ⚠️ **formatConformance** — Entity ManagedResource без entity.type (kind)
- ⚠️ **formatConformance** — Entity ResourceTree без entity.type (kind)
- ⚠️ **formatConformance** — Entity Event без entity.type (kind)
- ⚠️ **formatConformance** — Entity Link без entity.type (kind)
- ⚠️ **formatConformance** — Entity Log без entity.type (kind)
- ⚠️ **formatConformance** — Entity Manifest без entity.type (kind)
- ⚠️ **formatConformance** — Entity Operation без entity.type (kind)
- ⚠️ **formatConformance** — Entity Resource без entity.type (kind)
- ⚠️ **formatConformance** — Entity Action без entity.type (kind)
- ⚠️ **formatConformance** — Entity Chartdetail без entity.type (kind)
- ⚠️ **formatConformance** — Entity Metadata без entity.type (kind)
- ⚠️ **formatConformance** — Entity Ocimetadata без entity.type (kind)
- ⚠️ **formatConformance** — Entity Rollback без entity.type (kind)
- ⚠️ **formatConformance** — Entity Spec без entity.type (kind)
- ⚠️ **formatConformance** — Entity Syncwindow без entity.type (kind)
- ⚠️ **formatConformance** — Entity Applicationset без entity.type (kind)
- ⚠️ **formatConformance** — Entity Generate без entity.type (kind)
- ⚠️ **formatConformance** — Entity Certificate без entity.type (kind)
- ⚠️ **formatConformance** — Entity Cluster без entity.type (kind)
- ⚠️ **formatConformance** — Entity InvalidateCache без entity.type (kind)
- ⚠️ **formatConformance** — Entity RotateAuth без entity.type (kind)
- ⚠️ **formatConformance** — Entity Gpgkey без entity.type (kind)
- ⚠️ **formatConformance** — Entity Service без entity.type (kind)
- ⚠️ **formatConformance** — Entity Template без entity.type (kind)
- ⚠️ **formatConformance** — Entity Trigger без entity.type (kind)
- ⚠️ **formatConformance** — Entity Project без entity.type (kind)
- ⚠️ **formatConformance** — Entity Detailed без entity.type (kind)
- ⚠️ **formatConformance** — Entity Globalproject без entity.type (kind)
- ⚠️ **formatConformance** — Entity Repocred без entity.type (kind)
- ⚠️ **formatConformance** — Entity Repository без entity.type (kind)
- ⚠️ **formatConformance** — Entity App без entity.type (kind)
- ⚠️ **formatConformance** — Entity Helmchart без entity.type (kind)
- ⚠️ **formatConformance** — Entity OciTag без entity.type (kind)
- ⚠️ **formatConformance** — Entity Ref без entity.type (kind)
- ⚠️ **formatConformance** — Entity Appdetail без entity.type (kind)
- ⚠️ **formatConformance** — Entity Session без entity.type (kind)
- ⚠️ **formatConformance** — Entity Userinfo без entity.type (kind)
- ⚠️ **formatConformance** — Entity Setting без entity.type (kind)
- ⚠️ **formatConformance** — Entity Plugin без entity.type (kind)
- ⚠️ **formatConformance** — Entity WriteRepocred без entity.type (kind)
- ⚠️ **formatConformance** — Entity WriteRepository без entity.type (kind)
- ⚠️ **formatConformance** — Entity Version без entity.type (kind)
- ⚠️ **formatConformance** — Entity ApplicationCondition без entity.type (kind)
- ⚠️ **formatConformance** — Role "admin" с нестандартным base="admin"
- ℹ️ **patternApplication** — 9/9 проекций без behavioral-pattern
- ℹ️ **structuralHealth** — 89 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: accountAccount, accountAccountsList, accountCanIResponse, accountCreateTokenRequest, accountCreateTokenResponse, accountToken, accountUpdatePasswordRequest, applicationApplicationManifestQueryWithFiles, applicationApplicationManifestQueryWithFilesWrapper, applicationApplicationPatchRequest, applicationApplicationResourceResponse, applicationApplicationRollbackRequest, applicationApplicationServerSideDiffResponse, applicationApplicationSyncRequest, applicationApplicationSyncWindow, applicationApplicationSyncWindowsResponse, applicationFileChunk, applicationLinkInfo, applicationLinksResponse, applicationLogEntry, applicationManagedResourcesResponse, applicationResourceActionParameters, applicationResourceActionRunRequestV2, applicationResourceActionsListResponse, applicationSyncOptions, applicationsetApplicationSetGenerateRequest, applicationsetApplicationSetGenerateResponse, applicationsetApplicationSetResponse, applicationv1alpha1EnvEntry, applicationv1alpha1ResourceStatus, clusterClusterID, clusterConnector, clusterDexConfig, clusterGoogleAnalyticsConfig, clusterHelp, clusterOIDCConfig, clusterPlugin, clusterSettings, clusterSettingsPluginsResponse, gpgkeyGnuPGPublicKeyCreateResponse, intstrIntOrString, notificationService, notificationServiceList, notificationTemplate, notificationTemplateList, notificationTrigger, notificationTriggerList, oidcClaim, projectDetailedProjectsResponse, projectGlobalProjectsResponse, projectProjectCreateRequest, projectProjectTokenCreateRequest, projectProjectTokenResponse, projectProjectUpdateRequest, projectSyncWindowsResponse, protobufAny, repositoryAppInfo, repositoryHelmAppSpec, repositoryHelmChart, repositoryHelmChartsResponse, repositoryKustomizeAppSpec, repositoryManifestResponse, repositoryParameterAnnouncement, repositoryPluginAppSpec, repositoryRefs, repositoryRepoAppDetailsQuery, repositoryRepoAppDetailsResponse, repositoryRepoAppsResponse, runtimeError, runtimeRawExtension, runtimeStreamError, sessionGetUserInfoResponse, sessionSessionCreateRequest, sessionSessionResponse, v1Event, v1EventList, v1EventSeries, v1EventSource, v1FieldsV1, v1GroupKind, v1JSON, v1LabelSelector, v1LabelSelectorRequirement, v1ListMeta, v1LoadBalancerIngress, v1ManagedFieldsEntry, v1MicroTime, v1NodeSwapStatus, v1NodeSystemInfo, v1ObjectMeta, v1ObjectReference, v1OwnerReference, v1PortStatus, v1alpha1AWSAuthConfig, v1alpha1AppHealthStatus, v1alpha1AppProject, v1alpha1AppProjectList, v1alpha1AppProjectSpec, v1alpha1AppProjectStatus, v1alpha1Application, v1alpha1ApplicationCondition, v1alpha1ApplicationDestination, v1alpha1ApplicationDestinationServiceAccount, v1alpha1ApplicationList, v1alpha1ApplicationMatchExpression, v1alpha1ApplicationPreservedFields, v1alpha1ApplicationSet, v1alpha1ApplicationSetApplicationStatus, v1alpha1ApplicationSetCondition, v1alpha1ApplicationSetGenerator, v1alpha1ApplicationSetList, v1alpha1ApplicationSetNestedGenerator, v1alpha1ApplicationSetResourceIgnoreDifferences, v1alpha1ApplicationSetRolloutStep, v1alpha1ApplicationSetRolloutStrategy, v1alpha1ApplicationSetSpec, v1alpha1ApplicationSetStatus, v1alpha1ApplicationSetStrategy, v1alpha1ApplicationSetSyncPolicy, v1alpha1ApplicationSetTemplate, v1alpha1ApplicationSetTemplateMeta, v1alpha1ApplicationSetTree, v1alpha1ApplicationSetWatchEvent, v1alpha1ApplicationSource, v1alpha1ApplicationSourceDirectory, v1alpha1ApplicationSourceHelm, v1alpha1ApplicationSourceJsonnet, v1alpha1ApplicationSourceKustomize, v1alpha1ApplicationSourcePlugin, v1alpha1ApplicationSourcePluginParameter, v1alpha1ApplicationSpec, v1alpha1ApplicationStatus, v1alpha1ApplicationSummary, v1alpha1ApplicationTree, v1alpha1ApplicationWatchEvent, v1alpha1Backoff, v1alpha1BasicAuthBitbucketServer, v1alpha1BearerTokenBitbucket, v1alpha1BearerTokenBitbucketCloud, v1alpha1ChartDetails, v1alpha1Cluster, v1alpha1ClusterCacheInfo, v1alpha1ClusterConfig, v1alpha1ClusterGenerator, v1alpha1ClusterInfo, v1alpha1ClusterList, v1alpha1ClusterResourceRestrictionItem, v1alpha1Command, v1alpha1CommitMetadata, v1alpha1ComparedTo, v1alpha1ConfigManagementPlugin, v1alpha1ConfigMapKeyRef, v1alpha1ConnectionState, v1alpha1DrySource, v1alpha1DuckTypeGenerator, v1alpha1ExecProviderConfig, v1alpha1GitDirectoryGeneratorItem, v1alpha1GitFileGeneratorItem, v1alpha1GitGenerator, v1alpha1GnuPGPublicKey, v1alpha1GnuPGPublicKeyList, v1alpha1HealthStatus, v1alpha1HelmFileParameter, v1alpha1HelmParameter, v1alpha1HostInfo, v1alpha1HostResourceInfo, v1alpha1HydrateOperation, v1alpha1HydrateTo, v1alpha1Info, v1alpha1InfoItem, v1alpha1JWTToken, v1alpha1JWTTokens, v1alpha1JsonnetVar, v1alpha1KnownTypeField, v1alpha1KustomizeGvk, v1alpha1KustomizeOptions, v1alpha1KustomizePatch, v1alpha1KustomizeReplica, v1alpha1KustomizeResId, v1alpha1KustomizeSelector, v1alpha1KustomizeVersion, v1alpha1ListGenerator, v1alpha1ManagedNamespaceMetadata, v1alpha1MatrixGenerator, v1alpha1MergeGenerator, v1alpha1OCIMetadata, v1alpha1Operation, v1alpha1OperationInitiator, v1alpha1OperationState, v1alpha1OrphanedResourceKey, v1alpha1OrphanedResourcesMonitorSettings, v1alpha1OverrideIgnoreDiff, v1alpha1PluginConfigMapRef, v1alpha1PluginGenerator, v1alpha1PluginInput, v1alpha1ProjectRole, v1alpha1PullRequestGenerator, v1alpha1PullRequestGeneratorAzureDevOps, v1alpha1PullRequestGeneratorBitbucket, v1alpha1PullRequestGeneratorBitbucketServer, v1alpha1PullRequestGeneratorFilter, v1alpha1PullRequestGeneratorGitLab, v1alpha1PullRequestGeneratorGitea, v1alpha1PullRequestGeneratorGithub, v1alpha1RepoCreds, v1alpha1RepoCredsList, v1alpha1Repository, v1alpha1RepositoryCertificate, v1alpha1RepositoryCertificateList, v1alpha1RepositoryList, v1alpha1ResourceAction, v1alpha1ResourceActionParam, v1alpha1ResourceDiff, v1alpha1ResourceIgnoreDifferences, v1alpha1ResourceNetworkingInfo, v1alpha1ResourceNode, v1alpha1ResourceOverride, v1alpha1ResourceRef, v1alpha1ResourceResult, v1alpha1RetryStrategy, v1alpha1RevisionHistory, v1alpha1RevisionMetadata, v1alpha1RevisionReference, v1alpha1SCMProviderGenerator, v1alpha1SCMProviderGeneratorAWSCodeCommit, v1alpha1SCMProviderGeneratorAzureDevOps, v1alpha1SCMProviderGeneratorBitbucket, v1alpha1SCMProviderGeneratorBitbucketServer, v1alpha1SCMProviderGeneratorFilter, v1alpha1SCMProviderGeneratorGitea, v1alpha1SCMProviderGeneratorGithub, v1alpha1SCMProviderGeneratorGitlab, v1alpha1SecretRef, v1alpha1SignatureKey, v1alpha1SourceHydrator, v1alpha1SourceHydratorStatus, v1alpha1SuccessfulHydrateOperation, v1alpha1SyncOperation, v1alpha1SyncOperationResource, v1alpha1SyncOperationResult, v1alpha1SyncPolicy, v1alpha1SyncPolicyAutomated, v1alpha1SyncSource, v1alpha1SyncStatus, v1alpha1SyncStrategy, v1alpha1SyncStrategyApply, v1alpha1SyncStrategyHook, v1alpha1SyncWindow, v1alpha1TLSClientConfig, v1alpha1TagFilter, versionVersionMessage, CanI, Password, Token, ManifestsWithFile, ServerSideDiff, ManagedResource, ResourceTree, Event, Link, Log, Manifest, Operation, Resource, Action, Chartdetail, Metadata, Ocimetadata, Rollback, Spec, Syncwindow, Generate, InvalidateCache, RotateAuth, Service, Template, Trigger, Detailed, Globalproject, Repocred, App, Helmchart, OciTag, Ref, Appdetail, Session, Userinfo, Setting, Plugin, WriteRepocred, WriteRepository, Version, ApplicationCondition

### gravitino

- ⚠️ **formatConformance** — Entity Audit без entity.type (kind)
- ⚠️ **formatConformance** — Entity ErrorModel без entity.type (kind)
- ⚠️ **formatConformance** — Entity NameIdentifier без entity.type (kind)
- ⚠️ **formatConformance** — Entity NameListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity HealthCheck без entity.type (kind)
- ⚠️ **formatConformance** — Entity HealthResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity Metalake без entity.type (kind)
- ⚠️ **formatConformance** — Entity MetalakeCreateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RenameMetalakeRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateMetalakeCommentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity SetMetalakePropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RemoveMetalakePropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity MetalakeUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity MetalakeUpdatesRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity MetalakeSetRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity Tag без entity.type (kind)
- ⚠️ **formatConformance** — Entity TagListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity TagCreateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity TagResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity RenameTagRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateTagCommentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity SetTagPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RemoveTagPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity TagUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity TagUpdatesRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity TagsAssociateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PolicyBase без entity.type (kind)
- ⚠️ **formatConformance** — Entity PolicyContentBase без entity.type (kind)
- ⚠️ **formatConformance** — Entity CustomPolicyContent без entity.type (kind)
- ⚠️ **formatConformance** — Entity CustomPolicy без entity.type (kind)
- ⚠️ **formatConformance** — Entity Policy без entity.type (kind)
- ⚠️ **formatConformance** — Entity PolicyListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity PoliciesAssociateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity Statistic без entity.type (kind)
- ⚠️ **formatConformance** — Entity StatisticListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity StatisticsUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity StatisticsDropRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PartitionStatistics без entity.type (kind)
- ⚠️ **formatConformance** — Entity PartitionStatisticsListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity PartitionStatisticsUpdate без entity.type (kind)
- ⚠️ **formatConformance** — Entity PartitionStatisticsUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PartitionStatisticsDrop без entity.type (kind)
- ⚠️ **formatConformance** — Entity PartitionStatisticsDropRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PolicyCreateRequestBase без entity.type (kind)
- ⚠️ **formatConformance** — Entity CustomPolicyCreateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PolicyCreateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PolicyResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity RenamePolicyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdatePolicyCommentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdatePolicyContentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PolicyUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PolicyUpdatesRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PolicySetRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity MetadataObject без entity.type (kind)
- ⚠️ **formatConformance** — Entity MetadataObjectListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity Credential без entity.type (kind)
- ⚠️ **formatConformance** — Entity CredentialResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity CatalogListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity Catalog без entity.type (kind)
- ⚠️ **formatConformance** — Entity CatalogInfoListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity CatalogCreateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RenameCatalogRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateCatalogCommentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity SetCatalogPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RemoveCatalogPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity CatalogUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity CatalogUpdatesRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity CatalogSetRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity SchemaCreateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity Schema без entity.type (kind)
- ⚠️ **formatConformance** — Entity SetSchemaPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RemoveSchemaPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity SchemaUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity SchemaUpdatesRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity DataType без entity.type (kind)
- ⚠️ **formatConformance** — Entity StructField без entity.type (kind)
- ⚠️ **formatConformance** — Entity StructType без entity.type (kind)
- ⚠️ **formatConformance** — Entity ListType без entity.type (kind)
- ⚠️ **formatConformance** — Entity MapType без entity.type (kind)
- ⚠️ **formatConformance** — Entity UnionType без entity.type (kind)
- ⚠️ **formatConformance** — Entity UnparsedType без entity.type (kind)
- ⚠️ **formatConformance** — Entity Literal без entity.type (kind)
- ⚠️ **formatConformance** — Entity Field без entity.type (kind)
- ⚠️ **formatConformance** — Entity FunctionArg без entity.type (kind)
- ⚠️ **formatConformance** — Entity Function без entity.type (kind)
- ⚠️ **formatConformance** — Entity Column без entity.type (kind)
- ⚠️ **formatConformance** — Entity SortOrder без entity.type (kind)
- ⚠️ **formatConformance** — Entity Distribution без entity.type (kind)
- ⚠️ **formatConformance** — Entity IdentityPartitioning без entity.type (kind)
- ⚠️ **formatConformance** — Entity YearPartitioning без entity.type (kind)
- ⚠️ **formatConformance** — Entity MonthPartitioning без entity.type (kind)
- ⚠️ **formatConformance** — Entity DayPartitioning без entity.type (kind)
- ⚠️ **formatConformance** — Entity HourPartitioning без entity.type (kind)
- ⚠️ **formatConformance** — Entity BucketPartitioning без entity.type (kind)
- ⚠️ **formatConformance** — Entity TruncatePartitioning без entity.type (kind)
- ⚠️ **formatConformance** — Entity ListPartition без entity.type (kind)
- ⚠️ **formatConformance** — Entity ListPartitioning без entity.type (kind)
- ⚠️ **formatConformance** — Entity RangePartition без entity.type (kind)
- ⚠️ **formatConformance** — Entity RangePartitioning без entity.type (kind)
- ⚠️ **formatConformance** — Entity FunctionPartitioning без entity.type (kind)
- ⚠️ **formatConformance** — Entity PartitioningSpec без entity.type (kind)
- ⚠️ **formatConformance** — Entity IndexSpec без entity.type (kind)
- ⚠️ **formatConformance** — Entity TableCreateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity Table без entity.type (kind)
- ⚠️ **formatConformance** — Entity RenameTableRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateTableCommentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity SetTablePropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RemoveTablePropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity AfterColumnPosition без entity.type (kind)
- ⚠️ **formatConformance** — Entity ColumnPosition без entity.type (kind)
- ⚠️ **formatConformance** — Entity AddTableColumnRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RenameTableColumnRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateTableColumnTypeRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateTableColumnCommentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateTableColumnPositionRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateTableColumnNullabilityRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateTableColumnDefaultValueRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity DeleteTableColumnRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity TableUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity TableUpdatesRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PartitionNameListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity IdentityPartition без entity.type (kind)
- ⚠️ **formatConformance** — Entity PartitionSpec без entity.type (kind)
- ⚠️ **formatConformance** — Entity PartitionListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity AddPartitionsRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity FilesetCreateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity Fileset без entity.type (kind)
- ⚠️ **formatConformance** — Entity RenameFilesetRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity SetFilesetPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateFilesetCommentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RemoveFilesetPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity FilesetUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity FilesetUpdatesRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity FileInfo без entity.type (kind)
- ⚠️ **formatConformance** — Entity TopicCreateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity Topic без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateTopicCommentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity SetTopicPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RemoveTopicPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity TopicUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity TopicUpdatesRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity schema без entity.type (kind)
- ⚠️ **formatConformance** — Entity FunctionParam без entity.type (kind)
- ⚠️ **formatConformance** — Entity FunctionColumn без entity.type (kind)
- ⚠️ **formatConformance** — Entity FunctionResources без entity.type (kind)
- ⚠️ **formatConformance** — Entity SQLImpl без entity.type (kind)
- ⚠️ **formatConformance** — Entity JavaImpl без entity.type (kind)
- ⚠️ **formatConformance** — Entity PythonImpl без entity.type (kind)
- ⚠️ **formatConformance** — Entity FunctionImpl без entity.type (kind)
- ⚠️ **formatConformance** — Entity FunctionDefinition без entity.type (kind)
- ⚠️ **formatConformance** — Entity Function-2 без entity.type (kind)
- ⚠️ **formatConformance** — Entity FunctionListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity FunctionRegisterRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateFunctionCommentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity AddFunctionDefinitionRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RemoveFunctionDefinitionRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity AddFunctionImplRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateFunctionImplRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RemoveFunctionImplRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity FunctionUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity FunctionUpdatesRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity ModelRegisterRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity Model без entity.type (kind)
- ⚠️ **formatConformance** — Entity RenameModelRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity SetModelPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RemoveModelPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateModelCommentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity ModelUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity ModelUpdatesRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity ModelVersionListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity ModelVersion без entity.type (kind)
- ⚠️ **formatConformance** — Entity ModelVersionInfoListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity ModelVersionLinkRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateModelVersionCommentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity SetModelVersionPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RemoveModelVersionPropertyRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateModelVersionUriRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity AddModelVersionUriRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RemoveModelVersionUriRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateModelVersionAliasesRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity ModelVersionUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity ModelVersionUpdatesRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity User без entity.type (kind)
- ⚠️ **formatConformance** — Entity UserListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity UserAddRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UserResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity Group без entity.type (kind)
- ⚠️ **formatConformance** — Entity GroupListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity GroupAddRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity GroupResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity Privilege без entity.type (kind)
- ⚠️ **formatConformance** — Entity SecurableObject без entity.type (kind)
- ⚠️ **formatConformance** — Entity RoleCreateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity Role без entity.type (kind)
- ⚠️ **formatConformance** — Entity RoleResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity Owner без entity.type (kind)
- ⚠️ **formatConformance** — Entity OwnerResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity OwnerSetRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RoleGrantRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity RoleRevokeRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PrivilegeGrantRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PrivilegeRevokeRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity PrivilegeOverrideRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity BaseEvent без entity.type (kind)
- ⚠️ **formatConformance** — Entity BaseFacet без entity.type (kind)
- ⚠️ **formatConformance** — Entity RunFacet без entity.type (kind)
- ⚠️ **formatConformance** — Entity Run без entity.type (kind)
- ⚠️ **formatConformance** — Entity JobFacet без entity.type (kind)
- ⚠️ **formatConformance** — Entity Job без entity.type (kind)
- ⚠️ **formatConformance** — Entity DatasetFacet без entity.type (kind)
- ⚠️ **formatConformance** — Entity Dataset без entity.type (kind)
- ⚠️ **formatConformance** — Entity InputDatasetFacet без entity.type (kind)
- ⚠️ **formatConformance** — Entity InputDataset без entity.type (kind)
- ⚠️ **formatConformance** — Entity OutputDatasetFacet без entity.type (kind)
- ⚠️ **formatConformance** — Entity OutputDataset без entity.type (kind)
- ⚠️ **formatConformance** — Entity RunEvent без entity.type (kind)
- ⚠️ **formatConformance** — Entity StaticDataset без entity.type (kind)
- ⚠️ **formatConformance** — Entity DatasetEvent без entity.type (kind)
- ⚠️ **formatConformance** — Entity JobEvent без entity.type (kind)
- ⚠️ **formatConformance** — Entity ShellJobTemplate без entity.type (kind)
- ⚠️ **formatConformance** — Entity SparkJobTemplate без entity.type (kind)
- ⚠️ **formatConformance** — Entity JobTemplate без entity.type (kind)
- ⚠️ **formatConformance** — Entity JobTemplateListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity JobTemplateRegisterRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity JobTemplateResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity RenameJobTemplateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateJobTemplateCommentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity ShellTemplateUpdate без entity.type (kind)
- ⚠️ **formatConformance** — Entity SparkTemplateUpdate без entity.type (kind)
- ⚠️ **formatConformance** — Entity TemplateUpdate без entity.type (kind)
- ⚠️ **formatConformance** — Entity UpdateJobTemplateContentRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity JobTemplateUpdateRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity JobTemplateUpdatesRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity Job-2 без entity.type (kind)
- ⚠️ **formatConformance** — Entity JobListResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity JobRunRequest без entity.type (kind)
- ⚠️ **formatConformance** — Entity JobResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity AuthMeResponse без entity.type (kind)
- ⚠️ **formatConformance** — Entity Health без entity.type (kind)
- ⚠️ **formatConformance** — Entity Live без entity.type (kind)
- ⚠️ **formatConformance** — Entity Ready без entity.type (kind)
- ⚠️ **formatConformance** — Entity Partition без entity.type (kind)
- ⚠️ **formatConformance** — Entity Object без entity.type (kind)
- ⚠️ **formatConformance** — Entity TestConnection без entity.type (kind)
- ⚠️ **formatConformance** — Entity File без entity.type (kind)
- ⚠️ **formatConformance** — Entity Version без entity.type (kind)
- ⚠️ **formatConformance** — Entity Alias без entity.type (kind)
- ⚠️ **formatConformance** — Entity Uri без entity.type (kind)
- ⚠️ **formatConformance** — Entity Grant без entity.type (kind)
- ⚠️ **formatConformance** — Entity Revoke без entity.type (kind)
- ⚠️ **formatConformance** — Entity Lineage без entity.type (kind)
- ⚠️ **formatConformance** — Entity Template без entity.type (kind)
- ⚠️ **formatConformance** — Entity Me без entity.type (kind)
- ℹ️ **formatConformance** — Entity Grant мог бы иметь ownerField="userId"
- ℹ️ **formatConformance** — Entity Revoke мог бы иметь ownerField="userId"
- ℹ️ **patternApplication** — 24/24 проекций без behavioral-pattern
- ℹ️ **structuralHealth** — 117 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: Audit, ErrorModel, NameIdentifier, NameListResponse, HealthCheck, HealthResponse, MetalakeCreateRequest, RenameMetalakeRequest, UpdateMetalakeCommentRequest, SetMetalakePropertyRequest, RemoveMetalakePropertyRequest, MetalakeUpdateRequest, MetalakeUpdatesRequest, MetalakeSetRequest, TagListResponse, TagCreateRequest, TagResponse, RenameTagRequest, UpdateTagCommentRequest, SetTagPropertyRequest, RemoveTagPropertyRequest, TagUpdateRequest, TagUpdatesRequest, TagsAssociateRequest, PolicyBase, PolicyContentBase, CustomPolicyContent, CustomPolicy, PolicyListResponse, PoliciesAssociateRequest, Statistic, StatisticListResponse, StatisticsUpdateRequest, StatisticsDropRequest, PartitionStatistics, PartitionStatisticsListResponse, PartitionStatisticsUpdate, PartitionStatisticsUpdateRequest, PartitionStatisticsDrop, PartitionStatisticsDropRequest, PolicyCreateRequestBase, CustomPolicyCreateRequest, PolicyCreateRequest, PolicyResponse, RenamePolicyRequest, UpdatePolicyCommentRequest, UpdatePolicyContentRequest, PolicyUpdateRequest, PolicyUpdatesRequest, PolicySetRequest, MetadataObject, MetadataObjectListResponse, Credential, CredentialResponse, CatalogListResponse, CatalogInfoListResponse, CatalogCreateRequest, RenameCatalogRequest, UpdateCatalogCommentRequest, SetCatalogPropertyRequest, RemoveCatalogPropertyRequest, CatalogUpdateRequest, CatalogUpdatesRequest, CatalogSetRequest, SchemaCreateRequest, SetSchemaPropertyRequest, RemoveSchemaPropertyRequest, SchemaUpdateRequest, SchemaUpdatesRequest, DataType, StructField, StructType, ListType, MapType, UnionType, UnparsedType, Literal, Field, FunctionArg, Function, Column, SortOrder, Distribution, IdentityPartitioning, YearPartitioning, MonthPartitioning, DayPartitioning, HourPartitioning, BucketPartitioning, TruncatePartitioning, ListPartition, ListPartitioning, RangePartition, RangePartitioning, FunctionPartitioning, PartitioningSpec, IndexSpec, TableCreateRequest, RenameTableRequest, UpdateTableCommentRequest, SetTablePropertyRequest, RemoveTablePropertyRequest, AfterColumnPosition, ColumnPosition, AddTableColumnRequest, RenameTableColumnRequest, UpdateTableColumnTypeRequest, UpdateTableColumnCommentRequest, UpdateTableColumnPositionRequest, UpdateTableColumnNullabilityRequest, UpdateTableColumnDefaultValueRequest, DeleteTableColumnRequest, TableUpdateRequest, TableUpdatesRequest, PartitionNameListResponse, IdentityPartition, PartitionSpec, PartitionListResponse, AddPartitionsRequest, FilesetCreateRequest, RenameFilesetRequest, SetFilesetPropertyRequest, UpdateFilesetCommentRequest, RemoveFilesetPropertyRequest, FilesetUpdateRequest, FilesetUpdatesRequest, FileInfo, TopicCreateRequest, UpdateTopicCommentRequest, SetTopicPropertyRequest, RemoveTopicPropertyRequest, TopicUpdateRequest, TopicUpdatesRequest, schema, FunctionParam, FunctionColumn, FunctionResources, SQLImpl, JavaImpl, PythonImpl, FunctionImpl, FunctionDefinition, Function-2, FunctionListResponse, FunctionRegisterRequest, UpdateFunctionCommentRequest, AddFunctionDefinitionRequest, RemoveFunctionDefinitionRequest, AddFunctionImplRequest, UpdateFunctionImplRequest, RemoveFunctionImplRequest, FunctionUpdateRequest, FunctionUpdatesRequest, ModelRegisterRequest, RenameModelRequest, SetModelPropertyRequest, RemoveModelPropertyRequest, UpdateModelCommentRequest, ModelUpdateRequest, ModelUpdatesRequest, ModelVersionListResponse, ModelVersion, ModelVersionInfoListResponse, ModelVersionLinkRequest, UpdateModelVersionCommentRequest, SetModelVersionPropertyRequest, RemoveModelVersionPropertyRequest, UpdateModelVersionUriRequest, AddModelVersionUriRequest, RemoveModelVersionUriRequest, UpdateModelVersionAliasesRequest, ModelVersionUpdateRequest, ModelVersionUpdatesRequest, UserListResponse, UserAddRequest, UserResponse, GroupListResponse, GroupAddRequest, GroupResponse, Privilege, SecurableObject, RoleCreateRequest, RoleResponse, Owner, OwnerResponse, OwnerSetRequest, RoleGrantRequest, RoleRevokeRequest, PrivilegeGrantRequest, PrivilegeRevokeRequest, PrivilegeOverrideRequest, BaseEvent, BaseFacet, RunFacet, Run, JobFacet, Job, DatasetFacet, Dataset, InputDatasetFacet, InputDataset, OutputDatasetFacet, OutputDataset, RunEvent, StaticDataset, DatasetEvent, JobEvent, ShellJobTemplate, SparkJobTemplate, JobTemplate, JobTemplateListResponse, JobTemplateRegisterRequest, JobTemplateResponse, RenameJobTemplateRequest, UpdateJobTemplateCommentRequest, ShellTemplateUpdate, SparkTemplateUpdate, TemplateUpdate, UpdateJobTemplateContentRequest, JobTemplateUpdateRequest, JobTemplateUpdatesRequest, Job-2, JobListResponse, JobRunRequest, JobResponse, AuthMeResponse, Health, Live, Ready, Partition, Object, TestConnection, File, Version, Alias, Uri, Grant, Revoke, Lineage, Template, Me

### automation

- ⚠️ **formatConformance** — Entity User без entity.type (kind)
- ⚠️ **formatConformance** — Entity Workflow без entity.type (kind)
- ⚠️ **formatConformance** — Entity NodeType без entity.type (kind)
- ⚠️ **formatConformance** — Entity Node без entity.type (kind)
- ⚠️ **formatConformance** — Entity Connection без entity.type (kind)
- ⚠️ **formatConformance** — Entity Credential без entity.type (kind)
- ⚠️ **formatConformance** — Entity Execution без entity.type (kind)
- ⚠️ **formatConformance** — Entity ExecutionStep без entity.type (kind)
- ⚠️ **formatConformance** — Entity ScheduledRun без entity.type (kind)
- ⚠️ **testCoverage** — Домен automation без тестов/smoke/e2e-docs
- ℹ️ **structuralHealth** — 20 intents без creates/mutator classification
- ℹ️ **structuralHealth** — Возможно dead entities: Node, Connection, ExecutionStep, ScheduledRun
