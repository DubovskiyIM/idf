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

module.exports = { matchTrigger, resolveContext };
