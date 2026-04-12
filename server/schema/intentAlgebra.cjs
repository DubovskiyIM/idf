/**
 * intentAlgebra — server-side CJS-зеркало src/runtime/intentAlgebra.js.
 *
 * Используется agent layer (GET /schema) для экспонирования relations блока.
 * Синхронизируется вручную с client-side версией — при изменении алгоритмов
 * derivation или output shape обновлять ОБЕ копии.
 */

const { parseConditions } = require("./conditionParser.cjs");

// Copy из src/runtime/algebra.js после удаления increment/cas (Session A)
const COMPOSITION_TABLE = {
  replace: { replace: "ok",       add: "conflict", remove: "conflict", batch: "ok" },
  add:     { replace: "conflict", add: "ok",       remove: "order",    batch: "ok" },
  remove:  { replace: "conflict", add: "order",    remove: "ok",       batch: "ok" },
  batch:   { replace: "ok",       add: "ok",       remove: "ok",       batch: "ok" },
};

function checkCompositionCJS(effect1, effect2) {
  if (effect1.target !== effect2.target) return { compatible: true };
  const α1 = effect1.alpha;
  const α2 = effect2.alpha;
  const result = COMPOSITION_TABLE[α1]?.[α2];
  if (!result || result === "conflict") {
    return { compatible: false, resolution: "⊥" };
  }
  return { compatible: true };
}

function normalizeEntityFromTarget(target, ontology) {
  if (!target || typeof target !== "string") return null;
  const base = target.split(".")[0];
  if (base === "drafts" || base === "draft") return "draft";
  const singular = base.endsWith("s") ? base.slice(0, -1) : base;
  if (ontology?.entities) {
    for (const entityName of Object.keys(ontology.entities)) {
      const entityLower = entityName.toLowerCase();
      if (entityLower === singular) return singular;
      const segments = entityName.match(/[A-Z][a-z]*/g) || [];
      if (segments.length > 1) {
        const lastSegment = segments[segments.length - 1].toLowerCase();
        if (lastSegment === singular) return singular;
      }
    }
  }
  return singular;
}

function emptyRelations() {
  return {
    sequentialIn: [],
    sequentialOut: [],
    antagonists: [],
    excluding: [],
    parallel: []
  };
}

function parseCreatesImpliedStatus(creates) {
  if (!creates || typeof creates !== "string") return null;
  const match = creates.match(/^(\w+)\s*\(([^)]+)\)\s*$/);
  if (match) return { entity: match[1].toLowerCase(), impliedStatus: match[2].trim() };
  return { entity: creates.toLowerCase(), impliedStatus: null };
}

function effectSatisfiesCondition(effect, cond, ontology, intent) {
  const alpha = effect.α || effect.alpha;
  const effectEntity = normalizeEntityFromTarget(effect.target, ontology);
  if (effectEntity !== cond.entity) return false;
  const parts = (effect.target || "").split(".");
  const effectField = parts.length > 1 ? parts[parts.length - 1] : null;

  switch (alpha) {
    case "replace": {
      if (effectField !== cond.field) return false;
      const effValue = effect.value;
      switch (cond.op) {
        case "=": return effValue === cond.value;
        case "!=": return effValue !== cond.value;
        case "IN": return Array.isArray(cond.value) && cond.value.includes(effValue);
        default: return false;
      }
    }
    case "remove": {
      if (cond.op === "=" && cond.value === null) return true;
      return false;
    }
    case "add": {
      if (!intent?.creates) return false;
      const parsed = parseCreatesImpliedStatus(intent.creates);
      if (!parsed || !parsed.impliedStatus) return false;
      if (cond.field !== "status") return false;
      const createsEntity = parsed.entity;
      if (createsEntity !== cond.entity && createsEntity !== effectEntity) return false;
      switch (cond.op) {
        case "=": return parsed.impliedStatus === cond.value;
        case "!=": return parsed.impliedStatus !== cond.value;
        case "IN": return Array.isArray(cond.value) && cond.value.includes(parsed.impliedStatus);
        default: return false;
      }
    }
    default:
      return false;
  }
}

function deriveSequential(INTENTS, ONTOLOGY) {
  const edges = [];
  const intentIds = Object.keys(INTENTS);
  for (const toId of intentIds) {
    const conditions = parseConditions(INTENTS[toId].particles?.conditions || []);
    if (conditions.length === 0) continue;
    for (const fromId of intentIds) {
      if (fromId === toId) continue;
      const effects = INTENTS[fromId].particles?.effects || [];
      if (effects.length === 0) continue;
      const matches = conditions.some(cond =>
        effects.some(eff => effectSatisfiesCondition(eff, cond, ONTOLOGY, INTENTS[fromId]))
      );
      if (matches) edges.push({ from: fromId, to: toId });
    }
  }
  return edges;
}

function effectsReverse(e1, e2) {
  const a1 = e1.α || e1.alpha;
  const a2 = e2.α || e2.alpha;
  if (a1 === "replace" && a2 === "replace") {
    if (e1.target !== e2.target) return false;
    if (e1.value === e2.value) return false;
    return true;
  }
  if (a1 === "add" && a2 === "remove") return e1.target === e2.target;
  if (a1 === "remove" && a2 === "add") return e1.target === e2.target;
  return false;
}

function deriveAntagonisticStrict(INTENTS, ONTOLOGY) {
  const edges = [];
  const intentIds = Object.keys(INTENTS);
  for (let i = 0; i < intentIds.length; i++) {
    for (let j = i + 1; j < intentIds.length; j++) {
      const eff1 = INTENTS[intentIds[i]].particles?.effects || [];
      const eff2 = INTENTS[intentIds[j]].particles?.effects || [];
      if (eff1.length === 0 || eff2.length === 0) continue;
      if (eff1.length !== eff2.length) continue;

      const matchedE2 = new Set();
      let allMatched = true;
      for (const e1 of eff1) {
        let matched = false;
        for (let k = 0; k < eff2.length; k++) {
          if (matchedE2.has(k)) continue;
          if (effectsReverse(e1, eff2[k])) {
            matchedE2.add(k);
            matched = true;
            break;
          }
        }
        if (!matched) { allMatched = false; break; }
      }
      if (allMatched && matchedE2.size === eff2.length) {
        edges.push({ a: intentIds[i], b: intentIds[j] });
      }
    }
  }
  return edges;
}

function mergeDeclaredAntagonists(INTENTS, structuralEdges) {
  const structuralSet = new Set();
  for (const edge of structuralEdges) {
    structuralSet.add([edge.a, edge.b].sort().join("|"));
  }
  const evidenceMap = {};
  for (const edge of structuralEdges) {
    if (!evidenceMap[edge.a]) evidenceMap[edge.a] = {};
    if (!evidenceMap[edge.b]) evidenceMap[edge.b] = {};
    evidenceMap[edge.a][edge.b] = { classification: "structural" };
    evidenceMap[edge.b][edge.a] = { classification: "structural" };
  }
  for (const [id, intent] of Object.entries(INTENTS)) {
    const declared = intent.antagonist;
    if (!declared || !INTENTS[declared]) continue;
    const key = [id, declared].sort().join("|");
    if (structuralSet.has(key)) continue;
    if (!evidenceMap[id]) evidenceMap[id] = {};
    if (!evidenceMap[declared]) evidenceMap[declared] = {};
    if (!evidenceMap[id][declared]) {
      evidenceMap[id][declared] = { classification: "heuristic-lifecycle" };
    }
    if (!evidenceMap[declared][id]) {
      evidenceMap[declared][id] = { classification: "heuristic-lifecycle" };
    }
  }
  return evidenceMap;
}

function deriveExcluding(INTENTS, ONTOLOGY) {
  const edges = [];
  const intentIds = Object.keys(INTENTS);
  for (let i = 0; i < intentIds.length; i++) {
    for (let j = i + 1; j < intentIds.length; j++) {
      const eff1 = INTENTS[intentIds[i]].particles?.effects || [];
      const eff2 = INTENTS[intentIds[j]].particles?.effects || [];
      let hasConflict = false;
      for (const e1 of eff1) {
        for (const e2 of eff2) {
          const result = checkCompositionCJS(
            { alpha: e1.α || e1.alpha, target: e1.target },
            { alpha: e2.α || e2.alpha, target: e2.target }
          );
          if (result.compatible === false) { hasConflict = true; break; }
        }
        if (hasConflict) break;
      }
      if (hasConflict) edges.push({ a: intentIds[i], b: intentIds[j] });
    }
  }
  return edges;
}

function deriveParallel(INTENTS, ONTOLOGY, algebra) {
  const edges = [];
  const intentIds = Object.keys(INTENTS);
  for (let i = 0; i < intentIds.length; i++) {
    for (let j = i + 1; j < intentIds.length; j++) {
      const id1 = intentIds[i];
      const id2 = intentIds[j];
      const e1 = INTENTS[id1].particles?.effects || [];
      const e2 = INTENTS[id2].particles?.effects || [];
      if (e1.length === 0 || e2.length === 0) continue;

      const entities1 = new Set(e1.map(e => normalizeEntityFromTarget(e.target, ONTOLOGY)).filter(Boolean));
      const entities2 = new Set(e2.map(e => normalizeEntityFromTarget(e.target, ONTOLOGY)).filter(Boolean));
      let hasCommon = false;
      for (const ent of entities1) {
        if (entities2.has(ent)) { hasCommon = true; break; }
      }
      if (!hasCommon) continue;

      if (algebra[id1].excluding.includes(id2)) continue;
      if (algebra[id1].sequentialOut.includes(id2)) continue;
      if (algebra[id1].sequentialIn.includes(id2)) continue;
      if (algebra[id1].antagonists.includes(id2)) continue;

      edges.push({ a: id1, b: id2 });
    }
  }
  return edges;
}

function computeAlgebraWithEvidence(INTENTS, ONTOLOGY) {
  const algebra = {};
  if (!INTENTS) return algebra;
  for (const id of Object.keys(INTENTS)) {
    algebra[id] = { ...emptyRelations(), antagonistsEvidence: {} };
  }

  for (const { from, to } of deriveSequential(INTENTS, ONTOLOGY)) {
    if (!algebra[from].sequentialOut.includes(to)) algebra[from].sequentialOut.push(to);
    if (!algebra[to].sequentialIn.includes(from)) algebra[to].sequentialIn.push(from);
  }

  const structuralEdges = deriveAntagonisticStrict(INTENTS, ONTOLOGY);
  const evidenceMap = mergeDeclaredAntagonists(INTENTS, structuralEdges);
  for (const [id, otherMap] of Object.entries(evidenceMap)) {
    for (const [otherId, evidence] of Object.entries(otherMap)) {
      if (!algebra[id].antagonists.includes(otherId)) algebra[id].antagonists.push(otherId);
      algebra[id].antagonistsEvidence[otherId] = evidence;
    }
  }

  for (const { a, b } of deriveExcluding(INTENTS, ONTOLOGY)) {
    if (!algebra[a].excluding.includes(b)) algebra[a].excluding.push(b);
    if (!algebra[b].excluding.includes(a)) algebra[b].excluding.push(a);
  }

  for (const { a, b } of deriveParallel(INTENTS, ONTOLOGY, algebra)) {
    if (!algebra[a].parallel.includes(b)) algebra[a].parallel.push(b);
    if (!algebra[b].parallel.includes(a)) algebra[b].parallel.push(a);
  }

  return algebra;
}

function computeAlgebra(INTENTS, ONTOLOGY) {
  const withEvidence = computeAlgebraWithEvidence(INTENTS, ONTOLOGY);
  const algebra = {};
  for (const [id, relations] of Object.entries(withEvidence)) {
    const { antagonistsEvidence, ...rest } = relations;
    algebra[id] = rest;
  }
  return algebra;
}

module.exports = { computeAlgebra, computeAlgebraWithEvidence, normalizeEntityFromTarget };
