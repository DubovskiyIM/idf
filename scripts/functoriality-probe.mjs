/**
 * functoriality-probe — эмпирический тест детерминизма crystallizeV2.
 *
 * Гипотеза: crystallize(ontology, intents) — функция от семантики,
 * не от порядка авторства. Формально:
 *   ∀ permutation π над ключами INTENTS →
 *     crystallize(π(INTENTS), P, O) ≡ crystallize(INTENTS, P, O)
 *
 * Если гипотеза ложна — IDF-артефакт зависит от порядка объявления,
 * а не только от смысла. Это ломает positioning «формат, а не фреймворк»:
 * diff/merge/migration tooling невозможны.
 *
 * Запуск: node scripts/functoriality-probe.mjs [domainId]
 */

import { crystallizeV2 } from "@intent-driven/core";
import { INTENTS as bookingI, PROJECTIONS as bookingP, ONTOLOGY as bookingO } from "../src/domains/booking/domain.js";
import { INTENTS as planningI, PROJECTIONS as planningP, ONTOLOGY as planningO } from "../src/domains/planning/domain.js";
import { INTENTS as workflowI, PROJECTIONS as workflowP, ONTOLOGY as workflowO } from "../src/domains/workflow/domain.js";
import { INTENTS as messengerI, PROJECTIONS as messengerP, ONTOLOGY as messengerO } from "../src/domains/messenger/domain.js";
import { INTENTS as salesI, PROJECTIONS as salesP, ONTOLOGY as salesO } from "../src/domains/sales/domain.js";
import { INTENTS as lifequestI, PROJECTIONS as lifequestP, ONTOLOGY as lifequestO } from "../src/domains/lifequest/domain.js";
import { INTENTS as reflectI, PROJECTIONS as reflectP, ONTOLOGY as reflectO } from "../src/domains/reflect/domain.js";
import { INTENTS as investI, PROJECTIONS as investP, ONTOLOGY as investO } from "../src/domains/invest/domain.js";
import { INTENTS as deliveryI, PROJECTIONS as deliveryP, ONTOLOGY as deliveryO } from "../src/domains/delivery/domain.js";

const DOMAINS = [
  { id: "booking", INTENTS: bookingI, PROJECTIONS: bookingP, ONTOLOGY: bookingO },
  { id: "planning", INTENTS: planningI, PROJECTIONS: planningP, ONTOLOGY: planningO },
  { id: "workflow", INTENTS: workflowI, PROJECTIONS: workflowP, ONTOLOGY: workflowO },
  { id: "messenger", INTENTS: messengerI, PROJECTIONS: messengerP, ONTOLOGY: messengerO },
  { id: "sales", INTENTS: salesI, PROJECTIONS: salesP, ONTOLOGY: salesO },
  { id: "lifequest", INTENTS: lifequestI, PROJECTIONS: lifequestP, ONTOLOGY: lifequestO },
  { id: "reflect", INTENTS: reflectI, PROJECTIONS: reflectP, ONTOLOGY: reflectO },
  { id: "invest", INTENTS: investI, PROJECTIONS: investP, ONTOLOGY: investO },
  { id: "delivery", INTENTS: deliveryI, PROJECTIONS: deliveryP, ONTOLOGY: deliveryO },
];

const SEED = 42;
let rngState = SEED;
function rng() {
  rngState = (rngState * 9301 + 49297) % 233280;
  return rngState / 233280;
}

function shuffleObjectKeys(obj) {
  const keys = Object.keys(obj);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

/**
 * Stable canonicalization: снимает различия, которые мы договорились считать
 * cosmetic (timestamps). Всё остальное — семантика.
 */
function canonicalize(artifacts) {
  const out = {};
  for (const [projId, art] of Object.entries(artifacts)) {
    if (!art) { out[projId] = art; continue; }
    // generatedAt — wall-clock, заведомо non-deterministic → игнор
    const { generatedAt, ...rest } = art;
    out[projId] = rest;
  }
  return out;
}

/**
 * Order-insensitive canonicalization: рекурсивно сортирует массивы по
 * их JSON-представлению. Если после этой операции два артефакта равны,
 * значит различия были order-only (cosmetic — можно починить стабильной
 * сортировкой внутри crystallizer'а). Если нет — различие семантическое
 * (разное множество элементов или разные значения).
 */
function orderInsensitive(x) {
  if (Array.isArray(x)) {
    const normalized = x.map(orderInsensitive);
    return [...normalized].sort((a, b) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b))
    );
  }
  if (x && typeof x === "object") {
    const sorted = {};
    for (const k of Object.keys(x).sort()) sorted[k] = orderInsensitive(x[k]);
    return sorted;
  }
  return x;
}

function classify(a, b) {
  if (JSON.stringify(a) === JSON.stringify(b)) return "identical";
  const ai = orderInsensitive(a);
  const bi = orderInsensitive(b);
  if (JSON.stringify(ai) === JSON.stringify(bi)) return "order-only";
  return "semantic";
}

function diffPath(a, b, path = "") {
  if (a === b) return null;
  if (typeof a !== typeof b) return { path, kind: "type", a: typeof a, b: typeof b };
  if (a === null || b === null) return { path, kind: "null", a, b };
  if (Array.isArray(a) !== Array.isArray(b)) return { path, kind: "shape", a: Array.isArray(a), b: Array.isArray(b) };

  if (Array.isArray(a)) {
    if (a.length !== b.length) return { path, kind: "array-length", a: a.length, b: b.length };
    for (let i = 0; i < a.length; i++) {
      const d = diffPath(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }

  if (typeof a === "object") {
    const keysA = Object.keys(a), keysB = Object.keys(b);
    if (keysA.length !== keysB.length) {
      return { path, kind: "keys-count", a: keysA, b: keysB };
    }
    for (const k of keysA) {
      if (!(k in b)) return { path, kind: "missing-key", key: k };
      const d = diffPath(a[k], b[k], path ? `${path}.${k}` : k);
      if (d) return d;
    }
    return null;
  }

  return { path, kind: "value", a, b };
}

function probe(domain, permutations = 5) {
  const baseline = canonicalize(
    crystallizeV2(domain.INTENTS, domain.PROJECTIONS, domain.ONTOLOGY, domain.id)
  );
  const baselineKeys = Object.keys(baseline).sort();

  // per-projection классификация — ever-identical / order-only / semantic
  const projStatus = {};
  for (const projId of baselineKeys) projStatus[projId] = "identical";

  const examples = { "order-only": [], "semantic": [] };

  for (let i = 0; i < permutations; i++) {
    const permuted = shuffleObjectKeys(domain.INTENTS);
    const result = canonicalize(
      crystallizeV2(permuted, domain.PROJECTIONS, domain.ONTOLOGY, domain.id)
    );
    const resultKeys = Object.keys(result).sort();
    if (JSON.stringify(baselineKeys) !== JSON.stringify(resultKeys)) {
      projStatus["*"] = "semantic";
      continue;
    }
    for (const projId of baselineKeys) {
      const cls = classify(baseline[projId], result[projId]);
      if (cls === "identical") continue;
      // escalation: semantic > order-only > identical
      if (projStatus[projId] === "identical" || (projStatus[projId] === "order-only" && cls === "semantic")) {
        projStatus[projId] = cls;
      }
      if (examples[cls].length < 3) {
        const d = diffPath(baseline[projId], result[projId], projId);
        if (d) examples[cls].push({ perm: i, projection: projId, ...d });
      }
    }
  }

  const counts = { identical: 0, "order-only": 0, semantic: 0 };
  for (const s of Object.values(projStatus)) counts[s] = (counts[s] || 0) + 1;

  return {
    domainId: domain.id,
    projectionCount: baselineKeys.length,
    intentCount: Object.keys(domain.INTENTS).length,
    permutationsRun: permutations,
    perProjection: projStatus,
    counts,
    examples,
    functorialityHolds: counts.semantic === 0 && counts["order-only"] === 0,
    funcorialUpToOrder: counts.semantic === 0,
  };
}

async function main() {
  const onlyDomain = process.argv[2];
  const targets = onlyDomain ? DOMAINS.filter(d => d.id === onlyDomain) : DOMAINS;

  console.log("# Functoriality probe — crystallizeV2 determinism under intent permutation\n");
  console.log(`seed=${SEED}, permutations=5/domain, ignoring generatedAt\n`);

  const results = [];
  for (const domain of targets) {
    rngState = SEED;
    const result = probe(domain, 10);
    results.push(result);
    const c = result.counts;
    const strict = result.functorialityHolds ? "✓" : "✗";
    const upToOrder = result.funcorialUpToOrder ? "✓" : "✗";
    console.log(
      `${domain.id.padEnd(12)} P=${String(result.projectionCount).padStart(3)} I=${String(result.intentCount).padStart(3)} ` +
      `│ strict:${strict} up-to-order:${upToOrder} │ ` +
      `identical=${c.identical || 0} order-only=${c["order-only"] || 0} semantic=${c.semantic || 0}`
    );
    if (result.examples.semantic.length > 0) {
      const e = result.examples.semantic[0];
      const summary = e.kind === "value"
        ? `${e.path}: ${JSON.stringify(e.a).slice(0, 50)} → ${JSON.stringify(e.b).slice(0, 50)}`
        : `${e.path || "(root)"}: ${e.kind}`;
      console.log(`             semantic example: ${summary}`);
    }
  }

  console.log("\n# Summary");
  const strictHolds = results.filter(r => r.functorialityHolds).length;
  const upToOrderHolds = results.filter(r => r.funcorialUpToOrder).length;
  const allProj = results.reduce((s, r) => s + r.projectionCount, 0);
  const totalIdentical = results.reduce((s, r) => s + (r.counts.identical || 0), 0);
  const totalOrder = results.reduce((s, r) => s + (r.counts["order-only"] || 0), 0);
  const totalSemantic = results.reduce((s, r) => s + (r.counts.semantic || 0), 0);
  console.log(`Строгая функториальность: ${strictHolds}/${results.length} доменов`);
  console.log(`Функториальность с точностью до порядка массивов: ${upToOrderHolds}/${results.length} доменов`);
  console.log(`По проекциям (всего ${allProj}): identical=${totalIdentical} order-only=${totalOrder} semantic=${totalSemantic}`);

  const outPath = new URL("./functoriality-probe.report.json", import.meta.url);
  const fs = await import("node:fs/promises");
  await fs.writeFile(outPath, JSON.stringify(results, null, 2));
  console.log(`\nПолный отчёт: ${outPath.pathname}`);
}

main().catch(e => { console.error(e); process.exit(1); });
