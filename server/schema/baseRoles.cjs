/**
 * Унифицированный вокабуляр ролей (§5, v1.6 roadmap).
 *
 * Четыре базовые роли описывают **таксономические паттерны** доступа,
 * не заменяют доменные имена. Каждое domain-role помечается `base:`,
 * что даёт:
 *   1. Cross-domain инструменты (агент-smoke, audit-helpers) работают
 *      по семантическому классу, а не по имени.
 *   2. SDK провайдит sensible defaults для common case'ов.
 *   3. Авторы доменов узнают паттерн — «этот класс как owner из booking».
 *
 * **Важно:** base — метаданные, не override. Domain сохраняет свои
 * `canExecute` / `visibleFields` / `scope` / `preapproval` полностью.
 * Несовпадение base c фактическими правами — warning, не ошибка.
 *
 * Семантика базовых ролей:
 *
 * ─── owner ────────────────────────────────────────────────
 *   Самоакторный участник с CRUD над своими сущностями.
 *   Доступ: `row[ownerField] === viewer.id` (single-owner) или
 *           `role.scope` для m2m (advisor ↔ clients).
 *   Примеры: booking.client, meshok.buyer/seller, invest.investor,
 *            messenger.self, invest.advisor (owner of assignments).
 *
 * ─── viewer ───────────────────────────────────────────────
 *   Связанный читатель с минимальным write (голосование, reactions).
 *   Видит сущности по explicit-связи (contact, participant), не owner.
 *   Примеры: messenger.contact, planning.participant (voter),
 *            meshok.moderator (read-most, write-on-moderated).
 *
 * ─── agent ────────────────────────────────────────────────
 *   Автоматический актор (LLM-бот, human-agent, rule engine) с
 *   JWT-scope, canExecute whitelist, опциональным preapproval guard.
 *   Примеры: agent-роль всех 8 доменов.
 *
 * ─── observer ─────────────────────────────────────────────
 *   Read-only аудит: регулятор, compliance, read-only share.
 *   visibleFields полные, canExecute пустой. Обычно вместе с
 *   document-материализацией для PDF-отчётов.
 *   Примеры: invest.observer (регулятор audit-trail'а).
 */

const BASE_ROLES = Object.freeze(["owner", "viewer", "agent", "observer"]);

/**
 * Проверка, что domain-role имеет валидный `base`.
 * Возвращает { ok: true } | { ok: false, reason, got, allowed }.
 */
function validateBase(roleDef) {
  if (!roleDef || typeof roleDef !== "object") {
    return { ok: false, reason: "role_not_object" };
  }
  if (!("base" in roleDef)) {
    return { ok: false, reason: "base_missing" };
  }
  if (!BASE_ROLES.includes(roleDef.base)) {
    return {
      ok: false, reason: "base_invalid",
      got: roleDef.base, allowed: BASE_ROLES,
    };
  }
  return { ok: true };
}

/**
 * Возвращает массив имён domain-ролей с заданным base.
 * Используется cross-domain инструментами.
 */
function getRolesByBase(ontology, base) {
  if (!ontology?.roles || typeof ontology.roles !== "object") return [];
  return Object.entries(ontology.roles)
    .filter(([_, def]) => def?.base === base)
    .map(([name]) => name);
}

/**
 * Семантический helper — это agent-роль?
 * Используется agent-layer: любая роль с base:"agent" достижима через
 * /api/agent/:domain/* (при наличии canExecute).
 */
function isAgentRole(roleDef) {
  return roleDef?.base === "agent";
}

/**
 * Семантический helper — это read-only observer?
 * Используется document-материализатором и audit-helpers:
 * observer-роль по умолчанию получает расширенные visibleFields,
 * но canExecute должен быть пустым.
 */
function isObserverRole(roleDef) {
  if (roleDef?.base !== "observer") return false;
  // Observer-invariant: canExecute пустой или отсутствует.
  const ce = roleDef.canExecute;
  return !ce || (Array.isArray(ce) && ce.length === 0);
}

/**
 * Семантический helper — это owner-роль?
 * Owner должен иметь entity.ownerField на своих сущностях.
 */
function isOwnerRole(roleDef) {
  return roleDef?.base === "owner";
}

/**
 * Формальный invariant-check для ontology: проверяет, что все роли
 * имеют валидный `base`, и observer-инвариант соблюдён.
 *
 * Возвращает { ok, errors: [{role, reason, ...}] }.
 * Ошибки — не fatal; используется на авторском/lint уровне.
 */
function auditOntologyRoles(ontology) {
  const errors = [];
  const roles = ontology?.roles || {};
  for (const [name, def] of Object.entries(roles)) {
    const v = validateBase(def);
    if (!v.ok) {
      errors.push({ role: name, ...v });
    } else if (def.base === "observer") {
      if (def.canExecute && Array.isArray(def.canExecute) && def.canExecute.length > 0) {
        errors.push({
          role: name, reason: "observer_has_canExecute",
          canExecute: def.canExecute,
        });
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  BASE_ROLES,
  validateBase,
  getRolesByBase,
  isAgentRole,
  isObserverRole,
  isOwnerRole,
  auditOntologyRoles,
};
