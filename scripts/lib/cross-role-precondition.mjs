/**
 * Cross-role precondition analyzer (sheaf-formulation §2.12b operational extract).
 *
 * Контекст. В §2.12 sheaf-формулировке целостности класс багов H¹-нарушения =
 * локально валидные правила, не складывающиеся в глобально согласованное
 * состояние. Один из практически ловимых подклассов: intent в canExecute
 * роли, но precondition ссылается на поле, которое роль не может прочитать.
 *
 * Формально:
 *   ∀ intent, ∀ role: intent ∈ role.canExecute →
 *     ∀ (entity, field) ∈ refs(intent.precondition):
 *       field ∈ visibleFields(role, entity)
 *
 * Контрпример: agent.canExecute содержит run_workflow_manual с
 * precondition `Workflow.status === "active"`, но agent.visibleFields не
 * содержит Workflow.status. На запросе action будет necessarily ложным
 * (filterWorldForRole отфильтрует поле до evaluation), что приводит к
 * silent permanent rejection — самый коварный класс багов в role layer.
 *
 * Полиномиальный pass без когомологии. Поддерживает обе формы
 * precondition: object {Entity.field: [allowed]} и string-expression.
 */

function normalizeFields(fields) {
  if (!fields) return [];
  if (Array.isArray(fields)) {
    return fields.map((f) => (typeof f === "string" ? { name: f, type: "text" } : f));
  }
  return Object.entries(fields).map(([name, def]) => ({ name, ...(def || {}) }));
}

function finding(severity, axis, message, details = {}) {
  return { severity, axis, message, details };
}

export function extractPreconditionFieldRefs(precondition) {
  const refs = [];
  if (!precondition) return refs;

  if (typeof precondition === "object" && !Array.isArray(precondition)) {
    for (const key of Object.keys(precondition)) {
      const m = /^([A-Z][\w]*)\.(\w+)$/.exec(key);
      if (m) refs.push({ entity: m[1], field: m[2] });
    }
    return refs;
  }

  if (typeof precondition === "string") {
    const re = /\b([A-Z][\w]*)\.(\w+)\b/g;
    let m;
    while ((m = re.exec(precondition)) !== null) {
      refs.push({ entity: m[1], field: m[2] });
    }
    return refs;
  }

  return refs;
}

export function rolesThatCanExecute(intentId, roles) {
  const out = [];
  for (const [roleName, roleDef] of Object.entries(roles || {})) {
    if (Array.isArray(roleDef.canExecute) && roleDef.canExecute.includes(intentId)) {
      out.push([roleName, roleDef]);
    }
  }
  return out;
}

export function isFieldVisibleToRole(roleDef, entity, field) {
  if (roleDef.base === "admin") return true; // admin видит всё row-override
  const visMap = roleDef.visibleFields || {};
  const list = visMap[entity];
  if (list === undefined) return false;
  if (!Array.isArray(list)) return false;
  if (list.includes("*")) return true;
  return list.includes(field);
}

/**
 * Audit cross-role precondition consistency.
 *
 * @param {object} domain — { ontology, intents, projections, id }
 * @returns {{ findings: Array, metrics: { intentsWithPrecondition, preconditionFieldRefs, checksRun } }}
 */
export function auditCrossRolePrecondition(domain) {
  const findings = [];
  const intents = domain.intents || {};
  const roles = domain.ontology?.roles || {};
  const entities = domain.ontology?.entities || {};

  let intentsWithPrecondition = 0;
  let totalRefs = 0;
  let totalChecks = 0;

  for (const [intentId, intent] of Object.entries(intents)) {
    const refs = extractPreconditionFieldRefs(intent.precondition);
    if (refs.length === 0) continue;
    intentsWithPrecondition++;
    totalRefs += refs.length;

    const execRoles = rolesThatCanExecute(intentId, roles);
    if (execRoles.length === 0) continue;

    for (const [roleName, roleDef] of execRoles) {
      for (const { entity, field } of refs) {
        totalChecks++;

        // Если entity не в онтологии — это другая ось ловит, skip
        if (!entities[entity]) continue;

        // Если поле не существует в entity — не наша ответственность
        const entityFields = normalizeFields(entities[entity].fields);
        const fieldExists = entityFields.some((f) => f.name === field);
        if (!fieldExists) continue;

        if (!isFieldVisibleToRole(roleDef, entity, field)) {
          findings.push(
            finding(
              "warning",
              "crossRolePrecondition",
              `Intent "${intentId}" в canExecute роли "${roleName}", но precondition ссылается на ${entity}.${field}, которое роль не видит (visibleFields не содержит)`,
              { intentId, role: roleName, entity, field }
            )
          );
        }
      }
    }
  }

  return {
    findings,
    metrics: {
      intentsWithPrecondition,
      preconditionFieldRefs: totalRefs,
      checksRun: totalChecks,
    },
  };
}
