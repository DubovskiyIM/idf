// src/domains/notion/domain.js
//
// 18-й полевой тест IDF — Notion-style block-based knowledge management.
//
// Lineage: AntD enterprise (invest → compliance → keycloak → argocd → automation → notion).

import { ONTOLOGY } from "./ontology.js";
import { INTENTS } from "./intents.js";
import { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";

export const DOMAIN_ID = "notion";
export const DOMAIN_NAME = "Notion (block-based KB)";

export const SHELL = {
  layoutMode: "default",
  defaultRoute: "sidebar_workspace",
};

export { ONTOLOGY, INTENTS, PROJECTIONS, ROOT_PROJECTIONS };
export { getSeedEffects } from "./seed.js";

export function describeEffect(intentId, alpha, _ctx, target) {
  const intent = INTENTS[intentId];
  return `${intent?.name || intentId}: ${alpha} ${target || ""}`;
}

export function signalForIntent(_intentId) {
  return null;
}

/**
 * Client-side buildEffects — null означает «доверь generic-handler'у SDK».
 * Custom branches (multi-effect / cross-entity / preapproval-gated)
 * обрабатываются server-side в server/schema/buildNotionEffects.cjs.
 */
export function buildEffects(_intentId, _ctx = {}) {
  return null;
}
