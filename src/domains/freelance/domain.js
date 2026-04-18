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

export function buildEffects(intentId, ctx, world, drafts) {
  const intent = INTENTS[intentId];
  if (!intent) return null;
  const intentEffects = intent.particles?.effects || [];
  if (intentEffects.length === 0) return null;

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
