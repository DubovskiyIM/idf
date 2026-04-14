/**
 * Invariant kind: "referential".
 * Проверяет, что row[fromField] существует как row.toField в to-коллекции.
 *
 * from / to — строки формата "Entity.field"; Entity плюрализуется
 * по той же схеме, что и validator.js::updateTypeMap.
 */

function pluralize(entity) {
  const lower = entity.toLowerCase();
  if (lower.endsWith("s")) return lower + "es";
  if (lower.endsWith("y")) return lower.slice(0, -1) + "ies";
  return lower + "s";
}

function parseRef(ref) {
  const [entity, field] = ref.split(".");
  return { entity, field, collection: pluralize(entity) };
}

function handler(inv, world) {
  const from = parseRef(inv.from);
  const to = parseRef(inv.to);
  const fromRows = world[from.collection] || [];
  const toRows = world[to.collection] || [];
  const allowNull = !!inv.allowNull;

  const toIndex = new Set(toRows.map(r => r[to.field]));
  const violations = [];

  for (const row of fromRows) {
    const val = row[from.field];
    if (val == null) {
      if (allowNull) continue;
      violations.push({
        message: `${from.entity}#${row.id}: ${from.field}=null, ожидается ссылка на ${to.entity}.${to.field}`,
        details: { fromEntity: from.entity, fromId: row.id,
                   fromField: from.field, danglingValue: null },
      });
      continue;
    }
    if (!toIndex.has(val)) {
      violations.push({
        message: `${from.entity}#${row.id}: ${from.field}=${val} не найден в ${to.entity}.${to.field}`,
        details: { fromEntity: from.entity, fromId: row.id,
                   fromField: from.field, danglingValue: val,
                   toEntity: to.entity, toField: to.field },
      });
    }
  }

  return violations;
}

module.exports = { handler };
