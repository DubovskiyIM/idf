/**
 * causalSort — серверный порт src/runtime/causalSort.js.
 *
 * Топологическая сортировка эффектов по причинному порядку ≺. Используется
 * в server/validator.js::foldWorld для соответствия §10 манифеста:
 *   World(t) = fold(⊕, ∅, sort≺(Φ_confirmed ↓ t))
 *
 * ВНИМАНИЕ: при изменении правил — синхронизировать с клиентской версией.
 * См. src/runtime/causalSort.js и src/runtime/causalSort.test.js.
 */
function causalSort(effects) {
  if (!Array.isArray(effects) || effects.length === 0) return [];

  const byId = new Map();
  for (const ef of effects) {
    if (ef && ef.id != null) byId.set(ef.id, ef);
  }

  const children = new Map();
  const roots = [];

  for (const ef of effects) {
    if (!ef) continue;
    const parentId = ef.parent_id;
    if (parentId != null && byId.has(parentId)) {
      if (!children.has(parentId)) children.set(parentId, []);
      children.get(parentId).push(ef);
    } else {
      roots.push(ef);
    }
  }

  const byCreatedAt = (a, b) => (a.created_at ?? 0) - (b.created_at ?? 0);
  roots.sort(byCreatedAt);
  for (const sibs of children.values()) sibs.sort(byCreatedAt);

  const result = [];
  const visited = new Set();

  function visit(ef) {
    if (visited.has(ef.id)) return;
    visited.add(ef.id);
    result.push(ef);
    const sibs = children.get(ef.id);
    if (sibs) {
      for (const child of sibs) visit(child);
    }
  }

  for (const root of roots) visit(root);

  if (result.length < effects.length) {
    const missing = effects.filter(ef => ef && !visited.has(ef.id));
    missing.sort(byCreatedAt);
    for (const ef of missing) {
      visited.add(ef.id);
      result.push(ef);
    }
  }

  return result;
}

module.exports = { causalSort };
