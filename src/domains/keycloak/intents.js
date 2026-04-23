// src/domains/keycloak/intents.js
import { ontology as imported } from "./imported.js";

/**
 * Stage 2: param-aliasing по образцу Gravitino.
 *
 * Keycloak Admin REST использует короткие path-params (`/realms/{realm}`,
 * `/clients/{client}`), importer-openapi @0.6 берёт path-name как
 * intent.parameters key. Catalog-archetype для row-action'а ожидает
 * convention `<entity>Id` (matches detail.idParam).
 *
 * Mismatch: param `realm` → не матчится с derived detail.idParam=`realmId`,
 * intent не попадает в row-action realm_list. Host-fix: дублируем
 * parameter под canonical именем (aliasOf сохраняет связь с originalом
 * для server-payload binding'а).
 *
 * Safe-set: только те где `<entity>Id` ещё НЕ используется как ключ
 * intent.parameters в imported set. Не трогаем `provider` (конфликт с
 * `providerId`), `group` / `user` (уже как-Id есть).
 */

const PARAM_ALIASES = {
  realm: "realmId",       // path /realms/{realm}/...
  client: "clientId",     // path /clients/{client}/...
  alias: "aliasId",       // IdentityProvider natural key
  flowAlias: "flowAliasId", // AuthenticationFlow natural key
  protocol: "protocolId", // /client-scopes/{id}/protocol-mappers/protocol/{protocol}
  locale: "localeId",     // /localization/{realm}/{locale}
  attr: "attrId",         // /localization/{realm}/{locale}/{attr}
  session: "sessionId",   // /sessions/{session}
  node: "nodeId",         // /clients/{id}/nodes/{node}
  path: "pathId",         // /groups/path/{path} (group hierarchical key)
  key: "keyId",           // /authentication/config-description/{key}
};

function aliasParameters(intents) {
  const result = {};
  for (const [id, intent] of Object.entries(intents)) {
    const params = intent?.parameters;
    if (!params || typeof params !== "object") {
      result[id] = intent;
      continue;
    }
    const nextParams = { ...params };
    let changed = false;
    for (const [paramName, paramDef] of Object.entries(params)) {
      const canonical = PARAM_ALIASES[paramName];
      if (canonical && !nextParams[canonical]) {
        nextParams[canonical] = { ...paramDef, aliasOf: paramName };
        changed = true;
      }
    }
    result[id] = changed ? { ...intent, parameters: nextParams } : intent;
  }
  return result;
}

/**
 * Stage 3 host-fix для G-K-8 (новый): importer-openapi @0.6 неправильно
 * классифицирует POST на nested-коллекцию (`POST /realms/{realm}/users`)
 * как `usersUser` с α=`replace` вместо `createUser` с α=`insert`.
 *
 * Последствие: deriveProjections правило R1 (catalog требует insert-creator)
 * не срабатывает — на canonical entities (User/Group/Role/IdP/ClientScope/
 * Component/Organization/Workflow) появляется только detail, без catalog.
 * Только Realm и Client получили catalog потому что у них POST top-level
 * (POST /realms — `createRealm`, не nested).
 *
 * Host-fix: для известных canonical 14 mapping'ов — переименовываем
 * `xsX` → `createX` + α=`insert`. Это разблокирует R1.
 *
 * X1: после SDK PR `importer-openapi.detectCollectionPostAsCreate`.
 */
const COLLECTION_POST_TO_CREATE = {
  usersUser: "createUser",
  groupsGroup: "createGroup",
  rolesRole: "createRole",
  identity_providersIdentityProvider: "createIdentityProvider",
  client_scopesClientScope: "createClientScope",
  componentsComponent: "createComponent",
  organizationsOrganization: "createOrganization",
  workflowsWorkflow: "createWorkflow",
  membersMember: "createMember",
  resourcesResource: "createResource",
  scopesScope: "createScope",
  protocol_mappersProtocolMapper: "createProtocolMapper",
  credentialsCredential: "createCredential",
  flowsFlow: "createFlow",
  modelsModel: "createModel",
  client_templatesClientTemplate: "createClientTemplate",
  policiesPolicy: "createPolicy",
};

function reclassifyCollectionPosts(intents) {
  const result = {};
  for (const [id, intent] of Object.entries(intents)) {
    const newId = COLLECTION_POST_TO_CREATE[id];
    if (newId) {
      // analyzeIntents() в core ищет creators через intent.creates,
      // НЕ через α=insert. Без `creates` правило R1 (catalog) не срабатывает.
      result[newId] = {
        ...intent,
        alpha: "insert",
        creates: intent.target,
        originalId: id,
      };
    } else {
      result[id] = intent;
    }
  }
  return result;
}

export const INTENTS = reclassifyCollectionPosts(aliasParameters(imported.intents));
