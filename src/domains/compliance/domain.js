/**
 * Compliance domain — SOX ICFR provable-UI (13-й полевой тест).
 *
 * Тонкий buildEffects: только generic handler поверх particles.effects
 * (как freelance). Все cross-entity enforcement — через expression-kind
 * invariants на валидаторе (core@0.33+).
 */
import { v4 as uuid } from "uuid";

export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
export { getSeedEffects } from "./seed.js";
export { RULES } from "./rules.js";

import { INTENTS } from "./intents.js";

export const DOMAIN_ID = "compliance";
export const DOMAIN_NAME = "Compliance & Audit (SOX ICFR)";

export function describeEffect(intentId, alpha, ctx, target) {
  const intent = INTENTS[intentId];
  return `${intent?.name || intentId}: ${alpha} ${target || ""}`;
}

export function signalForIntent(intentId) {
  const irr = INTENTS[intentId]?.irreversibility;
  if (irr === "high") return { κ: "🔒", desc: "Необратимая операция (SOX §404)" };
  return null;
}

// Ownership-инъекция: UI-формы не спрашивают preparerId / controlOwnerId —
// viewer.id подставляется из ctx.userId до применения effects.
const OWNERSHIP_INJECT = {
  create_journal_entry_draft: { preparerId: "userId" },
  attach_evidence_to_je:      { attachedById: "userId" },
  review_je:                  { reviewerId: "userId" },
  approve_journal_entry:      { approverId: "userId" },
  reject_je_at_approval:      { approverId: "userId" },
  delegate_approval:          { approverId: "userId" },
  draft_attestation:          { controlOwnerId: "userId" },
  attach_evidence_to_attestation: { attachedById: "userId" },
  amend_attestation:          { authorId: "userId" },
  flag_finding:               { openedById: "userId" },
  file_amendment:             { authorId: "userId" },
};

export function ownershipInject(intentId, ctx) {
  const map = OWNERSHIP_INJECT[intentId];
  if (!map) return ctx;
  const out = { ...ctx };
  for (const [field, srcKey] of Object.entries(map)) {
    if (out[field] == null && ctx[srcKey] != null) out[field] = ctx[srcKey];
  }
  return out;
}

// Нет custom effect-handler'ов — весь флоу через generic particles.effects.
// buildCustomEffects возвращает null, fallback на generic handler server'а.
export function buildCustomEffects(_intentId, _ctx, _world) {
  return null;
}

// Helper для seed.js — создание effect'а с UUID + timestamp.
export function mkSeedEffect(intentId, target, props) {
  return {
    id: uuid(),
    intent_id: intentId,
    parent_id: null,
    status: "confirmed",
    ttl: null,
    created_at: Date.now(),
    α: "add",
    target,
    ...props,
  };
}
