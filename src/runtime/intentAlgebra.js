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
 * computeAlgebra — главный API. В skeleton-версии возвращает пустые
 * relations для каждого intent'а. Derivation добавляется в следующих задачах.
 */
export function computeAlgebra(INTENTS, ONTOLOGY) {
  const algebra = {};
  if (!INTENTS) return algebra;

  for (const id of Object.keys(INTENTS)) {
    algebra[id] = emptyRelations();
  }

  return algebra;
}
