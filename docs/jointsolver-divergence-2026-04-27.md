# JointSolver divergence — A2 Phase 3 calibration

**Generated:** 2026-04-27T07:31:53.582Z

> Сравнение derived (existing assignToSlots*) vs alternate (jointSolver Hungarian) на real domains. Каждый row — divergence per intent в projection × role.

## Per-domain summary

| Domain | Records | Total intents | Divergent | Derived-only | Alternate-only | Agreed |
|--------|---------|---------------|-----------|--------------|----------------|--------|
| booking | 15 | 69 | 18 | 24 | 27 | 0 |
| planning | 2 | 18 | 6 | 0 | 12 | 0 |
| workflow | 6 | 25 | 7 | 4 | 13 | 1 |
| messenger | 12 | 120 | 33 | 44 | 42 | 1 |
| sales | 48 | 723 | 61 | 609 | 51 | 2 |
| lifequest | 5 | 38 | 4 | 26 | 8 | 0 |
| reflect | 6 | 20 | 3 | 14 | 3 | 0 |
| invest | 5 | 5 | 0 | 0 | 5 | 0 |
| delivery | 4 | 4 | 0 | 0 | 4 | 0 |
| freelance | 4 | 14 | 2 | 6 | 6 | 0 |
| compliance | 10 | 10 | 0 | 0 | 10 | 0 |
| keycloak | 55 | 225 | 170 | 0 | 5 | 50 |
| argocd | 40 | 130 | 55 | 0 | 40 | 35 |
| notion | 45 | 154 | 30 | 113 | 4 | 7 |
| automation | 8 | 32 | 5 | 25 | 0 | 2 |
| gravitino | 24 | 86 | 76 | 8 | 1 | 1 |
| **TOTAL** | — | **1673** | **470** | **873** | **231** | **99** |

**Agreement rate:** 5.9% (99/1673)
**Divergence rate:** 28.1% (470/1673)

## Slot divergence patterns

| Derived → Alternate | Count |
|---------------------|-------|
| overlay → toolbar | 268 |
| toolbar → secondary | 64 |
| overlay → secondary | 57 |
| overlay → context | 25 |
| toolbar → hero | 18 |
| primaryCTA → secondary | 14 |
| footer → toolbar | 9 |
| footer → secondary | 5 |
| hero → toolbar | 4 |
| toolbar → primaryCTA | 3 |
| overlay → hero | 3 |

## Per-domain divergent records

### booking (11 divergent records)

#### service_catalog × specialist (catalog, mainEntity: Service)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `add_service` | toolbar | hero | divergent |
| `update_service` | overlay | toolbar | divergent |

#### specialist_schedule × client (catalog, mainEntity: TimeSlot)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_booking` | overlay | toolbar | divergent |

#### specialist_schedule × specialist (catalog, mainEntity: TimeSlot)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `block_slot` | overlay | toolbar | divergent |
| `unblock_slot` | overlay | toolbar | divergent |

#### specialist_schedule × agent (catalog, mainEntity: TimeSlot)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_booking` | overlay | toolbar | divergent |

#### my_bookings × client (catalog, mainEntity: Booking)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_booking` | overlay | toolbar | divergent |

#### my_bookings × agent (catalog, mainEntity: Booking)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_booking` | overlay | toolbar | divergent |

#### booking_detail × client (detail, mainEntity: Booking)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_booking` | toolbar | secondary | divergent |
| `reschedule_booking` | toolbar | secondary | divergent |

#### booking_detail × specialist (detail, mainEntity: Booking)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_client_booking` | toolbar | secondary | divergent |
| `complete_booking` | primaryCTA | secondary | divergent |
| `mark_no_show` | primaryCTA | secondary | divergent |

#### booking_detail × agent (detail, mainEntity: Booking)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `cancel_booking` | toolbar | secondary | divergent |
| `reschedule_booking` | toolbar | secondary | divergent |

#### service_detail × client (detail, mainEntity: Service)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `select_service` | toolbar | secondary | divergent |

_… ещё 1 divergent records (см. JSON)_

### planning (2 divergent records)

#### my_polls × agent (catalog, mainEntity: Poll)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_poll` | toolbar | hero | divergent |
| `set_deadline` | overlay | context | divergent |

#### poll_overview × agent (detail, mainEntity: Poll)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `open_poll` | primaryCTA | secondary | divergent |
| `set_deadline` | footer | toolbar | divergent |
| `cancel_poll` | footer | toolbar | divergent |
| `close_poll` | footer | secondary | divergent |

### workflow (4 divergent records)

#### workflow_list × self (catalog, mainEntity: Workflow)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `import_workflow` | toolbar | hero | divergent |
| `create_workflow` | hero | toolbar | divergent |

#### node_inspector × self (detail, mainEntity: Node)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `remove_node` | toolbar | secondary | divergent |
| `configure_node` | overlay | secondary | divergent |
| `rename_node` | overlay | secondary | divergent |

#### node_inspector × agent (detail, mainEntity: Node)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `configure_node` | overlay | secondary | divergent |

#### execution_log × self (detail, mainEntity: Execution)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `stop_execution` | primaryCTA | secondary | divergent |

### messenger (10 divergent records)

#### conversation_list × self (catalog, mainEntity: Conversation)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_direct_chat` | toolbar | hero | divergent |
| `create_group` | hero | toolbar | divergent |

#### conversation_list × contact (catalog, mainEntity: Conversation)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_group` | hero | toolbar | divergent |
| `rename_group` | overlay | context | divergent |
| `set_group_description` | overlay | context | divergent |
| `set_group_rules` | overlay | toolbar | divergent |
| `set_welcome_message` | overlay | context | divergent |

#### conversation_list × agent (catalog, mainEntity: Conversation)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_direct_chat` | toolbar | hero | divergent |
| `create_group` | hero | toolbar | divergent |

#### contact_list × self (catalog, mainEntity: Contact)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `add_contact` | toolbar | hero | divergent |
| `accept_contact` | overlay | toolbar | divergent |
| `block_contact` | overlay | toolbar | divergent |
| `reject_contact` | overlay | toolbar | divergent |

#### contact_list × contact (catalog, mainEntity: Contact)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `add_contact` | toolbar | hero | divergent |
| `set_contact_nickname` | overlay | context | divergent |
| `accept_contact` | overlay | toolbar | divergent |
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
| `update_profile` | toolbar | secondary | divergent |

#### user_profile × contact (detail, mainEntity: User)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `update_profile` | toolbar | secondary | divergent |
| `set_status_message` | overlay | secondary | divergent |
| `delete_avatar` | footer | toolbar | divergent |
| `enable_2fa` | footer | toolbar | divergent |
| `set_avatar` | footer | toolbar | divergent |
| `set_language` | footer | toolbar | divergent |
| `set_notification_settings` | footer | toolbar | divergent |
| `set_privacy_settings` | footer | toolbar | divergent |
| `set_theme` | footer | toolbar | divergent |

#### people_list × self (catalog, mainEntity: User)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `update_profile` | overlay | toolbar | divergent |

#### people_list × contact (catalog, mainEntity: User)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `set_status_message` | overlay | toolbar | divergent |
| `update_profile` | overlay | toolbar | divergent |

### sales (21 divergent records)

#### listing_feed × buyer (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `buy_now` | overlay | toolbar | divergent |

#### listing_feed × seller (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_listing` | toolbar | hero | divergent |
| `edit_listing` | overlay | toolbar | divergent |
| `extend_auction` | overlay | context | divergent |
| `lower_start_price` | overlay | context | divergent |
| `set_buy_now_price` | overlay | toolbar | divergent |
| `set_reserve_price` | overlay | context | divergent |
| `cancel_listing` | overlay | toolbar | divergent |
| `feature_listing` | overlay | context | divergent |
| `publish_listing` | overlay | toolbar | divergent |

#### listing_feed × moderator (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `feature_listing` | overlay | toolbar | divergent |
| `unfeature_listing` | overlay | toolbar | divergent |

#### listing_feed × agent (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_listing` | toolbar | hero | divergent |
| `buy_now` | overlay | toolbar | divergent |
| `publish_listing` | overlay | toolbar | divergent |

#### listing_detail × seller (detail, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `edit_listing` | toolbar | secondary | divergent |
| `extend_auction` | overlay | toolbar | divergent |
| `lower_start_price` | overlay | toolbar | divergent |
| `set_buy_now_price` | overlay | secondary | divergent |
| `set_reserve_price` | overlay | secondary | divergent |
| `cancel_listing` | overlay | secondary | divergent |
| `feature_listing` | overlay | toolbar | divergent |
| `publish_listing` | overlay | secondary | divergent |

#### listing_detail × moderator (detail, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `feature_listing` | overlay | secondary | divergent |
| `unfeature_listing` | overlay | secondary | divergent |
| `restore_listing` | primaryCTA | secondary | divergent |
| `suspend_listing` | primaryCTA | secondary | divergent |

#### listing_detail × agent (detail, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `publish_listing` | overlay | secondary | divergent |

#### my_listings × buyer (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `buy_now` | overlay | toolbar | divergent |

#### my_listings × seller (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `create_listing` | toolbar | hero | divergent |
| `edit_listing` | overlay | toolbar | divergent |
| `extend_auction` | overlay | context | divergent |
| `lower_start_price` | overlay | context | divergent |
| `set_buy_now_price` | overlay | toolbar | divergent |
| `set_reserve_price` | overlay | context | divergent |
| `cancel_listing` | overlay | toolbar | divergent |
| `feature_listing` | overlay | context | divergent |
| `publish_listing` | overlay | toolbar | divergent |

#### my_listings × moderator (catalog, mainEntity: Listing)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `feature_listing` | overlay | toolbar | divergent |
| `unfeature_listing` | overlay | toolbar | divergent |

_… ещё 11 divergent records (см. JSON)_

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
| `complete_goal` | primaryCTA | secondary | divergent |
| `update_goal_progress` | footer | secondary | divergent |

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
| `updateRealm` | overlay | toolbar | divergent |

#### realm_list × realmAdmin (catalog, mainEntity: Realm)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `logoutAllRealm` | overlay | toolbar | divergent |
| `realmRealm` | overlay | toolbar | divergent |
| `removeRealm` | overlay | toolbar | divergent |
| `updateRealm` | overlay | toolbar | divergent |

#### realm_list × userMgr (catalog, mainEntity: Realm)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `logoutAllRealm` | overlay | toolbar | divergent |
| `realmRealm` | overlay | toolbar | divergent |
| `removeRealm` | overlay | toolbar | divergent |
| `updateRealm` | overlay | toolbar | divergent |

#### realm_list × viewer (catalog, mainEntity: Realm)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `logoutAllRealm` | overlay | toolbar | divergent |
| `realmRealm` | overlay | toolbar | divergent |
| `removeRealm` | overlay | toolbar | divergent |
| `updateRealm` | overlay | toolbar | divergent |

#### realm_list × self (catalog, mainEntity: Realm)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `logoutAllRealm` | overlay | toolbar | divergent |
| `realmRealm` | overlay | toolbar | divergent |
| `removeRealm` | overlay | toolbar | divergent |
| `updateRealm` | overlay | toolbar | divergent |

#### client_list × admin (catalog, mainEntity: Client)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `removeClient` | overlay | toolbar | divergent |
| `testNodesAvailableClient` | overlay | toolbar | divergent |
| `updateClient` | overlay | toolbar | divergent |

#### client_list × realmAdmin (catalog, mainEntity: Client)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `removeClient` | overlay | toolbar | divergent |
| `testNodesAvailableClient` | overlay | toolbar | divergent |
| `updateClient` | overlay | toolbar | divergent |

#### client_list × userMgr (catalog, mainEntity: Client)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `removeClient` | overlay | toolbar | divergent |
| `testNodesAvailableClient` | overlay | toolbar | divergent |
| `updateClient` | overlay | toolbar | divergent |

#### client_list × viewer (catalog, mainEntity: Client)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `removeClient` | overlay | toolbar | divergent |
| `testNodesAvailableClient` | overlay | toolbar | divergent |
| `updateClient` | overlay | toolbar | divergent |

#### client_list × self (catalog, mainEntity: Client)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `removeClient` | overlay | toolbar | divergent |
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
| `updateApplication` | toolbar | secondary | divergent |
| `patchApplication` | toolbar | secondary | divergent |
| `removeApplication` | overlay | secondary | divergent |
| `syncApplication` | overlay | secondary | divergent |

#### application_detail × developer (detail, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `updateApplication` | toolbar | secondary | divergent |
| `patchApplication` | toolbar | secondary | divergent |
| `removeApplication` | overlay | secondary | divergent |
| `syncApplication` | overlay | secondary | divergent |

#### application_detail × deployer (detail, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `updateApplication` | toolbar | secondary | divergent |
| `patchApplication` | toolbar | secondary | divergent |
| `removeApplication` | overlay | secondary | divergent |
| `syncApplication` | overlay | secondary | divergent |

#### application_detail × viewer (detail, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `updateApplication` | toolbar | secondary | divergent |
| `patchApplication` | toolbar | secondary | divergent |
| `removeApplication` | overlay | secondary | divergent |
| `syncApplication` | overlay | secondary | divergent |

#### application_detail × auditor (detail, mainEntity: Application)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `updateApplication` | toolbar | secondary | divergent |
| `patchApplication` | toolbar | secondary | divergent |
| `removeApplication` | overlay | secondary | divergent |
| `syncApplication` | overlay | secondary | divergent |

_… ещё 15 divergent records (см. JSON)_

### notion (10 divergent records)

#### page_detail × workspaceOwner (detail, mainEntity: Page)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `archive_page` | toolbar | primaryCTA | divergent |
| `rename_page` | toolbar | secondary | divergent |
| `set_cover_image` | overlay | secondary | divergent |
| `set_page_icon` | overlay | secondary | divergent |
| `unarchive_page` | overlay | secondary | divergent |

#### page_detail × editor (detail, mainEntity: Page)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `archive_page` | toolbar | primaryCTA | divergent |
| `rename_page` | toolbar | secondary | divergent |
| `set_cover_image` | overlay | secondary | divergent |
| `set_page_icon` | overlay | secondary | divergent |
| `unarchive_page` | overlay | secondary | divergent |

#### database_detail × workspaceOwner (detail, mainEntity: Database)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `archive_database` | toolbar | primaryCTA | divergent |
| `set_default_view` | toolbar | secondary | divergent |

#### database_detail × editor (detail, mainEntity: Database)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `set_default_view` | toolbar | secondary | divergent |

#### database_views_list × workspaceOwner (catalog, mainEntity: DatabaseView)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `change_view_kind` | overlay | toolbar | divergent |
| `clear_filters` | overlay | toolbar | divergent |
| `rename_view` | overlay | toolbar | divergent |
| `set_group_by` | overlay | context | divergent |
| `set_sort` | overlay | toolbar | divergent |

#### database_views_list × editor (catalog, mainEntity: DatabaseView)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `change_view_kind` | overlay | toolbar | divergent |
| `clear_filters` | overlay | toolbar | divergent |
| `rename_view` | overlay | toolbar | divergent |
| `set_group_by` | overlay | context | divergent |
| `set_sort` | overlay | toolbar | divergent |

#### database_properties_list × workspaceOwner (catalog, mainEntity: Property)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `delete_property` | overlay | hero | divergent |
| `rename_property` | overlay | toolbar | divergent |

#### database_properties_list × editor (catalog, mainEntity: Property)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `delete_property` | overlay | hero | divergent |
| `rename_property` | overlay | toolbar | divergent |

#### page_permissions_panel × workspaceOwner (catalog, mainEntity: PagePermission)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `unshare_page` | overlay | hero | divergent |

#### members_admin × workspaceOwner (catalog, mainEntity: WorkspaceMember)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `change_member_role` | overlay | toolbar | divergent |
| `revoke_member` | overlay | toolbar | divergent |

### automation (2 divergent records)

#### credential_vault × editor (catalog, mainEntity: Credential)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `delete_credential` | overlay | toolbar | divergent |
| `rotate_credential` | overlay | toolbar | divergent |
| `update_credential` | overlay | toolbar | divergent |

#### node_palette × editor (catalog, mainEntity: NodeType)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `mark_node_type_deprecated` | overlay | toolbar | divergent |
| `update_node_type` | overlay | toolbar | divergent |

### gravitino (24 divergent records)

#### metalake_list × owner (catalog, mainEntity: Metalake)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterMetalake` | overlay | toolbar | divergent |
| `dropMetalake` | overlay | toolbar | divergent |
| `setMetalake` | overlay | toolbar | divergent |

#### metalake_detail × owner (detail, mainEntity: Metalake)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterMetalake` | toolbar | secondary | divergent |
| `setMetalake` | toolbar | secondary | divergent |
| `dropMetalake` | toolbar | secondary | divergent |

#### catalog_list × owner (catalog, mainEntity: Catalog)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterCatalog` | overlay | toolbar | divergent |
| `createCatalog` | overlay | toolbar | divergent |
| `dropCatalog` | overlay | toolbar | divergent |
| `setCatalog` | overlay | toolbar | divergent |

#### catalog_detail × owner (detail, mainEntity: Catalog)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterCatalog` | toolbar | secondary | divergent |
| `createCatalog` | overlay | secondary | divergent |
| `dropCatalog` | overlay | secondary | divergent |
| `setCatalog` | overlay | secondary | divergent |

#### schema_list × owner (catalog, mainEntity: Schema)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterSchema` | overlay | toolbar | divergent |
| `createSchema` | overlay | toolbar | divergent |
| `dropSchema` | overlay | toolbar | divergent |

#### schema_detail × owner (detail, mainEntity: Schema)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterSchema` | toolbar | secondary | divergent |
| `createSchema` | toolbar | secondary | divergent |
| `dropSchema` | toolbar | secondary | divergent |

#### table_list × owner (catalog, mainEntity: Table)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterTable` | overlay | toolbar | divergent |
| `createTable` | overlay | toolbar | divergent |
| `dropTable` | overlay | toolbar | divergent |

#### table_detail × owner (detail, mainEntity: Table)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterTable` | toolbar | secondary | divergent |
| `createTable` | toolbar | secondary | divergent |
| `dropTable` | toolbar | secondary | divergent |

#### fileset_list × owner (catalog, mainEntity: Fileset)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterFileset` | overlay | toolbar | divergent |
| `createFileset` | overlay | toolbar | divergent |
| `dropFileset` | overlay | toolbar | divergent |

#### fileset_detail × owner (detail, mainEntity: Fileset)

| Intent | Derived | Alternate | Kind |
|--------|---------|-----------|------|
| `alterFileset` | toolbar | secondary | divergent |
| `createFileset` | toolbar | secondary | divergent |
| `dropFileset` | toolbar | secondary | divergent |

_… ещё 14 divergent records (см. JSON)_
