/**
 * Прогон checkAnchoring на всех доменах прототипа.
 * Печатает отчёт по группам (errors/warnings/infos).
 * Exit 1 если есть errors — используется как CI-gate и как миграционный инструмент.
 *
 * Usage: node scripts/audit-anchoring.mjs
 */

import { checkAnchoring } from "@intent-driven/core";

const DOMAINS = [
  "booking", "planning", "workflow", "messenger",
  "sales", "lifequest", "reflect", "invest", "delivery",
];

let totalErrors = 0;
let totalWarnings = 0;
let totalInfos = 0;

for (const name of DOMAINS) {
  let mod;
  try {
    mod = await import(`../src/domains/${name}/domain.js`);
  } catch (err) {
    console.error(`\n[${name}] не удалось импортировать: ${err.message}`);
    continue;
  }

  const { INTENTS, ONTOLOGY } = mod;
  if (!INTENTS || !ONTOLOGY) {
    console.error(`\n[${name}] нет INTENTS/ONTOLOGY exports — пропуск`);
    continue;
  }

  const result = checkAnchoring(INTENTS, ONTOLOGY);
  const header = `=== ${name}: ${result.errors.length} errors, ${result.warnings.length} warnings, ${result.infos.length} infos ===`;
  console.log(`\n${header}`);

  for (const f of result.errors) {
    console.log(`  [ERROR]   ${f.intent}: ${f.message}`);
    console.log(`     → ${f.detail}`);
  }
  for (const f of result.warnings) {
    console.log(`  [warn]    ${f.intent}: ${f.message}`);
  }
  for (const f of result.infos.slice(0, 5)) {
    console.log(`  [info]    ${f.intent}: ${f.message}`);
  }
  if (result.infos.length > 5) {
    console.log(`  [info]    ... и ещё ${result.infos.length - 5}`);
  }

  totalErrors += result.errors.length;
  totalWarnings += result.warnings.length;
  totalInfos += result.infos.length;
}

console.log(`\n=== TOTAL: ${totalErrors} errors, ${totalWarnings} warnings, ${totalInfos} infos ===`);
if (totalErrors > 0) {
  console.log(`\n${totalErrors} structural misses блокируют crystallizeV2 в strict-режиме. Классифицировать: (а) баг в домене → fix, (б) системная коллекция → ontology.systemCollections.`);
}
process.exit(totalErrors > 0 ? 1 : 0);
