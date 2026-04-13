/**
 * Движок реактивных правил (event-condition-action).
 *
 * Правила живут в ontology.rules. Формат:
 *   { id, trigger, action, context }
 *
 * trigger — glob: "vote_*" (prefix) или "confirm_delivery" (exact).
 * action — intent_id, чьи conditions служат guard'ом.
 * context — маппинг { key: "effect.<field>" | литерал }.
 */

function matchTrigger(trigger, intentId) {
  if (trigger === "*") return true;
  if (trigger.endsWith("*")) {
    return intentId.startsWith(trigger.slice(0, -1));
  }
  return trigger === intentId;
}

function resolveContext(mapping, storedContext) {
  const result = {};
  for (const [key, value] of Object.entries(mapping)) {
    if (typeof value === "string" && value.startsWith("effect.")) {
      const field = value.slice("effect.".length);
      result[key] = storedContext[field];
    } else {
      result[key] = value;
    }
  }
  return result;
}

function buildActionEffect(actionIntentId, intent, resolvedContext) {
  const effects = intent.particles?.effects || [];
  const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();

  if (effects.length === 1) {
    const ef = effects[0];
    return {
      id,
      intent_id: actionIntentId,
      alpha: ef.α,
      target: ef.target,
      value: ef.value,
      scope: ef.σ || "account",
      context: resolvedContext,
      created_at: now,
    };
  }

  // Multi-effect → batch
  const base = effects[0]?.target?.split(".")[0] || actionIntentId;
  return {
    id,
    intent_id: actionIntentId,
    alpha: "batch",
    target: base,
    value: effects.map(ef => ({
      alpha: ef.α,
      target: ef.target,
      value: ef.value,
      context: resolvedContext,
      scope: ef.σ || "account",
    })),
    scope: "account",
    context: resolvedContext,
    created_at: now,
  };
}

module.exports = { matchTrigger, resolveContext, buildActionEffect };
