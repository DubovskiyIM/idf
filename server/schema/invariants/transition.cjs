/**
 * Invariant kind: "transition".
 * Проверяет допустимость переходов значения поля.
 *
 * Режимы:
 *  - order: [s1, s2, ...] — monotonic; curr должен быть ≥ prev по индексу
 *  - transitions: [[a,b], ...] — whitelist пар; каждый переход ∈ whitelist
 *
 * Источники данных:
 *  - world[collection] — текущее значение field
 *  - opts.history[`${id}.${field}`] — массив значений в порядке применения
 *    (опц.; если нет — проверяется только текущий статус ∈ набор)
 */

function pluralize(entity) {
  const lower = entity.toLowerCase();
  if (lower.endsWith("s")) return lower + "es";
  if (lower.endsWith("y")) return lower.slice(0, -1) + "ies";
  return lower + "s";
}

function allowedSet(inv) {
  if (Array.isArray(inv.order)) return new Set(inv.order);
  if (Array.isArray(inv.transitions)) {
    const s = new Set();
    for (const [a, b] of inv.transitions) { s.add(a); s.add(b); }
    return s;
  }
  return null;
}

function checkTransition(prev, curr, inv) {
  if (prev === curr) return true;
  if (Array.isArray(inv.order)) {
    const ip = inv.order.indexOf(prev);
    const ic = inv.order.indexOf(curr);
    if (ip < 0 || ic < 0) return false;
    return ic >= ip;
  }
  if (Array.isArray(inv.transitions)) {
    return inv.transitions.some(([a, b]) => a === prev && b === curr);
  }
  return true;
}

function handler(inv, world, _ontology, opts = {}) {
  const collection = pluralize(inv.entity);
  const rows = world[collection] || [];
  const history = opts.history || {};
  const allowed = allowedSet(inv);
  const violations = [];

  for (const row of rows) {
    const curr = row[inv.field];
    if (allowed && curr != null && !allowed.has(curr)) {
      violations.push({
        message: `${inv.entity}#${row.id}: ${inv.field}="${curr}" не в допустимом наборе`,
        details: { entity: inv.entity, id: row.id, field: inv.field,
                   currentValue: curr, reason: "not_in_allowed_set" },
      });
      continue;
    }

    const seq = history[`${row.id}.${inv.field}`];
    if (!Array.isArray(seq) || seq.length < 2) continue;

    for (let i = 1; i < seq.length; i++) {
      const prev = seq[i - 1];
      const curVal = seq[i];
      if (!checkTransition(prev, curVal, inv)) {
        violations.push({
          message: `${inv.entity}#${row.id}: недопустимый переход ${prev} → ${curVal}`,
          details: { entity: inv.entity, id: row.id, field: inv.field,
                     from: prev, to: curVal, reason: "illegal_transition" },
        });
        break;
      }
    }
  }

  return violations;
}

module.exports = { handler };
