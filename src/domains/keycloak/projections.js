// src/domains/keycloak/projections.js
import { deriveProjections } from "@intent-driven/core";
import { ONTOLOGY } from "./ontology.js";
import { INTENTS } from "./intents.js";

/**
 * Stage 3 host-fix для G-K-2 + G-K-5: explicit canonical whitelist для
 * ROOT_PROJECTIONS. Operation-as-entity (Activate/Deactivate/MoveAfter/
 * Localization/Copy/Import/Export/...) после Stage 2 dedup всё ещё
 * деривируются как catalog'и — операции на parent выглядят как
 * collections в OpenAPI path-graph'е. Whitelist даёт чистый nav-bar
 * 12 canonical модулей вместо 20 mixed catalog'ов.
 *
 * X1: после SDK PR `importer-openapi.detectActionEndpoints` (G-K-2)
 * — operation-noise исчезнет автоматически.
 */

const CANONICAL_ENTITIES = [
  "Realm", "Client", "User", "Group", "Role", "IdentityProvider",
  "ClientScope", "Component", "Organization", "Workflow",
  "AuthenticationFlow", "Event",
];

/**
 * Stage 5 — Wizard catalog_create (G23 closed core@0.58+): authored
 * form-projection с `bodyOverride: { type: "wizard", steps }` разделяет
 * один createX intent на семантические step'ы. Подходит для enterprise-
 * config entity с десятками полей (Realm.fields = 155, Client.fields = 48).
 *
 * Renderer: form-archetype читает bodyOverride и отдаёт Wizard primitive
 * вместо flat formBody. Автор управляет группировкой вручную — это
 * декларативная UX-декомпозиция, не автоматическая.
 */
// G-K-16 host-fix: AdminShell даёт persistent sidebar tree —
// hierarchy-tree-nav в body дублирует. Disable через patterns.disabled.
const SUPPRESS_TREE_IN_BODY = { disabled: ["hierarchy-tree-nav"] };

// G-K-22 host-fix: catalog-default-datagrid pattern не apply'ится если
// body.item.intents непустой (base assignToSlotsCatalog добавляет inline
// CRUD intents — это base behavior, не pattern). bodyOverride с явным
// type:"dataGrid" — обходим. Helper генерит columns из witnesses
// (sortable+filterable дефолты).
function dgColumns(witnesses, fieldDefs = {}) {
  return witnesses.map(key => ({
    key,
    label: fieldDefs[key]?.label || key,
    sortable: true,
    filterable: true,
  }));
}
function dataGridBody(mainEntity, witnesses, actionIntents = [], filter = null) {
  const cols = [...dgColumns(witnesses)];
  if (actionIntents.length > 0) {
    cols.push({
      key: "_actions",
      kind: "actions",
      label: "",
      display: "auto", // ≤2 inline, ≥3 menu (Gravitino #218/#222)
      // SDK ActionCell schema: { intent (NOT intentId), label, params, danger }.
      // params использует resolveActionParams: "item.X" → row[X].
      actions: actionIntents.map(intent => ({
        intent,
        label: intent.startsWith("update") ? "Изменить"
             : intent.startsWith("remove") ? "Удалить"
             : intent.startsWith("read")   ? "Открыть"
             : intent,
        params: { id: "item.id" },
        danger: intent.startsWith("remove"),
      })),
    });
  }
  return {
    type: "dataGrid",
    source: mainEntity,  // world[mainEntity] — entities группируются по target=PascalCase
    columns: cols,
    // G-K-25 (idf-sdk#267): DataGrid::resolveItems применяет node.filter
    ...(filter ? { filter } : {}),
  };
}

// Scoping filter: scope по worldWithRoute.realmId (для child-каталогов
// под realm-instance в AdminShell tree).
const SCOPED_BY_REALM = "!world.realmId || realmId === world.realmId";

// Hero-create CTA spec: bodyOverride блокирует hero-create.apply
// (pattern boundary), поэтому author hero вручную для каждого catalog'а.
// containers.jsx::IntentButton с opens:"overlay" + overlayKey =
// `overlay_${intentId}` — overlay уже автогенерится crystallize_v2.
function heroCreate(intentId, label) {
  return [{
    type: "intentButton",
    intentId,
    label,
    opens: "overlay",
    overlayKey: `overlay_${intentId}`,
    icon: "⚡",
    variant: "primary",
  }];
}

export const PROJECTIONS = {
  // Stage 5b override: после G-K-10 fix derive назначает kind:"feed" для
  // Realm/Client (R2 feed override активируется через synthetic FK +
  // confirmation:"enter"). Feed-архетип активирует composer-entry pattern
  // («Сообщение...» внизу) — для admin-UI неуместно. Принудительно
  // catalog для top-level entities.
  realm_list: {
    name: "Realms",
    kind: "catalog",
    mainEntity: "Realm",
    entities: ["Realm"],
    witnesses: ["realm", "displayName", "enabled", "sslRequired"],
    bodyOverride: dataGridBody("Realm", ["realm", "displayName", "enabled", "sslRequired"], ["updateRealm", "removeRealm"]),
    hero: heroCreate("createRealm", "Создать realm"),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  client_list: {
    name: "Clients",
    kind: "catalog",
    mainEntity: "Client",
    entities: ["Client"],
    witnesses: ["clientId", "name", "enabled", "publicClient", "protocol"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("Client", ["clientId", "name", "enabled", "publicClient", "protocol"], ["updateClient", "removeClient"], SCOPED_BY_REALM),
    hero: heroCreate("createClient", "Создать client"),
    patterns: SUPPRESS_TREE_IN_BODY,
  },

  // ═══ G-K-17 host workaround: scoped child-каталоги ═══════════════════
  // Под persistentSidebar AdminShell (G-K-14) клик «Users под master» vs
  // «Users под customer-app» должен дать РАЗНЫЕ списки, но без filter
  // показывает все 10 users в обоих случаях. Authored filter по
  // routeParams.realmId через worldWithRoute (= {...world, ...current.params}).
  // X1: после SDK derive auto-filter по FK match (G-K-17 SDK PR) удалить.
  user_list: {
    name: "Пользователи",
    kind: "catalog",
    mainEntity: "User",
    entities: ["User"],
    witnesses: ["username", "email", "firstName", "lastName", "enabled", "emailVerified"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("User", ["username", "email", "firstName", "lastName", "enabled", "emailVerified"], ["updateUser", "removeUser"], SCOPED_BY_REALM),
    hero: heroCreate("createUser", "Создать user"),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  group_list: {
    name: "Группы",
    kind: "catalog",
    mainEntity: "Group",
    entities: ["Group"],
    witnesses: ["name", "path", "subGroupCount"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("Group", ["name", "path", "subGroupCount"], ["updateGroup", "removeGroup"], SCOPED_BY_REALM),
    hero: heroCreate("createGroup", "Создать group"),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  role_list: {
    name: "Роли",
    kind: "catalog",
    mainEntity: "Role",
    entities: ["Role"],
    witnesses: ["name", "description", "composite", "clientRole"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("Role", ["name", "description", "composite", "clientRole"], ["updateRole", "removeRole"], SCOPED_BY_REALM),
    hero: heroCreate("createRole", "Создать role"),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  identityprovider_list: {
    name: "Identity Providers",
    kind: "catalog",
    mainEntity: "IdentityProvider",
    entities: ["IdentityProvider"],
    witnesses: ["alias", "displayName", "providerId", "enabled", "trustEmail"],
    filter: "!world.realmId || realmId === world.realmId",
    // IdentityProvider: только remove (нет updateIdentityProvider в imported)
    bodyOverride: dataGridBody("IdentityProvider", ["alias", "displayName", "providerId", "enabled", "trustEmail"], ["removeIdentityProvider"], SCOPED_BY_REALM),
    hero: heroCreate("createIdentityProvider", "Создать IdP"),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  clientscope_list: {
    name: "Client Scopes",
    kind: "catalog",
    mainEntity: "ClientScope",
    entities: ["ClientScope"],
    witnesses: ["name", "protocol", "description"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("ClientScope", ["name", "protocol", "description"], ["updateClientScope", "removeClientScope"], SCOPED_BY_REALM),
    hero: heroCreate("createClientScope", "Создать ClientScope"),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  component_list: {
    name: "Components",
    kind: "catalog",
    mainEntity: "Component",
    entities: ["Component"],
    witnesses: ["name", "providerType", "providerId"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("Component", ["name", "providerType", "providerId"], ["updateComponent", "removeComponent"], SCOPED_BY_REALM),
    hero: heroCreate("createComponent", "Создать Component"),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  organization_list: {
    name: "Organizations",
    kind: "catalog",
    mainEntity: "Organization",
    entities: ["Organization"],
    witnesses: ["alias", "name", "description", "enabled"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("Organization", ["alias", "name", "description", "enabled"], ["updateOrganization", "removeOrganization"], SCOPED_BY_REALM),
    hero: heroCreate("createOrganization", "Создать Organization"),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  workflow_list: {
    name: "Workflows",
    kind: "catalog",
    mainEntity: "Workflow",
    entities: ["Workflow"],
    witnesses: ["name", "description", "enabled"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("Workflow", ["name", "description", "enabled"], ["updateWorkflow", "removeWorkflow"], SCOPED_BY_REALM),
    hero: heroCreate("createWorkflow", "Создать Workflow"),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  realm_create: {
    name: "Создать realm",
    kind: "form",
    mode: "create",
    mainEntity: "Realm",
    creatorIntent: "createRealm",
    bodyOverride: {
      type: "wizard",
      steps: [
        {
          id: "basic",
          title: "Основное",
          fields: [
            { name: "realm", label: "ID realm'а", type: "string", required: true, placeholder: "my-realm" },
            { name: "displayName", label: "Отображаемое имя", type: "string", placeholder: "My Realm" },
            { name: "displayNameHtml", label: "HTML-версия имени", type: "textarea" },
            { name: "enabled", label: "Включён", type: "boolean" },
          ],
        },
        {
          id: "login",
          title: "Вход и регистрация",
          fields: [
            { name: "registrationAllowed", label: "Разрешена регистрация", type: "boolean" },
            { name: "resetPasswordAllowed", label: "Разрешён сброс пароля", type: "boolean" },
            { name: "rememberMe", label: "«Запомнить меня»", type: "boolean" },
            { name: "verifyEmail", label: "Верификация email", type: "boolean" },
            { name: "loginTheme", label: "Login theme", type: "string", placeholder: "keycloak" },
            { name: "accountTheme", label: "Account theme", type: "string", placeholder: "keycloak" },
          ],
        },
        {
          id: "security",
          title: "Токены и безопасность",
          fields: [
            { name: "sslRequired", label: "SSL requirement", type: "select", options: ["all", "external", "none"] },
            { name: "defaultSignatureAlgorithm", label: "Signature algorithm", type: "string", placeholder: "RS256" },
            { name: "accessTokenLifespan", label: "Access token lifespan (sec)", type: "number" },
          ],
        },
      ],
      onSubmit: { intent: "createRealm" },
    },
  },
  client_create: {
    name: "Создать client",
    kind: "form",
    mode: "create",
    mainEntity: "Client",
    creatorIntent: "createClient",
    bodyOverride: {
      type: "wizard",
      steps: [
        {
          id: "basic",
          title: "Основное",
          fields: [
            { name: "clientId", label: "Client ID", type: "string", required: true, placeholder: "my-app" },
            { name: "name", label: "Name", type: "string" },
            { name: "description", label: "Description", type: "textarea" },
            { name: "enabled", label: "Включён", type: "boolean" },
          ],
        },
        {
          id: "flow",
          title: "Client type",
          fields: [
            { name: "protocol", label: "Protocol", type: "select", options: ["openid-connect", "saml"] },
            { name: "publicClient", label: "Public client", type: "boolean" },
            { name: "standardFlowEnabled", label: "Standard flow", type: "boolean" },
            { name: "directAccessGrantsEnabled", label: "Direct access grants", type: "boolean" },
            { name: "serviceAccountsEnabled", label: "Service accounts", type: "boolean" },
          ],
        },
        {
          id: "urls",
          title: "URL'ы",
          fields: [
            { name: "rootUrl", label: "Root URL", type: "string", fieldRole: "url" },
            { name: "baseUrl", label: "Base URL", type: "string", fieldRole: "url" },
            { name: "redirectUris", label: "Redirect URIs (через запятую)", type: "textarea" },
            { name: "webOrigins", label: "Web origins (через запятую)", type: "textarea" },
          ],
        },
      ],
      onSubmit: { intent: "createClient" },
    },
  },
  /**
   * Stage 6 (P-K-A, idf-sdk#263): tabbed-form для Client.detail. Client
   * имеет 48 полей — flat formBody не масштабируется. Декомпозиция по
   * semantic tabs: Settings / Credentials / Auth flow / URLs / Advanced.
   * Каждый tab — свой Save, shared intent updateClient.
   */
  client_detail: {
    name: "Client",
    kind: "form",
    mainEntity: "Client",
    idParam: "clientId",
    bodyOverride: {
      type: "tabbedForm",
      initialTab: "settings",
      tabs: [
        {
          id: "settings",
          title: "Настройки",
          fields: [
            { name: "clientId", label: "Client ID", type: "string", required: true },
            { name: "name", label: "Name", type: "string" },
            { name: "description", label: "Description", type: "textarea" },
            { name: "enabled", label: "Включён", type: "boolean" },
            { name: "alwaysDisplayInConsole", label: "Always display in console", type: "boolean" },
            { name: "consentRequired", label: "Consent required", type: "boolean" },
          ],
          onSubmit: { intent: "updateClient" },
        },
        {
          id: "credentials",
          title: "Credentials",
          fields: [
            { name: "clientAuthenticatorType", label: "Authenticator", type: "select",
              options: ["client-secret", "client-jwt", "client-x509"] },
            { name: "secret", label: "Secret", type: "string" },
            { name: "registrationAccessToken", label: "Registration access token", type: "string" },
            { name: "bearerOnly", label: "Bearer only", type: "boolean" },
          ],
          onSubmit: { intent: "updateClient" },
        },
        {
          id: "flow",
          title: "Client type",
          fields: [
            { name: "protocol", label: "Protocol", type: "select",
              options: ["openid-connect", "saml"] },
            { name: "publicClient", label: "Public client", type: "boolean" },
            { name: "standardFlowEnabled", label: "Standard flow", type: "boolean" },
            { name: "implicitFlowEnabled", label: "Implicit flow", type: "boolean" },
            { name: "directAccessGrantsEnabled", label: "Direct access grants", type: "boolean" },
            { name: "serviceAccountsEnabled", label: "Service accounts", type: "boolean" },
            { name: "authorizationServicesEnabled", label: "Authorization services", type: "boolean" },
          ],
          onSubmit: { intent: "updateClient" },
        },
        {
          id: "urls",
          title: "URL'ы",
          fields: [
            { name: "rootUrl", label: "Root URL", type: "string" },
            { name: "baseUrl", label: "Base URL", type: "string" },
            { name: "adminUrl", label: "Admin URL", type: "string" },
            { name: "redirectUris", label: "Redirect URIs", type: "textarea" },
            { name: "webOrigins", label: "Web origins", type: "textarea" },
          ],
          onSubmit: { intent: "updateClient" },
        },
        {
          id: "advanced",
          title: "Advanced",
          fields: [
            { name: "notBefore", label: "Not before (unix ts)", type: "number" },
            { name: "surrogateAuthRequired", label: "Surrogate auth required", type: "boolean" },
            { name: "frontchannelLogout", label: "Front-channel logout", type: "boolean" },
            { name: "fullScopeAllowed", label: "Full scope allowed", type: "boolean" },
          ],
          onSubmit: { intent: "updateClient" },
        },
      ],
    },
  },
  /**
   * Stage 7 (P-K-B): connection-test mid-wizard. IdP create имеет OAuth
   * endpoints (authorizationUrl / tokenUrl / userInfoUrl) которые должны
   * быть validated до submit — отдельный wizard-step с testConnection
   * (Wizard primitive уже поддерживает `step.testConnection` через
   * ctx.testConnection(intent, values) async handler).
   *
   * Flow: Type → Endpoints → Test Connection → Advanced → Submit.
   * Test step вызывает ctx.testConnection("testIdentityProviderConnection",
   * values) — host-runtime handler делает probe к OIDC discovery или
   * SAML metadata URL, возвращает { ok, message? }.
   */
  /**
   * Stage 9 (P-K-D, idf-sdk#269): user_detail с role-mappings sub-section.
   * Показывает 4 источника ролей (direct / composite / group / client-default)
   * через RoleMapping assignment-entity с FK userId. В MVP рендерится как
   * обычная SubCollectionSection — item.roleName + item.inheritedFrom
   * badge через auto-generated itemView. Full PermissionMatrix UI с
   * inheritance-badges (idf-sdk#269) — ждёт section.kind-dispatcher в
   * ArchetypeDetail (follow-up SDK PR).
   */
  user_detail: {
    name: "Пользователь",
    kind: "detail",
    mainEntity: "User",
    idParam: "userId",
    subCollections: [
      {
        entity: "RoleMapping",
        foreignKey: "userId",
        title: "Роли пользователя",
        itemView: [
          { bind: "type", type: "badge" },
          { bind: "roleName", type: "text" },
          { bind: "inheritedFrom", type: "text" },
        ],
      },
      // Stage 8 (P-K-C, idf-sdk#272): Credentials sub-section. CredentialEditor
      // primitive готов в renderer — discriminator-driven viewer с 4 типами
      // (password/otp/webauthn/x509). Host MVP через default SubCollectionSection
      // (section.kind dispatcher для primitive-embed — отдельный SDK PR).
      {
        entity: "Credential",
        foreignKey: "userId",
        title: "Credentials",
        itemView: [
          { bind: "type", type: "badge" },
          { bind: "userLabel", type: "text" },
          { bind: "createdDate", type: "text" },
        ],
      },
    ],
  },
  identityprovider_create: {
    name: "Создать identity provider",
    kind: "form",
    mode: "create",
    mainEntity: "IdentityProvider",
    creatorIntent: "createIdentityProvider",
    bodyOverride: {
      type: "wizard",
      steps: [
        {
          id: "type",
          title: "Type",
          fields: [
            { name: "providerId", label: "Provider", type: "select", required: true,
              options: ["oidc", "saml", "google", "github", "microsoft", "facebook", "gitlab"] },
            { name: "alias", label: "Alias", type: "string", required: true, placeholder: "google" },
            { name: "displayName", label: "Display name", type: "string" },
          ],
        },
        {
          id: "endpoints",
          title: "Endpoints",
          fields: [
            { name: "authorizationUrl", label: "Authorization URL", type: "string",
              placeholder: "https://provider.example.com/oauth/authorize" },
            { name: "tokenUrl", label: "Token URL", type: "string",
              placeholder: "https://provider.example.com/oauth/token" },
            { name: "userInfoUrl", label: "User info URL", type: "string",
              placeholder: "https://provider.example.com/oauth/userinfo" },
            { name: "clientId", label: "Client ID", type: "string", required: true },
            { name: "clientSecret", label: "Client secret", type: "string", fieldRole: "secret" },
          ],
          // P-K-B: Test connection перед advanced-step'ом. Wizard primitive
          // рендерит button с async-validation, блокирует Next до OK.
          testConnection: {
            intent: "testIdentityProviderConnection",
            label: "Проверить подключение",
          },
        },
        {
          id: "advanced",
          title: "Advanced",
          fields: [
            { name: "enabled", label: "Включён", type: "boolean" },
            { name: "trustEmail", label: "Trust email", type: "boolean" },
            { name: "storeToken", label: "Store token", type: "boolean" },
            { name: "linkOnly", label: "Link only", type: "boolean" },
          ],
        },
      ],
      onSubmit: { intent: "createIdentityProvider" },
    },
  },
};

const _derived = deriveProjections(INTENTS, ONTOLOGY);

// Whitelist: canonical catalog/feed'ы + dashboard'ы. После core@0.58.1
// (explicit FK-marker в detectForeignKeys) R2 rule назначает `realm_list`
// и `client_list` kind:"feed" (т.к. intents имеют confirmation:"enter" +
// foreignKey), а не "catalog". Whitelist принимает обе формы.
// Catalog/feed с mainEntity вне CANONICAL_ENTITIES — отбрасываем как noise.
export const ROOT_PROJECTIONS = Object.entries(_derived)
  .filter(([, p]) => {
    if (p?.kind === "dashboard") return true;
    if (p?.kind !== "catalog" && p?.kind !== "feed") return false;
    return CANONICAL_ENTITIES.includes(p.mainEntity);
  })
  .map(([id]) => id);
