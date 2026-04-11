/**
 * Фильтрация folded world для конкретной роли.
 *
 * Три прохода в одном циклу по entities ontology:
 *   1. row-filter через entity.ownerField (agent видит только свои bookings/reviews)
 *   2. field-filter через role.visibleFields[entity] (скрываем clientId и т.п.)
 *   3. status-mapping через role.statusMapping (held → booked)
 *
 * Коллекция, для которой в role.visibleFields нет записи, не возвращается
 * в output вовсе.
 */

function pluralize(word) {
  if (!word) return word;
  if (word.endsWith("y")) return word.slice(0, -1) + "ies";
  if (word.endsWith("s")) return word + "es";
  return word + "s";
}

function filterWorldForRole(rawWorld, ontology, roleName, viewer) {
  const role = ontology?.roles?.[roleName];
  if (!role) throw new Error(`Role "${roleName}" не найдена в ontology`);

  const visibleFields = role.visibleFields || {};
  const statusMapping = role.statusMapping || {};
  const filtered = {};

  for (const [entityName, entityDef] of Object.entries(ontology.entities || {})) {
    const allowed = visibleFields[entityName];
    if (!allowed) continue; // коллекция не видна этой роли

    const collName = pluralize(entityName.toLowerCase());
    const rows = rawWorld[collName] || [];

    const owned = entityDef.ownerField
      ? rows.filter(r => r[entityDef.ownerField] === viewer.id)
      : rows;

    const projected = owned.map(row => {
      const out = {};
      for (const field of allowed) {
        let val = row[field];
        if (field === "status" && statusMapping[val]) {
          val = statusMapping[val];
        }
        if (val !== undefined) out[field] = val;
      }
      return out;
    });

    filtered[collName] = projected;
  }

  return filtered;
}

module.exports = { filterWorldForRole };
