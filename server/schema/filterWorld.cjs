/**
 * filterWorldForRole — viewer-scoping для ролей (§5 + §26.1 m2m).
 *
 * Inline-implementation (не thin re-export) до релиза SDK с fix'ом для
 * camelCase collection names (AgentPreapproval → agentPreapprovals,
 * RiskProfile → riskProfiles). Синхронизовано с
 * idf-sdk/packages/core/src/filterWorld.js — когда SDK v0.10+ выйдет,
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

// Поиск: camelCase > lowercase > last-segment (booking legacy `slots`).
// outputName = всегда canonical camelPlural — это public API namespace, агент
// не должен знать про внутренние legacy-формы домена.
function findCollection(rawWorld, entityName) {
  const camelPlural = camelPluralize(entityName);
  const lowerPlural = pluralize(entityName.toLowerCase());
  const candidates = [camelPlural];
  if (lowerPlural !== camelPlural) candidates.push(lowerPlural);
  const segments = entityName.match(/[A-Z][a-z]*/g) || [];
  if (segments.length > 1) {
    const lastPlural = pluralize(segments[segments.length - 1].toLowerCase());
    if (!candidates.includes(lastPlural)) candidates.push(lastPlural);
  }
  for (const cand of candidates) {
    if (Array.isArray(rawWorld[cand])) {
      return { outputName: camelPlural, rows: rawWorld[cand] };
    }
  }
  return { outputName: camelPlural, rows: [] };
}

function resolveAllowedIds(rawWorld, scope, viewer) {
  if (!scope?.via || !scope.viewerField || !scope.joinField) return null;
  const bridge = rawWorld[scope.via];
  if (!Array.isArray(bridge)) return new Set();

  const allowedStatuses = Array.isArray(scope.statusAllowed) && scope.statusAllowed.length > 0
    ? new Set(scope.statusAllowed)
    : null;

  const ids = new Set();
  for (const m of bridge) {
    if (m[scope.viewerField] !== viewer.id) continue;
    if (allowedStatuses && scope.statusField && !allowedStatuses.has(m[scope.statusField])) continue;
    const joinVal = m[scope.joinField];
    if (joinVal != null) ids.add(joinVal);
  }
  return ids;
}

function filterWorldForRole(rawWorld, ontology, roleName, viewer) {
  const role = ontology?.roles?.[roleName];
  if (!role) throw new Error(`Role "${roleName}" не найдена в ontology`);

  const visibleFields = role.visibleFields || {};
  const statusMapping = role.statusMapping || {};
  const scopes = role.scope || {};
  const filtered = {};

  for (const [entityName, entityDef] of Object.entries(ontology.entities || {})) {
    const allowed = visibleFields[entityName];
    if (!allowed) continue;

    const { outputName, rows } = findCollection(rawWorld, entityName);

    let owned;
    const scope = scopes[entityName];
    if (scope && scope.via) {
      const allowedIds = resolveAllowedIds(rawWorld, scope, viewer);
      const localField = scope.localField || entityDef.ownerField;
      if (!localField) {
        owned = [];
      } else {
        owned = rows.filter(r => allowedIds.has(r[localField]));
      }
    } else if (entityDef.kind === "reference") {
      owned = rows;
    } else if (entityDef.ownerField) {
      owned = rows.filter(r => r[entityDef.ownerField] === viewer.id);
    } else {
      owned = rows;
    }

    const allowAll = allowed === "all";
    const projected = owned.map(row => {
      if (allowAll) {
        const out = { ...row };
        if (out.status && statusMapping[out.status]) out.status = statusMapping[out.status];
        return out;
      }
      const out = {};
      for (const field of allowed) {
        let val = row[field];
        if (field === "status" && statusMapping[val]) val = statusMapping[val];
        if (val !== undefined) out[field] = val;
      }
      return out;
    });

    filtered[outputName] = projected;
  }

  return filtered;
}

module.exports = { filterWorldForRole };
