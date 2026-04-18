/**
 * Freelance domain — биржа услуг (12-й полевой тест).
 *
 * Тонкий buildEffects: только generic handler поверх particles.effects.
 * Cycle 1: публикация задачи → отклик (без escrow — Cycle 2).
 */
import { v4 as uuid } from "uuid";
export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
export { getSeedEffects } from "./seed.js";
export { RULES } from "./rules.js";
import { INTENTS } from "./intents.js";

export const DOMAIN_ID = "freelance";
export const DOMAIN_NAME = "Фриланс — биржа услуг";

export function describeEffect(intentId, alpha, ctx, target) {
  const intent = INTENTS[intentId];
  return `${intent?.name || intentId}: ${alpha} ${target || ""}`;
}

// Инструментальный signal (κ-символ + описание) для SSE-стрима useEngine.
// Пока no-op — все escrow-эффекты описаны через describeEffect.
// Cycle 3+ может вернуть { κ: "💰", desc: "Escrow резервирование" } для важных.
export function signalForIntent(_intentId) {
  return null;
}

// Ownership-field auto-injection для creator intents: UI-формы не спрашивают
// customerId/authorId/executorId (ownership детали), viewer.id подставляется
// из ctx.userId перед применением effects.
const OWNERSHIP_INJECT = {
  create_task_draft: { customerId: "userId" },
  confirm_deal: { customerId: "userId" },
  leave_review: { authorId: "userId" },
  submit_response: { executorId: "userId" },
  top_up_wallet_by_card: { userId: "userId" },
};

export function buildEffects(intentId, ctx, world, drafts) {
  const intent = INTENTS[intentId];
  if (!intent) return null;
  const intentEffects = intent.particles?.effects || [];
  if (intentEffects.length === 0) return null;

  const injectRules = OWNERSHIP_INJECT[intentId];
  if (injectRules && ctx.userId) {
    const patches = {};
    for (const [field, source] of Object.entries(injectRules)) {
      if (ctx[field] === undefined && ctx[source] !== undefined) {
        patches[field] = ctx[source];
      }
    }
    if (Object.keys(patches).length > 0) ctx = { ...ctx, ...patches };
  }

  const now = Date.now();
  const effects = [];
  const push = (props) => effects.push({
    id: uuid(), intent_id: intentId, parent_id: null, status: "proposed",
    ttl: null, created_at: now, ...props,
  });

  for (const iEf of intentEffects) {
    const alpha = iEf.α;
    const target = iEf.target;
    const scope = iEf.σ || "account";

    switch (alpha) {
      case "add": {
        const entityId = ctx.id || `${target.slice(0, 4)}_${now}_${Math.random().toString(36).slice(2, 6)}`;
        push({
          alpha: "add", target, scope, value: null,
          context: { id: entityId, ...ctx, createdAt: now },
          desc: describeEffect(intentId, "add", ctx, target),
        });
        break;
      }
      case "replace": {
        const entityId = ctx.id || ctx.entityId;
        const field = target.includes(".") ? target.split(".").pop() : target;
        const resolvedValue =
          iEf.value !== undefined ? iEf.value
          : ctx[field] !== undefined ? ctx[field]
          : ctx.value;
        if (entityId && resolvedValue !== undefined) {
          push({
            alpha: "replace", target, scope, value: resolvedValue,
            context: { id: entityId, userId: ctx.userId || ctx.ownerId },
            desc: describeEffect(intentId, "replace", ctx, target),
          });
        }
        break;
      }
      case "remove": {
        const entityId = ctx.id || ctx.entityId;
        if (entityId) {
          push({
            alpha: "remove", target, scope, value: null,
            context: { id: entityId, userId: ctx.userId || ctx.ownerId },
            desc: describeEffect(intentId, "remove", ctx, target),
          });
        }
        break;
      }
    }
  }

  return effects.length > 0 ? effects : null;
}
