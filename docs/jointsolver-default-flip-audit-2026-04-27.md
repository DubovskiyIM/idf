# JointSolver default-flip audit (creator-of-main → hero promotion)

**Generated:** 2026-04-27T15:15:06.236Z

> Predicts какие creator-of-main intents переедут `toolbar → hero`
> автоматически когда SDK default-flip'нет `salienceDrivenRouting`
> с opt-in (`=== true`) на opt-out (`!== false`). Только catalog projections.

## Per-domain summary (unique creator-of-main intents in catalog)

| Domain | features.salienceDrivenRouting | explicit-primary | implicit-primary | explicit-non-primary | Total candidates |
|---|---|---:|---:|---:|---:|
| booking | — | 0 | 2 | 0 | 2 |
| planning | — | 0 | 0 | 0 | 0 |
| workflow | — | 0 | 1 | 0 | 1 |
| messenger | — | 0 | 3 | 0 | 3 |
| sales | — | 0 | 2 | 0 | 2 |
| lifequest | — | 0 | 0 | 0 | 0 |
| reflect | — | 0 | 2 | 0 | 2 |
| invest | — | 0 | 5 | 0 | 5 |
| delivery | — | 0 | 3 | 0 | 3 |
| freelance | — | 0 | 0 | 0 | 0 |
| compliance | — | 0 | 6 | 0 | 6 |
| keycloak | — | 0 | 10 | 0 | 10 |
| argocd | — | 0 | 7 | 0 | 7 |
| notion | — | 0 | 0 | 0 | 0 |
| automation | — | 0 | 0 | 0 | 0 |
| gravitino | — | 0 | 1 | 0 | 1 |
| meta | — | 0 | 0 | 0 | 0 |
| **TOTAL** | — | **0** | **42** | **0** | **42** |

## Categories explained

- **explicit-primary** — `intent.salience >= 80`, явный author signal. Default-flip их уже промотирует через #434. **Безопасно**.
- **implicit-primary** — creator-of-main БЕЗ explicit salience. Default-flip их промотирует через #438 (classifyIntentRole consultation). **Главный risk surface** — author может не ожидать hero.
- **explicit-non-primary** — `intent.salience` задан и < 80 (secondary/navigation/utility). Default-flip их **НЕ** промотирует.

## Implicit-primary intents (default-flip risk surface)

Intents которые переедут toolbar→hero автоматически если #438 + default-flip merged. Для каждого автор НЕ задал salience explicit — полагается на default toolbar placement.

| Domain | Intent | Confirmation | Projections | Notes |
|---|---|---|---|---|
| booking | `add_service` | form | service_catalog | Добавить услугу |
| booking | `create_booking` | form | my_bookings | Создать бронирование |
| workflow | `import_workflow` | file | workflow_list | Импортировать |
| messenger | `create_direct_chat` | clickForm | conversation_list | Личный чат |
| messenger | `create_group` | form | conversation_list | Групповой чат |
| messenger | `create_channel` | form | conversation_list | Создать канал |
| sales | `create_category` | enter | category_browse | Создать категорию |
| sales | `save_search` | enter | saved_searches | Сохранить поиск |
| reflect | `create_activity` | form | activity_list | Создать активность |
| reflect | `create_tag` | form | tag_list | Создать тег |
| invest | `create_portfolio` | — | portfolios_root | Новый портфель |
| invest | `create_goal` | — | goals_root | Создать цель |
| invest | `create_watchlist` | — | watchlists_root | Новый список |
| invest | `create_recommendation_for_client` | — | recommendations_inbox | Рекомендация клиенту |
| invest | `assign_client` | — | advisor_clients | Взять клиента |
| delivery | `create_draft_order` | auto | order_history, orders_feed | Создать черновик заказа |
| delivery | `assign_courier_manual` | auto | courier_lobby, delivery_history | Назначить курьера вручную |
| delivery | `agent_auto_assign_courier` | none | courier_lobby, delivery_history | Агент: авто-назначение курьера |
| compliance | `create_journal_entry_draft` | auto | my_journal_entries, review_queue, approval_queue | Создать JE (черновик) |
| compliance | `configure_control` | auto | my_controls, controls_admin | Добавить control |
| compliance | `flag_finding` | manual | findings_catalog | Поднять Finding |
| compliance | `attach_evidence_to_je` | auto | evidence_browser | Прикрепить evidence к JE |
| compliance | `attach_evidence_to_attestation` | auto | evidence_browser | Evidence к attestation |
| compliance | `open_cycle` | manual | cycles_admin | Открыть attestation cycle |
| keycloak | `createRealm` | enter | realm_list | createRealm |
| keycloak | `createClient` | enter | client_list | createClient |
| keycloak | `createUser` | enter | user_list | createUser |
| keycloak | `createGroup` | enter | group_list | createGroup |
| keycloak | `createRole` | enter | role_list | createRole |
| keycloak | `createIdentityProvider` | enter | identityprovider_list | createIdentityProvider |
| keycloak | `createClientScope` | enter | clientscope_list | createClientScope |
| keycloak | `createComponent` | enter | component_list | createComponent |
| keycloak | `createOrganization` | enter | organization_list | createOrganization |
| keycloak | `createWorkflow` | enter | workflow_list | createWorkflow |
| argocd | `createApplication` | enter | application_list | createApplication |
| argocd | `createApplicationSet` | enter | applicationset_list | createApplicationSet |
| argocd | `createProject` | enter | project_list | createProject |
| argocd | `createCluster` | enter | cluster_list | createCluster |
| argocd | `createRepository` | enter | repository_list | createRepository |
| argocd | `createCertificate` | enter | certificate_list | createCertificate |
| argocd | `createGpgkey` | enter | gpgkey_list | createGpgkey |
| gravitino | `createMetalake` | enter | metalake_list | createMetalake |
