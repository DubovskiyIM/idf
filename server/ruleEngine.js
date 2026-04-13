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

function evaluateRules(stored, worldThunk, deps) {
  const { getDomainByIntentId, getOntology, validateIntentConditions, getIntent } = deps;

  const storedCtx = typeof stored.context === "string"
    ? JSON.parse(stored.context)
    : (stored.context || {});

  const domain = getDomainByIntentId(stored.intent_id);
  if (!domain) return [];

  const ontology = getOntology(domain);
  const rules = ontology?.rules || [];
  if (rules.length === 0) return [];

  const matched = rules.filter(rule => matchTrigger(rule.trigger, stored.intent_id));
  if (matched.length === 0) return [];

  const world = worldThunk();
  const results = [];

  for (const rule of matched) {
    const intent = getIntent(rule.action);
    if (!intent) continue;

    const resolvedCtx = resolveContext(rule.context || {}, storedCtx);
    const mockEffect = {
      intent_id: rule.action,
      target: intent.particles?.effects?.[0]?.target || rule.action,
      context: resolvedCtx,
    };

    const validation = validateIntentConditions(mockEffect, world);
    if (validation.valid) {
      const effect = buildActionEffect(rule.action, intent, resolvedCtx);
      results.push({ rule, effect });
    }
  }

  return results;
}

module.exports = { matchTrigger, resolveContext, buildActionEffect, evaluateRules };
