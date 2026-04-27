# JointSolver divergence — A2 Phase 3 calibration

**Generated:** 2026-04-27T07:52:25.504Z

> Сравнение derived (existing assignToSlots*) vs alternate (jointSolver Hungarian) на real domains. Каждый row — divergence per intent в projection × role.

## Per-domain summary

| Domain | Records | Total intents | Divergent | Derived-only | Alternate-only | Agreed |
|--------|---------|---------------|-----------|--------------|----------------|--------|
| booking | 15 | 69 | 16 | 24 | 27 | 2 |
| planning | 2 | 18 | 4 | 0 | 12 | 2 |
| workflow | 6 | 25 | 4 | 4 | 13 | 4 |
| messenger | 12 | 120 | 32 | 44 | 42 | 2 |
| sales | 48 | 723 | 46 | 609 | 51 | 17 |
| lifequest | 5 | 38 | 3 | 26 | 8 | 1 |
| reflect | 6 | 20 | 3 | 14 | 3 | 0 |
| invest | 5 | 5 | 0 | 0 | 5 | 0 |
| delivery | 4 | 4 | 0 | 0 | 4 | 0 |
| freelance | 4 | 14 | 2 | 6 | 6 | 0 |
| compliance | 10 | 10 | 0 | 0 | 10 | 0 |
| keycloak | 55 | 225 | 165 | 0 | 5 | 55 |
| argocd | 40 | 130 | 55 | 0 | 40 | 35 |
| notion | 45 | 154 | 37 | 113 | 4 | 0 |
| automation | 8 | 32 | 7 | 25 | 0 | 0 |
| gravitino | 24 | 86 | 76 | 8 | 1 | 1 |
| **TOTAL** | — | **1673** | **450** | **873** | **231** | **119** |

**Agreement rate:** 7.1% (119/1673)
**Divergence rate:** 26.9% (450/1673)

## Slot divergence patterns

| Derived → Alternate | Count |
|---------------------|-------|
| overlay → toolbar | 159 |
| overlay → hero | 111 |
| overlay → primaryCTA | 70 |
| toolbar → primaryCTA | 67 |
| toolbar → hero | 25 |
| footer → primaryCTA | 12 |
| hero → toolbar | 2 |
| footer → toolbar | 2 |
| toolbar → overlay | 1 |
| hero → overlay | 1 |

## Per-domain divergent records

### booking (11 divergent records)

#### service_catalog × specialist (catalog, mainEntity: Service)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `add_service` | toolbar | hero | divergent |
| `update_service` | overlay | hero | divergent |

#### specialist_schedule × client (catalog, mainEntity: TimeSlot)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_booking` | overlay | hero | divergent |

#### specialist_schedule × specialist (catalog, mainEntity: TimeSlot)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `block_slot` | overlay | hero | divergent |
| `unblock_slot` | overlay | hero | divergent |

#### specialist_schedule × agent (catalog, mainEntity: TimeSlot)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_booking` | overlay | hero | divergent |

#### my_bookings × client (catalog, mainEntity: Booking)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_booking` | overlay | hero | divergent |

#### my_bookings × agent (catalog, mainEntity: Booking)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_booking` | overlay | hero | divergent |

#### booking_detail × client (detail, mainEntity: Booking)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_booking` | toolbar | primaryCTA | divergent |
| `reschedule_booking` | toolbar | primaryCTA | divergent |

#### booking_detail × specialist (detail, mainEntity: Booking)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_client_booking` | toolbar | primaryCTA | divergent |

#### booking_detail × agent (detail, mainEntity: Booking)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_booking` | toolbar | primaryCTA | divergent |
| `reschedule_booking` | toolbar | primaryCTA | divergent |

#### service_detail × client (detail, mainEntity: Service)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `select_service` | toolbar | primaryCTA | divergent |

_… ещё 1 divergent records (см. JSON)_

### planning (2 divergent records)

#### my_polls × agent (catalog, mainEntity: Poll)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_poll` | toolbar | hero | divergent |

#### poll_overview × agent (detail, mainEntity: Poll)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `set_deadline` | footer | primaryCTA | divergent |
| `cancel_poll` | footer | primaryCTA | divergent |
| `close_poll` | footer | primaryCTA | divergent |

### workflow (2 divergent records)

#### node_inspector × self (detail, mainEntity: Node)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `remove_node` | toolbar | primaryCTA | divergent |
| `configure_node` | overlay | primaryCTA | divergent |
| `rename_node` | overlay | primaryCTA | divergent |

#### node_inspector × agent (detail, mainEntity: Node)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `configure_node` | overlay | primaryCTA | divergent |

### messenger (10 divergent records)

#### conversation_list × self (catalog, mainEntity: Conversation)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_group` | hero | toolbar | divergent |

#### conversation_list × contact (catalog, mainEntity: Conversation)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_direct_chat` | toolbar | overlay | divergent |
| `create_group` | hero | overlay | divergent |
| `rename_group` | overlay | toolbar | divergent |
| `set_group_rules` | overlay | toolbar | divergent |
| `set_welcome_message` | overlay | toolbar | divergent |

#### conversation_list × agent (catalog, mainEntity: Conversation)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_direct_chat` | toolbar | hero | divergent |
| `create_group` | hero | toolbar | divergent |

#### contact_list × self (catalog, mainEntity: Contact)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `add_contact` | toolbar | hero | divergent |
| `accept_contact` | overlay | hero | divergent |
| `block_contact` | overlay | toolbar | divergent |
| `reject_contact` | overlay | toolbar | divergent |

#### contact_list × contact (catalog, mainEntity: Contact)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `add_contact` | toolbar | hero | divergent |
| `set_contact_nickname` | overlay | toolbar | divergent |
| `accept_contact` | overlay | hero | divergent |
| `block_contact` | overlay | toolbar | divergent |
| `reject_contact` | overlay | toolbar | divergent |
| `unblock_contact` | overlay | toolbar | divergent |

#### contact_list × agent (catalog, mainEntity: Contact)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `add_contact` | toolbar | hero | divergent |

#### user_profile × self (detail, mainEntity: User)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `update_profile` | toolbar | primaryCTA | divergent |

#### user_profile × contact (detail, mainEntity: User)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `update_profile` | toolbar | primaryCTA | divergent |
| `set_status_message` | overlay | primaryCTA | divergent |
| `delete_avatar` | footer | primaryCTA | divergent |
| `enable_2fa` | footer | toolbar | divergent |
| `set_avatar` | footer | primaryCTA | divergent |
| `set_language` | footer | toolbar | divergent |
| `set_notification_settings` | footer | primaryCTA | divergent |
| `set_privacy_settings` | footer | primaryCTA | divergent |
| `set_theme` | footer | primaryCTA | divergent |

#### people_list × self (catalog, mainEntity: User)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `update_profile` | overlay | toolbar | divergent |

#### people_list × contact (catalog, mainEntity: User)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `set_status_message` | overlay | toolbar | divergent |
| `update_profile` | overlay | toolbar | divergent |

### sales (19 divergent records)

#### listing_feed × buyer (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `buy_now` | overlay | toolbar | divergent |

#### listing_feed × seller (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_listing` | toolbar | hero | divergent |
| `edit_listing` | overlay | hero | divergent |
| `set_buy_now_price` | overlay | toolbar | divergent |
| `set_reserve_price` | overlay | toolbar | divergent |
| `cancel_listing` | overlay | toolbar | divergent |
| `publish_listing` | overlay | toolbar | divergent |

#### listing_feed × moderator (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `feature_listing` | overlay | hero | divergent |
| `unfeature_listing` | overlay | hero | divergent |

#### listing_feed × agent (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_listing` | toolbar | hero | divergent |
| `buy_now` | overlay | toolbar | divergent |
| `publish_listing` | overlay | hero | divergent |

#### listing_detail × seller (detail, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `edit_listing` | toolbar | primaryCTA | divergent |
| `extend_auction` | overlay | primaryCTA | divergent |
| `lower_start_price` | overlay | primaryCTA | divergent |
| `set_buy_now_price` | overlay | primaryCTA | divergent |
| `set_reserve_price` | overlay | primaryCTA | divergent |
| `cancel_listing` | overlay | primaryCTA | divergent |
| `feature_listing` | overlay | primaryCTA | divergent |
| `publish_listing` | overlay | primaryCTA | divergent |

#### listing_detail × moderator (detail, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `feature_listing` | overlay | primaryCTA | divergent |
| `unfeature_listing` | overlay | primaryCTA | divergent |

#### listing_detail × agent (detail, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `publish_listing` | overlay | primaryCTA | divergent |

#### my_listings × buyer (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `buy_now` | overlay | toolbar | divergent |

#### my_listings × seller (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_listing` | toolbar | hero | divergent |
| `edit_listing` | overlay | hero | divergent |
| `set_buy_now_price` | overlay | toolbar | divergent |
| `set_reserve_price` | overlay | toolbar | divergent |
| `cancel_listing` | overlay | toolbar | divergent |
| `publish_listing` | overlay | toolbar | divergent |

#### my_listings × moderator (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `feature_listing` | overlay | hero | divergent |
| `unfeature_listing` | overlay | hero | divergent |

_… ещё 9 divergent records (см. JSON)_

### lifequest (3 divergent records)

#### habit_list × agent (catalog, mainEntity: Habit)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_habit` | toolbar | hero | divergent |

#### goal_list × agent (catalog, mainEntity: Goal)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_goal` | toolbar | hero | divergent |

#### goal_detail × agent (detail, mainEntity: Goal)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `update_goal_progress` | footer | primaryCTA | divergent |

### reflect (3 divergent records)

#### hypothesis_list × agent (catalog, mainEntity: Hypothesis)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `propose_hypothesis` | toolbar | hero | divergent |

#### activity_list × agent (catalog, mainEntity: Activity)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_activity` | toolbar | hero | divergent |

#### tag_list × agent (catalog, mainEntity: Tag)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_tag` | toolbar | hero | divergent |

### invest — все 5 records aligned (no divergence)

### delivery — все 4 records aligned (no divergence)

### freelance (1 divergent records)

#### task_catalog_public × customer (catalog, mainEntity: Task)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_task_draft` | toolbar | hero | divergent |
| `edit_task` | overlay | toolbar | divergent |

### compliance — все 10 records aligned (no divergence)

### keycloak (55 divergent records)

#### realm_list × admin (catalog, mainEntity: Realm)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `logoutAllRealm` | overlay | toolbar | divergent |
| `realmRealm` | overlay | toolbar | divergent |
| `removeRealm` | overlay | toolbar | divergent |
| `updateRealm` | overlay | hero | divergent |

#### realm_list × realmAdmin (catalog, mainEntity: Realm)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `logoutAllRealm` | overlay | toolbar | divergent |
| `realmRealm` | overlay | toolbar | divergent |
| `removeRealm` | overlay | toolbar | divergent |
| `updateRealm` | overlay | hero | divergent |

#### realm_list × userMgr (catalog, mainEntity: Realm)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `logoutAllRealm` | overlay | toolbar | divergent |
| `realmRealm` | overlay | toolbar | divergent |
| `removeRealm` | overlay | toolbar | divergent |
| `updateRealm` | overlay | hero | divergent |

#### realm_list × viewer (catalog, mainEntity: Realm)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `logoutAllRealm` | overlay | toolbar | divergent |
| `realmRealm` | overlay | toolbar | divergent |
| `removeRealm` | overlay | toolbar | divergent |
| `updateRealm` | overlay | hero | divergent |

#### realm_list × self (catalog, mainEntity: Realm)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `logoutAllRealm` | overlay | toolbar | divergent |
| `realmRealm` | overlay | toolbar | divergent |
| `removeRealm` | overlay | toolbar | divergent |
| `updateRealm` | overlay | hero | divergent |

#### client_list × admin (catalog, mainEntity: Client)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `removeClient` | overlay | hero | divergent |
| `testNodesAvailableClient` | overlay | toolbar | divergent |
| `updateClient` | overlay | toolbar | divergent |

#### client_list × realmAdmin (catalog, mainEntity: Client)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `removeClient` | overlay | hero | divergent |
| `testNodesAvailableClient` | overlay | toolbar | divergent |
| `updateClient` | overlay | toolbar | divergent |

#### client_list × userMgr (catalog, mainEntity: Client)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `removeClient` | overlay | hero | divergent |
| `testNodesAvailableClient` | overlay | toolbar | divergent |
| `updateClient` | overlay | toolbar | divergent |

#### client_list × viewer (catalog, mainEntity: Client)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `removeClient` | overlay | hero | divergent |
| `testNodesAvailableClient` | overlay | toolbar | divergent |
| `updateClient` | overlay | toolbar | divergent |

#### client_list × self (catalog, mainEntity: Client)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `removeClient` | overlay | hero | divergent |
| `testNodesAvailableClient` | overlay | toolbar | divergent |
| `updateClient` | overlay | toolbar | divergent |

_… ещё 45 divergent records (см. JSON)_

### argocd (25 divergent records)

#### application_list × admin (catalog, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `patchApplication` | overlay | toolbar | divergent |
| `removeApplication` | overlay | toolbar | divergent |
| `syncApplication` | overlay | toolbar | divergent |

#### application_list × developer (catalog, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `patchApplication` | overlay | toolbar | divergent |
| `removeApplication` | overlay | toolbar | divergent |
| `syncApplication` | overlay | toolbar | divergent |

#### application_list × deployer (catalog, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `patchApplication` | overlay | toolbar | divergent |
| `removeApplication` | overlay | toolbar | divergent |
| `syncApplication` | overlay | toolbar | divergent |

#### application_list × viewer (catalog, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `patchApplication` | overlay | toolbar | divergent |
| `removeApplication` | overlay | toolbar | divergent |
| `syncApplication` | overlay | toolbar | divergent |

#### application_list × auditor (catalog, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `patchApplication` | overlay | toolbar | divergent |
| `removeApplication` | overlay | toolbar | divergent |
| `syncApplication` | overlay | toolbar | divergent |

#### application_detail × admin (detail, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `updateApplication` | toolbar | primaryCTA | divergent |
| `patchApplication` | toolbar | primaryCTA | divergent |
| `removeApplication` | overlay | primaryCTA | divergent |
| `syncApplication` | overlay | primaryCTA | divergent |

#### application_detail × developer (detail, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `updateApplication` | toolbar | primaryCTA | divergent |
| `patchApplication` | toolbar | primaryCTA | divergent |
| `removeApplication` | overlay | primaryCTA | divergent |
| `syncApplication` | overlay | primaryCTA | divergent |

#### application_detail × deployer (detail, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `updateApplication` | toolbar | primaryCTA | divergent |
| `patchApplication` | toolbar | primaryCTA | divergent |
| `removeApplication` | overlay | primaryCTA | divergent |
| `syncApplication` | overlay | primaryCTA | divergent |

#### application_detail × viewer (detail, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `updateApplication` | toolbar | primaryCTA | divergent |
| `patchApplication` | toolbar | primaryCTA | divergent |
| `removeApplication` | overlay | primaryCTA | divergent |
| `syncApplication` | overlay | primaryCTA | divergent |

#### application_detail × auditor (detail, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `updateApplication` | toolbar | primaryCTA | divergent |
| `patchApplication` | toolbar | primaryCTA | divergent |
| `removeApplication` | overlay | primaryCTA | divergent |
| `syncApplication` | overlay | primaryCTA | divergent |

_… ещё 15 divergent records (см. JSON)_

### notion (11 divergent records)

#### page_detail × workspaceOwner (detail, mainEntity: Page)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `archive_page` | toolbar | primaryCTA | divergent |
| `rename_page` | toolbar | primaryCTA | divergent |
| `set_cover_image` | overlay | primaryCTA | divergent |
| `set_page_icon` | overlay | primaryCTA | divergent |
| `unarchive_page` | overlay | primaryCTA | divergent |

#### page_detail × editor (detail, mainEntity: Page)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `archive_page` | toolbar | primaryCTA | divergent |
| `rename_page` | toolbar | primaryCTA | divergent |
| `set_cover_image` | overlay | primaryCTA | divergent |
| `set_page_icon` | overlay | primaryCTA | divergent |
| `unarchive_page` | overlay | primaryCTA | divergent |

#### database_detail × workspaceOwner (detail, mainEntity: Database)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `archive_database` | toolbar | primaryCTA | divergent |
| `set_default_view` | toolbar | primaryCTA | divergent |

#### database_detail × editor (detail, mainEntity: Database)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `set_default_view` | toolbar | primaryCTA | divergent |

#### database_views_list × workspaceOwner (catalog, mainEntity: DatabaseView)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_view` | toolbar | hero | divergent |
| `change_view_kind` | overlay | toolbar | divergent |
| `clear_filters` | overlay | toolbar | divergent |
| `rename_view` | overlay | hero | divergent |
| `set_group_by` | overlay | toolbar | divergent |
| `set_sort` | overlay | toolbar | divergent |

#### database_views_list × editor (catalog, mainEntity: DatabaseView)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_view` | toolbar | hero | divergent |
| `change_view_kind` | overlay | toolbar | divergent |
| `clear_filters` | overlay | toolbar | divergent |
| `rename_view` | overlay | hero | divergent |
| `set_group_by` | overlay | toolbar | divergent |
| `set_sort` | overlay | toolbar | divergent |

#### database_properties_list × workspaceOwner (catalog, mainEntity: Property)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `add_property` | toolbar | hero | divergent |
| `delete_property` | overlay | toolbar | divergent |
| `rename_property` | overlay | hero | divergent |

#### database_properties_list × editor (catalog, mainEntity: Property)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `add_property` | toolbar | hero | divergent |
| `delete_property` | overlay | toolbar | divergent |
| `rename_property` | overlay | hero | divergent |

#### page_permissions_panel × workspaceOwner (catalog, mainEntity: PagePermission)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `share_page` | toolbar | hero | divergent |
| `unshare_page` | overlay | hero | divergent |

#### page_permissions_panel × editor (catalog, mainEntity: PagePermission)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `share_page` | toolbar | hero | divergent |

_… ещё 1 divergent records (см. JSON)_

### automation (2 divergent records)

#### credential_vault × editor (catalog, mainEntity: Credential)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_credential` | toolbar | hero | divergent |
| `delete_credential` | overlay | toolbar | divergent |
| `rotate_credential` | overlay | toolbar | divergent |
| `update_credential` | overlay | hero | divergent |

#### node_palette × editor (catalog, mainEntity: NodeType)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `register_node_type` | toolbar | hero | divergent |
| `mark_node_type_deprecated` | overlay | toolbar | divergent |
| `update_node_type` | overlay | hero | divergent |

### gravitino (24 divergent records)

#### metalake_list × owner (catalog, mainEntity: Metalake)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterMetalake` | overlay | hero | divergent |
| `dropMetalake` | overlay | toolbar | divergent |
| `setMetalake` | overlay | toolbar | divergent |

#### metalake_detail × owner (detail, mainEntity: Metalake)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterMetalake` | toolbar | primaryCTA | divergent |
| `setMetalake` | toolbar | primaryCTA | divergent |
| `dropMetalake` | toolbar | primaryCTA | divergent |

#### catalog_list × owner (catalog, mainEntity: Catalog)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterCatalog` | overlay | hero | divergent |
| `createCatalog` | overlay | hero | divergent |
| `dropCatalog` | overlay | toolbar | divergent |
| `setCatalog` | overlay | toolbar | divergent |

#### catalog_detail × owner (detail, mainEntity: Catalog)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterCatalog` | toolbar | primaryCTA | divergent |
| `createCatalog` | overlay | primaryCTA | divergent |
| `dropCatalog` | overlay | primaryCTA | divergent |
| `setCatalog` | overlay | primaryCTA | divergent |

#### schema_list × owner (catalog, mainEntity: Schema)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterSchema` | overlay | hero | divergent |
| `createSchema` | overlay | hero | divergent |
| `dropSchema` | overlay | toolbar | divergent |

#### schema_detail × owner (detail, mainEntity: Schema)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterSchema` | toolbar | primaryCTA | divergent |
| `createSchema` | toolbar | primaryCTA | divergent |
| `dropSchema` | toolbar | primaryCTA | divergent |

#### table_list × owner (catalog, mainEntity: Table)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterTable` | overlay | hero | divergent |
| `createTable` | overlay | hero | divergent |
| `dropTable` | overlay | toolbar | divergent |

#### table_detail × owner (detail, mainEntity: Table)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterTable` | toolbar | primaryCTA | divergent |
| `createTable` | toolbar | primaryCTA | divergent |
| `dropTable` | toolbar | primaryCTA | divergent |

#### fileset_list × owner (catalog, mainEntity: Fileset)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterFileset` | overlay | hero | divergent |
| `createFileset` | overlay | hero | divergent |
| `dropFileset` | overlay | toolbar | divergent |

#### fileset_detail × owner (detail, mainEntity: Fileset)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterFileset` | toolbar | primaryCTA | divergent |
| `createFileset` | toolbar | primaryCTA | divergent |
| `dropFileset` | toolbar | primaryCTA | divergent |

_… ещё 14 divergent records (см. JSON)_
