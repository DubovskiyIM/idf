/**
 * Invariant kind: "role-capability".
 * Проверяет capability-contract на доменных ролях.
 *
 * Параметры:
 *   role: string — имя роли ИЛИ base-маркер ("owner"|"viewer"|"agent"|"observer")
 *   require.canExecute: "empty" | "non-empty"
 *
 * Если role совпадает с base-маркером — проверяются ВСЕ роли с этим base.
 * Иначе — роль ищется по имени.
 */

const BASE_MARKERS = new Set(["owner", "viewer", "agent", "observer"]);

function findTargetRoles(roleKey, ontology) {
  const roles = ontology?.roles || {};
  if (BASE_MARKERS.has(roleKey)) {
    const matches = Object.entries(roles).filter(([, def]) => def?.base === roleKey);
    if (matches.length === 0 && !roles[roleKey]) return { found: false };
    return { found: true, entries: matches };
  }
  if (roles[roleKey]) return { found: true, entries: [[roleKey, roles[roleKey]]] };
  return { found: false };
}

function checkCanExecute(roleName, roleDef, requirement) {
  const ce = roleDef?.canExecute;
  const isEmpty = !ce || (Array.isArray(ce) && ce.length === 0);
  if (requirement === "empty" && !isEmpty) {
    return {
      message: `Роль "${roleName}" должна иметь пустой canExecute`,
      details: { role: roleName, canExecute: ce, expected: "empty" },
    };
  }
  if (requirement === "non-empty" && isEmpty) {
    return {
      message: `Роль "${roleName}" должна иметь непустой canExecute`,
      details: { role: roleName, canExecute: ce, expected: "non-empty" },
    };
  }
  return null;
}

function handler(inv, world, ontology) {
  const target = findTargetRoles(inv.role, ontology);
  if (!target.found) {
    return [{
      message: `Роль "${inv.role}" не найдена в ontology.roles`,
      details: { reason: "role_not_found", role: inv.role },
    }];
  }

  const violations = [];
  const req = inv.require || {};
  for (const [name, def] of target.entries) {
    if ("canExecute" in req) {
      const v = checkCanExecute(name, def, req.canExecute);
      if (v) violations.push(v);
    }
  }
  return violations;
}

module.exports = { handler };
