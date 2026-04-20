#!/usr/bin/env node
/**
 * Compliance domain smoke — standalone sanity check.
 *
 * Загружает онтологию, seed, intents; прогоняет fold(Φ) + checkInvariants
 * на seed world'е. Ожидается 0 errors. Warnings допустимы.
 *
 * Usage: node scripts/smoke-compliance.mjs
 *
 * Запускается в CI после любых изменений в src/domains/compliance/ —
 * ловит рассогласования между seed data и expression-invariants (SoD
 * triplet, dynamic threshold, cycle-close guard).
 */
import {
  ONTOLOGY,
  INTENTS,
  PROJECTIONS,
  ROOT_PROJECTIONS,
  RULES,
  getSeedEffects,
} from "../src/domains/compliance/domain.js";
import { checkInvariants, fold } from "@intent-driven/core";

console.log("=== compliance domain smoke ===\n");

console.log("[1] ontology");
console.log("    entities:   ", Object.keys(ONTOLOGY.entities).length);
console.log("    roles:      ", Object.keys(ONTOLOGY.roles).length);
console.log("    invariants: ", ONTOLOGY.invariants.length);
console.log("    rules:      ", RULES.length);

console.log("\n[2] intents:", Object.keys(INTENTS).length);
const irr = Object.entries(INTENTS)
  .filter(([, i]) => i.irreversibility === "high")
  .map(([n]) => n);
console.log("    __irr:high:", irr.length, "→", irr.join(", "));

console.log("\n[3] projections:", Object.keys(PROJECTIONS).length, "(root:", ROOT_PROJECTIONS.length + ")");

const seedEffects = getSeedEffects();
console.log("\n[4] seed effects:", seedEffects.length);

const world = fold(seedEffects);
const wKeys = Object.keys(world).filter((k) => Array.isArray(world[k]));
console.log("\n[5] fold(Φ):");
for (const k of wKeys) console.log(`    ${k.padEnd(20)} ${world[k].length}`);

const { ok, violations } = checkInvariants(world, ONTOLOGY);
console.log("\n[6] checkInvariants:", ok ? "OK" : `FAIL (${violations.length} violations)`);

if (!ok) {
  const errs = violations.filter((v) => v.severity === "error");
  const warns = violations.filter((v) => v.severity === "warning");
  console.log(`    errors:   ${errs.length}`);
  console.log(`    warnings: ${warns.length}`);
  errs.slice(0, 10).forEach((v) => console.log(`    ERR  [${v.name}] ${v.message}`));
  warns.slice(0, 5).forEach((v) => console.log(`    WARN [${v.name}] ${v.message}`));
}

console.log(ok ? "\n✓ PASS" : "\n✗ FAIL");
process.exit(ok ? 0 : 1);
