/**
 * Invariant kind: "cardinality".
 * Проверяет count(rows) после where-фильтра, опционально с groupBy.
 *
 * Параметры:
 *   entity: string
 *   where?: { field: value, ... } — точное сравнение
 *   groupBy?: string — имя поля для группировки
 *   max?: number — верхний предел на группу (или всю коллекцию)
 *   min?: number — нижний предел на группу; пустые группы не проверяются
 */

function pluralize(e) {
  const l = e.toLowerCase();
  if (l.endsWith("s")) return l + "es";
  if (l.endsWith("y")) return l.slice(0, -1) + "ies";
  return l + "s";
}

function matchesWhere(row, where) {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    if (row[k] !== v) return false;
  }
  return true;
}

function handler(inv, world) {
  const rows = (world[pluralize(inv.entity)] || []).filter(r => matchesWhere(r, inv.where));
  const violations = [];

  const groups = new Map();
  if (inv.groupBy) {
    for (const r of rows) {
      const k = r[inv.groupBy];
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
  } else {
    groups.set(null, rows);
  }

  for (const [key, items] of groups) {
    const count = items.length;
    if (inv.max != null && count > inv.max) {
      violations.push({
        message: `${inv.entity}: group=${key} count=${count} > max=${inv.max}`,
        details: { entity: inv.entity, group: key, count, max: inv.max,
                   ids: items.map(i => i.id) },
      });
    }
    if (inv.min != null && count < inv.min) {
      violations.push({
        message: `${inv.entity}: group=${key} count=${count} < min=${inv.min}`,
        details: { entity: inv.entity, group: key, count, min: inv.min },
      });
    }
  }

  return violations;
}

module.exports = { handler };
