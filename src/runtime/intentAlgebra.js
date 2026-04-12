/**
 * intentAlgebra — формализация §12 манифеста (расширенная алгебра
 * связей между намерениями).
 *
 * Computes adjacency map из INTENTS+ONTOLOGY: для каждого intent'а —
 * сначала derivation через частицы, затем merge declared antagonists
 * как hint с §15 classification.
 *
 * Public API:
 *   computeAlgebra(INTENTS, ONTOLOGY) → adjacency map (production output)
 *   computeAlgebraWithEvidence(INTENTS, ONTOLOGY) → adjacency map + evidence (debug)
 *
 * Internal helpers (exported для тестов):
 *   normalizeEntityFromTarget(target, ONTOLOGY) → singular entity name
 */

import { parseCondition, parseConditions } from "./conditionParser.js";

/**
 * Нормализация target эффекта в singular entity name.
 *
 * Стратегия:
 *   1. base = target.split(".")[0]
 *   2. drafts/draft — special case
 *   3. Strip trailing 's' → candidate singular
 *   4. Match по ontology.entities (lowercase или last camelCase segment)
 *   5. Fallback: возвращаем singular как есть
 */
export function normalizeEntityFromTarget(target, ontology) {
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

/**
 * effectSatisfiesCondition — проверяет, делает ли effect condition истинным.
 *
 * Правила:
 *   - replace + `=`/`!=`/`IN` — matching value
 *   - remove + `= null` — YES
 *   - add — NO в v1 (слабое соответствие, out of scope)
 */
function effectSatisfiesCondition(effect, cond, ontology) {
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
        case "=":
          return effValue === cond.value;
        case "!=":
          return effValue !== cond.value;
        case "IN":
          return Array.isArray(cond.value) && cond.value.includes(effValue);
        default:
          return false;
      }
    }

    case "remove": {
      if (cond.op === "=" && cond.value === null) return true;
      return false;
    }

    case "add":
      return false;

    default:
      return false;
  }
}

/**
 * deriveSequential — выводит ▷ edges для всех пар (I₁, I₂).
 *
 * Для каждого condition в I₂ ищет effect в I₁, который этот condition
 * делает истинным. Field-level matching через parseCondition + normalized
 * entity/field из target.
 */
function deriveSequential(INTENTS, ONTOLOGY) {
  const edges = [];
  const intentIds = Object.keys(INTENTS);

  for (const toId of intentIds) {
    const toIntent = INTENTS[toId];
    const conditions = parseConditions(toIntent.particles?.conditions || []);
    if (conditions.length === 0) continue;

    for (const fromId of intentIds) {
      if (fromId === toId) continue; // no self-loops
      const fromIntent = INTENTS[fromId];
      const effects = fromIntent.particles?.effects || [];
      if (effects.length === 0) continue;

      const matches = conditions.some(cond =>
        effects.some(eff => effectSatisfiesCondition(eff, cond, ONTOLOGY))
      );

      if (matches) {
        edges.push({ from: fromId, to: toId });
      }
    }
  }

  return edges;
}

/**
 * computeAlgebra — главный API.
 */
export function computeAlgebra(INTENTS, ONTOLOGY) {
  const algebra = {};
  if (!INTENTS) return algebra;

  for (const id of Object.keys(INTENTS)) {
    algebra[id] = emptyRelations();
  }

  // 1. ▷
  const sequentialEdges = deriveSequential(INTENTS, ONTOLOGY);
  for (const { from, to } of sequentialEdges) {
    if (!algebra[from].sequentialOut.includes(to)) {
      algebra[from].sequentialOut.push(to);
    }
    if (!algebra[to].sequentialIn.includes(from)) {
      algebra[to].sequentialIn.push(from);
    }
  }

  return algebra;
}
