/**
 * Delivery domain — еда / продукты last-mile (field-test 11).
 * Большинство intents через Generic Effect Handler. Специфика
 * (place_order, capture_payment, cancel_order, request_refund) —
 * наполняется в Task 5.
 */
import { v4 as uuid } from "uuid";
export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";

export const DOMAIN_ID = "delivery";
export const DOMAIN_NAME = "Delivery";

export function describeEffect(intentId, alpha, ctx, target) {
  return `${intentId}: ${alpha} ${target || ""}`;
}

export function signalForIntent(intentId) {
  return null;
}

export function buildEffects(intentId, ctx, world, drafts) {
  // Stub — generic handler применит intent.particles.effects.
  // Специфика заполнится в Task 5.
  return [];
}
