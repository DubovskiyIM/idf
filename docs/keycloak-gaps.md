# Keycloak gap-каталог (Stage 1 baseline)

**Дата:** 2026-04-23
**Worktree:** `.worktrees/keycloak-dogfood/` (host), branch `feat/keycloak-dogfood`
**Источник:** Keycloak Admin REST OpenAPI 1.0 (https://www.keycloak.org/docs-api/latest/rest-api/openapi.yaml, ~370KB / 14400 строк / 265 paths / 22 tags)
**Importer:** `@intent-driven/importer-openapi@0.6.0` (с flattenSchema из Gravitino #227)
**Baseline statistics:** 224 entities / 254 intents / 1 role (`owner`) → derive: **48 projections** (7 catalog + 41 detail/form), pattern-bank матчит ≥3 patterns на каждом catalog (`hero-create`, `hierarchy-tree-nav`, `catalog-action-cta`).

**Методология:** static-analysis через `crystallizeV2` + `deriveProjections` в node-репле; baseline smoke-тест 4/4 passed (`src/domains/keycloak/__tests__/baseline.test.js`).

## Ключевое наблюдение Stage 1

**Importer-openapi на Keycloak'овом spec'е генерирует огромный noise-слой:**
- **25 base/Representation duplicate pair'ов** (`Realm` + `RealmRepresentation`, `Client` + `ClientRepresentation`, `User` + `UserRepresentation`, ... — те же сущности как 2 разные entities в ontology). Path-derived synthesis vs schema-derived даёт два имени.
- **21 operation-as-entity** (`LowerPriority`, `RaisePriority`, `Copy`, `Import`, `Export`, `LogoutAll`, `TestSMTPConnection`, `ResetPassword`, `SendVerifyEmail`, `MoveAfter` ...). Это HTTP endpoints с body shape, importer materializes их как сущности.
- **100 entities без intents** (44.6% всех entities) — Representation-helpers (`AbstractPolicyRepresentation`, `AccessToken`, `AuthDetailsRepresentation`, `AuthenticationFlowRepresentation`, ...) которые нужны как nested types, но не как top-level UI page.

После baseline render UI покажет ~50 root-tabs из которых ⅔ — мусор. Это качественно хуже чем Gravitino baseline (там 218 entities → 3 catalog'а из-за enrich-blocker'а; здесь 224 → 7 catalog'ов, но noise глубже).

## Структура каталога

`{id, severity, module, observation, target-stage, how-to-reproduce}`. Severity: P0 (блокирует demo) / P1 (визуально плохо) / P2 (cosmetic). Target: Stage 2-N / Deferred / SDK PR.

## Gap'ы (Stage 1 первичная партия)

### G-K-1 — Дубликаты base/Representation entity-имён (25 пар)

**Severity:** P0
**Module:** `@intent-driven/importer-openapi` (path-derived FK synthesis vs schema-derived entities)
**Observation:** Для 25 canonical entity importer создаёт ДВЕ записи в `ontology.entities` — например `Realm` (path-derived `/realms/{realm}`) и `RealmRepresentation` (из `components.schemas.RealmRepresentation`). Intent.target использует короткое имя (`Realm`), полное hosting-FK references — длинное (`RealmRepresentation`). UI видит обе как отдельные tabs.

Пары: Realm/AdminEvent/User/Policy/ClientScope/ScopeMapping/Client/ClientTemplate/ClientType/ResourceServer/Resource/Scope (12 в первом sample) + ещё 13.

**Target-stage:** SDK PR — importer-openapi `mergeRepresentationDuplicates`. Heuristic: если есть `X` и `XRepresentation`, и intents.target = `X` — алиасить `XRepresentation` → `X`, объединить fields preferring `XRepresentation` (более полный schema).
**Reproduce:**
```bash
node -e "import('./src/domains/keycloak/imported.js').then(m => {
  const ents = Object.keys(m.ontology.entities);
  console.log(ents.filter(e => ents.includes(e + 'Representation')).length);
})"
```

### G-K-2 — Operation-as-entity (21 шт)

**Severity:** P0
**Module:** `@intent-driven/importer-openapi`
**Observation:** Endpoints типа `POST /authentication/executions/{id}/lower-priority`, `POST /clients/{id}/test-nodes-available`, `POST /users/{id}/reset-password`, `POST /users/{id}/send-verify-email` создают entities `LowerPriority`, `TestNodesAvailable`, `ResetPassword`, `SendVerifyEmail` соответственно. Это action verbs, не сущности — должны быть intents на parent entity (User/Client/Execution).

Полный список (21): FederatedIdentityRepresentation, LowerPriority, RaisePriority, Copy, Import, Evaluate, Download, TestNodesAvailable, ImportConfig, Export, Localization, LogoutAll, TestSMTPConnection, MoveAfter, FederatedIdentity, Logout, ResetPassword, ResetPasswordEmail, SendVerifyEmail, Activate, Deactivate.

**Target-stage:** SDK PR — importer-openapi `detectActionEndpoints`. Heuristic: верб-form path-segment (`lower-priority`, `test-*`, `reset-*`, `send-*`, `move-after`, `logout-*`, `activate`, `deactivate`) после `{id}` — НЕ создавать entity, а создать intent на parent entity с corresponding intent-name.
**Reproduce:**
```bash
node -e "import('./src/domains/keycloak/imported.js').then(m => {
  const verbs = /^(Activate|Deactivate|MoveAfter|Localization|FederatedIdentity|Copy|Download|Evaluate|Import|Export|Reset|Logout|Send|Test|Sync|Clear|Validate|Lower|Raise|Restart|Stop|Run|Convert|Parse)/;
  console.log(Object.keys(m.ontology.entities).filter(e => verbs.test(e)));
})"
```

### G-K-3 — 100 orphan entities без intents (44.6%)

**Severity:** P1
**Module:** `@intent-driven/importer-openapi`
**Observation:** Из 224 entities — 100 не имеют ни одного intent.target на себя. Все они — Representation-helpers (`AbstractPolicyRepresentation`, `AccessToken`, `AuthDetailsRepresentation`, `AuthenticationFlowRepresentation`, ... 100 шт) — нужны как nested types в полях canonical entity, но как top-level UI tab — мусор.

V2Shell не фильтрует — все 100 попадут в nav-graph если будут заматчены root-кандидатами через crystallize.

**Target-stage:** SDK PR — importer-openapi `entity.kind: "embedded"` для типов, которые не имеют path-coverage (нет endpoint'а, который бы возвращал/создавал их как top-level resource). V2Shell + ROOT_PROJECTIONS уже фильтруют по kind.
**Связан с:** Gravitino G2 (envelope-типы) — общий класс gap'ов «importer не отличает root resources от nested types».

### G-K-4 — Roles только `owner` (нет Keycloak RBAC)

**Severity:** P1
**Module:** `@intent-driven/importer-openapi` (нет role-extraction из security-schemes / scopes)
**Observation:** Keycloak имеет богатую RBAC — `realm-admin`, `view-realm`, `manage-users`, `view-users`, `query-users`, ~40 client-roles в `realm-management`. Importer-openapi выдаёт только дефолтный `owner`. После enrichment ожидаем ≥5 roles (admin/realm-admin/user-mgr/viewer/self).
**Target-stage:** Stage 2 — enrichment-claude (если CLI wire-format фикс из Gravitino #186 работает) ИЛИ ручная декларация в `ontology.js`.
**Reference:** https://www.keycloak.org/docs/latest/server_admin/#per-realm-admin-permissions

### G-K-5 — Только 7 root catalog'ов (мало для 22-tag domain)

**Severity:** P1
**Module:** `@intent-driven/core` deriveProjections — слабая heuristic для catalog detection
**Observation:** OpenAPI имеет 22 tags / 224 entities / 254 intents, но crystallize derive вытащил всего 7 catalog (realm/client/localization/moveafter/federatedidentity/activate/deactivate). Из них только 2 настоящие (realm/client), остальные — operation-noise (G-K-2).

Ожидаемые canonical catalog'и: realm/client/user/group/role/identityProvider/clientScope/userFederation/authenticationFlow/event/session/policy = **12 шт**. Получили — 2 + 5 noise.

**Target-stage:** Закроется после G-K-1 + G-K-2 (без duplicate'ов и operation-noise останется чистый список) ИЛИ Stage 2 — author 12 catalog projections вручную.
**Reproduce:**
```bash
node -e "import('./src/domains/keycloak/projections.js').then(m => console.log(m.ROOT_PROJECTIONS))"
```

### G-K-6 — Pattern bank уже работает на baseline (положительная находка)

**Severity:** N/A (info)
**Observation:** На `realm_list` artifact'е заматчилось 3 stable pattern'а без любого host-tuning'а:
- `hero-create` — заметный CTA для создания
- `hierarchy-tree-nav` — sidebar tree (Realm → Client/User/Group/...)
- `catalog-action-cta` (новый из Gravitino-спринта) — toolbar action button

Это значит даже baseline без authored projections даст работающий navigation experience. Stage 2 work — почистить noise → patterns заработают на ВСЕХ canonical caталогах.

## Заплары на дальше (Stage 2+)

- **Stage 2** — host-facade enrichment: aliasing param-имён (`{realm}` → `realmId`), target-remap для grant/revoke, fieldRole для password / secret / token / timestamp.
- **Stage 3** — authored projections для 12 canonical entities (Realm / Client / User / Group / Role / IdentityProvider / ClientScope / UserFederation / AuthenticationFlow / Event / Session / Policy).
- **Stage 4** — seed: 2-3 realms + 5 clients + 10 users + 4 IdP + role hierarchy.
- **Stage 5** — Wizard catalog_create (G23 deferred из Gravitino) — Add Realm / Add Client / Add IdentityProvider.
- **Stage 6** — Tab-composed form (Client с 10+ tabs × 30+ полей: Settings/Credentials/Roles/ClientScopes/Authorization/Sessions/OfflineAccess/Installation). Новый класс pattern'ов — **tabbed-form-sections**.
- **Stage 7** — Connection-test pattern (IdP + UserFederation create flow с "Test connection" mid-wizard).
- **Stage 8** — Credentials primitive (password / OTP / WebAuthn / X509 — multi-kind credential).
- **Stage 9** — Role-mappings matrix с group inheritance.

## Stage 1 acceptance-критерии

- [x] Worktree создан, importer прогнан (224/254/1)
- [x] Host facade (6 файлов) парсится
- [x] Baseline smoke-тест (4 assertions) green
- [x] Static gap-анализ зафиксирован (6 gap'ов)
- [ ] HTTP smoke на dev server — отложено (требует портов 3001+5173 в background)
- [ ] Browser visual baseline — отложено (требует пользовательского взгляда)
