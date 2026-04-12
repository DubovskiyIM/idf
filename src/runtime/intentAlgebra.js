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
import { checkComposition } from "./algebra.js";

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
 * Парсит creates-строку с parenthesized default status.
 *   "Poll(draft)" → { entity: "poll", impliedStatus: "draft" }
 *   "Vote(yes)"   → { entity: "vote", impliedStatus: "yes" }
 *   "Booking"     → { entity: "booking", impliedStatus: null }
 *   null          → null
 */
function parseCreatesImpliedStatus(creates) {
  if (!creates || typeof creates !== "string") return null;
  const match = creates.match(/^(\w+)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { entity: match[1].toLowerCase(), impliedStatus: match[2].trim() };
  }
  return { entity: creates.toLowerCase(), impliedStatus: null };
}

/**
 * effectSatisfiesCondition — проверяет, делает ли effect condition истинным.
 *
 * Правила:
 *   - replace + `=`/`!=`/`IN` — matching value
 *   - remove + `= null` — YES
 *   - add + intent.creates с implied status → matching по status field
 *     (wave 2: "Poll(draft)" → condition "poll.status = 'draft'" → ▷)
 *
 * @param {Object} effect — шаблон эффекта
 * @param {Object} cond — parsed condition AST
 * @param {Object} ontology
 * @param {Object} intent — полный intent (для доступа к creates)
 */
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

    case "add": {
      // Wave 2: derivation через intent.creates implied status.
      // "creates: Poll(draft)" → add polls → condition "poll.status = 'draft'" → ▷
      if (!intent?.creates) return false;
      const parsed = parseCreatesImpliedStatus(intent.creates);
      if (!parsed || !parsed.impliedStatus) return false;

      // Condition должен быть на status-поле
      if (cond.field !== "status") return false;

      // Entity matching: parsed.entity должен match cond.entity
      const createsEntity = parsed.entity;
      if (createsEntity !== cond.entity && createsEntity !== effectEntity) return false;

      // Value matching
      switch (cond.op) {
        case "=":
          return parsed.impliedStatus === cond.value;
        case "!=":
          return parsed.impliedStatus !== cond.value;
        case "IN":
          return Array.isArray(cond.value) && cond.value.includes(parsed.impliedStatus);
        default:
          return false;
      }
    }

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
        effects.some(eff => effectSatisfiesCondition(eff, cond, ONTOLOGY, fromIntent))
      );

      if (matches) {
        edges.push({ from: fromId, to: toId });
      }
    }
  }

  return edges;
}

/**
 * effectsReverse — проверяет, реверсирует ли e2 эффект e1.
 *
 * Правила:
 *   - replace + replace на одном target с разными values → bistable candidate
 *   - add + remove на одной коллекции → reversal
 *   - remove + add на одной коллекции → reversal
 */
function effectsReverse(e1, e2) {
  const a1 = e1.α || e1.alpha;
  const a2 = e2.α || e2.alpha;

  if (a1 === "replace" && a2 === "replace") {
    if (e1.target !== e2.target) return false;
    if (e1.value === e2.value) return false;
    return true;
  }

  if (a1 === "add" && a2 === "remove") {
    return e1.target === e2.target;
  }

  if (a1 === "remove" && a2 === "add") {
    return e1.target === e2.target;
  }

  return false;
}

/**
 * deriveAntagonisticStrict — выводит ⇌ через effect pair-reversal.
 *
 * Для пары (I₁, I₂) ⇌ признаётся только если:
 *   - Для каждого effect'а в I₁ существует reversing effect в I₂
 *   - Симметрично для I₂
 *   - Покрытие полное (все эффекты замэтчены)
 */
function deriveAntagonisticStrict(INTENTS, ONTOLOGY) {
  const edges = [];
  const intentIds = Object.keys(INTENTS);

  for (let i = 0; i < intentIds.length; i++) {
    for (let j = i + 1; j < intentIds.length; j++) {
      const id1 = intentIds[i];
      const id2 = intentIds[j];
      const eff1 = INTENTS[id1].particles?.effects || [];
      const eff2 = INTENTS[id2].particles?.effects || [];
      if (eff1.length === 0 || eff2.length === 0) continue;
      if (eff1.length !== eff2.length) continue; // асимметричное покрытие

      const matchedE2 = new Set();
      const pairs = [];
      let allMatched = true;

      for (const e1 of eff1) {
        let matched = false;
        for (let k = 0; k < eff2.length; k++) {
          if (matchedE2.has(k)) continue;
          if (effectsReverse(e1, eff2[k])) {
            matchedE2.add(k);
            pairs.push([e1, eff2[k]]);
            matched = true;
            break;
          }
        }
        if (!matched) {
          allMatched = false;
          break;
        }
      }

      if (allMatched && matchedE2.size === eff2.length) {
        edges.push({ a: id1, b: id2, witness: { pairs } });
      }
    }
  }

  return edges;
}

/**
 * mergeDeclaredAntagonists — добавляет declared antagonists в evidence map
 * с classification по §15:
 *   - structural: strict derivation подтверждает (evidence есть)
 *   - heuristic-lifecycle: declared, но strict derivation не подтверждает
 */
function mergeDeclaredAntagonists(INTENTS, structuralEdges) {
  const structuralSet = new Set();
  for (const edge of structuralEdges) {
    structuralSet.add([edge.a, edge.b].sort().join("|"));
  }

  const evidenceMap = {};

  // 1. Strict edges → classification=structural
  for (const edge of structuralEdges) {
    if (!evidenceMap[edge.a]) evidenceMap[edge.a] = {};
    if (!evidenceMap[edge.b]) evidenceMap[edge.b] = {};
    evidenceMap[edge.a][edge.b] = { classification: "structural" };
    evidenceMap[edge.b][edge.a] = { classification: "structural" };
  }

  // 2. Declared antagonists (если не покрыты strict)
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

/**
 * deriveExcluding — выводит ⊕ через composition table из algebra.js.
 *
 * Для пары (I₁, I₂) ⊕ существует если хотя бы одна пара (e₁, e₂) даёт ⊥
 * в checkComposition. Симметричный тип связи.
 */
function deriveExcluding(INTENTS, ONTOLOGY) {
  const edges = [];
  const intentIds = Object.keys(INTENTS);

  for (let i = 0; i < intentIds.length; i++) {
    for (let j = i + 1; j < intentIds.length; j++) {
      const id1 = intentIds[i];
      const id2 = intentIds[j];
      const eff1 = INTENTS[id1].particles?.effects || [];
      const eff2 = INTENTS[id2].particles?.effects || [];

      let hasConflict = false;
      for (const e1 of eff1) {
        for (const e2 of eff2) {
          const result = checkComposition(
            { alpha: e1.α || e1.alpha, target: e1.target, context: {} },
            { alpha: e2.α || e2.alpha, target: e2.target, context: {} }
          );
          if (result.compatible === false) {
            hasConflict = true;
            break;
          }
        }
        if (hasConflict) break;
      }

      if (hasConflict) {
        edges.push({ a: id1, b: id2 });
      }
    }
  }

  return edges;
}

/**
 * deriveParallel — complement derivation: ∥ существует если пара имеет
 * общие entities в effects, НЕ ⊕, НЕ ▷ ни в одну сторону, НЕ ⇌.
 *
 * Вычисляется ПОСЛЕ всех остальных derivation, потому что зависит от них.
 */
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

      const entities1 = new Set(
        e1.map(e => normalizeEntityFromTarget(e.target, ONTOLOGY)).filter(Boolean)
      );
      const entities2 = new Set(
        e2.map(e => normalizeEntityFromTarget(e.target, ONTOLOGY)).filter(Boolean)
      );

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

/**
 * computeAlgebraWithEvidence — debug-версия с classification метаданными.
 * Используется integrity rule #5.
 */
export function computeAlgebraWithEvidence(INTENTS, ONTOLOGY) {
  const algebra = {};
  if (!INTENTS) return algebra;

  for (const id of Object.keys(INTENTS)) {
    algebra[id] = { ...emptyRelations(), antagonistsEvidence: {} };
  }

  // 1. ▷
  const sequentialEdges = deriveSequential(INTENTS, ONTOLOGY);
  for (const { from, to } of sequentialEdges) {
    if (!algebra[from].sequentialOut.includes(to)) algebra[from].sequentialOut.push(to);
    if (!algebra[to].sequentialIn.includes(from)) algebra[to].sequentialIn.push(from);
  }

  // 2. ⇌ strict + declared merge
  const structuralEdges = deriveAntagonisticStrict(INTENTS, ONTOLOGY);
  const evidenceMap = mergeDeclaredAntagonists(INTENTS, structuralEdges);

  for (const [id, otherMap] of Object.entries(evidenceMap)) {
    for (const [otherId, evidence] of Object.entries(otherMap)) {
      if (!algebra[id].antagonists.includes(otherId)) {
        algebra[id].antagonists.push(otherId);
      }
      algebra[id].antagonistsEvidence[otherId] = evidence;
    }
  }

  // 3. ⊕
  const excludingEdges = deriveExcluding(INTENTS, ONTOLOGY);
  for (const { a, b } of excludingEdges) {
    if (!algebra[a].excluding.includes(b)) algebra[a].excluding.push(b);
    if (!algebra[b].excluding.includes(a)) algebra[b].excluding.push(a);
  }

  // 4. ∥ complement (после всех предыдущих)
  const parallelEdges = deriveParallel(INTENTS, ONTOLOGY, algebra);
  for (const { a, b } of parallelEdges) {
    if (!algebra[a].parallel.includes(b)) algebra[a].parallel.push(b);
    if (!algebra[b].parallel.includes(a)) algebra[b].parallel.push(a);
  }

  return algebra;
}

/**
 * computeAlgebra — production API. Strip'ит evidence из output.
 */
export function computeAlgebra(INTENTS, ONTOLOGY) {
  const withEvidence = computeAlgebraWithEvidence(INTENTS, ONTOLOGY);

  const algebra = {};
  for (const [id, relations] of Object.entries(withEvidence)) {
    const { antagonistsEvidence, ...rest } = relations;
    algebra[id] = rest;
  }

  return algebra;
}
