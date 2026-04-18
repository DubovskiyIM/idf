/**
 * Domain audit — проверяет домены на соответствие планке lifequest.
 *
 * 10 проверок: онтология (5) + интенты (5). Возвращает gaps-объекты
 * с полем `kind`. CLI: `node scripts/domain-audit.mjs --all | --domain <name>`.
 *
 * Spec: docs/superpowers/specs/2026-04-18-domains-to-lifequest-bar-design.md
 */

export function checkFieldsTyped(ontology) {
  const gaps = [];
  for (const [name, entity] of Object.entries(ontology.entities || {})) {
    if (Array.isArray(entity.fields)) {
      gaps.push({ kind: "fields-array-form", entity: name });
    }
  }
  return gaps;
}

const ALLOWED_BASE = new Set(["owner", "viewer", "agent", "observer"]);
const OWNER_CANDIDATES = ["userId", "ownerId", "authorId", "createdBy"];

export function checkEntityKind(ontology) {
  const gaps = [];
  for (const [name, entity] of Object.entries(ontology.entities || {})) {
    if (!entity.type) gaps.push({ kind: "entity-no-type", entity: name });
  }
  return gaps;
}

export function checkRoleBase(ontology) {
  const gaps = [];
  for (const [name, role] of Object.entries(ontology.roles || {})) {
    if (!role.base) gaps.push({ kind: "role-no-base", role: name });
    else if (!ALLOWED_BASE.has(role.base)) gaps.push({ kind: "role-bad-base", role: name, value: role.base });
  }
  return gaps;
}

export function checkOwnerField(ontology) {
  const gaps = [];
  for (const [entityName, entity] of Object.entries(ontology.entities || {})) {
    if (entity.type && entity.type !== "internal") continue;
    if (entity.ownerField) continue;
    if (Array.isArray(entity.fields)) {
      const found = entity.fields.find((f) => OWNER_CANDIDATES.includes(f));
      if (found) gaps.push({ kind: "owner-field-missing", entity: entityName, candidate: found });
      continue;
    }
    const found = OWNER_CANDIDATES.find((c) => entity.fields && entity.fields[c]);
    if (found) gaps.push({ kind: "owner-field-missing", entity: entityName, candidate: found });
  }
  return gaps;
}

export function checkEnumValues(ontology) {
  const gaps = [];
  for (const [entityName, entity] of Object.entries(ontology.entities || {})) {
    if (Array.isArray(entity.fields)) continue;
    for (const [fieldName, field] of Object.entries(entity.fields || {})) {
      if (field.type !== "enum") continue;
      if (!Array.isArray(field.values) || field.values.length === 0) {
        gaps.push({ kind: "enum-no-values", entity: entityName, field: fieldName });
      } else if (!field.valueLabels || typeof field.valueLabels !== "object") {
        gaps.push({ kind: "enum-no-valueLabels", entity: entityName, field: fieldName });
      }
    }
  }
  return gaps;
}
