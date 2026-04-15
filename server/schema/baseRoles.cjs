/**
 * @intent-driven/core re-export (v0.2.0).
 * Реализация в SDK: packages/core/src/baseRoles.js.
 */
const {
  BASE_ROLES,
  validateBase,
  getRolesByBase,
  isAgentRole,
  isObserverRole,
  isOwnerRole,
  auditOntologyRoles,
} = require("@intent-driven/core");

module.exports = {
  BASE_ROLES,
  validateBase,
  getRolesByBase,
  isAgentRole,
  isObserverRole,
  isOwnerRole,
  auditOntologyRoles,
};
