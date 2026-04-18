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

const DESTRUCTIVE_STATUSES = new Set(["archived", "deleted", "cancelled", "blocked", "closed", "abandoned", "rejected"]);
const FORM_CONFIRMATIONS = new Set(["form", "composerEntry", "formModal", "file", "enter", "clickForm", "bulkWizard", "customCapture", "filePicker", "inlineSearch"]);

export function checkAntagonistSymmetry(intents) {
  const gaps = [];
  const names = new Set(Object.keys(intents || {}));
  for (const [name, intent] of Object.entries(intents || {})) {
    const a = intent.antagonist;
    if (!a) continue;
    if (!names.has(a)) {
      gaps.push({ kind: "antagonist-missing-target", intent: name, target: a });
      continue;
    }
    const other = intents[a];
    if (other.antagonist !== name) {
      gaps.push({ kind: "antagonist-asymmetry", intent: a, expected: name });
    }
  }
  return gaps;
}

export function checkIrreversibility(intents) {
  const gaps = [];
  for (const [name, intent] of Object.entries(intents || {})) {
    if (intent.irreversibility) continue;
    const effects = intent.particles?.effects || [];
    const hasRemove = effects.some((e) => e.α === "remove");
    const hasStatusKill = effects.some(
      (e) => e.α === "replace" && /\.status$/.test(e.target || "") && DESTRUCTIVE_STATUSES.has(e.value),
    );
    if (hasRemove || hasStatusKill) {
      gaps.push({ kind: "irreversibility-missing", intent: name });
    }
  }
  return gaps;
}

export function checkCreatesConfirmation(intents) {
  const gaps = [];
  for (const [name, intent] of Object.entries(intents || {})) {
    if (!intent.creates) continue;
    const c = intent.particles?.confirmation;
    if (!c) continue;
    if (!FORM_CONFIRMATIONS.has(c)) {
      gaps.push({ kind: "creates-needs-form", intent: name });
    }
  }
  return gaps;
}

export function checkEmptyConditions(intents) {
  const gaps = [];
  for (const [name, intent] of Object.entries(intents || {})) {
    if (intent.creates) continue;
    const p = intent.particles || {};
    const conditions = p.conditions || [];
    const effects = p.effects || [];
    const hasTransition = effects.some((e) => e.α === "replace" || e.α === "remove");
    if (hasTransition && conditions.length === 0) {
      gaps.push({ kind: "empty-conditions", intent: name });
    }
  }
  return gaps;
}

export function checkEmptyWitnesses(intents) {
  const gaps = [];
  for (const [name, intent] of Object.entries(intents || {})) {
    const p = intent.particles || {};
    const witnesses = p.witnesses || [];
    const confirmation = p.confirmation;
    if (confirmation === "auto" || confirmation === "drag-end" || confirmation === "drag") continue;
    if (witnesses.length > 0) continue;
    const effects = p.effects || [];
    const entities = p.entities || [];
    if (effects.length === 0 && entities.length === 0) continue;
    gaps.push({ kind: "empty-witnesses", intent: name });
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
