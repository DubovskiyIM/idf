# Salience suggestions — 2026-04-20

**Generated:** 2026-04-20T08:29:13.057Z
**Alphabetical-fallback witnesses:** 21

> Каждая tied-group → предложение явного `intent.salience` для разрешения ties. Target после apply: alphabetical-fallback count → 0.

## Per-domain counts

| Domain | Witnesses |
|--------|-----------|
| sales | 11 |
| lifequest | 5 |
| reflect | 2 |
| freelance | 2 |
| booking | 1 |
| planning | 0 |
| workflow | 0 |
| messenger | 0 |
| invest | 0 |
| delivery | 0 |

## Suggestions

### booking/booking_detail (mainEntity: Booking)

**Slot:** toolbar · **Score:** 100 · **Chosen (alpha):** `cancel_booking` · **Tied total:** 2

**Tied intents:** `cancel_booking`, `reschedule_booking`

⚠️ **Нужна ручная judgement** — heuristic не нашёл canonical primary.

### sales/listing_feed (mainEntity: Listing)

**Slot:** toolbar · **Score:** 100 · **Chosen (alpha):** `bulk_relist` · **Tied total:** 2

**Tied intents:** `bulk_relist`, `create_listing`

⚠️ **Нужна ручная judgement** — heuristic не нашёл canonical primary.

### sales/listing_feed (mainEntity: Listing)

**Slot:** toolbar · **Score:** 80 · **Chosen (alpha):** `bulk_relist_expired` · **Tied total:** 3

**Tied intents:** `bulk_relist_expired`, `duplicate_listing`, `relist_item`

⚠️ **Нужна ручная judgement** — heuristic не нашёл canonical primary.

### sales/listing_detail (mainEntity: Listing)

**Slot:** toolbar · **Score:** 100 · **Chosen (alpha):** `add_to_watchlist` · **Tied total:** 3

**Tied intents:** `add_to_watchlist`, `edit_listing`, `feature_listing`

✅ **Promote:** `edit_listing` → `salience: "primary"` _(tier 1: canonical edit listing)_

### sales/listing_detail (mainEntity: Listing)

**Slot:** toolbar · **Score:** 60 · **Chosen (alpha):** `add_listing_image` · **Tied total:** 31

**Tied intents (31):** `add_listing_image`, `add_to_bundle`, `apply_template`, `archive_listing`, `cancel_promotion`, `certify_listing`, …

✅ **Promote:** `edit_template` → `salience: "primary"` _(tier 2: edit-like action)_

### sales/listing_detail (mainEntity: Listing)

**Slot:** toolbar · **Score:** 40 · **Chosen (alpha):** `add_to_collection` · **Tied total:** 12

**Tied intents (12):** `add_to_collection`, `block_bidder`, `delete_template`, `remove_from_collection`, `remove_listing`, `remove_tag`, …

⚠️ **Нужна ручная judgement** — heuristic не нашёл canonical primary.

### sales/order_detail (mainEntity: Order)

**Slot:** toolbar · **Score:** 60 · **Chosen (alpha):** `add_order_note` · **Tied total:** 9

**Tied intents (9):** `add_order_note`, `apply_coupon`, `apply_store_credit`, `choose_payment_method`, `combine_shipping`, `issue_partial_refund`, …

⚠️ **Нужна ручная judgement** — heuristic не нашёл canonical primary.

### sales/seller_profile (mainEntity: User)

**Slot:** toolbar · **Score:** 100 · **Chosen (alpha):** `follow_seller` · **Tied total:** 2

**Tied intents:** `follow_seller`, `update_profile`

✅ **Promote:** `update_profile` → `salience: "primary"` _(tier 2: edit-like action)_

### sales/seller_profile (mainEntity: User)

**Slot:** toolbar · **Score:** 60 · **Chosen (alpha):** `approve_verification` · **Tied total:** 3

**Tied intents:** `approve_verification`, `reject_verification`, `verify_identity`

✅ **Promote:** `approve_verification` → `salience: "primary"` _(tier 3: promotion action)_

### sales/seller_profile (mainEntity: User)

**Slot:** toolbar · **Score:** 40 · **Chosen (alpha):** `block_user` · **Tied total:** 7

**Tied intents:** `block_user`, `report_user`, `subscribe_to_seller`, `unblock_user`, `unfollow_seller`, `unsubscribe_from_seller`, `warn_user`

⚠️ **Нужна ручная judgement** — heuristic не нашёл canonical primary.

### lifequest/habit_detail (mainEntity: Habit)

**Slot:** toolbar · **Score:** 100 · **Chosen (alpha):** `check_habit` · **Tied total:** 2

**Tied intents:** `check_habit`, `edit_habit`

✅ **Promote:** `edit_habit` → `salience: "primary"` _(tier 1: canonical edit habit)_

### lifequest/habit_detail (mainEntity: Habit)

**Slot:** toolbar · **Score:** 60 · **Chosen (alpha):** `change_habit_frequency` · **Tied total:** 3

**Tied intents:** `change_habit_frequency`, `move_habit_sphere`, `reset_streak`

⚠️ **Нужна ручная judgement** — heuristic не нашёл canonical primary.

### lifequest/habit_detail (mainEntity: Habit)

**Slot:** toolbar · **Score:** 40 · **Chosen (alpha):** `delete_habit` · **Tied total:** 2

**Tied intents:** `delete_habit`, `log_habit_value`

⚠️ **Нужна ручная judgement** — heuristic не нашёл canonical primary.

### lifequest/goal_detail (mainEntity: Goal)

**Slot:** toolbar · **Score:** 100 · **Chosen (alpha):** `edit_goal` · **Tied total:** 2

**Tied intents:** `edit_goal`, `update_goal_progress`

✅ **Promote:** `edit_goal` → `salience: "primary"` _(tier 1: canonical edit goal)_

### lifequest/goal_detail (mainEntity: Goal)

**Slot:** toolbar · **Score:** 60 · **Chosen (alpha):** `add_goal_note` · **Tied total:** 3

**Tied intents:** `add_goal_note`, `move_goal_sphere`, `set_goal_deadline`

⚠️ **Нужна ручная judgement** — heuristic не нашёл canonical primary.

### reflect/entry_detail (mainEntity: MoodEntry)

**Slot:** toolbar · **Score:** 100 · **Chosen (alpha):** `add_tag_to_entry` · **Tied total:** 2

**Tied intents:** `add_tag_to_entry`, `edit_entry_note`

✅ **Promote:** `edit_entry_note` → `salience: "primary"` _(tier 2: edit-like action)_

### reflect/entry_detail (mainEntity: MoodEntry)

**Slot:** toolbar · **Score:** 40 · **Chosen (alpha):** `add_activity_to_entry` · **Tied total:** 2

**Tied intents:** `add_activity_to_entry`, `delete_entry`

⚠️ **Нужна ручная judgement** — heuristic не нашёл canonical primary.

### freelance/deal_detail_customer (mainEntity: Deal)

**Slot:** toolbar · **Score:** 70 · **Chosen (alpha):** `cancel_deal_mutual` · **Tied total:** 4

**Tied intents:** `cancel_deal_mutual`, `request_revision`, `submit_revision`, `submit_work_result`

✅ **Promote:** `submit_revision` → `salience: "primary"` _(tier 3: promotion action)_
