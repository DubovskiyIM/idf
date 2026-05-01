// src/domains/gravitino/domain.js
/**
 * Gravitino — metadata-catalog домен. Импортирован из Apache Gravitino
 * OpenAPI spec (docs/open-api/openapi.yaml) через importer-openapi.
 * Enrich через enricher-claude не сработал из-за Claude CLI 2.1.117
 * wire-format регрессии (docs/backlog.md §1.12) — продолжаем на
 * pre-enrich ontology.
 *
 * 14-й домен в IDF, используется как Gravitino-dogfood для SDK/adapter
 * polish (docs/superpowers/specs/2026-04-22-gravitino-dogfood-design.md,
 * локальный файл вне git).
 *
 * Stage 1: baseline render без custom buildEffects, без seed, без
 * authored projections — всё derived.
 */
export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
export { getSeedEffects } from "./seed.js";
export { RULES } from "./rules.js";
import { INTENTS } from "./intents.js";

export const DOMAIN_ID = "gravitino";
export const DOMAIN_NAME = "Gravitino — metadata catalog";

export function describeEffect(intentId, alpha, _ctx, target) {
  const intent = INTENTS[intentId];
  return `${intent?.name || intentId}: ${alpha} ${target || ""}`;
}

export function signalForIntent(_intentId) {
  return null;
}
