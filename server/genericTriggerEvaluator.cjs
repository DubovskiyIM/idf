/**
 * Generic trigger evaluator для ref-candidates.
 *
 * Pattern-researcher выкатывает паттерны как plain JSON с trigger.requires[],
 * без runable trigger.match(). Kind'ы — open-vocabulary ("entity-field",
 * "intent-effect", "mirror", "session", "timeslot-like" и др.). SDK registry
 * их строго валидирует через whitelist, поэтому stable evaluateTriggerExplained
 * не работает.
 *
 * Этот evaluator делает best-effort match каждого require'а против реальной
 * domain-projection и возвращает per-require boolean | "unknown" + reasons.
 * Идея: куратор видит «partial verdict», а не пустоту.
 *
 * Семантика:
 *   ok=true     — require удовлетворён
 *   ok=false    — require явно не удовлетворён
 *   ok=unknown  — placeholder (<view-entity>, *, regex без context) или
 *                 unsupported kind; не блокирует, но не подтверждает
 *
 * AND-композиция:
 *   все true             → matched=true,  actual=true
 *   хоть один false      → matched=false, actual=false
 *   нет false, есть unknown → matched=null, actual=null (live-undecidable)
 */

const KNOWN_KINDS = new Set([
  "entity-field",
  "entity-kind",
  "field-role-present",
  "has-role",
  "intent-confirmation",
  "intent-count",
  "intent-creates",
  "intent-effect",
  "sub-entity-exists",
  "internal",
  "mirror",
  "polymorphic",
  "polymorphic-context",
  "reference",
  "session",
  "timeslot-like",
]);

const PLACEHOLDER_RE = /^[*<]|[<>*]$|^\*$/;

function isPlaceholder(s) {
  if (s == null) return true;
  if (typeof s !== "string") return false;
  return PLACEHOLDER_RE.test(s) || s.includes("|") || s.includes("*");
}

function entityList(ontology) {
  const ents = ontology?.entities || {};
  return Object.entries(ents).map(([name, def]) => ({ name, ...def }));
}

function resolveEntity(ontology, name, projection) {
  if (name == null) return null; // не placeholder — отсутствие критерия
  if (isPlaceholder(name)) {
    // textual placeholder (<view-entity>, *) → берём mainEntity
    if (projection?.mainEntity && ontology?.entities?.[projection.mainEntity]) {
      return { name: projection.mainEntity, ...ontology.entities[projection.mainEntity] };
    }
    return null;
  }
  // regex с pipe (A|B|C) — пробуем все
  if (name.includes("|")) {
    for (const part of name.split("|")) {
      const trimmed = part.trim().replace(/\*/g, "");
      if (ontology?.entities?.[trimmed]) {
        return { name: trimmed, ...ontology.entities[trimmed] };
      }
    }
    return null;
  }
  if (ontology?.entities?.[name]) {
    return { name, ...ontology.entities[name] };
  }
  return null;
}

function inferFieldRole(field) {
  if (!field) return null;
  return field.fieldRole || field.role || null;
}

// ── Per-kind handlers ────────────────────────────────────────

function evalEntityField(req, ctx) {
  const ent = resolveEntity(ctx.ontology, req.entity, ctx.projection);
  if (!ent) return { ok: "unknown", reason: `entity not resolved: ${req.entity}` };
  const fields = ent.fields || {};
  const targetField = req.field;
  const targetRole = req.fieldRole || req.role;
  const targetPattern = req.pattern;
  const requiredValue = req.hasValue;

  let candidates = Object.entries(fields).map(([name, def]) => ({ name, ...def }));
  if (targetField && !isPlaceholder(targetField)) {
    candidates = candidates.filter((f) => f.name === targetField);
  }
  if (targetRole) {
    candidates = candidates.filter((f) => inferFieldRole(f) === targetRole);
  }
  if (targetPattern) {
    try {
      const re = new RegExp(targetPattern);
      candidates = candidates.filter((f) => re.test(f.name));
    } catch {
      return { ok: "unknown", reason: `bad regex: ${targetPattern}` };
    }
  }
  if (candidates.length === 0) {
    return { ok: false, reason: `no field on ${ent.name} matching ${JSON.stringify({ targetField, targetRole, targetPattern })}` };
  }
  if (requiredValue !== undefined) {
    const matchValue = candidates.some(
      (f) => f.default === requiredValue || (f.options || []).includes(requiredValue),
    );
    if (!matchValue) {
      return { ok: false, reason: `field present but no value=${requiredValue}` };
    }
  }
  return { ok: true, reason: `${ent.name}.${candidates[0].name} matches` };
}

function evalEntityKind(req, ctx) {
  const expected = req["kind-value"] || req.kind_value || req.value;
  const ent = resolveEntity(ctx.ontology, req.entity || req.name, ctx.projection);
  if (!ent) {
    // если ни entity ни expected — пробуем найти любую с этим kind
    if (expected) {
      const any = entityList(ctx.ontology).find((e) => e.kind === expected);
      if (any) return { ok: true, reason: `${any.name}.kind === ${expected}` };
      return { ok: false, reason: `no entity with kind=${expected}` };
    }
    return { ok: "unknown", reason: "entity not resolved" };
  }
  if (!expected) return { ok: "unknown", reason: "kind value missing" };
  if (ent.kind === expected) return { ok: true, reason: `${ent.name}.kind === ${expected}` };
  return { ok: false, reason: `${ent.name}.kind === ${ent.kind || "?"} (≠ ${expected})` };
}

function evalEntityKindShorthand(kindValue) {
  // mirror / internal / polymorphic / reference — shorthand для entity-kind.
  return (req, ctx) =>
    evalEntityKind({ kind: "entity-kind", entity: req.entity, "kind-value": kindValue }, ctx);
}

function evalFieldRolePresent(req, ctx) {
  const role = req.role || req.fieldRole;
  if (!role) return { ok: "unknown", reason: "role missing" };
  const ents = req.entity
    ? [resolveEntity(ctx.ontology, req.entity, ctx.projection)].filter(Boolean)
    : entityList(ctx.ontology);
  for (const ent of ents) {
    for (const [fname, fdef] of Object.entries(ent.fields || {})) {
      if (inferFieldRole(fdef) === role) {
        return { ok: true, reason: `${ent.name}.${fname} has role=${role}` };
      }
    }
  }
  return { ok: false, reason: `no field with role=${role}` };
}

function evalHasRole(req, ctx) {
  const want = req.role;
  const base = req.base;
  const roles = ctx.ontology?.roles || {};
  if (want) {
    const direct = roles[want];
    if (direct) return { ok: true, reason: `roles.${want}` };
    if (ctx.projection?.forRoles?.includes(want)) {
      return { ok: true, reason: `projection.forRoles ⊇ ${want}` };
    }
    return { ok: false, reason: `no role=${want}` };
  }
  if (base) {
    const found = Object.entries(roles).find(([_, def]) => def.base === base);
    if (found) return { ok: true, reason: `${found[0]}.base === ${base}` };
    return { ok: false, reason: `no role with base=${base}` };
  }
  return { ok: "unknown", reason: "role criteria missing" };
}

function evalIntentConfirmation(req, ctx) {
  const values = req.values || (req.value ? [req.value] : req.confirmation ? [req.confirmation] : []);
  if (values.length === 0) return { ok: "unknown", reason: "value(s) missing" };
  const intents = ctx.intents || [];
  const match = intents.find((i) => values.includes(i.confirmation));
  if (match) return { ok: true, reason: `intent confirmation matches ${values.join("|")}` };
  return { ok: false, reason: `no intent with confirmation in ${values.join("|")}` };
}

function evalIntentCount(req, ctx) {
  const intents = ctx.intents || [];
  let filtered = intents;
  if (req.operation || req.α) {
    const op = req.operation || req.α;
    filtered = filtered.filter((i) => i.α === op);
  }
  if (req.pattern) {
    try {
      const re = new RegExp(req.pattern);
      filtered = filtered.filter((i) => re.test(i.id || i.name || ""));
    } catch {
      return { ok: "unknown", reason: `bad regex: ${req.pattern}` };
    }
  }
  if (req.where?.entity && !isPlaceholder(req.where.entity)) {
    filtered = filtered.filter((i) => (i.target || "").startsWith(req.where.entity));
  }
  const min = req.min ?? req.gte;
  const max = req.max ?? req.lte;
  const n = filtered.length;
  if (min != null && n < min) return { ok: false, reason: `intent count ${n} < min ${min}` };
  if (max != null && n > max) return { ok: false, reason: `intent count ${n} > max ${max}` };
  return { ok: true, reason: `intent count ${n} ∈ [${min ?? "·"}, ${max ?? "·"}]` };
}

function evalIntentCreates(req, ctx) {
  const want = req.creates || req.entity;
  if (!want || isPlaceholder(want)) return { ok: "unknown", reason: "creates target placeholder" };
  const intents = ctx.intents || [];
  const match = intents.find((i) => {
    if (i.α !== "create") return false;
    const target = i.target || i.creates || "";
    return target === want || target.startsWith(want + ".");
  });
  if (match) return { ok: true, reason: `intent ${match.id || match.name} creates ${want}` };
  return { ok: false, reason: `no intent creates ${want}` };
}

function evalIntentEffect(req, ctx) {
  const intents = ctx.intents || [];
  const matchByName = req.intent && !isPlaceholder(req.intent);
  for (const i of intents) {
    if (matchByName && i.id !== req.intent && i.name !== req.intent) continue;
    const effects = i.particles?.effects || [];
    for (const e of effects) {
      if (req.α && e.α !== req.α) continue;
      if (req.target && !isPlaceholder(req.target) && e.target !== req.target) continue;
      if (req.targetField) {
        const tf = (e.target || "").split(".")[1];
        if (tf !== req.targetField) continue;
      }
      return { ok: true, reason: `intent ${i.id || i.name} effect matches` };
    }
  }
  return { ok: false, reason: `no intent effect matching ${JSON.stringify(req)}` };
}

function evalSubEntityExists(req, ctx) {
  const parent = resolveEntity(ctx.ontology, req.parent, ctx.projection);
  const childName = req.child;
  const ents = entityList(ctx.ontology);
  // FK-based detection: any entity has entityRef field pointing to mainEntity / parent
  const target = parent?.name || ctx.projection?.mainEntity;
  if (!target) return { ok: "unknown", reason: "no parent/mainEntity to reference" };
  for (const ent of ents) {
    if (ent.name === target) continue;
    if (childName && !isPlaceholder(childName) && ent.name !== childName) continue;
    const fields = ent.fields || {};
    const refsTarget = Object.values(fields).some(
      (f) => f.type === "entityRef" && f.entity === target,
    );
    if (!refsTarget) continue;
    if (req.withField) {
      if (!fields[req.withField]) continue;
    }
    if (req.fields && Array.isArray(req.fields)) {
      const allPresent = req.fields.every((f) => fields[f]);
      if (!allPresent) continue;
    }
    return { ok: true, reason: `sub-entity ${ent.name} → ${target}` };
  }
  return { ok: false, reason: `no sub-entity referencing ${target}` };
}

const HANDLERS = {
  "entity-field": evalEntityField,
  "entity-kind": evalEntityKind,
  "field-role-present": evalFieldRolePresent,
  "has-role": evalHasRole,
  "intent-confirmation": evalIntentConfirmation,
  "intent-count": evalIntentCount,
  "intent-creates": evalIntentCreates,
  "intent-effect": evalIntentEffect,
  "sub-entity-exists": evalSubEntityExists,
  internal: evalEntityKindShorthand("internal"),
  mirror: evalEntityKindShorthand("mirror"),
  polymorphic: evalEntityKindShorthand("polymorphic"),
  reference: evalEntityKindShorthand("reference"),
  session: () => ({ ok: "unknown", reason: "kind=session unsupported (single-case)" }),
  "polymorphic-context": () => ({ ok: "unknown", reason: "kind=polymorphic-context unsupported" }),
  "timeslot-like": () => ({ ok: "unknown", reason: "kind=timeslot-like unsupported" }),
};

function evaluateRequire(req, ctx) {
  const kind = req.kind;
  const handler = HANDLERS[kind];
  if (!handler) {
    return { ok: "unknown", reason: `unsupported kind: ${kind}` };
  }
  try {
    return handler(req, ctx);
  } catch (e) {
    return { ok: "unknown", reason: `handler threw: ${e.message}` };
  }
}

/**
 * @param {Object} trigger — pattern.trigger
 * @param {Object} ctx — { intents, ontology, projection }
 * @returns {{ matched: boolean|null, perRequire: Array<{kind, ok, reason}> }}
 */
function evaluateGenericRequires(trigger, ctx) {
  const requires = trigger?.requires || [];
  const perRequire = requires.map((req) => {
    const r = evaluateRequire(req, ctx);
    return { kind: req.kind, ok: r.ok, reason: r.reason };
  });
  const anyFalse = perRequire.some((r) => r.ok === false);
  const anyUnknown = perRequire.some((r) => r.ok === "unknown");
  let matched;
  if (anyFalse) matched = false;
  else if (anyUnknown) matched = null;
  else matched = true;
  return { matched, perRequire };
}

module.exports = { evaluateGenericRequires, KNOWN_KINDS, evaluateRequire };
