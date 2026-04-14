/**
 * Global invariants checker — ∀-свойства world-state после fold(Φ).
 *
 * Контракт: ontology.invariants — массив { name, kind, severity?, ... }.
 * Dispatch по kind, каждый handler возвращает массив violations.
 *
 * Возврат: { ok: bool, violations: [{name, kind, severity, message, details}] }.
 * ok=false только если есть хотя бы один violation с severity:"error".
 *
 * Пустые/отсутствующие invariants → ok:true, пустой violations.
 *
 * См. план: docs/superpowers/plans/2026-04-14-global-invariants.md
 */

const { handler: roleCapability } = require("./invariants/roleCapability.cjs");

const KIND_HANDLERS = {
  "role-capability": roleCapability,
};

function registerKind(name, handler) {
  KIND_HANDLERS[name] = handler;
}

function checkInvariants(world, ontology, opts = {}) {
  const invariants = Array.isArray(ontology?.invariants) ? ontology.invariants : [];
  const violations = [];

  for (const inv of invariants) {
    const severity = inv.severity || "error";
    const handler = KIND_HANDLERS[inv.kind];

    if (!handler) {
      violations.push({
        name: inv.name,
        kind: inv.kind,
        severity,
        message: `Неизвестный kind инварианта: "${inv.kind}"`,
        details: { reason: "unknown_kind" },
      });
      continue;
    }

    try {
      const found = handler(inv, world, ontology, opts) || [];
      for (const v of found) {
        violations.push({
          name: inv.name,
          kind: inv.kind,
          severity,
          message: v.message,
          details: v.details || {},
        });
      }
    } catch (e) {
      violations.push({
        name: inv.name,
        kind: inv.kind,
        severity: "error",
        message: `Ошибка исполнения инварианта: ${e.message}`,
        details: { reason: "handler_threw", error: String(e) },
      });
    }
  }

  const hasError = violations.some(v => v.severity === "error");
  return { ok: !hasError, violations };
}

module.exports = { checkInvariants, registerKind, KIND_HANDLERS };
