/**
 * Парсер строк-условий намерений в JSON-AST.
 *
 * Зеркалит 5 регулярок из server/intents.js::evalIntentCondition, но
 * вместо вычисления возвращает структуру для публикации в agent-schema.
 *
 * Grammar (неформальный):
 *   <cond>  := <entity>.<field> <op> <value>
 *   <op>    := = | != | IN
 *   <value> := 'string' | null | true | false | me.id | (list)
 */

function parseCondition(condStr) {
  if (!condStr || typeof condStr !== "string") return null;
  const c = condStr.trim();
  if (!c) return null;

  // x.field = null
  let m = c.match(/^(\w+)\.(\w+)\s*=\s*null$/);
  if (m) return { entity: m[1], field: m[2], op: "=", value: null };

  // x.field != null
  m = c.match(/^(\w+)\.(\w+)\s*!=\s*null$/);
  if (m) return { entity: m[1], field: m[2], op: "!=", value: null };

  // x.field = true|false
  m = c.match(/^(\w+)\.(\w+)\s*=\s*(true|false)$/);
  if (m) return { entity: m[1], field: m[2], op: "=", value: m[3] === "true" };

  // x.field = me.id
  m = c.match(/^(\w+)\.(\w+)\s*=\s*me\.id$/);
  if (m) return { entity: m[1], field: m[2], op: "=", value: { ref: "viewer.id" } };

  // x.field = 'value'
  m = c.match(/^(\w+)\.(\w+)\s*=\s*'([^']*)'$/);
  if (m) return { entity: m[1], field: m[2], op: "=", value: m[3] };

  // x.field != 'value'
  m = c.match(/^(\w+)\.(\w+)\s*!=\s*'([^']*)'$/);
  if (m) return { entity: m[1], field: m[2], op: "!=", value: m[3] };

  // x.field IN ('a','b','c')
  m = c.match(/^(\w+)\.(\w+)\s+IN\s+\(([^)]+)\)$/i);
  if (m) {
    const values = m[3].split(",").map(v => v.trim().replace(/^'|'$/g, ""));
    return { entity: m[1], field: m[2], op: "IN", value: values };
  }

  return null;
}

function parseConditions(strs) {
  if (!Array.isArray(strs)) return [];
  return strs.map(parseCondition).filter(Boolean);
}

module.exports = { parseCondition, parseConditions };
