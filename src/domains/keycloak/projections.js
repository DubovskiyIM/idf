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
function dataGridBody(mainEntity, witnesses, extraColumns = []) {
  return {
    type: "dataGrid",
    source: mainEntity,  // world[mainEntity] — entities группируются по target=PascalCase
    columns: [...dgColumns(witnesses), ...extraColumns],
  };
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
    bodyOverride: dataGridBody("Realm", ["realm", "displayName", "enabled", "sslRequired"]),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  client_list: {
    name: "Clients",
    kind: "catalog",
    mainEntity: "Client",
    entities: ["Client"],
    witnesses: ["clientId", "name", "enabled", "publicClient", "protocol"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("Client", ["clientId", "name", "enabled", "publicClient", "protocol"]),
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
    bodyOverride: dataGridBody("User", ["username", "email", "firstName", "lastName", "enabled", "emailVerified"]),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  group_list: {
    name: "Группы",
    kind: "catalog",
    mainEntity: "Group",
    entities: ["Group"],
    witnesses: ["name", "path", "subGroupCount"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("Group", ["name", "path", "subGroupCount"]),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  role_list: {
    name: "Роли",
    kind: "catalog",
    mainEntity: "Role",
    entities: ["Role"],
    witnesses: ["name", "description", "composite", "clientRole"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("Role", ["name", "description", "composite", "clientRole"]),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  identityprovider_list: {
    name: "Identity Providers",
    kind: "catalog",
    mainEntity: "IdentityProvider",
    entities: ["IdentityProvider"],
    witnesses: ["alias", "displayName", "providerId", "enabled", "trustEmail"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("IdentityProvider", ["alias", "displayName", "providerId", "enabled", "trustEmail"]),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  clientscope_list: {
    name: "Client Scopes",
    kind: "catalog",
    mainEntity: "ClientScope",
    entities: ["ClientScope"],
    witnesses: ["name", "protocol", "description"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("ClientScope", ["name", "protocol", "description"]),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  component_list: {
    name: "Components",
    kind: "catalog",
    mainEntity: "Component",
    entities: ["Component"],
    witnesses: ["name", "providerType", "providerId"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("Component", ["name", "providerType", "providerId"]),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  organization_list: {
    name: "Organizations",
    kind: "catalog",
    mainEntity: "Organization",
    entities: ["Organization"],
    witnesses: ["alias", "name", "description", "enabled"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("Organization", ["alias", "name", "description", "enabled"]),
    patterns: SUPPRESS_TREE_IN_BODY,
  },
  workflow_list: {
    name: "Workflows",
    kind: "catalog",
    mainEntity: "Workflow",
    entities: ["Workflow"],
    witnesses: ["name", "description", "enabled"],
    filter: "!world.realmId || realmId === world.realmId",
    bodyOverride: dataGridBody("Workflow", ["name", "description", "enabled"]),
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
          id: "config",
          title: "Configuration",
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
