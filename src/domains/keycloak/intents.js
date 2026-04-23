// src/domains/keycloak/intents.js
import { ontology as imported } from "./imported.js";

/**
 * Stage 1: passthrough. Все 254 intents от importer'а как есть.
 *
 * TODO Stage 2: param-aliasing аналогично Gravitino (path-params типа
 * {realm} → realmId), target-remap для grant/revoke intents.
 */
export const INTENTS = imported.intents;
