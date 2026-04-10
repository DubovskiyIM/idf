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
  } catch {
    return true;
  }
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
