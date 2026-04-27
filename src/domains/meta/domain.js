// src/domains/meta/domain.js
/**
 * Meta-домен — IDF-on-IDF, Level 1 (read-only observability).
 *
 * Описывает сам формат IDF: домены, intent'ы, projection'ы, patterns,
 * witness'ы, rrules, adapters, capabilities. Источник Φ — build-time
 * snapshot (см. scripts/build-meta-snapshot.mjs).
 *
 * Цель — dogfood формата на самом себе и фиксация gap'ов в
 * docs/sdk-improvements-backlog.md (новый § meta-domain).
 */

export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
export { getSeedEffects, SEED_SUMMARY } from "./seed.js";

import { INTENTS } from "./intents.js";
import { ONTOLOGY } from "./ontology.js";

export const RULES = ONTOLOGY.rules || [];

export const DOMAIN_ID = "meta";
export const DOMAIN_NAME = "IDF Self-Description";

export const SHELL = {
  layoutMode: "default",
  defaultRoute: "domain_list",
};

export function describeEffect(intentId, alpha, _ctx, target) {
  const intent = INTENTS[intentId];
  return `${intent?.name || intentId}: ${alpha} ${target || ""}`;
}

export function signalForIntent(_intentId) {
  return null;
}

export function buildEffects(_intentId, _ctx = {}) {
  return null;
}
