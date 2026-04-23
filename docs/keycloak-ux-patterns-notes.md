# Keycloak UX patterns — кандидаты в bank

**Источник:** Keycloak Admin Console (https://www.keycloak.org/docs/latest/server_admin/), 14-й dogfood-домен IDF.
**Worktree:** `.worktrees/keycloak-dogfood/`
**Sister doc:** `docs/keycloak-gaps.md` (Stage 1 gap-каталог).

## Pre-Stage 1 ожидания (из project-memory)

Память `project_next_dogfood_keycloak.md` (originSession `daceeade-2968-4f09-a4fb-0638967becbe`, 2026-04-23) предсказывала следующие новые pattern'ы:

### P-K-A — Tabbed-form-sections

**Контекст:** Keycloak Client Settings — НЕ flat form. Это ~10 tab'ов (Settings / Credentials / Roles / Client Scopes / Authorization / Sessions / Offline Access / Installation) × 30+ полей в каждом. То же — Realm Settings (~7 tabs), User edit (~6 tabs).

**Trigger:** form-archetype с >=15 fields, где ontology.composition группирует в логические разделы (по prefix или explicit tab'у).

**Структурный вид:** `slots.body = [{ tab: "Settings", fields: [...] }, { tab: "Credentials", fields: [...] }, ...]` + `slots.bodyControl = "tab-strip"`.

**SDK requirement:** Новый primitive `tabStrip` или extension `bodyControl: "tabs"` в form-archetype. Pattern bank entry в `idf-sdk/packages/core/src/patterns/stable/form/tabbed-form-sections/`.

**Falsification:** не должен матчиться на forms с <10 fields или без logical grouping.

### P-K-B — Connection-test mid-wizard

**Контекст:** Keycloak IdP create wizard — между "Configure" step и "Save" step есть "Test Connection" кнопка (для SAML — test-metadata-fetch, для LDAP — test-bind, для OIDC — discovery-fetch).

**Trigger:** wizard-archetype с intent.particles.testTarget !== null, или intent.kind === "verification" в pre-create chain.

**Структурный вид:** `wizard.steps[N] = { kind: "verification", testIntent: "testIdpConnection", outputBinding: "testResult" }` + UI отображает result (success/failure + diagnostics).

**SDK requirement:** Wizard primitive (G23 deferred из Gravitino) с поддержкой `kind:"verification"` step. Pattern bank — `wizard/connection-test-step/`.

**Reference:** Gravitino importer уже создаёт `testConnection`-style intents для catalog-types (PostgreSQL/Hive), но активно используется только в G7-spec (deferred).

### P-K-C — Multi-kind credential editor

**Контекст:** Keycloak User → Credentials tab. Ровно одна сущность (User) имеет N credentials разных типов: password, OTP (TOTP/HOTP), WebAuthn, X.509. Каждый — со своим UI:
- Password — text input + show/hide + strength meter
- OTP — QR-code generator + secret + counter
- WebAuthn — device registration flow
- X.509 — file upload (PEM)

**Trigger:** subCollection с `discriminator: "type"` где type is enum < 10 values, и каждый value требует **разный input primitive**.

**Структурный вид:** Полиморфизм per-row: instead of one render-function, table показывает row-render dispatch'нутый по type discriminator.

**SDK requirement:** SubCollectionSection с per-row primitive override; possibly polymorphic entity kind (open item §"Composite/polymorphic entities" в backlog).

### P-K-D — Role-mappings matrix с inheritance

**Контекст:** Keycloak User → Role Mappings. Покажет (a) directly-assigned realm roles, (b) directly-assigned client roles, (c) effective roles (inherited через group membership + composite roles). Это NOT просто PermissionMatrix — это tree-like inheritance view.

**Trigger:** entity с `transitive` relation (composite roles ссылаются на другие composite roles, group nesting).

**Структурный вид:** Matrix [users × roles] с дополнительной dimension "source" (direct/group/composite).

**SDK requirement:** Расширение PermissionMatrix primitive (Gravitino #202) с `inheritance: { sourceField, transitiveVia }` config. Pattern bank — `detail/role-inheritance-matrix/`.

### P-K-E — Action endpoint как row-action (anti-pattern fix)

**Контекст:** Operation-as-entity gap (G-K-2): importer видит `POST /users/{id}/reset-password` как создание `ResetPassword` сущности. Семантически — это action на User row.

**Trigger / Anti-trigger:** entity-name содержит verb (Reset/Activate/Logout/Send/Move/Test) AND path содержит `{id}` родительской entity AND нет GET-endpoint'а на этой entity.

**Структурный вид:** Не создавать catalog'и для этих entities; создавать intent с `target: <ParentEntity>` + соответствующая row-action в DataGrid `col.kind:"actions"` (Gravitino #218).

**SDK requirement:** importer-openapi `detectActionEndpoints` heuristic + action intent synthesis. Pattern bank entry зарегистрировать как `anti/operation-as-entity/` (первый residing в anti/).

## Pre-bank: Keycloak-specific UI conventions для pattern researcher

Из docs.keycloak.org observation (без implementation на Stage 1):

- **Search-as-you-type в catalog'ах** — User list, Group list, Client list используют search-input как primary filter, не toolbar facet'ы. Может матчиться существующий `inline-search` pattern.
- **JSON editor для config blobs** — Identity Provider config, Authentication Flow execution config. Аналог `propertyPopover` (Gravitino), но writable. Возможный candidate `monaco-config-editor`.
- **Realm switcher в shell-header** — глобальный selector сверху (multi-tenant навигация). Похож на Gravitino `tenant-quick-switcher` (#226 candidate). Если Keycloak использует тот же UX — это validation для promotion.
- **Сессии (active/offline) — read-only listing с per-row "Logout"** — связан с P-K-E (action endpoints).
- **Events — read-only audit log с filter'ами по type/user/date** — `read-only-audit-log` candidate (отсутствует, но напрашивается).

## Stage 2-N action plan

После того как gap'ы G-K-1, G-K-2, G-K-3 закроются (importer cleanup) — повторить baseline-derive. Ожидаемое улучшение: 12 чистых canonical catalog'ов вместо 7+noise.

После Stage 4 (seed) — запустить pattern researcher batch на Keycloak для попытки выявить ещё кандидатов из визуального anchor'а. Скрипт: `scripts/keycloak-pattern-batch.mjs` (по образцу `freelance-pattern-batch.mjs`).
