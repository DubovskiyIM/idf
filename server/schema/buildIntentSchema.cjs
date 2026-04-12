/**
 * Композиция: intent → полный agent-schema entry.
 *
 * Используется routes/agent.js::getSchema. Для каждого intent'а из
 * canExecute собирает: описание, параметры (inferred), условия (parsed),
 * шаблоны эффектов (нормализованные), метаданные (creates, antagonist,
 * irreversibility, phase).
 */

const { parseConditions } = require("./conditionParser.cjs");
const { inferParameters } = require("./inferParameters.cjs");

function normalizeEffectTemplate(eff, creates) {
  const template = {
    alpha: eff.α || eff.alpha,
    target: eff.target,
    scope: eff.σ || eff.scope || "account"
  };
  if (eff.value !== undefined) template.value = eff.value;
  if (eff.ttl != null) template.ttlMs = eff.ttl;
  // Для add-эффектов можем вывести producesEntity из creates
  if (template.alpha === "add" && typeof creates === "string") {
    const norm = creates.replace(/\s*\(.*\)\s*$/, "").trim();
    template.producesEntity = norm;
  }
  return template;
}

function buildIntentSchema(intentId, intent, ontology, roleName, relations) {
  const particles = intent.particles || {};
  const parameters = inferParameters(intent, ontology);
  const conditions = parseConditions(particles.conditions || []);
  const effects = (particles.effects || []).map(e => normalizeEffectTemplate(e, intent.creates));

  const defaultRelations = {
    sequentialIn: [],
    sequentialOut: [],
    antagonists: [],
    excluding: [],
    parallel: []
  };

  return {
    intentId,
    name: intent.name,
    description: intent.description || intent.name,
    parameters,
    conditions,
    effects,
    creates: typeof intent.creates === "string" ? intent.creates : null,
    antagonist: intent.antagonist || null,
    irreversibility: intent.irreversibility || null,
    phase: intent.phase || null,
    relations: relations || defaultRelations
  };
}

module.exports = { buildIntentSchema };
