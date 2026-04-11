/**
 * causalSort — топологическая сортировка эффектов по причинному порядку ≺.
 *
 * Реализация §10 манифеста: World(t) = fold(⊕, ∅, sort≺(Φ_confirmed ↓ t)).
 *
 * Правила:
 *   - Parent идёт до child'а (parent_id → id).
 *   - Множественные roots (без parent_id) сортируются по created_at ASC.
 *   - Siblings одного parent'а сортируются по created_at ASC.
 *   - Orphaned parent_id (ссылка на несуществующий effect) трактуется как root.
 *   - Цикл — crazy case, не должен случаться в корректном Φ, но fallback на
 *     сортировку по created_at без падения.
 *
 * Функция не мутирует input.
 */
export function causalSort(effects) {
  if (!Array.isArray(effects) || effects.length === 0) return [];

  const byId = new Map();
  for (const ef of effects) {
    if (ef && ef.id != null) byId.set(ef.id, ef);
  }

  // Children map: parent_id → [effects that reference it]
  // Orphaned parent_id (ссылка на ghost) — не включаем, такие эффекты
  // трактуются как roots.
  const children = new Map();
  const roots = [];

  for (const ef of effects) {
    if (!ef) continue;
    const parentId = ef.parent_id;
    if (parentId != null && byId.has(parentId)) {
      if (!children.has(parentId)) children.set(parentId, []);
      children.get(parentId).push(ef);
    } else {
      // Root: либо parent_id === null, либо orphaned ref
      roots.push(ef);
    }
  }

  // Стабильная сортировка по created_at (undefined → 0)
  const byCreatedAt = (a, b) => (a.created_at ?? 0) - (b.created_at ?? 0);
  roots.sort(byCreatedAt);
  for (const sibs of children.values()) sibs.sort(byCreatedAt);

  // DFS с visited-защитой от циклов
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

  // Fallback: если что-то не посещено (цикл) — добавить в порядке created_at
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
