# Keycloak gap-каталог (Stage 1-5 closed)

**Дата:** 2026-04-23
**Worktree:** `.worktrees/keycloak-dogfood/` (host), branch `feat/keycloak-dogfood` (NOT merged, накапливает Stage'и)
**Источник:** Keycloak Admin REST OpenAPI 1.0 (https://www.keycloak.org/docs-api/latest/rest-api/openapi.yaml, ~370KB / 14400 строк / 265 paths / 22 tags)
**Importer:** `@intent-driven/importer-openapi@0.6.0` (с flattenSchema из Gravitino #227)
**SDK after bump:** core@0.58.0 / renderer@0.38.1 / adapter-antd@1.8.0 / importer-openapi@0.6.0

**Stage 1 baseline:** 224 entities / 254 intents / 1 role (`owner`) → derive: 48 projections (7 catalog).
**Stage 2 host-enrichment:** **199 entities** (-25 dedup) / 254 intents (253 с alias) / 5 roles (admin/realmAdmin/userMgr/viewer/self) → 49 artifacts (8 catalog + 7 form + 34 detail), 53 fields с `fieldRole`, 75 embedded.
**Stage 3 reclassify + whitelist:** 20 catalog'ов derived (`reclassifyCollectionPosts` 17 POST → createX), **10 чистых ROOT_PROJECTIONS** (canonical-12 minus AuthFlow/Event с low coverage). Operation-noise отфильтрована.
**Stage 4 seed:** 34 effects (3 Realm + 5 Client + 10 User + 3 Group + 6 Role + 4 IdP + 3 ClientScope), FK realmId корректный.
**Stage 5 wizards (G23 unblocked by idf-sdk#240):** 3 authored form-projections с `bodyOverride: { type: "wizard", steps }` — `realm_create` (3 steps × 13 fields), `client_create` (3 × 13), `identityprovider_create` (2 × 7). Декларативная UX-декомпозиция Wizard primitive.

**Методология:** static-analysis через `crystallizeV2` + `deriveProjections` в node-репле; baseline smoke-тест **16/16 passed** (`src/domains/keycloak/__tests__/baseline.test.js`).

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

### G-K-14 — admin-shell layout: persistent sidebar tree (Stage 5b smoke) — SDK архитектурный gap ⛔

**Severity:** P0 для Keycloak-style UX (не блокирует другие домены)
**Module:** `@intent-driven/renderer` V2Shell layout (нет mode'а для admin-UI)
**Observation:** Сейчас `hierarchy-tree-nav` pattern apply'ится **внутри body** одной из catalog projections (например `realm_list`). На других top-tabs (Event / IdentityProvider / Мои Event) дерева нет. Также — клик по узлу tree не переключает правую панель целиком (не отдельный layout-region), а является частью того же catalog'а.

**Что хочет user (Keycloak Admin Console reference):**
```
| persistent sidebar (tree)    | body (current selected projection) |
| - Realms                     |                                    |
|   - master                   |                                    |
|     - Users                  |     [content of selected node]     |
|     - Groups                 |                                    |
|     - Clients                |                                    |
|     - ...                    |                                    |
|   - customer-app             |                                    |
| - Events                     |                                    |
| - Settings                   |                                    |
```

**Target-stage:** SDK PR — V2Shell новый prop `layoutMode: "topTabs" | "persistentSidebar"` (или domain-level `domain.shell = { layout: "persistentSidebar", treeSource: "realm_detail.hubSections" }`). Required для admin-style UX (Keycloak / Gravitino / Grafana / Argo / любой enterprise control-plane).

**Workaround (host):** свести ROOT_PROJECTIONS до 1 («Realms»), всю иерархию открывать кликом на realm — но это уход от admin-style nav, юзер вернётся к click-through вместо persistent tree.

### G-K-15 — hierarchy-tree-nav включает embedded entities (Stage 5b smoke)

**Severity:** P1 (визуальный мусор в дереве)
**Module:** `@intent-driven/core` patterns/cross/hierarchy-tree-nav
**Observation:** В дереве «ИЕРАРХИЯ» видны embedded entities без intents: `AuthDetailsRepresentation`, `ClientDescriptionConverter`, `ClientSessionStat`, `ClientType`, `ClientsInitialAccess`, `Composite`, `PushRevocation`, `Available`. Они помечены `kind:"embedded"` через G-K-3 host-fix, но pattern apply все равно их вытаскивает (вероятно ищет children по FK references=Realm в `ontology.entities`, не по absorbed catalogs или non-embedded entities).

**Target-stage:** SDK PR — hierarchy-tree-nav.apply должен skip'ать `entity.kind === "embedded"` или проверять `catalogByEntity[childEntity]` (т.е. показывать только entities с derived catalog).

### G-K-16 — hierarchy-tree-nav в body дублирует AdminShell sidebar (Stage 5b smoke) — pattern-tuning ⚠️

**Severity:** P1 (visual mess в admin-mode)
**Module:** `@intent-driven/core` patterns/cross/hierarchy-tree-nav
**Observation:** AdminShell (G-K-14) даёт persistent sidebar tree слева. Однако внутри body одного из catalog'ов (например `user_list`) `hierarchy-tree-nav` apply'ится дополнительно — entity-types schema внутри body. Получается дубликат tree-nav (один в sidebar, один в body).
**Target-stage:** SDK PR — pattern apply должен skip'ать `hierarchy-tree-nav` если в context есть signal "host провайдит external nav" (например, через `applyContext.hasExternalShell` flag, выставленный V2Shell в AdminShell mode). Альтернатива: feature-flag в `ontology.features.suppressHierarchyTreeInBody = true`.

### G-K-17 — params-driven filtering не работает между realm-instance'ами (Stage 5b smoke)

**Severity:** P1 (data identical поверх different realms — UX mistruth)
**Module:** `@intent-driven/core` deriveProjections + filter pipeline
**Observation:** AdminShell tree содержит инстанс-узлы `Пользователи под master` и `Пользователи под customer-app`. Клик в обоих местах даёт **одинаковый список 10 users** (полный набор), хотя ожидается scoped по `realmId`. routeParams `{realmId: "r_master"}` передаются, но user_list filter их игнорирует — derived projection не auto-filter'ит по FK match.
**Target-stage:** SDK PR — derive auto-filter: если `child.foreignKey` матчится с `routeParams[idParam]` parent'а, добавить implicit filter `where: child[fk] === routeParams[idParam]`. Альтернатива: host authored projection с явным `filter`.
**Workaround (host):** authored `user_list` с `filter: (item, ctx) => item.realmId === ctx.routeParams?.realmId`. Не делал в Stage 5b — отложено в Stage 6.

### G-K-18 — sidebar labels одинаковые между realm-instance'ами

**Severity:** P2 (cosmetic — UX confusion в big workspace)
**Module:** host V2Shell adminTree builder
**Observation:** Под master и customer-app в sidebar — `Composite / Role / Clients / Group / Organization / Пользователи / ...` (одинаковые labels). При big workspace user может потеряться, какой realm активен.
**Workaround (host):** prepend parent label в child label — `master / Пользователи` вместо просто `Пользователи`. Минимальный fix в `adminTree useMemo` builder в V2Shell.jsx. Альтернатива: оставить labels чистыми, но добавить sticky breadcrumb в sidebar header.

### G-K-19 — Seed idempotency: getSeedEffects() даёт новые uuid каждый refresh — host-fix ✅

**Severity:** P0 (БД накапливает дубликаты — 24 Realm при ожидаемых 3, 80 User при 10)
**Module:** host (keycloak/seed.js + standalone.jsx existence check)
**Observation:** `seed.js::getSeedEffects()` использовал `id: uuid()` — каждый refresh страницы создавал новые ids → existence check `existingIds.has(e.id)` всегда false → seed POST'ился заново. После 8 refresh'ей: 24 Realm, 80 User.
**Stage 5b host-fix:** stable IDs `seed_keycloak_${target}_${context.id}` — детерминированы от content. Existence check срабатывает, повторный POST не вставит дубликаты.
**Cleanup:** для удаления старых дубликатов — `DELETE FROM effects WHERE intent_id='_seed' AND target IN ('Realm','Client','User','Group','Role','IdentityProvider','ClientScope') AND id NOT LIKE 'seed_keycloak_%'`. Сделать manually либо через server SQL endpoint (DELETE /api/effects заблокирован — wipes all domains).

### G-K-20 — Update form показывает только path-params (Stage 5b discovery)

**Severity:** P1 (update-flow сломан UX-wise)
**Module:** `@intent-driven/core` form-archetype + edit-projection generation
**Observation:** Клик на «Сохранить» row-action в group_list → modal `updateGroup` показывает 3 поля: `Realm` / `Group Id` / `Realm Id` (все path-params, не editable). Нет реальных editable полей Group entity (`name`, `path`, `description`, `attributes`). Group.fields имеет 11 полей — должны быть в form.

Edit-projection генерируется из `intent.parameters`, не из `entity.fields`. Это правильно для CREATE (где parameters могут быть subset), но для UPDATE — должны read entity.fields с pre-fill values из current world[mainEntity][id].

**Target-stage:** SDK PR — для intent с α="replace" form-archetype читает entity.fields (excluding identifier-fields like idParam) + pre-fills values. parameters остаются для path-binding (URL), не как editable form fields.
**Workaround (host):** authored update_group projection с явным `fields` list. Не делал в Stage 5b — отложено.

### G-K-21 — Breadcrumb non-consecutive duplicates (Stage 5b deep-nav smoke) — host aggressive dedup ⚠️

**Severity:** P1 (UX-мусор в deep nav)
**Module:** SDK Breadcrumbs primitive + host useProjectionRoute
**Observation:** G-K-13 (consecutive dedup) решил `Realms / Realms / Realms`, но не покрыл deep-nav: `Группы / Organizations / Группы / Group` (non-consecutive duplicates от tree navigation back-forward).
**Stage 5b host-fix:** aggressive dedup через `seenIndex.set(key, i)` — оставляем только ПОСЛЕДНЕЕ occurrence каждого `(projectionId+params)`. Back-семантика страдает, но в AdminShell back редок (sidebar-driven nav).
**SDK PR:** dedup как опция в Breadcrumbs primitive (`mode: "consecutive"|"latest"|"none"`) или в useProjectionRoute auto-flatten.

### G-K-9 — crystallize теряет mainEntity в detail-артефактах — ✅ ЗАКРЫТ (idf-sdk#239)

**Severity:** P0 → **closed 2026-04-23 в core@0.58.0** (PR idf-sdk#239 «fix(core): preserve mainEntity + entities в artifact из crystallizeV2»).
**Root cause:** `artifact = { ... }` builder в `src/crystallize_v2/index.js` line 279 пропускал `mainEntity` и `entities` из projection. Один-line oversight — все остальные поля (`projection/name/domain/layer/archetype/pattern/.../witnesses`) собирались, кроме этих двух.
**Fix:** добавлены `mainEntity: proj.mainEntity || null` и `entities: proj.entities || (proj.mainEntity ? [proj.mainEntity] : [])`. 5 новых assertions в `preserveMainEntity.test.js`, full core suite 1253/1253 green.
**Verification:** `arts.user_detail.mainEntity === "User"` (раньше `undefined`) — manual probe подтверждает после bump core@0.58.0.

### G-K-10 — detectForeignKeys не учитывает synthetic FK (Stage 5 discovery) — ✅ ЗАКРЫТ (idf-sdk#243)

**Severity:** P0 → closed
**Closed:** idf-sdk#243 merged 2026-04-23, core@0.58.1 published. detectForeignKeys теперь принимает `{ kind: "foreignKey" + references }` shape. R8 начал срабатывать для 22 absorption'ов в Keycloak.

---

### G-K-11 — R8 absorbHubChildren выбирает первого parent'а (multi-parent noise) — ✅ ЗАКРЫТ (idf-sdk#245)

**Severity:** P1 → closed
**Closed:** idf-sdk#245 merged 2026-04-23, core@0.58.2 published. «Hubbier wins» heuristic + redistribution cleanup: parent'ы с <MIN children после конфликта skipped. Keycloak user_list теперь correctly абсорбируется в realm_detail (Realm — 10 candidates, Role — 1 после redistribution).

**Historical (исходный observation):**

**Module:** `@intent-driven/core` crystallize_v2/absorbHubChildren
**Observation:** `absorbHubChildren` iterate'ит detailByEntity в порядке Object.entries и для каждого parent'а берёт matching child'ов без приоритизации. Если child имеет FK на несколько parent'ов (User.roleId + User.realmId), R8 абсорбирует его в первого встреченного parent'а. Для Keycloak User.roleId (synthetic path FK от `/roles/{roleId}/users`) встречается раньше realmId → user_list.absorbedBy = "role_detail" вместо ожидаемого "realm_detail".

В Keycloak всего ~22 catalog'а абсорбированы, но часть к "неправильному" parent'у (user→role, group→user, и др). Renderer показывает их в subsections, но hierarchy семантически кривая.

**Target-stage:** SDK PR — best-parent heuristic. Варианты:
1. «Hubbier wins» — parent с бо́льшим числом children-candidate'ов (Realm имеет ~10, Role ~2)
2. «Not-absorbed-self wins» — parent, который сам не absorbedBy
3. Author-override в ontology: `entity.preferredParent: "Realm"` для мультиparent child'ов

Первый вариант — pure алгоритмический, не требует author input.
**Workaround:** host-side `absorbed: false` на конкретные noise-absorbtions в projections.js.


**Module:** `@intent-driven/core` deriveProjections::detectForeignKeys
**Observation:** `detectForeignKeys` в `src/crystallize_v2/deriveProjections.js` ищет ТОЛЬКО `field.type === "entityRef"`. Но `importer-openapi @0.5+` синтезирует path-derived FK как `{ type: "string", kind: "foreignKey", references: "Realm", synthetic: "openapi-path" }`. Type не `"entityRef"` → SDK FK detection skip'ает.

**Последствие:** absorbHubChildren находит 0 children для Realm, хотя host-side manual walk показывает 10 valid candidates (User/Group/Role/Client/ClientScope/Component/Organization/Workflow/ClientTemplate/Member все с `realmId.references=Realm + kind:foreignKey`).

**Verification:**
```bash
node -e "import('./src/domains/keycloak/domain.js').then(async m => {
  const { deriveProjections, crystallizeV2 } = await import('@intent-driven/core');
  const d = deriveProjections(m.INTENTS, m.ONTOLOGY);
  const a = crystallizeV2(m.INTENTS, d, m.ONTOLOGY, 'keycloak');
  console.log('absorbed:', Object.values(a).filter(x => x.absorbedBy).length);  // 0 (должно быть >=6)
})"
```

**Target-stage:** SDK PR — расширить `detectForeignKeys` heuristic'ом «`fieldDef.kind === "foreignKey"` ИЛИ `fieldDef.references` напрямую» в дополнение к type-check'у. ~10 строк fix.
**Workaround:** host-side преобразование — массово пометить synthetic FK как `type:"entityRef"` в keycloak ontology.js (но это лишает path-derived metadata семантики «string на самом деле»).

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

## План Stage 6+ (актуально на 2026-04-23 после Stage 5 closure)

### Критический путь (блокеры R8 / визуального демо)

- **G-K-10 SDK fix** (importer-derived synthetic FK) — `detectForeignKeys` extension. Без него R8 hub-absorption не работает на всём openapi-imported set'е. ~10 LOC, аналогично #239 — failing test → fix → changeset → PR.
- **dev-server smoke** — после G-K-10 fix запустить `npm run server` + `npm run dev`, открыть keycloak в browser, зафиксировать визуальные gap'ы (form layout, hover-trail, tabbed-section overflow).

### Authored content (после критического пути)

- **Stage 6 — Tab-composed form (P-K-A)** — Client.detail имеет ~10 tabs (Settings / Credentials / Roles / ClientScopes / Authorization / Sessions / OfflineAccess / Installation), каждая с 30+ полями. Расширить `bodyOverride` под nested tabs ИЛИ новый primitive `TabbedFormSections`. Stage 5 wizard'ы покрыли create-flow, Stage 6 — edit/detail-flow.
- **Stage 7 — Connection-test mid-wizard (P-K-B)** — IdP `identityprovider_create` уже имеет 2 step'а; добавить промежуточный `kind: "verification"` step (test SAML metadata fetch / LDAP bind / OIDC discovery) с server route `/api/probe/idp-connection`. Wizard primitive нужно расширить под verification-step'ы.
- **Stage 8 — Credentials primitive (P-K-C)** — User.credentials = разные types (password / OTP / WebAuthn / X.509). Каждый требует своего input UI. Возможно новый renderer-primitive `CredentialEditor` с per-type discriminator-driven render.
- **Stage 9 — Role-mappings matrix (P-K-D)** — User → effective roles (direct realm + direct client + composite + group-inherited). PermissionMatrix primitive (есть) + расширение под inheritance-graph. tree-like renderer.

### SDK PR'ы по-прежнему открытые (X1: удаление host-fix'ов после merge)

- importer-openapi `mergeRepresentationDuplicates` (G-K-1) — сейчас host ontology.js.
- importer-openapi `detectActionEndpoints` (G-K-2 + P-K-E) — operation-as-entity → row-action.
- importer-openapi `inferFieldRoles` (G-K-7) — централизованный fieldRole heuristic.
- importer-openapi `markEmbeddedTypes` (G-K-3) — orphan type без path → `kind:embedded`.
- importer-openapi `detectCollectionPostAsCreate` (G-K-8) — POST collection → α=insert + creates.
- **core `detectForeignKeys.synthetic` (G-K-10) — НОВЫЙ, P0 блокер R8.**

### Закрытые SDK PR'ы

- ✅ `core.preserveMainEntity` (G-K-9) — idf-sdk#239 merged 2026-04-23 → core@0.58.0.
- ✅ `core.formArchetype.bodyOverride` (G23 backport из Gravitino) — idf-sdk#240 merged 2026-04-23 → core@0.58.0. Unblocked Stage 5.

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

## Stage 4 acceptance-критерии (закрыт 2026-04-23)

- [x] `getSeedEffects()` возвращает 34 effects (3 Realm + 5 Client + 10 User + 3 Group + 6 Role + 4 IdentityProvider + 3 ClientScope)
- [x] FK realmId корректный — все child entities ссылаются на Realm.id
- [x] `fold(effects)` даёт expected world counts (3/5/10) — verified в тестах
- [x] Тесты 13/13 green
- [ ] Visual baseline в браузере — отложено (требует пользовательского взгляда + dev-сервер)

## Stage 3 acceptance-критерии (закрыт 2026-04-23)

- [x] Reclassify (intents.js): 17 collection-POST → createX с α=insert + creates=target
- [x] ROOT_PROJECTIONS whitelist (projections.js): 12 canonical → 10 active root catalog'ов в nav
- [x] Discovery: G-K-8 (importer α=replace BUG), G-K-9 (crystallize mainEntity drop SDK BUG)
- [x] Тесты 11/11 green; catalog'ов 8 → 20 (12 новых canonical), nav 8 → 10 чистых
- [ ] Authored projections для 4 MVP — отложено до Stage 4 (визуальная валидация требует seed)
- [ ] Hub-absorption (Realm.detail с children sections) — заблокирован G-K-9, нужен SDK fix

## Stage 5 acceptance-критерии (закрыт 2026-04-23 commit `4c0a9cc`)

- [x] G23 разблокирован (idf-sdk#240 — form-archetype `projection.bodyOverride`)
- [x] 3 authored wizard'а: `realm_create` (3 steps × 13 fields), `client_create` (3 × 13), `identityprovider_create` (2 × 7)
- [x] Bump SDK deps к latest (core@0.58.0 + renderer@0.38.1 + adapter-antd@1.8.0) — commit `7227ddb`
- [x] Тесты 16/16 green
- [ ] Визуальная проверка wizard render — отложена до Stage 6 setup

## Stage 5 discoveries

- **G-K-9 closed** через мой PR idf-sdk#239 (1-line oversight в crystallize artifact builder)
- **G-K-10 opened** — глубже G-K-9. detectForeignKeys не покрывает synthetic FK от importer-openapi. Главный блокер R8 hub-absorption теперь.
