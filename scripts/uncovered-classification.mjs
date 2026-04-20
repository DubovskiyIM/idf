/**
 * Классификация authored проекций по 10 доменам:
 *   Layer 1 — покрываются derived через rename (R1..R7)
 *   Layer 2 — archetype без R-правил (dashboard/canvas/wizard/form)
 *   Uncovered — не покрывается ни тем ни другим. Это карта будущих R-правил.
 *
 * Для каждой uncovered проекции извлекается signature, намекающая на
 * класс недостающего R-правила: cross-entity, temporal scope, cross-role scope,
 * aggregation, и пр.
 */
// Требует @intent-driven/core >= 0.17 (PR #61 + #63 + #64 + #65) — все R-правила с witnesses.
import { deriveProjections } from "@intent-driven/core";

import { INTENTS as bookingI, PROJECTIONS as bookingP, ONTOLOGY as bookingO } from "../src/domains/booking/domain.js";
import { INTENTS as planningI, PROJECTIONS as planningP, ONTOLOGY as planningO } from "../src/domains/planning/domain.js";
import { INTENTS as workflowI, PROJECTIONS as workflowP, ONTOLOGY as workflowO } from "../src/domains/workflow/domain.js";
import { INTENTS as messengerI, PROJECTIONS as messengerP, ONTOLOGY as messengerO } from "../src/domains/messenger/domain.js";
import { INTENTS as salesI, PROJECTIONS as salesP, ONTOLOGY as salesO } from "../src/domains/sales/domain.js";
import { INTENTS as lifequestI, PROJECTIONS as lifequestP, ONTOLOGY as lifequestO } from "../src/domains/lifequest/domain.js";
import { INTENTS as reflectI, PROJECTIONS as reflectP, ONTOLOGY as reflectO } from "../src/domains/reflect/domain.js";
import { INTENTS as investI, PROJECTIONS as investP, ONTOLOGY as investO } from "../src/domains/invest/domain.js";
import { INTENTS as deliveryI, PROJECTIONS as deliveryP, ONTOLOGY as deliveryO } from "../src/domains/delivery/domain.js";
import { INTENTS as freelanceI, PROJECTIONS as freelanceP, ONTOLOGY as freelanceO } from "../src/domains/freelance/domain.js";

const DOMAINS = [
  { id: "booking",   I: bookingI,   P: bookingP,   O: bookingO },
  { id: "planning",  I: planningI,  P: planningP,  O: planningO },
  { id: "workflow",  I: workflowI,  P: workflowP,  O: workflowO },
  { id: "messenger", I: messengerI, P: messengerP, O: messengerO },
  { id: "sales",     I: salesI,     P: salesP,     O: salesO },
  { id: "lifequest", I: lifequestI, P: lifequestP, O: lifequestO },
  { id: "reflect",   I: reflectI,   P: reflectP,   O: reflectO },
  { id: "invest",    I: investI,    P: investP,    O: investO },
  { id: "delivery",  I: deliveryI,  P: deliveryP,  O: deliveryO },
  { id: "freelance", I: freelanceI, P: freelanceP, O: freelanceO },
];

const ARCHETYPE_FREE = new Set(["dashboard", "canvas", "wizard", "form"]);

function classify(domainId, authoredId, authored, derivedMap) {
  const kind = authored.kind;
  if (ARCHETYPE_FREE.has(kind)) return { layer: "L2", reason: `archetype:${kind}` };

  // Exact id match
  if (derivedMap[authoredId]) return { layer: "L1", reason: "exact-id-match" };

  // Rename candidate: same kind + mainEntity + filter presence
  const mainEntity = authored.mainEntity;
  if (!mainEntity) return { layer: "U", reason: "no-mainEntity" };
  const aHasFilter = !!authored.filter;
  for (const [dId, d] of Object.entries(derivedMap)) {
    if (d.kind === kind && d.mainEntity === mainEntity && !!d.filter === aHasFilter) {
      return { layer: "L1", reason: "rename", renamedFrom: dId };
    }
  }

  // Composition-covered rename (v2.1): authored имеет multi-entity, но derived
  // через ontology.compositions получает те же aliases. Ищем derived с
  // совпадающим (kind, mainEntity) и compositions, покрывающими authored.entities.
  const authoredEntitiesExtra = (authored.entities || []).filter(e => e !== mainEntity);
  if (authoredEntitiesExtra.length > 0) {
    for (const [dId, d] of Object.entries(derivedMap)) {
      if (d.kind === kind && d.mainEntity === mainEntity && Array.isArray(d.compositions)) {
        const derivedTargetEntities = new Set(d.compositions.map(c => c.entity));
        const coverage = authoredEntitiesExtra.every(e => derivedTargetEntities.has(e));
        if (coverage && !!d.filter === aHasFilter) {
          return { layer: "L1", reason: "composition-rename", renamedFrom: dId };
        }
      }
    }
  }

  // Uncovered — extract signature
  return { layer: "U", reason: extractSignature(authored) };
}

function extractSignature(proj) {
  const signals = [];
  const entities = proj.entities || [];
  if (entities.length > 1) signals.push(`multi-entity(${entities.length})`);
  if (proj.filter && typeof proj.filter === "string") {
    const f = proj.filter;
    if (/\|\||&&/.test(f)) signals.push("complex-filter");
    if (/createdAt|updatedAt|Date|date/i.test(f)) signals.push("temporal-filter");
    if (/status/.test(f)) signals.push("status-filter");
    if (/viewer|user\.id|me\.id/.test(f) && !/sellerId|buyerId|ownerId|customerId|userId/.test(f.replace(/viewer|me\.id/g, ""))) {
      signals.push("viewer-scope-nonowner");
    }
  }
  if (proj.sort === "-createdAt" || proj.sort === "-updatedAt" || /createdAt/.test(proj.sort || "")) {
    signals.push("temporal-sort");
  }
  if (proj.kind === "feed" && entities.length > 1) signals.push("cross-entity-feed");
  if (signals.length === 0) signals.push("unclassified");
  return signals.join(", ");
}

// ---- Run ----
const summary = { L1: 0, L2: 0, U: 0 };
const perDomain = [];
const uncoveredSignatures = {};  // signature → [{domain, id}]

for (const d of DOMAINS) {
  const derived = deriveProjections(d.I, d.O);
  const entries = Object.entries(d.P);
  const counts = { L1: 0, L2: 0, U: 0 };
  const uncovered = [];

  for (const [authoredId, p] of entries) {
    const { layer, reason } = classify(d.id, authoredId, p, derived);
    counts[layer]++;
    if (layer === "U") {
      uncovered.push({ id: authoredId, reason, kind: p.kind, mainEntity: p.mainEntity });
      const key = reason;
      if (!uncoveredSignatures[key]) uncoveredSignatures[key] = [];
      uncoveredSignatures[key].push({ domain: d.id, id: authoredId, kind: p.kind });
    }
  }
  summary.L1 += counts.L1;
  summary.L2 += counts.L2;
  summary.U  += counts.U;
  perDomain.push({ id: d.id, total: entries.length, ...counts, uncovered });
}

const total = summary.L1 + summary.L2 + summary.U;

console.log(`# Uncovered classification — 10 доменов\n`);
console.log(`${"domain".padEnd(12)} ${"tot".padStart(4)} ${"L1".padStart(4)} ${"L2".padStart(4)} ${"U".padStart(4)} ${"U%".padStart(5)}`);
console.log("-".repeat(42));
for (const d of perDomain) {
  const uPct = ((d.U / d.total) * 100).toFixed(0);
  console.log(`${d.id.padEnd(12)} ${String(d.total).padStart(4)} ${String(d.L1).padStart(4)} ${String(d.L2).padStart(4)} ${String(d.U).padStart(4)} ${uPct.padStart(4)}%`);
}
console.log("-".repeat(42));
const totalUPct = ((summary.U / total) * 100).toFixed(0);
console.log(`${"TOTAL".padEnd(12)} ${String(total).padStart(4)} ${String(summary.L1).padStart(4)} ${String(summary.L2).padStart(4)} ${String(summary.U).padStart(4)} ${totalUPct.padStart(4)}%`);

console.log(`\n## Layer breakdown`);
console.log(`  L1 (derived через rename/exact): ${summary.L1} (${((summary.L1/total)*100).toFixed(0)}%)`);
console.log(`  L2 (archetype-free):             ${summary.L2} (${((summary.L2/total)*100).toFixed(0)}%)`);
console.log(`  U  (uncovered — gap в R-правилах): ${summary.U} (${((summary.U/total)*100).toFixed(0)}%)`);

console.log(`\n## Uncovered signatures — паттерны недостающих R-правил\n`);
const sigEntries = Object.entries(uncoveredSignatures).sort((a, b) => b[1].length - a[1].length);
for (const [sig, items] of sigEntries) {
  console.log(`  [${items.length}] ${sig}`);
  for (const it of items.slice(0, 5)) {
    console.log(`       ${it.domain}.${it.id}  (${it.kind})`);
  }
  if (items.length > 5) console.log(`       ... +${items.length - 5} more`);
}

console.log(`\n## Детальный список uncovered per domain\n`);
for (const d of perDomain) {
  if (d.uncovered.length === 0) continue;
  console.log(`### ${d.id} — ${d.uncovered.length} uncovered`);
  for (const u of d.uncovered) {
    console.log(`  ${u.id.padEnd(32)} kind=${(u.kind || "?").padEnd(8)} main=${(u.mainEntity || "-").padEnd(14)} [${u.reason}]`);
  }
  console.log();
}
