/**
 * Shallow merge authored projections over derived.
 *
 * Семантика:
 * - authored[id] = false → удаление
 * - authored[id] = {...} + derived[id] exists → shallow merge (authored поля побеждают)
 * - authored[id] = {...} + derived[id] absent → новая проекция
 * - поле отсутствует в authored → берётся из derived
 *
 * @param {Record<string, object>} derived
 * @param {Record<string, object|false>} authored
 * @returns {Record<string, object>}
 */
export function mergeProjections(derived, authored) {
  const result = {};

  for (const [id, proj] of Object.entries(derived)) {
    result[id] = { ...proj };
  }

  for (const [id, spec] of Object.entries(authored)) {
    if (spec === false) {
      delete result[id];
      continue;
    }

    if (result[id]) {
      result[id] = { ...result[id], ...spec };
    } else {
      result[id] = { ...spec };
    }
  }

  return result;
}
