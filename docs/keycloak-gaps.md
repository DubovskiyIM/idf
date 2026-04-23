# Keycloak gap-каталог (Stage 1+2+3 baseline)

**Дата:** 2026-04-23
**Worktree:** `.worktrees/keycloak-dogfood/` (host), branch `feat/keycloak-dogfood`
**Источник:** Keycloak Admin REST OpenAPI 1.0 (https://www.keycloak.org/docs-api/latest/rest-api/openapi.yaml, ~370KB / 14400 строк / 265 paths / 22 tags)
**Importer:** `@intent-driven/importer-openapi@0.6.0` (с flattenSchema из Gravitino #227)
**Stage 1 baseline:** 224 entities / 254 intents / 1 role (`owner`) → derive: 48 projections (7 catalog).
**Stage 2 после host-enrichment:** **199 entities** (-25 dedup) / **254 intents** (253 с alias) / **5 roles** (admin/realmAdmin/userMgr/viewer/self) → derive: **49 artifacts (8 catalog + 7 form + 34 detail)**, **53 fields** с `fieldRole` hint (secret/datetime/email/url), **75 entities** помечены `kind:embedded`. Pattern-bank матчит ≥3 patterns на каждом catalog (`hero-create`, `hierarchy-tree-nav`, `catalog-action-cta`).

**Stage 3 после reclassify + whitelist:** **20 catalog'ов derived** (host-fix `reclassifyCollectionPosts` синтезирует `createX` intents с α=`insert` + `creates=X` для 17 canonical collection-POST endpoint'ов), **10 чистых ROOT_PROJECTIONS** (whitelist canonical: realm/user/client/group/role/identityprovider/clientscope/component/organization/workflow). Operation-noise (activate/deactivate/moveafter/localization/federatedidentity) исключена из nav. Baseline 11/11 tests green.

**Методология:** static-analysis через `crystallizeV2` + `deriveProjections` в node-репле; baseline smoke-тест **11/11 passed** (`src/domains/keycloak/__tests__/baseline.test.js`).

## Ключевое наблюдение Stage 1

**Importer-openapi на Keycloak'овом spec'е генерирует огромный noise-слой:**
- **25 base/Representation duplicate pair'ов** (`Realm` + `RealmRepresentation`, `Client` + `ClientRepresentation`, `User` + `UserRepresentation`, ... — те же сущности как 2 разные entities в ontology). Path-derived synthesis vs schema-derived даёт два имени.
- **21 operation-as-entity** (`LowerPriority`, `RaisePriority`, `Copy`, `Import`, `Export`, `LogoutAll`, `TestSMTPConnection`, `ResetPassword`, `SendVerifyEmail`, `MoveAfter` ...). Это HTTP endpoints с body shape, importer materializes их как сущности.
- **100 entities без intents** (44.6% всех entities) — Representation-helpers (`AbstractPolicyRepresentation`, `AccessToken`, `AuthDetailsRepresentation`, `AuthenticationFlowRepresentation`, ...) которые нужны как nested types, но не как top-level UI page.

После baseline render UI покажет ~50 root-tabs из которых ⅔ — мусор. Это качественно хуже чем Gravitino baseline (там 218 entities → 3 catalog'а из-за enrich-blocker'а; здесь 224 → 7 catalog'ов, но noise глубже).

## Структура каталога

`{id, severity, module, observation, target-stage, how-to-reproduce}`. Severity: P0 (блокирует demo) / P1 (визуально плохо) / P2 (cosmetic). Target: Stage 2-N / Deferred / SDK PR.

## Gap'ы (Stage 1 первичная партия)

### G-K-1 — Дубликаты base/Representation entity-имён (25 пар) — host-fix ⚠️

**Severity:** P0 → **частично закрыт host-fix'ом** (ontology.js::mergeRepresentationDuplicates), SDK PR ещё нужен.
**Module:** `@intent-driven/importer-openapi` (path-derived FK synthesis vs schema-derived entities)
**Stage 2 host-fix:** `mergeRepresentationDuplicates` в `src/domains/keycloak/ontology.js` — для каждой пары переносит fields/relations из `XRepresentation` в `X` (Representation как source-of-truth — он fully populated), удаляет `XRepresentation`. Результат: 224 → 199 entities, Realm.fields 4 → 155, Client 5 → 48, User 3 → 29.
**SDK PR (X1):** importer-openapi `mergeRepresentationDuplicates` — после merge удалить host-fix.
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

### G-K-3 — Orphan entities без intents — host-fix ⚠️

**Severity:** P1 → **частично закрыт host-fix'ом** (ontology.js::markOrphansEmbedded).
**Module:** `@intent-driven/importer-openapi`
**Stage 1 наблюдение:** Из 224 entities — 100 без intent.target. После Stage 2 dedup (-25 XRepresentation) — **75 orphan**. Все они Representation-helpers (`AbstractPolicyRepresentation`, `AccessToken`, ...) — нужны как nested types, но не как top-level UI tab.
**Stage 2 host-fix:** `markOrphansEmbedded` помечает их `kind:"embedded"` (importer дефолтом ставит `internal`). ROOT_PROJECTIONS фильтрует по kind catalog/dashboard, поэтому embedded не всплывают в nav.
**SDK PR (X1):** importer-openapi `entity.kind: "embedded"` для type'ов без path-coverage. **Связан с** Gravitino G2 (envelope-типы) — общий класс «importer не отличает root resources от nested types».

### G-K-4 — Roles только `owner` (нет Keycloak RBAC) — host-fix ✅

**Severity:** P1 → **закрыт host-декларацией** (ontology.js::KEYCLOAK_ROLES).
**Module:** `@intent-driven/importer-openapi` (нет role-extraction из security-schemes / scopes)
**Stage 2 host-fix:** Декларированы 5 baseline-ролей: `admin` (super-admin), `realmAdmin` (per-realm), `userMgr` (User CRUD), `viewer` (read-only audit), `self` (self-service). База в `ontology.roles`, использование — Stage 3 forRoles.
**SDK PR / Deferred:** importer-openapi `extractRolesFromSecuritySchemes` — анализ `security` блоков OpenAPI с `bearer + scopes` для авто-извлечения. Низкий приоритет — security-schemes Keycloak не sufficiently structured для авто-вывода.
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

### G-K-8 — POST-collection как α=replace без creates (Stage 3 discovery) — host-fix ⚠️

**Severity:** P0 → **частично закрыт host-fix'ом** (intents.js::reclassifyCollectionPosts).
**Module:** `@intent-driven/importer-openapi`
**Observation:** Importer создаёт intent для `POST /realms/{realm}/users` как `usersUser` с α=`replace` и БЕЗ `creates: "User"`. Поскольку `analyzeIntents` в core ищет creators через `intent.creates` (НЕ через α), правило R1 (catalog) не срабатывает — User/Group/Role/IdP/ClientScope/Component/Organization/Workflow получают только detail, без catalog.

Только `Realm` и `Client` получили catalog в Stage 1-2 потому что у них POST top-level (`POST /admin/realms` → `createRealm` с правильным α=insert + creates=Realm).

**Stage 3 host-fix:** explicit mapping 17 canonical `xsX → createX` с подменой `alpha: "insert"` + `creates: target`. Результат: 8 → 20 derived catalog'ов.
**SDK PR (X1):** importer-openapi `detectCollectionPostAsCreate` — heuristic для POST на nested collection paths (path заканчивается на segment без `{id}` после).

### G-K-9 — crystallize теряет mainEntity в detail-артефактах (Stage 3 discovery) — SDK BUG ⛔

**Severity:** P0 (блокирует R8 hub-absorption)
**Module:** `@intent-driven/core` crystallizeV2
**Observation:** `derived[user_detail].mainEntity = "User"` (правильно). После `crystallizeV2(...)` — `arts[user_detail].mainEntity = undefined`. Все 34 detail-артефакта теряют mainEntity. Это блокирует `absorbHubChildren` (R8): `detailByEntity[mainEntity]` index пуст → нет автоматической hub-absorption даже с настроенными FK.

Сейчас: 6 child catalog'ов (User/Group/Role/Client/ClientScope/Component) имеют `realmId references Realm`, FK detected правильно (`detectForeignKeys` работает), но R8 не активируется — Realm.realm_detail не получает hubSections автоматически.

**Verification:**
```bash
node -e "import('./src/domains/keycloak/domain.js').then(async m => {
  const { deriveProjections, crystallizeV2 } = await import('@intent-driven/core');
  const d = deriveProjections(m.INTENTS, m.ONTOLOGY);
  const a = crystallizeV2(m.INTENTS, d, m.ONTOLOGY, 'keycloak');
  console.log('derived:', d.user_detail?.mainEntity, '/ artifact:', a.user_detail?.mainEntity);
})"
```

**Target-stage:** SDK BUG — должен быть приоритетный fix в `@intent-driven/core` crystallizeV2 (вероятно где-то в pipeline phase 3a-d mainEntity дропается). Без этого R8 hub-absorption неоперабельна для всего dogfood'а.
**Workaround:** authored hubSections в host projections.js (manual override).

### G-K-7 — fieldRole не выводится importer'ом (новый, Stage 2 discovery) — host-fix ⚠️

**Severity:** P1 → **частично закрыт host-fix'ом** (ontology.js::applyFieldRoleHints).
**Module:** `@intent-driven/importer-openapi`
**Observation:** Без fieldRole UI рендерит `Client.secret` как plain-text, `Realm.notBefore` как ISO-string, `User.email` без mailto-link. Pattern-bank примитивы (secret-mask, date-relative, email-link) требуют hint.
**Stage 2 host-fix:** `applyFieldRoleHints` через name-pattern heuristic: `^password|^secret|^token|*Password|registrationAccessToken` → `secret`; `*Date|*Timestamp|^expir|notBefore|updated_at|sentDate|createdTimestamp` → `datetime`; `^email$` → `email`; `*Url|redirectUris|webOrigins` → `url`. Conservative guard: `refreshTokenMaxReuse` (число секунд) — НЕ secret. Применено к 53 fields.
**SDK PR:** importer-openapi `inferFieldRoles` (см. SDK backlog §9.x) — централизованная heuristic, чтобы все доменные импорты получали hints одинаково. Закрытие host-fix'а после merge.

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
- [x] Baseline smoke-тест (9 assertions) green
- [x] Static gap-анализ зафиксирован (7 gap'ов: G-K-1..G-K-7)
- [ ] HTTP smoke на dev server — отложено (требует портов 3001+5173 в background)
- [ ] Browser visual baseline — отложено (требует пользовательского взгляда)

## Stage 2 acceptance-критерии (закрыт 2026-04-23)

- [x] Param-aliasing (intents.js): {realm}→realmId, {client}→clientId, +9 алиасов
- [x] Dedup (ontology.js): 25 base/Representation мерджей
- [x] FieldRole hints: 53 поля (secret/datetime/email/url)
- [x] Embedded marking: 75 orphans → kind:embedded
- [x] 5 base roles задекларированы (admin/realmAdmin/userMgr/viewer/self)
- [x] Все тесты green (9/9), counts перепроверены: 199 entities / 49 artifacts / 8 catalogs

## Stage 3 acceptance-критерии (закрыт 2026-04-23)

- [x] Reclassify (intents.js): 17 collection-POST → createX с α=insert + creates=target
- [x] ROOT_PROJECTIONS whitelist (projections.js): 12 canonical → 10 active root catalog'ов в nav
- [x] Discovery: G-K-8 (importer α=replace BUG), G-K-9 (crystallize mainEntity drop SDK BUG)
- [x] Тесты 11/11 green; catalog'ов 8 → 20 (12 новых canonical), nav 8 → 10 чистых
- [ ] Authored projections для 4 MVP — отложено до Stage 4 (визуальная валидация требует seed)
- [ ] Hub-absorption (Realm.detail с children sections) — заблокирован G-K-9, нужен SDK fix

## Открытые SDK PR'ы (X1: удаление host-fix'ов после merge)

- importer-openapi `mergeRepresentationDuplicates` (закроет G-K-1)
- importer-openapi `detectActionEndpoints` (закроет G-K-2 и P-K-E)
- importer-openapi `inferFieldRoles` (закроет G-K-7)
- importer-openapi `markEmbeddedTypes` (закроет G-K-3)
- importer-openapi `detectCollectionPostAsCreate` (закроет G-K-8)
- core `crystallizeV2.preserveMainEntity` (закроет G-K-9, BUG, наивысший приоритет)
