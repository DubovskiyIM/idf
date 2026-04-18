/**
 * Conformance runner — прогоняет 55 language-agnostic JSON-тестов из
 * spec/conformance/{level-1,level-2,level-3} через @intent-driven/core.
 *
 * Смысл: спека spec/ заявляет «any conformant implementation passes these
 * tests». Без runner'а это просто документация. С runner'ом это
 * верифицируемое свойство реализации.
 *
 * Format тестов: {id, level, input, expected}. Спека использует
 * spec-level формат эффектов (type/target/payload), SDK — внутренний
 * (alpha/target/context/value). Конвертер specEffectToSDK мостит.
 *
 * Использование:
 *   node scripts/conformance-runner.mjs            # все уровни
 *   node scripts/conformance-runner.mjs level-1    # один уровень
 *
 * Exit 0 если все passed, иначе 1 (для CI).
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fold,
  buildTypeMap,
  applyPresentation,
  computeAlgebra,
  checkAnchoring,
  checkIntegrity,
} from "@intent-driven/core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPEC_DIR = path.resolve(HERE, "..", "spec", "conformance");

// ─── Spec-format → SDK-format конвертер ───

function specEffectToSDK(ef) {
  const { id, type, target, payload = {}, status, created_at } = ef;
  if (type === "batch") {
    const subs = (payload && Array.isArray(payload.effects)) ? payload.effects : [];
    return subs.flatMap(specEffectToSDK);
  }
  if (type === "add") {
    return [{
      id, alpha: "add", target,
      context: { ...payload },
      status, timestamp: created_at,
    }];
  }
  if (type === "remove") {
    // payload для remove: {id: ...} или пусто — в любом случае id достаётся
    // из payload или самого эффекта.
    const entityId = payload.id ?? ef.id;
    return [{
      id, alpha: "remove", target,
      context: { id: entityId },
      status, timestamp: created_at,
    }];
  }
  if (type === "replace") {
    // spec replace: payload = {id, field1: v1, field2: v2, ...}
    // SDK replace: отдельный эффект на каждое field.
    const { id: entityId, ...fields } = payload;
    return Object.entries(fields).map(([field, value]) => ({
      id: `${id}.${field}`,
      alpha: "replace",
      target: `${target}.${field}`,
      context: { id: entityId },
      value,
      status, timestamp: created_at,
    }));
  }
  return [];
}

// ─── Normalization для стабильного сравнения ───

function normalizeWorld(world) {
  const out = {};
  for (const [k, v] of Object.entries(world || {})) {
    if (Array.isArray(v)) {
      out[k] = [...v].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")));
    } else {
      out[k] = v;
    }
  }
  return out;
}

function deepEq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ─── Runners по уровням ───

/**
 * Per spec §5.1 Fold Semantics:
 *   World(t) = fold(⊕, ∅, sort≺(Φ_confirmed ↓ t))
 *
 * Runner applies the normative filters before handing effects to SDK's fold
 * (which does not itself filter by status or TTL — that is a caller concern
 * per §4.4 requirement 4 "MUST be treated as rejected during fold computation").
 */
function confirmedAtTime(effects, foldTime) {
  return effects.filter(ef => {
    if (ef.status !== "confirmed") return false;
    if (typeof ef.ttl === "number" && ef.ttl >= 0) {
      const expiresAt = (ef.created_at ?? 0) + ef.ttl;
      const now = foldTime ?? ef.created_at ?? 0;
      if (now > expiresAt) return false;
    }
    return true;
  });
}

/** Initialize empty collections per ontology — some expected.world entries
 *  include empty arrays (`{listings: []}`), not just populated ones. */
function hydrateWorldFromOntology(world, ontology) {
  const typeMap = buildTypeMap(ontology);
  for (const [singular, plural] of Object.entries(typeMap)) {
    if (singular === "draft") continue;
    if (world[plural] === undefined) world[plural] = [];
  }
  return world;
}

function runLevel1(test) {
  const { effects, ontology, fold_time, presentation_effects } = test.input;
  const typeMap = buildTypeMap(ontology);
  const filtered = confirmedAtTime(effects || [], fold_time);
  let actual = fold(filtered, typeMap);

  // scope-003 exercises applyPresentation as a separate step after fold.
  if (Array.isArray(presentation_effects) && presentation_effects.length > 0) {
    actual = applyPresentation(actual, presentation_effects, typeMap);
  }

  const expectedWorld = test.expected.world_after_presentation || test.expected.world;

  // If the expected shape mentions an empty collection explicitly,
  // hydrate actual to include it too (fold doesn't initialize empties).
  const actualHydrated = hydrateExpectedShape(actual, expectedWorld);

  return {
    passed: deepEq(normalizeWorld(actualHydrated), normalizeWorld(expectedWorld)),
    actual: actualHydrated,
    expected: expectedWorld,
  };
}

function hydrateExpectedShape(actual, expected) {
  const out = { ...actual };
  for (const k of Object.keys(expected)) {
    if (out[k] === undefined) out[k] = [];
  }
  return out;
}

/**
 * Level-2 tests specify expected relations per intent. Per spec/conformance/README.md:
 * «for Level 2, only the relations listed in expected.relations are checked
 * (other relations MAY be present)». Runner checks every declared relation kind
 * (antagonists, sequentialIn, sequentialOut, excluding, parallel) as a set —
 * actual MUST equal expected, additional intents outside expected are ignored.
 */
function runLevel2(test) {
  const { intents, ontology } = test.input;
  const expected = test.expected;

  const actual = computeAlgebra(intents, ontology);

  if (expected.relations) {
    for (const [intentId, rel] of Object.entries(expected.relations)) {
      const actualRel = actual[intentId] || {};
      for (const kind of Object.keys(rel)) {
        const expSet = [...(rel[kind] || [])].sort();
        const actSet = [...(actualRel[kind] || [])].sort();
        if (!deepEq(expSet, actSet)) {
          return {
            passed: false,
            actual: { [intentId]: { [kind]: actSet } },
            expected: { [intentId]: { [kind]: expSet } },
          };
        }
      }
    }
  }

  return { passed: true, actual, expected };
}

/**
 * Translate SDK anchoring/integrity output to spec findings shape.
 *
 * SDK shape (per anchoring.js, integrity.js):
 *   {rule, level, intent, message, ...} — 'level' is severity, 'intent' is intentId
 *
 * Spec shape (per §7, conformance/level-3):
 *   {rule, intentId, severity, message} + optional `blocking`
 *
 * Message strings differ by language between impl and spec — message is
 * informational per spec §7 (rules described with example messages, not
 * normative text). Runner compares findings by (rule, intentId, severity)
 * triple; message is compared as presence-only unless test explicitly asks.
 */
function toFinding(sdk) {
  return {
    rule: sdk.rule,
    intentId: sdk.intent ?? sdk.intentId,
    severity: sdk.level ?? sdk.severity,
    message: sdk.message,
  };
}

function findingsKey(f) {
  return `${f.rule}|${f.intentId}|${f.severity}`;
}

/**
 * Per spec/conformance/README.md for Level 3:
 *   "all listed findings MUST be present (additional findings MAY be present)"
 * So actual ⊇ expected (subset check).
 */
function findingsContainAll(actual, expected) {
  const a = new Set(actual.map(findingsKey));
  for (const f of expected) if (!a.has(findingsKey(f))) return false;
  return true;
}

function runLevel3(test) {
  const { intents, ontology, projections } = test.input;
  const expected = test.expected;

  const anchoring = checkAnchoring(intents, ontology);
  const anchoringFindings = [
    ...(anchoring.errors || []),
    ...(anchoring.warnings || []),
  ].map(toFinding);

  let integrityFindings = [];
  if (projections) {
    try {
      const integrity = checkIntegrity(intents, projections, ontology);
      const issues = integrity.issues ?? integrity;
      if (Array.isArray(issues)) {
        integrityFindings = issues.map(toFinding);
      }
    } catch {
      // checkIntegrity may throw on malformed input — anchoring findings suffice
    }
  }

  const actualFindings = [...anchoringFindings, ...integrityFindings];

  // Back-compat: old tests используют `expected.violations` — treat as findings.
  const expectedFindings = expected.findings ?? expected.violations ?? [];

  const passed = findingsContainAll(actualFindings, expectedFindings);

  return {
    passed,
    actual: { findings: actualFindings, anchoringPassed: anchoring.passed },
    expected: { findings: expectedFindings, blocking: expected.blocking },
  };
}

const RUNNERS = { 1: runLevel1, 2: runLevel2, 3: runLevel3 };

// ─── Main ───

function loadTests(level) {
  const dir = path.join(SPEC_DIR, `level-${level}`);
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  return files.map(f => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
}

function main() {
  const onlyLevel = process.argv[2]?.replace("level-", "");
  const levels = onlyLevel ? [Number(onlyLevel)] : [1, 2, 3];

  let total = 0, passed = 0, failed = 0;
  const failures = [];

  for (const level of levels) {
    const tests = loadTests(level);
    const runner = RUNNERS[level];
    console.log(`\n=== Level ${level} (${tests.length} тестов) ===`);

    let levelPassed = 0, levelFailed = 0;
    for (const test of tests) {
      total++;
      let result;
      try {
        result = runner(test);
      } catch (e) {
        result = { passed: false, error: e.message };
      }
      if (result.passed) {
        passed++;
        levelPassed++;
        // console.log(`  ✓ ${test.id}`);
      } else {
        failed++;
        levelFailed++;
        failures.push({ test, result });
        const reason = result.error
          ? `THROW: ${result.error}`
          : `mismatch`;
        console.log(`  ✗ ${test.id} — ${test.name.slice(0, 50)} — ${reason}`);
      }
    }
    console.log(`  ${levelPassed}/${tests.length} passed`);
  }

  console.log(`\n═══ Итого: ${passed}/${total} conformance-тестов passed ═══`);

  if (failed > 0 && process.argv.includes("--verbose")) {
    console.log("\nДетали падений:");
    for (const { test, result } of failures.slice(0, 5)) {
      console.log(`\n[${test.id}] ${test.name}`);
      console.log("  expected:", JSON.stringify(result.expected).slice(0, 200));
      console.log("  actual:  ", JSON.stringify(result.actual).slice(0, 200));
    }
  }

  process.exit(failed === 0 ? 0 : 1);
}

main();
