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
const FORM_CONFIRMATIONS = new Set(["form", "composerEntry", "formModal", "file", "enter", "clickForm", "bulkWizard", "customCapture", "filePicker", "inlineSearch", "drag", "drag-end"]);

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
    if (intent.system) continue;
    const p = intent.particles || {};
    if (p.confirmation === "auto") continue;
    const entities = p.entities || [];
    if (entities.length === 0) continue;
    const conditions = p.conditions || [];
    const effects = p.effects || [];
    const hasTransition = effects.some((e) => e.α === "replace" || e.α === "remove");
    if (hasTransition && conditions.length === 0) {
      gaps.push({ kind: "empty-conditions", intent: name });
    }
  }
  return gaps;
}

// click-подтверждение на известной сущности с чистой status-replace
// не требует явного witness — UI покажет detail сам.
function isContextualStatusReplace(particles) {
  const confirmation = particles.confirmation;
  if (confirmation !== "click") return false;
  const entities = particles.entities || [];
  if (entities.length === 0) return false;
  const effects = particles.effects || [];
  if (effects.length === 0) return false;
  return effects.every((e) => e.α === "replace" || e.α === "remove");
}

export function checkEmptyWitnesses(intents) {
  const gaps = [];
  for (const [name, intent] of Object.entries(intents || {})) {
    if (intent.system) continue;
    const p = intent.particles || {};
    const witnesses = p.witnesses || [];
    const confirmation = p.confirmation;
    if (confirmation === "auto" || confirmation === "drag-end" || confirmation === "drag") continue;
    if (witnesses.length > 0) continue;
    const effects = p.effects || [];
    const entities = p.entities || [];
    if (effects.length === 0 && entities.length === 0) continue;
    if (isContextualStatusReplace(p)) continue;
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

export function auditDomain(domain, ontology, intents) {
  const gaps = [
    ...checkFieldsTyped(ontology),
    ...checkEnumValues(ontology),
    ...checkEntityKind(ontology),
    ...checkRoleBase(ontology),
    ...checkOwnerField(ontology),
    ...checkEmptyConditions(intents),
    ...checkEmptyWitnesses(intents),
    ...checkAntagonistSymmetry(intents),
    ...checkIrreversibility(intents),
    ...checkCreatesConfirmation(intents),
  ];
  const summary = gaps.reduce(
    (acc, g) => ({ ...acc, [g.kind]: (acc[g.kind] || 0) + 1 }),
    { total: gaps.length },
  );
  return { domain, gaps, summary };
}

const ALL_DOMAINS = [
  "workflow", "planning", "messenger", "booking",
  "sales", "invest", "delivery", "lifequest", "reflect", "prilozhenie_otslezhivani",
];

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  const domainArg = args.indexOf("--domain");
  const all = args.includes("--all");
  const domains = all
    ? ALL_DOMAINS
    : domainArg >= 0 ? [args[domainArg + 1]] : [];
  if (domains.length === 0) {
    console.error("usage: node scripts/domain-audit.mjs [--all | --domain <name>]");
    process.exit(2);
  }
  const reports = [];
  for (const d of domains) {
    try {
      const ontoMod = await import(`../src/domains/${d}/ontology.js`);
      const intentsMod = await import(`../src/domains/${d}/intents.js`);
      reports.push(auditDomain(d, ontoMod.ONTOLOGY, intentsMod.INTENTS));
    } catch (err) {
      console.error(`[${d}] import error: ${err.message}`);
    }
  }
  for (const r of reports) {
    console.error(`\n=== ${r.domain} === ${r.summary.total} gaps`);
    for (const [k, v] of Object.entries(r.summary)) {
      if (k !== "total") console.error(`  ${k}: ${v}`);
    }
  }
  console.log(JSON.stringify(reports, null, 2));
}
