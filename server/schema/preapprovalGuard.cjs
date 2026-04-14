/**
 * preapprovalGuard — декларативный проверщик preapproval для agent-
 * intents (§26.2 закрытие).
 *
 * Контракт: ontology.roles.agent.preapproval описывает
 *   { entity, ownerField, requiredFor: [intentIds], checks: [...] }
 *
 * checks — массив предикатов, каждый со свой `kind`:
 *
 *   { kind: "active", field: "active" }
 *     — preapproval[field] должно быть truthy
 *
 *   { kind: "notExpired", field: "expiresAt" }
 *     — preapproval[field] > now (или нет поля = бессрочно)
 *
 *   { kind: "maxAmount", paramField, limitField }
 *     — params[paramField] <= preapproval[limitField]
 *
 *   { kind: "csvInclude", paramField, limitField, allowEmpty? }
 *     — params[paramField] ∈ CSV-list в preapproval[limitField]
 *       Если allowEmpty и limitField пустой → всегда проходит.
 *
 *   { kind: "dailySum", paramField, limitField,
 *     sumCollection, sumField, sumOwnerField, sumTimestampField,
 *     sumFilter? }
 *     — sum([r[sumField] for r in world[sumCollection]
 *             if r[sumOwnerField] === viewer.id
 *                and r[sumTimestampField] > startOfDay
 *                and (sumFilter condition)])
 *       + params[paramField] <= preapproval[limitField]
 *
 * Возвращает:
 *   { ok: true }
 *   | { ok: false, reason: "no_preapproval" | "check_failed", failedCheck, details }
 *
 * Если intent не в requiredFor — всегда { ok: true } (нет preapproval-
 * требования — значит проверять нечего, pass через).
 */

function pluralize(word) {
  if (!word) return word;
  if (word.endsWith("y")) return word.slice(0, -1) + "ies";
  if (word.endsWith("s")) return word + "es";
  return word + "s";
}

function getPreapprovalRow(world, config, viewer) {
  const collection = pluralize(config.entity.toLowerCase());
  const rows = world[collection] || [];
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
      if (exp == null) return { ok: true }; // бессрочно
      const now = Date.now();
      if (Number(exp) > now) return { ok: true };
      return { ok: false, reason: "expired", field: check.field, expiresAt: exp, now };
    }

    case "maxAmount": {
      const paramVal = Number(params[check.paramField]);
      const limitVal = Number(preapproval[check.limitField]);
      if (!isFinite(paramVal) || paramVal <= 0) {
        return { ok: false, reason: "invalid_param", paramField: check.paramField, value: params[check.paramField] };
      }
      if (!isFinite(limitVal)) {
        return { ok: true }; // лимит не задан = не ограничиваем
      }
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

/**
 * Главная точка входа.
 * @param intentId {string}
 * @param params {object} — resolved params intent'а (possibly с derived)
 * @param viewer {object} — { id, name, ... }
 * @param ontology {object} — full domain ontology
 * @param world {object} — folded world
 * @param roleName {string} — обычно "agent"
 * @returns { ok: bool, reason?: string, failedCheck?: object, details?: object }
 */
function checkPreapproval(intentId, params, viewer, ontology, world, roleName = "agent") {
  const config = ontology?.roles?.[roleName]?.preapproval;
  if (!config) return { ok: true }; // нет preapproval-требований

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
