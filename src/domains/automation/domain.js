// src/domains/automation/domain.js
/**
 * Automation domain — visual workflow automation в духе n8n / Zapier / Make.
 *
 * 17-й полевой тест IDF (после ArgoCD 16-го status-driven admin).
 *
 * Lineage: AntD enterprise (invest → compliance → keycloak → argocd → automation).
 *
 * Scope: 8 entities, 4 роли (editor / executor / viewer / agent), 35 intents,
 * 15 invariants (10 referential + 2 transition + 2 expression + 1 cardinality),
 * 2 rules (threshold + schedule).
 *
 * Out of scope MVP: real engine выполнения, OAuth flow, marketplace UI,
 * live execution overlay.
 */

export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
export { getSeedEffects } from "./seed.js";

import { INTENTS } from "./intents.js";
import { ONTOLOGY } from "./ontology.js";

export const RULES = ONTOLOGY.rules || [];

export const DOMAIN_ID = "automation";
export const DOMAIN_NAME = "Workflow Automation";

export const SHELL = {
  layoutMode: "default",
  defaultRoute: "workflow_list",
};

export function describeEffect(intentId, alpha, _ctx, target) {
  const intent = INTENTS[intentId];
  return `${intent?.name || intentId}: ${alpha} ${target || ""}`;
}

export function signalForIntent(_intentId) {
  return null;
}

/**
 * Client-side buildEffects (SDK fallback'ом подхватывает particles.effects).
 * Custom branches:
 *   - run_workflow_manual / run_workflow_with_input — синтез Execution + steps
 *   - duplicate_workflow / import_workflow / purge_execution_history —
 *     handled на client с context.
 *
 * Возвращает null → SDK generic handler читает intent.particles.effects.
 */
export function buildEffects(_intentId, _ctx = {}) {
  return null;
}
