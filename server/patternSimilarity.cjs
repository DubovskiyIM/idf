/**
 * Pattern similarity — best-effort метрика "насколько candidate похож на
 * stable". Куратор использует чтобы избегать дублей: если новый candidate
 * на 80%+ совпадает с уже промоченным stable — это либо вариация одного
 * и того же паттерна (отклонить), либо отказ от текущего stable
 * (отдельный flow).
 *
 * Score 0..1, weighted:
 *   trigger.requires kinds Jaccard         × 0.45
 *   structure.slot match (binary)          × 0.20
 *   archetype match (binary)               × 0.20
 *   id-token Jaccard (rough name overlap)  × 0.15
 *
 * Совершенный score (1.0) — все 4 совпали полностью. Threshold для
 * "warning duplicate" обычно 0.65+ (UI решает что подсветить).
 */

function tokenSet(id) {
  if (!id) return new Set();
  return new Set(String(id).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function triggerKinds(pattern) {
  const requires = pattern?.trigger?.requires || [];
  const kinds = new Set();
  for (const r of requires) {
    if (r && typeof r.kind === "string") kinds.add(r.kind);
  }
  return kinds;
}

/**
 * @returns {number} 0..1
 */
function similarity(a, b) {
  if (!a || !b) return 0;
  const triggerScore = jaccard(triggerKinds(a), triggerKinds(b));
  const slotA = a.structure?.slot || a.structure?.target;
  const slotB = b.structure?.slot || b.structure?.target;
  const slotScore = slotA && slotB && slotA === slotB ? 1 : 0;
  const archScore = a.archetype && b.archetype && a.archetype === b.archetype ? 1 : 0;
  const nameScore = jaccard(tokenSet(a.id), tokenSet(b.id));
  return Math.min(
    1,
    triggerScore * 0.45 + slotScore * 0.2 + archScore * 0.2 + nameScore * 0.15,
  );
}

/**
 * @param {Object} candidate
 * @param {Array<Object>} pool — stable patterns
 * @param {number} top — сколько вернуть
 * @returns {Array<{id, score, archetype?, refSource?, slot?}>}
 */
function findTopMatches(candidate, pool, top = 3) {
  const scored = pool
    .filter((p) => p && p.id && p.id !== candidate.id)
    .map((p) => ({
      id: p.id,
      score: similarity(candidate, p),
      archetype: p.archetype || null,
      slot: p.structure?.slot || null,
      status: p.status || null,
    }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, top);
}

module.exports = { similarity, findTopMatches, jaccard, triggerKinds, tokenSet };
