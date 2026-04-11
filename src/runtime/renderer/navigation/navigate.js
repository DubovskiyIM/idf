/**
 * Разрешение action-объектов артефакта в вызовы навигации.
 *
 * Action-объект формата:
 *   { action: "navigate", to: "projId", params: { field: "item.id" } }
 *
 * Параметры-шаблоны типа "item.id" резолвятся против item + viewer.
 */

export function resolveNavigateAction(action, item, viewer) {
  if (!action || action.action !== "navigate") return null;
  const resolvedParams = {};
  for (const [key, val] of Object.entries(action.params || {})) {
    if (typeof val === "string" && val.startsWith("item.")) {
      resolvedParams[key] = item?.[val.slice(5)];
    } else if (typeof val === "string" && val.startsWith("viewer.")) {
      resolvedParams[key] = viewer?.[val.slice(7)];
    } else {
      resolvedParams[key] = val;
    }
  }
  return { to: action.to, params: resolvedParams };
}
