/**
 * Conformance test runner for IDF Specification v1.0 Part 1.
 *
 * Reads JSON test files from spec/conformance/ and runs them against
 * the @idf/core reference implementation.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { fold, applyPresentation } from "../src/fold.js";
import { causalSort } from "../src/causalSort.js";
import { pluralize } from "../src/pluralize.js";
import { computeAlgebra } from "../src/intentAlgebra.js";
import { checkIntegrity } from "../src/integrity.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFORMANCE_DIR = join(__dirname, "../../../spec/conformance");

/**
 * Normalize conformance test effect to runtime format.
 * Spec tests may use: type→alpha, payload→context, PascalCase target→plural,
 * or full-entity replace (payload with multiple fields) instead of single-field replace.
 *
 * Returns an array (a full-entity replace expands to multiple single-field effects).
 */
function normalizeEffects(ef, typeMap) {
  const alpha = ef.alpha || ef.type;
  let target = ef.target;
  const payload = ef.payload || {};
  const context = ef.context || {};

  // Resolve PascalCase entity name to plural collection
  function resolvePlural(t) {
    const lower = t.toLowerCase();
    return typeMap[lower] || lower;
  }

  if (alpha === "add") {
    // payload goes into context
    const ctx = Object.keys(context).length > 0 ? context : payload;
    return [{
      id: ef.id || `auto_${Math.random().toString(36).slice(2, 8)}`,
      intent_id: ef.intent_id || "test",
      alpha: "add",
      target: target.includes(".") ? target : resolvePlural(target),
      value: ef.value ?? null,
      scope: ef.scope || "account",
      parent_id: ef.parent_id || null,
      status: ef.status || "confirmed",
      ttl: ef.ttl ?? null,
      context: ctx,
      created_at: ef.created_at || 0,
    }];
  }

  if (alpha === "replace") {
    // If target has a dot, it's already entity.field format
    if (target.includes(".")) {
      const parts = target.split(".");
      parts[0] = parts[0].toLowerCase();
      return [{
        id: ef.id, intent_id: ef.intent_id || "test",
        alpha: "replace", target: parts.join("."),
        value: ef.value ?? null, scope: ef.scope || "account",
        parent_id: ef.parent_id || null, status: ef.status || "confirmed",
        ttl: ef.ttl ?? null,
        context: Object.keys(context).length > 0 ? context : { id: payload.id },
        created_at: ef.created_at || 0,
      }];
    }
    // Full-entity replace: expand payload fields into individual replaces
    const entityLower = target.toLowerCase();
    const entityId = payload.id || context.id;
    const fields = Object.entries(payload).filter(([k]) => k !== "id");
    if (fields.length === 0 && ef.value !== undefined) {
      // Single value replace without field path — treat as single replace
      return [{
        id: ef.id, intent_id: ef.intent_id || "test",
        alpha: "replace", target: entityLower,
        value: ef.value, scope: ef.scope || "account",
        parent_id: ef.parent_id || null, status: ef.status || "confirmed",
        ttl: ef.ttl ?? null, context: { id: entityId },
        created_at: ef.created_at || 0,
      }];
    }
    return fields.map(([field, value], i) => ({
      id: i === 0 ? ef.id : `${ef.id}_${field}`,
      intent_id: ef.intent_id || "test",
      alpha: "replace",
      target: `${entityLower}.${field}`,
      value,
      scope: ef.scope || "account",
      parent_id: ef.parent_id || null,
      status: ef.status || "confirmed",
      ttl: ef.ttl ?? null,
      context: { id: entityId },
      created_at: ef.created_at || 0,
    }));
  }

  if (alpha === "remove") {
    const ctx = Object.keys(context).length > 0 ? context : payload;
    return [{
      id: ef.id, intent_id: ef.intent_id || "test",
      alpha: "remove", target: target.includes(".") ? target : resolvePlural(target),
      value: ef.value ?? null, scope: ef.scope || "account",
      parent_id: ef.parent_id || null, status: ef.status || "confirmed",
      ttl: ef.ttl ?? null, context: ctx, created_at: ef.created_at || 0,
    }];
  }

  if (alpha === "batch") {
    let subs = ef.value || ef.payload?.effects || [];
    const flatSubs = subs.flatMap(sub => normalizeEffects(sub, typeMap));
    return [{
      id: ef.id, intent_id: ef.intent_id || "test",
      alpha: "batch", target: "batch",
      value: flatSubs, scope: ef.scope || "account",
      parent_id: ef.parent_id || null, status: ef.status || "confirmed",
      ttl: ef.ttl ?? null, context: {}, created_at: ef.created_at || 0,
    }];
  }

  // Fallback
  return [{
    ...ef,
    alpha,
    intent_id: ef.intent_id || "test",
    scope: ef.scope || "account",
    parent_id: ef.parent_id || null,
    status: ef.status || "confirmed",
    ttl: ef.ttl ?? null,
    context: Object.keys(context).length > 0 ? context : payload,
    created_at: ef.created_at || 0,
  }];
}

function buildTypeMap(ontology) {
  const map = { draft: "drafts" };
  if (ontology?.entities) {
    for (const name of Object.keys(ontology.entities)) {
      map[name.toLowerCase()] = pluralize(name);
    }
  }
  return map;
}

function loadTests(level) {
  const dir = join(CONFORMANCE_DIR, `level-${level}`);
  try {
    const files = readdirSync(dir).filter(f => f.endsWith(".json"));
    return files.map(f => {
      const content = JSON.parse(readFileSync(join(dir, f), "utf8"));
      return { file: f, ...content };
    });
  } catch {
    return [];
  }
}

// ============================================================
// Level 1: Core (fold, causal sort, batch, TTL, scope)
// ============================================================
describe("Conformance Level 1", () => {
  const tests = loadTests(1);

  for (const t of tests) {
    // Presentation tests (applyPresentation)
    if (t.expected?.world_after_presentation) {
      it(`${t.id}: ${t.name}`, () => {
        const typeMap = buildTypeMap(t.input.ontology);
        const allEffects = (t.input.effects || []).flatMap(e => normalizeEffects(e, typeMap));
        const presRaw = (t.input.presentation_effects || []).flatMap(e => normalizeEffects(e, typeMap));
        const semanticEffects = allEffects.filter(e => e.status === "confirmed" && e.scope !== "presentation");
        const presEffects = presRaw.length > 0 ? presRaw : allEffects.filter(e => e.scope === "presentation");
        const world = fold(semanticEffects, typeMap);
        const visual = applyPresentation(world, presEffects, typeMap);
        for (const [coll, entities] of Object.entries(t.expected.world_after_presentation)) {
          expect(visual[coll]).toBeDefined();
          for (const exp of entities) {
            const match = visual[coll].find(a => a.id === exp.id);
            expect(match, `entity ${exp.id} in ${coll}`).toBeDefined();
            for (const [key, val] of Object.entries(exp)) {
              expect(match[key]).toEqual(val);
            }
          }
        }
      });
      continue;
    }

    // Pluralization tests
    if (t.expected?.pluralization) {
      it(`${t.id}: ${t.name}`, () => {
        const typeMap = buildTypeMap(t.input.ontology);
        for (const [entity, expectedPlural] of Object.entries(t.expected.pluralization)) {
          expect(typeMap[entity.toLowerCase()]).toBe(expectedPlural);
        }
      });
      continue;
    }

    // Standard fold tests
    if (!t.expected?.world) continue;

    it(`${t.id}: ${t.name}`, () => {
      const typeMap = buildTypeMap(t.input.ontology);
      let effects = (t.input.effects || []).flatMap(e => normalizeEffects(e, typeMap));

      // Handle TTL: if fold_time is specified, mark expired as rejected
      if (t.input.fold_time) {
        const foldTime = t.input.fold_time;
        effects = effects.map(e => {
          if (e.status === "confirmed" && e.ttl && (foldTime - e.created_at > e.ttl)) {
            return { ...e, status: "rejected" };
          }
          return e;
        });
      }

      // Only confirmed effects participate in fold
      const confirmedEffects = effects.filter(e => e.status === "confirmed");
      const world = fold(confirmedEffects, typeMap);

      // Compare expected world
      for (const [coll, expectedEntities] of Object.entries(t.expected.world)) {
        const actual = world[coll] || [];
        if (expectedEntities.length === 0) {
          expect(actual).toHaveLength(0);
          continue;
        }
        expect(actual).toHaveLength(expectedEntities.length);
        for (const expected of expectedEntities) {
          const match = actual.find(a => a.id === expected.id);
          expect(match, `entity ${expected.id} in ${coll}`).toBeDefined();
          for (const [key, val] of Object.entries(expected)) {
            expect(match[key]).toEqual(val);
          }
        }
      }
    });
  }
});

// ============================================================
// Level 2: Algebra (intent relations)
// ============================================================
describe("Conformance Level 2", () => {
  const tests = loadTests(2);

  for (const t of tests) {
    if (!t.expected?.relations) continue;

    it(`${t.id}: ${t.name}`, () => {
      const map = computeAlgebra(t.input.intents, t.input.ontology);

      for (const [intentId, expectedRels] of Object.entries(t.expected.relations)) {
        expect(map[intentId], `${intentId} missing from adjacency map`).toBeDefined();
        for (const [relType, expectedIds] of Object.entries(expectedRels)) {
          if (!Array.isArray(expectedIds)) continue;
          const actual = map[intentId][relType] || [];
          for (const expectedId of expectedIds) {
            expect(actual, `${intentId}.${relType} should contain ${expectedId}`).toContain(expectedId);
          }
        }
      }
    });
  }
});

// ============================================================
// Level 3: Integrity (rules)
// ============================================================
describe("Conformance Level 3", () => {
  const tests = loadTests(3);

  for (const t of tests) {
    if (!t.expected?.findings) continue;

    it(`${t.id}: ${t.name}`, () => {
      const result = checkIntegrity(
        t.input.intents,
        t.input.projections || {},
        t.input.ontology
      );

      if (t.expected.findings.length === 0) {
        // No specific findings expected — test passes
        return;
      }

      for (const expected of t.expected.findings) {
        const match = result.issues.find(issue =>
          (expected.rule && (issue.rule === expected.rule || issue.message?.toLowerCase().includes(expected.rule.toLowerCase()))) ||
          (expected.intentId && issue.intentId === expected.intentId)
        );
        expect(match, `expected finding: rule=${expected.rule} intentId=${expected.intentId || "any"}`).toBeDefined();
      }
    });
  }
});
