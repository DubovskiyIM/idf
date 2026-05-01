// src/domains/keycloak/intents.js
import { ontology as imported } from "./imported.js";

/**
 * Host passthrough после Stage 5+ X1 cleanup (2026-04-23):
 * importer-openapi@0.11.0 делает всю heavy-lifting:
 * - G-K-2: detectActionEndpoints (idf-sdk#251) — action-verbs не entity
 * - G-K-8: detectCollectionPostAsCreate (idf-sdk#260) — POST на nested
 *   collection → createEntity с α=insert + creates
 *
 * Остаётся только host-specific param-aliasing — importer не знает о
 * canonical key-convention `<entity>Id`, Keycloak Admin REST использует
 * короткие path-params (`/realms/{realm}`). Catalog row-action resolver
 * ожидает `realmId`, а imported intent имеет `realm`. Host дублирует
 * parameter под canonical именем (aliasOf сохраняет связь с originalом
 * для server-payload binding'а).
 *
 * Safe-set: только где `<entity>Id` ещё НЕ используется как ключ intent.
 * Не трогаем `provider` (конфликт с `providerId`), `group` / `user` (уже
 * как-Id есть).
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

export const INTENTS = aliasParameters(imported.intents);
