/**
 * Утилиты интерпретации артефакта: template-подстановка, резолвинг путей, условия.
 * Извлечены из legacy renderer.jsx для переиспользования.
 */

export function resolve(data, path) {
  if (!path || !data) return undefined;
  if (typeof path !== "string") return path;
  return path.split(".").reduce((obj, key) => obj?.[key], data);
}

export function template(str, ctx) {
  if (typeof str !== "string") return str;
  return str.replace(/\{([\w.]+)\}/g, (_, path) => resolve(ctx, path) ?? "");
}

export function evalCondition(condition, ctx) {
  if (!condition) return true;
  if (typeof condition === "boolean") return condition;
  try {
    const fn = new Function(...Object.keys(ctx), `return !!(${condition})`);
    return fn(...Object.values(ctx));
  } catch (err) {
    console.warn(`[eval] condition parse error: "${condition}"`, err.message);
    return true;
  }
}

/**
 * Проверка доменного условия в формате "entity.field <op> <value>".
 * Используется для фильтрации item-intent кнопок в рантайме.
 *
 * Поддерживаемые форматы:
 *   entity.field = 'value'       → item[field] === value
 *   entity.field = me.id         → item[field] === viewer.id
 *   entity.field = true/false    → item[field] === true/false
 *   entity.field != 'value'      → item[field] !== value
 *   entity.field = null          → item[field] == null
 *   entity.field IN ('a','b')    → values.includes(item[field])
 */
export function evalIntentCondition(conditionStr, item, viewer) {
  if (!conditionStr) return true;
  const c = conditionStr.trim();

  // entity.field = 'value' | true | false | null | me.id
  const mEq = c.match(/^(\w+)\.(\w+)\s*=\s*(.+)$/);
  if (mEq && !mEq[3].startsWith("!")) {
    const field = mEq[2];
    const rhsRaw = mEq[3].trim();
    const lhs = item?.[field];
    const rhs = parseLiteral(rhsRaw, viewer);
    if (rhs === "__me_id__") return lhs === viewer?.id;
    if (rhsRaw === "null") return lhs == null;
    return lhs === rhs;
  }

  // entity.field != 'value'
  const mNeq = c.match(/^(\w+)\.(\w+)\s*!=\s*(.+)$/);
  if (mNeq) {
    const field = mNeq[2];
    const rhs = parseLiteral(mNeq[3].trim(), viewer);
    return item?.[field] !== rhs;
  }

  // entity.field IN ('a','b','c')
  const mIn = c.match(/^(\w+)\.(\w+)\s+IN\s+\(([^)]+)\)$/i);
  if (mIn) {
    const field = mIn[2];
    const values = mIn[3].split(",").map(v => parseLiteral(v.trim(), viewer));
    return values.includes(item?.[field]);
  }

  // Неизвестный формат — не блокируем
  return true;
}

function parseLiteral(raw, viewer) {
  if (raw === "me.id") return "__me_id__";
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  const m = raw.match(/^'([^']*)'$/);
  if (m) return m[1];
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

/**
 * Вычисляет computed witness — агрегатное выражение count()/ratio().
 * Reuse синтаксиса из conditionParser, но возвращает число (не boolean).
 */
export function computeWitness(expr, targetId, world) {
  if (!expr || !world) return null;
  const c = expr.trim();

  // count(collection, foreignKey=target.id)
  const mCount = c.match(/^count\((\w+),\s*(\w+)=target\.id\)$/);
  if (mCount) {
    const [, collection, fkField] = mCount;
    return (world[collection] || []).filter(item => item[fkField] === targetId).length;
  }

  // ratio(collection.distinctField, totalCollection, foreignKey=target.id)
  const mRatio = c.match(/^ratio\((\w+)\.(\w+),\s*(\w+),\s*(\w+)=target\.id\)$/);
  if (mRatio) {
    const [, collection, distinctField, totalCollection, fkField] = mRatio;
    const filtered = (world[collection] || []).filter(item => item[fkField] === targetId);
    const total = (world[totalCollection] || []).filter(item => item[fkField] === targetId).length;
    if (total === 0) return null;
    const distinct = new Set(filtered.map(item => item[distinctField])).size;
    return distinct / total;
  }

  return null;
}

export function resolveParams(params, data) {
  if (!params) return {};
  const resolved = {};
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === "string" && val.startsWith("item.")) {
      resolved[key] = resolve(data.item || data, val.replace("item.", ""));
    } else if (typeof val === "string" && val.startsWith("viewer.")) {
      resolved[key] = resolve(data.viewer || data, val.replace("viewer.", ""));
    } else {
      resolved[key] = val;
    }
  }
  return resolved;
}
