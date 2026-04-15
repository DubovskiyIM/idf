/**
 * Irreversibility — effect-level marker необратимости (§6 field-test-11).
 *
 * Хранится в context.__irr как структура { point, at, reason }:
 *   - point: "high" | "medium" | "low" | "none" — степень необратимости
 *   - at: timestamp | null — момент фактического перехода в необратимость
 *     (null значит "point декларирован, но переход ещё не произошёл",
 *      например payment-hold до capture)
 *   - reason: string | null — человекочитаемое основание
 *
 * Zero-migration: живёт в context JSON, не требует ALTER TABLE.
 * Integrity rule читает hasIrreversiblePast по истории эффектов сущности.
 */

const IRR_POINT_HIGH = "high";
const IRR_POINT_MEDIUM = "medium";
const IRR_POINT_LOW = "low";
const IRR_POINT_NONE = "none";

function parseContextSafe(ctx) {
  if (ctx == null) return null;
  if (typeof ctx !== "string") return ctx;
  try {
    return JSON.parse(ctx);
  } catch {
    return null;
  }
}

/**
 * Достать irreversibility-объект из эффекта. null если нет.
 */
function getIrreversibility(effect) {
  if (!effect) return null;
  const ctx = parseContextSafe(effect.context);
  if (!ctx || typeof ctx !== "object") return null;
  return ctx.__irr || null;
}

/**
 * Проверить, содержит ли history хотя бы один эффект с
 * irreversibility.point === "high" && at !== null.
 */
function hasIrreversiblePast(history) {
  if (!Array.isArray(history) || history.length === 0) return false;
  for (const ef of history) {
    const irr = getIrreversibility(ef);
    if (!irr) continue;
    if (irr.point === IRR_POINT_HIGH && irr.at != null) return true;
  }
  return false;
}

/**
 * Вставить __irr в context (immutably). Возвращает новый объект/строку
 * того же типа, что на входе.
 */
function mergeIntoContext(ctx, irr) {
  const wasString = typeof ctx === "string";
  const parsed = parseContextSafe(ctx) || {};
  const merged = { ...parsed, __irr: { ...irr } };
  return wasString ? JSON.stringify(merged) : merged;
}

module.exports = {
  getIrreversibility,
  hasIrreversiblePast,
  mergeIntoContext,
  IRR_POINT_HIGH,
  IRR_POINT_MEDIUM,
  IRR_POINT_LOW,
  IRR_POINT_NONE,
};
