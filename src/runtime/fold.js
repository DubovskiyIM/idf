/**
 * fold(effects) → world (массив сущностей)
 *
 * По манифесту: World(t) = fold(⊕, ∅, sort≺(Φ ↓ t))
 * Принимает массив эффектов, возвращает массив сущностей.
 *
 * @param {Array} effects — эффекты для свёртки (предполагается порядок по created_at)
 * @returns {Array} — массив сущностей (tasks)
 */
export function fold(effects) {
  const entities = {};

  for (const ef of effects) {
    const ctx = ef.context || {};
    const val = ef.value;

    switch (ef.alpha) {
      case "add": {
        const entityId = ctx.id || ef.id;
        entities[entityId] = { ...ctx };
        break;
      }
      case "replace": {
        const entityId = ctx.id;
        if (entityId && entities[entityId]) {
          const field = ef.target.split(".").pop();
          entities[entityId] = { ...entities[entityId], [field]: val };
        }
        break;
      }
      case "remove": {
        const entityId = ctx.id;
        if (entityId) delete entities[entityId];
        break;
      }
    }
  }

  return Object.values(entities);
}

/**
 * Отфильтровать эффекты по статусам для разных представлений мира.
 */
export function filterByStatus(effects, ...statuses) {
  return effects.filter(e => statuses.includes(e.status));
}
