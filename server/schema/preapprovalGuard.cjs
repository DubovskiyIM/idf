/**
 * preapprovalGuard — декларативный проверщик preapproval (§26.2).
 *
 * Inline-implementation (не thin re-export) до релиза SDK с fix'ом для
 * camelCase collection names. Синхронизовано с
 * idf-sdk/packages/core/src/preapprovalGuard.js — когда SDK v0.10+ выйдет,
 * вернуть thin re-export `require("@intent-driven/core")`.
 */

function pluralize(word) {
  if (!word) return word;
  if (word.endsWith("y")) return word.slice(0, -1) + "ies";
  if (word.endsWith("s")) return word + "es";
  return word + "s";
}

function camelPluralize(entityName) {
  if (!entityName) return entityName;
  const head = entityName[0].toLowerCase() + entityName.slice(1);
  return pluralize(head);
}

function findCollectionRows(world, entityName) {
  const candidates = [
    camelPluralize(entityName),
    pluralize(entityName.toLowerCase()),
  ];
  for (const key of candidates) {
    if (Array.isArray(world[key])) return world[key];
  }
  return [];
}

function getPreapprovalRow(world, config, viewer) {
  const rows = findCollectionRows(world, config.entity);
  return rows.find(r => r[config.ownerField] === viewer.id);
}

function parseCsv(val) {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    return val.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function checkPredicate(check, preapproval, params, world, viewer) {
  switch (check.kind) {
    case "active": {
      const val = preapproval[check.field];
      if (val === true || val === "true" || val === 1) return { ok: true };
      return { ok: false, reason: "inactive", field: check.field, value: val };
    }

    case "notExpired": {
      const exp = preapproval[check.field];
      if (exp == null) return { ok: true };
      const expMs = typeof exp === "number" ? exp : Date.parse(exp);
      if (!Number.isFinite(expMs)) {
        return { ok: false, reason: "invalid_expiresAt", field: check.field, value: exp };
      }
      const now = Date.now();
      if (expMs > now) return { ok: true };
      return { ok: false, reason: "expired", field: check.field, expiresAt: exp, now };
    }

    case "maxAmount": {
      const paramVal = Number(params[check.paramField]);
      const limitVal = Number(preapproval[check.limitField]);
      if (!isFinite(paramVal) || paramVal <= 0) {
        return { ok: false, reason: "invalid_param", paramField: check.paramField, value: params[check.paramField] };
      }
      if (!isFinite(limitVal)) return { ok: true };
      if (paramVal <= limitVal) return { ok: true };
      return { ok: false, reason: "amount_exceeded", paramField: check.paramField,
               value: paramVal, limit: limitVal };
    }

    case "csvInclude": {
      const paramVal = params[check.paramField];
      const list = parseCsv(preapproval[check.limitField]);
      if (list.length === 0) {
        if (check.allowEmpty) return { ok: true };
        return { ok: false, reason: "scope_empty", limitField: check.limitField };
      }
      if (paramVal != null && list.includes(String(paramVal))) return { ok: true };
      return { ok: false, reason: "not_in_scope", paramField: check.paramField,
               value: paramVal, allowed: list };
    }

    case "dailySum": {
      const paramVal = Number(params[check.paramField]) || 0;
      const limitVal = Number(preapproval[check.limitField]);
      if (!isFinite(limitVal)) return { ok: true };

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startMs = startOfDay.getTime();

      const rows = world[check.sumCollection] || [];
      const sumFilter = check.sumFilter;
      const todayOwn = rows.filter(r => {
        if (r[check.sumOwnerField] !== viewer.id) return false;
        if (Number(r[check.sumTimestampField]) < startMs) return false;
        if (sumFilter && r[sumFilter.field] !== sumFilter.equals) return false;
        return true;
      });

      const alreadyToday = todayOwn.reduce((s, r) => s + (Number(r[check.sumField]) || 0), 0);
      const projected = alreadyToday + paramVal;

      if (projected <= limitVal) return { ok: true };
      return { ok: false, reason: "daily_limit_exceeded",
               alreadyToday, projected, limit: limitVal };
    }

    default:
      return { ok: false, reason: "unknown_check_kind", kind: check.kind };
  }
}

function checkPreapproval(intentId, params, viewer, ontology, world, roleName = "agent") {
  const config = ontology?.roles?.[roleName]?.preapproval;
  if (!config) return { ok: true };

  const requiredFor = Array.isArray(config.requiredFor) ? config.requiredFor : [];
  if (!requiredFor.includes(intentId)) return { ok: true };

  const preapproval = getPreapprovalRow(world, config, viewer);
  if (!preapproval) {
    return { ok: false, reason: "no_preapproval",
             details: { entity: config.entity, ownerField: config.ownerField, viewerId: viewer.id } };
  }

  const checks = Array.isArray(config.checks) ? config.checks : [];
  for (const check of checks) {
    const result = checkPredicate(check, preapproval, params, world, viewer);
    if (!result.ok) {
      return { ok: false, reason: "check_failed", failedCheck: check.kind, details: result };
    }
  }

  return { ok: true, preapprovalId: preapproval.id };
}

module.exports = { checkPreapproval };
