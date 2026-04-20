// patternNodes.js
//
// Строит pattern-узлы и edges для /api/studio/domain/:name/graph.
// Узлы:  { id: "pattern:<patternId>", kind: "pattern", patternId, archetype, hasApply }
// Edges: pattern → projection (kind: "applies-to")
//        pattern → entity     (kind: "affects")
//
// Используется только если домен импортирован успешно (ONTOLOGY/INTENTS/PROJECTIONS).
// Pattern matching — синхронный SDK-вызов, не требует subprocess.

const {
  getDefaultRegistry,
  loadStablePatterns,
} = require("@intent-driven/core");

function filterIntentsForProjection(intents, projection) {
  const main = projection?.mainEntity;
  return Object.entries(intents || {})
    .filter(([, intent]) => {
      if (!main) return true;
      const entities = (intent?.particles?.entities || [])
        .map(e => String(e).split(":").pop().trim());
      return entities.includes(main);
    })
    .map(([id, intent]) => ({ id, ...intent }));
}

function buildPatternNodes({ ontology, intents, projections }) {
  const registry = getDefaultRegistry();
  loadStablePatterns(registry);

  const nodes = [];
  const edges = [];
  const seen = new Set();

  for (const [projId, projection] of Object.entries(projections || {})) {
    const projIntents = filterIntentsForProjection(intents, projection);
    let matchResult;
    try {
      matchResult = registry.matchPatterns(projIntents, ontology, projection, {
        includeNearMiss: false,
      });
    } catch {
      continue;
    }
    const matched = Array.isArray(matchResult) ? matchResult : matchResult.matched;
    for (const entry of matched) {
      const pattern = Array.isArray(matchResult) ? entry : entry.pattern;
      const nodeId = `pattern:${pattern.id}`;
      if (!seen.has(nodeId)) {
        seen.add(nodeId);
        nodes.push({
          id: nodeId,
          kind: "pattern",
          name: pattern.id,
          patternId: pattern.id,
          archetype: pattern.archetype,
          status: pattern.status,
          hasApply: typeof pattern.structure?.apply === "function",
        });
      }
      edges.push({
        id: `pat:${pattern.id}->proj:${projId}`,
        kind: "applies-to",
        source: nodeId,
        target: `projection:${projId}`,
      });
      if (projection.mainEntity) {
        edges.push({
          id: `pat:${pattern.id}->ent:${projection.mainEntity}`,
          kind: "affects",
          source: nodeId,
          target: `entity:${projection.mainEntity}`,
        });
      }
    }
  }

  return { nodes, edges };
}

module.exports = { buildPatternNodes };
