/**
 * Studio authoring state machine.
 *
 * 7 последовательных состояний, которые PM проходит в live-demo:
 *   empty → kickoff → entities → intents → roles → ontology_detail → preview → committed
 *
 * Каждый ход (turn) — это reply от LLM в формате:
 *   { userFacing, patch, nextState, nextPrompt }
 *
 * applyTurn() merge'ит patch в текущий spec, валидирует partial-spec на
 * consistency, и возвращает новый state.
 *
 * Функции чистые — никакого IO. LLM-call живёт в route (see routes/studio-authoring.js).
 */

const STATES = [
  "empty", "kickoff", "entities", "intents", "roles", "ontology_detail", "preview", "committed",
];

function initAuthoring({ domainId }) {
  return {
    domainId,
    state: "empty",
    spec: {
      meta: { id: domainId },
      INTENTS: {},
      PROJECTIONS: {},
      ONTOLOGY: { entities: {}, roles: {}, invariants: [] },
    },
    history: [],
    validationIssues: [],
    nextPrompt: "Опиши словами, что за инструмент ты делаешь и кто им пользуется.",
  };
}

function mergePatch(spec, patch) {
  if (!patch || typeof patch !== "object") return spec;
  const out = { ...spec };

  if (patch.meta) {
    out.meta = { ...(out.meta || {}), ...patch.meta };
  }
  if (patch.INTENTS) {
    out.INTENTS = { ...(out.INTENTS || {}), ...patch.INTENTS };
  }
  if (patch.PROJECTIONS) {
    out.PROJECTIONS = { ...(out.PROJECTIONS || {}), ...patch.PROJECTIONS };
  }
  if (patch.ONTOLOGY) {
    const prevOnt = out.ONTOLOGY || { entities: {}, roles: {}, invariants: [] };
    out.ONTOLOGY = {
      ...prevOnt,
      entities: { ...(prevOnt.entities || {}), ...(patch.ONTOLOGY.entities || {}) },
      roles: { ...(prevOnt.roles || {}), ...(patch.ONTOLOGY.roles || {}) },
      invariants: [...(prevOnt.invariants || []), ...(patch.ONTOLOGY.invariants || [])],
    };
  }
  return out;
}

function validatePartial(spec) {
  const issues = [];
  const entityIds = new Set(Object.keys(spec.ONTOLOGY?.entities || {}));
  for (const [intentId, intent] of Object.entries(spec.INTENTS || {})) {
    if (!intent.target) continue;
    const entityName = String(intent.target).split(".")[0];
    if (!entityIds.has(entityName)) {
      issues.push({
        code: "unknown_entity",
        intentId,
        target: intent.target,
        message: `intent ${intentId} ссылается на неизвестную сущность ${entityName}`,
      });
    }
  }
  return issues;
}

async function applyTurn(state, { userText, llmResponse }) {
  const patch = llmResponse?.patch || null;
  const newSpec = patch ? mergePatch(state.spec, patch) : state.spec;
  const issues = validatePartial(newSpec);
  const nextState = llmResponse?.nextState || state.state;
  const nextPrompt = llmResponse?.nextPrompt || state.nextPrompt;
  return {
    ...state,
    spec: newSpec,
    state: nextState,
    nextPrompt,
    history: [
      ...state.history,
      { userText, llmResponse, at: Date.now() },
    ],
    validationIssues: issues,
  };
}

function canFinalize(state) {
  const finalizableStates = new Set(["preview", "ontology_detail"]);
  if (!finalizableStates.has(state.state)) return false;
  const hasIntents = Object.keys(state.spec?.INTENTS || {}).length > 0;
  const hasEntities = Object.keys(state.spec?.ONTOLOGY?.entities || {}).length > 0;
  return hasIntents && hasEntities;
}

module.exports = {
  STATES,
  initAuthoring,
  applyTurn,
  canFinalize,
  mergePatch,
  validatePartial,
};
