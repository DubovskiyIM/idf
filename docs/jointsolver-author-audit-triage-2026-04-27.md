# JointSolver author audit — triage

**Generated:** 2026-04-27T10:46:26.866Z

Per-intent triage над divergent diff'ом из Phase 3e (post-3d.3 default flip).
Каждое intent классифицировано по сильнейшему signal'у; intents в нескольких
проекциях агрегированы (primaryCategory = highest-priority).

## Counts (per individual diff record)

| Category | Count |
|---|---:|
| explicit-already | 6 |
| propose-primary | 7 |
| propose-secondary | 0 |
| propose-navigation | 0 |
| propose-utility | 91 |
| slot-model-mismatch | 345 |
| manual-review | 196 |

## Counts (per unique intent)

| Category | Unique intents |
|---|---:|
| slot-model-mismatch | 121 |
| propose-primary | 5 |
| propose-utility | 45 |
| manual-review | 70 |
| explicit-already | 4 |
| **Total** | **245** |

## Proposable annotations by domain

| Domain | propose-primary | propose-secondary | propose-navigation | propose-utility | Total |
|---|---:|---:|---:|---:|---:|
| booking | 1 | 0 | 0 | 2 | 3 |
| planning | 0 | 0 | 0 | 1 | 1 |
| workflow | 1 | 0 | 0 | 0 | 1 |
| messenger | 1 | 0 | 0 | 10 | 11 |
| sales | 0 | 0 | 0 | 30 | 30 |
| lifequest | 0 | 0 | 0 | 1 | 1 |
| reflect | 2 | 0 | 0 | 0 | 2 |
| notion | 0 | 0 | 0 | 1 | 1 |

## Manual-review intents (70)

| Domain | Intent | Slot pairs (derived→alternate) |
|---|---|---|
| workflow | `create_workflow` | hero→overlay |
| workflow | `remove_node` | toolbar→overlay |
| workflow | `stop_execution` | primaryCTA→overlay |
| sales | `close_dispute` | primaryCTA→overlay |
| sales | `cancel_listing` | overlay→toolbar |
| sales | `publish_listing` | overlay→toolbar |
| sales | `accept_offer` | overlay→footer |
| sales | `approve_return` | overlay→footer |
| sales | `reject_return` | overlay→footer |
| sales | `ban_user` | footer→overlay |
| sales | `resolve_dispute` | toolbar→overlay |
| sales | `add_dispute_evidence` | toolbar→overlay |
| sales | `accept_resolution` | primaryCTA→overlay |
| sales | `escalate_dispute` | primaryCTA→overlay |
| sales | `respond_to_dispute` | primaryCTA→overlay |
| lifequest | `log_habit_value` | toolbar→overlay |
| freelance | `create_task_draft` | toolbar→overlay |
| keycloak | `updateUser` | toolbar→overlay |
| keycloak | `disableCredentialTypesUser` | toolbar→overlay |
| keycloak | `removeUser` | overlay→primaryCTA |
| argocd | `patchApplication` | toolbar→overlay |
| argocd | `removeApplication` | overlay→primaryCTA |
| notion | `rename_page` | toolbar→overlay |
| notion | `move_page` | toolbar→overlay |
| notion | `create_view` | toolbar→hero |
| notion | `add_property` | toolbar→hero |
| notion | `add_database_row` | toolbar→hero |
| notion | `share_page` | toolbar→hero |
| notion | `invite_member` | toolbar→hero |
| notion | `search_workspace` | toolbar→overlay |
| notion | `agent_summarize_page` | toolbar→overlay |
| automation | `create_credential` | toolbar→hero |
| automation | `register_node_type` | toolbar→hero |
| gravitino | `alterMetalake` | toolbar→overlay |
| gravitino | `setMetalake` | toolbar→overlay |
| gravitino | `dropMetalake` | toolbar→primaryCTA |
| gravitino | `alterCatalog` | toolbar→overlay |
| gravitino | `dropCatalog` | overlay→primaryCTA |
| gravitino | `alterSchema` | toolbar→overlay |
| gravitino | `createSchema` | toolbar→overlay |
| gravitino | `dropSchema` | toolbar→primaryCTA |
| gravitino | `alterTable` | toolbar→overlay |
| gravitino | `createTable` | toolbar→overlay |
| gravitino | `dropTable` | toolbar→primaryCTA |
| gravitino | `alterFileset` | toolbar→overlay |
| gravitino | `createFileset` | toolbar→overlay |
| gravitino | `dropFileset` | toolbar→primaryCTA |
| gravitino | `alterTopic` | toolbar→overlay |
| gravitino | `createTopic` | toolbar→overlay |
| gravitino | `dropTopic` | toolbar→primaryCTA |
| gravitino | `updateModel` | toolbar→overlay |
| gravitino | `registerModel` | toolbar→overlay |
| gravitino | `deleteModel` | toolbar→primaryCTA |
| gravitino | `addUser` | toolbar→overlay |
| gravitino | `removeUser` | overlay→primaryCTA |
| gravitino | `addGroup` | toolbar→overlay |
| gravitino | `removeGroup` | overlay→primaryCTA |
| gravitino | `createRole` | toolbar→overlay |
| gravitino | `overrideRolePrivileges` | toolbar→overlay |
| gravitino | `deleteRole` | toolbar→primaryCTA |
| gravitino | `alterTag` | toolbar→overlay |
| gravitino | `deleteTag` | overlay→primaryCTA |
| gravitino | `alterPolicy` | toolbar→overlay |
| gravitino | `deletePolicy` | overlay→primaryCTA |
| meta | `approve_pattern_promotion` | toolbar→overlay |
| meta | `reject_pattern_promotion` | toolbar→overlay |
| meta | `ship_pattern_promotion` | toolbar→overlay |
| meta | `close_backlog_item` | toolbar→overlay |
| meta | `reject_backlog_item` | toolbar→overlay |
| meta | `schedule_backlog_item` | toolbar→overlay |
