// src/domains/keycloak/domain.js
/**
 * Keycloak — identity-and-access-management домен. 14-й dogfood (после
 * Gravitino metadata-catalog), импортирован из Keycloak Admin REST OpenAPI
 * (https://www.keycloak.org/docs-api/latest/rest-api/openapi.yaml) через
 * @intent-driven/importer-openapi@0.6.x.
 *
 * Stage 1 цель: baseline-рендер 224 entities + 254 intents без custom
 * buildEffects, без seed, без authored projections — всё derived. Будет
 * визуально перегружено (большой nav-graph), gap'ы зафиксируются в
 * docs/keycloak-gaps.md.
 *
 * Ожидаемые gap'ы (из project-memory): G23 wizard catalog_create,
 * tab-composed form (Client с 10+ tabs × 30+ полей), connection-test
 * step (IdP / UserFederation), credentials editor (password/OTP/WebAuthn),
 * role-mappings matrix с group inheritance.
 */
export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
export { getSeedEffects } from "./seed.js";
export { RULES } from "./rules.js";
import { INTENTS } from "./intents.js";

export const DOMAIN_ID = "keycloak";
export const DOMAIN_NAME = "Keycloak — identity & access";

export function describeEffect(intentId, alpha, _ctx, target) {
  const intent = INTENTS[intentId];
  return `${intent?.name || intentId}: ${alpha} ${target || ""}`;
}

export function signalForIntent(_intentId) {
  return null;
}
