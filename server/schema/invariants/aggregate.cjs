/**
 * Invariant kind: "aggregate".
 * Сравнивает sum/count по from-коллекции с полем target-строки.
 *
 * Параметры:
 *   op: "sum" | "count"
 *   from: "Entity.field" — source-коллекция + поле для op
 *   where: { field: value | "$target.<field>", ... } — фильтр; плейсхолдер
 *          $target.<f> подставляется из каждой target-строки
 *   target: "Entity.field" — с каким полем сравнивать результат op
 *   tolerance: number — абсолютная дельта (default 0)
 */

function pluralize(e) {
  const l = e.toLowerCase();
  if (l.endsWith("s")) return l + "es";
  if (l.endsWith("y")) return l.slice(0, -1) + "ies";
  return l + "s";
}

function parseRef(r) {
  const [entity, field] = r.split(".");
  return { entity, field, collection: pluralize(entity) };
}

function resolveWhere(where, targetRow) {
  const out = {};
  for (const [k, v] of Object.entries(where || {})) {
    if (typeof v === "string" && v.startsWith("$target.")) {
      out[k] = targetRow[v.slice("$target.".length)];
    } else {
      out[k] = v;
    }
  }
  return out;
}

function matchesWhere(row, where) {
  for (const [k, v] of Object.entries(where)) {
    if (row[k] !== v) return false;
  }
  return true;
}

function compute(op, rows, field) {
  if (op === "sum") return rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
  if (op === "count") return rows.length;
  throw new Error(`unknown op: ${op}`);
}

function handler(inv, world) {
  const from = parseRef(inv.from);
  const target = parseRef(inv.target);
  const tol = inv.tolerance != null ? inv.tolerance : 0;
  const fromRows = world[from.collection] || [];
  const targetRows = world[target.collection] || [];
  const violations = [];

  for (const tRow of targetRows) {
    const where = resolveWhere(inv.where, tRow);
    const filtered = fromRows.filter(r => matchesWhere(r, where));
    const computed = compute(inv.op, filtered, from.field);
    const expected = Number(tRow[target.field]) || 0;

    if (Math.abs(computed - expected) > tol) {
      violations.push({
        message: `${target.entity}#${tRow.id}: ${inv.op}(${inv.from})=${computed} ≠ ${target.field}=${expected} (tolerance=${tol})`,
        details: {
          targetEntity: target.entity, targetId: tRow.id, targetField: target.field,
          op: inv.op, computed, expected, delta: computed - expected, tolerance: tol,
        },
      });
    }
  }

  return violations;
}

module.exports = { handler };
