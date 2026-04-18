/**
 * Migrate spec/conformance/level-N fixtures from historical
 * {type, target, payload} effect wire format to canonical
 * {alpha, target, value, context, scope, ...} per effect.schema.json.
 *
 * Migration rules:
 *
 *   type "add"  → alpha "add"
 *     payload → context (preserve all fields)
 *
 *   type "remove" → alpha "remove"
 *     payload.id → context.id (payload may be empty for target-only removes)
 *
 *   type "replace" → alpha "replace"
 *     payload = {id, field_1: v_1}           (single field)
 *       → target unchanged, context {id}, value v_1
 *     payload = {id, field_1: v_1, field_2: v_2}  (multi field)
 *       → split into batch of N replaces, one per field
 *         (preserve original effect id as prefix: id.field_1, id.field_2)
 *
 *   type "batch" → alpha "batch"
 *     payload.effects → value (each sub-effect migrated recursively)
 *
 * Required-by-schema fields added if missing:
 *   intent_id (defaults to effect.id or "test")
 *   scope (defaults to "account")
 *
 * Usage: node scripts/migrate-conformance-fixtures.mjs [--dry-run]
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPEC_DIR = path.resolve(HERE, "..", "spec", "conformance");
const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Split a replace with multi-field payload into N single-field replace effects.
 * Returns array (even for single-field: length 1).
 */
function explodeReplace(ef) {
  const { id, target, payload = {}, status, created_at, intent_id, scope, ttl } = ef;
  const { id: entityId, ...fields } = payload;
  const fieldNames = Object.keys(fields);

  if (fieldNames.length === 0) {
    throw new Error(`replace effect ${id} has no fields in payload`);
  }

  return fieldNames.map((field, i) => ({
    id: fieldNames.length === 1 ? id : `${id}.${field}`,
    intent_id: intent_id ?? id ?? "test",
    alpha: "replace",
    target: `${target}.${field}`,
    context: entityId !== undefined ? { id: entityId } : {},
    value: fields[field],
    scope: scope ?? "account",
    status: status ?? "confirmed",
    created_at: created_at ?? (1000 + i),
    ...(ttl !== undefined ? { ttl } : {}),
  }));
}

/**
 * Migrate a single effect from spec-form to canonical form.
 * Returns array (batch may unwind, replace may explode).
 */
function migrateEffect(ef, recursion = 0) {
  if (recursion > 10) throw new Error("effect nesting too deep");

  // Already canonical — leave alone but ensure required fields.
  if (ef.alpha !== undefined && ef.type === undefined) {
    return [{
      ...ef,
      intent_id: ef.intent_id ?? ef.id ?? "test",
      scope: ef.scope ?? "account",
    }];
  }

  if (ef.type === undefined) {
    throw new Error(`effect missing both 'type' and 'alpha': ${JSON.stringify(ef)}`);
  }

  const { id, type, target, payload = {}, status, created_at, intent_id, scope, ttl } = ef;
  const common = {
    id,
    intent_id: intent_id ?? id ?? "test",
    target,
    scope: scope ?? "account",
    status: status ?? "confirmed",
    created_at: created_at ?? 1000,
    ...(ttl !== undefined ? { ttl } : {}),
  };

  switch (type) {
    case "add":
      return [{ ...common, alpha: "add", context: { ...payload } }];

    case "remove":
      return [{
        ...common,
        alpha: "remove",
        context: payload?.id !== undefined ? { id: payload.id } : {},
      }];

    case "replace":
      return explodeReplace(ef);

    case "batch": {
      const subs = (payload && Array.isArray(payload.effects)) ? payload.effects : [];
      const migratedSubs = subs.flatMap(s => migrateEffect(s, recursion + 1));
      return [{
        ...common,
        alpha: "batch",
        value: migratedSubs,
        context: {},
      }];
    }

    default:
      throw new Error(`unknown effect type '${type}' (id=${id})`);
  }
}

/**
 * Migrate intent.particles.effects — these use {α: "replace", target: "entity.field", value}
 * per spec §3.1.2, NOT the spec-level-1 {type, target, payload} form. But some fixtures
 * historically put spec-level-1 form here. Normalize.
 */
function migrateParticleEffect(ef) {
  // Already canonical particle form: {α: "replace", target: "task.status", value: "done"}
  if (ef.α !== undefined) return ef;
  // alpha used instead of α (synonym)
  if (ef.alpha !== undefined) {
    const { alpha, ...rest } = ef;
    return { α: alpha, ...rest };
  }
  // Spec-level-1 form leaked into particle effects. Migrate.
  if (ef.type !== undefined) {
    // For add/remove: keep target at collection level.
    // For replace with payload.field: promote to target "entity.field" + value.
    const { type, target, payload = {} } = ef;
    if (type === "replace" && typeof payload === "object" && !Array.isArray(payload)) {
      const { id: _ignore, ...fields } = payload;
      const fieldNames = Object.keys(fields);
      if (fieldNames.length === 1) {
        return { α: "replace", target: `${target}.${fieldNames[0]}`, value: fields[fieldNames[0]] };
      }
      // Multi-field in particles — rare, map to first-field (particles are declaration templates,
      // runtime fills in values).
      return { α: "replace", target: `${target}.${fieldNames[0]}` };
    }
    return { α: type, target };
  }
  return ef;
}

function migrateIntent(intent) {
  if (!intent?.particles?.effects) return intent;
  return {
    ...intent,
    particles: {
      ...intent.particles,
      effects: intent.particles.effects.map(migrateParticleEffect),
    },
  };
}

/**
 * Normalize target from ontology-entity-name (TitleCase) form to
 * collection-name (lowercase plural) form, matching level-2 convention
 * and SDK-internal use.
 *
 *   "User"            → "users"
 *   "User.status"     → "user.status"   (field path: stem lowercased, no plural)
 *   "Task.id"         → "task.id"
 *   "users"           → "users"         (already lowercase plural — unchanged)
 *   "user.status"     → "user.status"   (already lowercase — unchanged)
 */
function normalizeTarget(target, ontology) {
  if (typeof target !== "string") return target;
  const parts = target.split(".");
  const head = parts[0];
  if (!head) return target;

  // Already lowercase → leave alone.
  if (head.toLowerCase() === head) return target;

  // Does head match an ontology entity name?
  const isEntity = ontology?.entities && Object.keys(ontology.entities).includes(head);
  const lowered = head.toLowerCase();

  if (parts.length === 1) {
    // Collection-level target → pluralize.
    if (isEntity) {
      const plural = lowered.endsWith("s") ? lowered + "es"
        : lowered.endsWith("y") ? lowered.slice(0, -1) + "ies"
        : lowered + "s";
      return plural;
    }
    return lowered;
  }

  // Field-path target: stem remains singular-lowercase, rest unchanged.
  return [lowered, ...parts.slice(1)].join(".");
}

function normalizeEffectTargets(ef, ontology) {
  if (!ef || typeof ef !== "object") return ef;
  const out = { ...ef };
  if (typeof out.target === "string") {
    out.target = normalizeTarget(out.target, ontology);
  }
  if (Array.isArray(out.value)) {
    // batch sub-effects
    out.value = out.value.map(sub => normalizeEffectTargets(sub, ontology));
  }
  return out;
}

function migrateTest(test) {
  const out = JSON.parse(JSON.stringify(test));
  const ontology = out.input?.ontology;

  if (Array.isArray(out.input?.effects)) {
    out.input.effects = out.input.effects
      .flatMap(ef => migrateEffect(ef))
      .map(ef => normalizeEffectTargets(ef, ontology));
  }

  if (Array.isArray(out.input?.presentation_effects)) {
    out.input.presentation_effects = out.input.presentation_effects
      .flatMap(ef => migrateEffect(ef))
      .map(ef => normalizeEffectTargets(ef, ontology));
  }

  if (out.input?.intents && typeof out.input.intents === "object") {
    const migrated = {};
    for (const [k, v] of Object.entries(out.input.intents)) {
      migrated[k] = migrateIntent(v);
    }
    out.input.intents = migrated;
  }

  return out;
}

function processLevel(level) {
  const dir = path.join(SPEC_DIR, `level-${level}`);
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  let migrated = 0, skipped = 0;
  for (const f of files) {
    const full = path.join(dir, f);
    const orig = JSON.parse(readFileSync(full, "utf8"));
    let next;
    try {
      next = migrateTest(orig);
    } catch (e) {
      console.log(`  ✗ ${f} — skipped: ${e.message}`);
      skipped++;
      continue;
    }
    const origStr = JSON.stringify(orig, null, 2);
    const nextStr = JSON.stringify(next, null, 2);
    if (origStr === nextStr) {
      skipped++;
      continue;
    }
    if (!DRY_RUN) {
      writeFileSync(full, nextStr + "\n");
    }
    migrated++;
    console.log(`  ${DRY_RUN ? "~" : "✓"} ${f}`);
  }
  console.log(`  level-${level}: ${migrated} migrated, ${skipped} unchanged`);
}

console.log(`# Migrating fixtures${DRY_RUN ? " (DRY RUN)" : ""}\n`);
for (const level of [1, 2, 3]) {
  console.log(`## level-${level}`);
  processLevel(level);
  console.log();
}
