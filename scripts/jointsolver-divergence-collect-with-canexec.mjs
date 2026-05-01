#!/usr/bin/env node
/**
 * jointsolver-divergence-collect-with-canexec — A2 Phase 3e validation re-run.
 *
 * Re-runs Phase 3a divergence collection с активированным
 * opts.respectRoleCanExecute: true (Phase 3d.1+3d.2 SDK opt-in).
 *
 * Cравнивает metrics с Phase 3a baseline (5.9% agreement)
 * и Phase 3c'' empirical model run (7.1%) — measures whether
 * filter alignment приводит к expected convergence (~30-40%).
 *
 * Cycles per-role: для каждой role вызывает crystallizeV2 с
 * opts.respectRoleCanExecute=true + opts.role=role, получает
 * role-filtered derived. Затем сравнивает с alternate (тоже
 * per-role).
 *
 * Phase 3a/3c'' использовали single crystallizeV2 без role-iter (роль не
 * передавалась в opts), поэтому derived был "global" union; alternate
 * — per-role. Phase 3e использует per-role и для derived, и для
 * alternate — symmetric comparison.
 *
 * Output:
 *   docs/jointsolver-divergence-phase3e-2026-04-27.json
 *   docs/jointsolver-divergence-phase3e-2026-04-27.md
 *
 * Backlog: idf-sdk § A2 Phase 3e.
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  crystallizeV2,
  computeAlternateAssignment,
} from "@intent-driven/core";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const DOMAIN_NAMES = [
  "booking", "planning", "workflow", "messenger", "sales",
  "lifequest", "reflect", "invest", "delivery", "freelance",
  "compliance", "keycloak", "argocd", "notion", "automation",
  "gravitino", "meta",
];

const INTENT_BEARING_SLOTS = new Set([
  "header", "toolbar", "hero", "primaryCTA", "secondary",
  "footer", "overlay", "fab", "context",
]);

function extractDerivedAssignment(slots) {
  const map = new Map();
  if (!slots || typeof slots !== "object") return map;
  for (const [slotName, nodes] of Object.entries(slots)) {
    if (!INTENT_BEARING_SLOTS.has(slotName)) continue;
    if (!Array.isArray(nodes)) continue;
    for (const n of nodes) {
      if (n && typeof n === "object" && typeof n.intentId === "string") {
        if (!map.has(n.intentId)) map.set(n.intentId, slotName);
      }
    }
  }
  return map;
}

function computeDiff(derivedMap, alternateMap) {
  const allIds = new Set([...derivedMap.keys(), ...alternateMap.keys()]);
  const diff = [];
  let agreed = 0;

  for (const intentId of allIds) {
    const d = derivedMap.get(intentId) ?? null;
    const a = alternateMap.get(intentId) ?? null;
    if (d && a) {
      if (d === a) agreed++;
      else diff.push({ intentId, derived: d, alternate: a, kind: "divergent" });
    } else if (d) {
      diff.push({ intentId, derived: d, alternate: null, kind: "derived-only" });
    } else if (a) {
      diff.push({ intentId, derived: null, alternate: a, kind: "alternate-only" });
    }
  }

  return {
    diff,
    summary: {
      total: allIds.size,
      divergent: diff.filter((x) => x.kind === "divergent").length,
      derivedOnly: diff.filter((x) => x.kind === "derived-only").length,
      alternateOnly: diff.filter((x) => x.kind === "alternate-only").length,
      agreed,
    },
  };
}

function projectionKind(p) {
  return p.archetype || p.kind || null;
}

async function loadDomain(name) {
  const file = path.join(ROOT, "src", "domains", name, "domain.js");
  try {
    const mod = await import(pathToFileURL(file).href);
    return {
      id: name,
      ontology: mod.ONTOLOGY || null,
      intents: mod.INTENTS || {},
      projections: mod.PROJECTIONS || {},
      ok: true,
    };
  } catch (e) {
    return { id: name, ok: false, error: e.message };
  }
}

async function collectFromDomain(domain) {
  const { ontology, intents, projections, id } = domain;
  const roles = Object.keys(ontology?.roles || {});
  const records = [];

  for (const role of roles) {
    let artifacts;
    try {
      // Phase 3e: opt-in pre-filter через role.canExecute.
      // Per-role crystallizeV2 — derived теперь role-filtered, alternate
      // тоже per-role: симметричное сравнение.
      artifacts = crystallizeV2(intents, projections, ontology, id, {
        role,
        respectRoleCanExecute: true,
      });
    } catch (e) {
      records.push({
        role,
        error: `crystallizeV2: ${e.message}`,
      });
      continue;
    }

    for (const [projId, projection] of Object.entries(projections)) {
      const kind = projectionKind(projection);
      if (kind !== "catalog" && kind !== "detail") continue;
      const artifact = artifacts[projId];
      if (!artifact || !artifact.slots) continue;

      const derived = extractDerivedAssignment(artifact.slots);

      let alt;
      try {
        alt = computeAlternateAssignment(intents, projection, ontology, { role });
      } catch (e) {
        records.push({
          projection: projId, role, archetype: kind,
          error: `computeAlternateAssignment: ${e.message}`,
        });
        continue;
      }
      const alternate = alt.assignment;

      const { diff, summary } = computeDiff(derived, alternate);
      if (summary.total === 0) continue;
      records.push({
        projection: projId, role, archetype: kind,
        mainEntity: projection.mainEntity,
        summary, diff,
      });
    }
  }

  return { domain: id, records };
}

function generateMarkdown(allRecords) {
  const lines = [];
  lines.push("# JointSolver divergence — A2 Phase 3e validation re-run");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("> Re-run Phase 3a/3c'' divergence collection с активированным `opts.respectRoleCanExecute: true` (Phase 3d.1/3d.2 SDK opt-in). Per-role symmetric comparison: derived per-role (через crystallizeV2 opts) vs alternate per-role (через computeAlternateAssignment).");
  lines.push("");

  let grandTotal = 0, grandDiv = 0, grandDOnly = 0, grandAOnly = 0, grandAgreed = 0;
  lines.push("## Per-domain summary");
  lines.push("");
  lines.push("| Domain | Records | Total | Divergent | Derived-only | Alternate-only | Agreed |");
  lines.push("|--------|---------|-------|-----------|--------------|----------------|--------|");
  for (const r of allRecords) {
    if (r.error) {
      lines.push(`| ${r.domain} | ERROR: ${r.error} | — | — | — | — | — |`);
      continue;
    }
    const validRecs = (r.records || []).filter((x) => x.summary);
    const totals = validRecs.reduce((acc, x) => {
      acc.total += x.summary.total;
      acc.div += x.summary.divergent;
      acc.dOnly += x.summary.derivedOnly;
      acc.aOnly += x.summary.alternateOnly;
      acc.agreed += x.summary.agreed;
      return acc;
    }, { total: 0, div: 0, dOnly: 0, aOnly: 0, agreed: 0 });
    grandTotal += totals.total;
    grandDiv += totals.div;
    grandDOnly += totals.dOnly;
    grandAOnly += totals.aOnly;
    grandAgreed += totals.agreed;
    lines.push(`| ${r.domain} | ${validRecs.length} | ${totals.total} | ${totals.div} | ${totals.dOnly} | ${totals.aOnly} | ${totals.agreed} |`);
  }
  lines.push(`| **TOTAL** | — | **${grandTotal}** | **${grandDiv}** | **${grandDOnly}** | **${grandAOnly}** | **${grandAgreed}** |`);
  lines.push("");

  const agreedPct = grandTotal > 0 ? ((grandAgreed / grandTotal) * 100).toFixed(1) : "0.0";
  const divPct = grandTotal > 0 ? ((grandDiv / grandTotal) * 100).toFixed(1) : "0.0";
  lines.push(`**Agreement rate:** ${agreedPct}% (${grandAgreed}/${grandTotal})`);
  lines.push(`**Divergence rate:** ${divPct}% (${grandDiv}/${grandTotal})`);
  lines.push("");

  // Phase 3a / 3c'' / 3e comparison
  lines.push("## Phase 3a vs 3c'' vs 3e comparison");
  lines.push("");
  lines.push("| Metric | Phase 3a baseline | Phase 3c'' empirical | **Phase 3e + canExec** | Δ vs 3a |");
  lines.push("|--------|-------------------|---------------------|-------------------|---------|");
  lines.push(`| Total intents | 1673 | 1673 | ${grandTotal} | ${grandTotal - 1673 >= 0 ? "+" : ""}${grandTotal - 1673} |`);
  lines.push(`| Agreed | 99 | 119 | **${grandAgreed}** | ${grandAgreed - 99 >= 0 ? "+" : ""}${grandAgreed - 99} |`);
  lines.push(`| Divergent | 470 | 450 | ${grandDiv} | ${grandDiv - 470} |`);
  lines.push(`| Derived-only | 873 | 873 | **${grandDOnly}** | ${grandDOnly - 873} |`);
  lines.push(`| Alternate-only | 231 | 231 | ${grandAOnly} | ${grandAOnly - 231} |`);
  lines.push(`| **Agreement rate** | 5.9% | 7.1% | **${agreedPct}%** | ${(parseFloat(agreedPct) - 5.9).toFixed(1)}pp |`);
  lines.push("");

  return lines.join("\n");
}

async function main() {
  console.log("[Phase 3e] Loading 17 domains…");
  const domains = await Promise.all(DOMAIN_NAMES.map(loadDomain));
  const ok = domains.filter((d) => d.ok);
  console.log(`[Phase 3e] Loaded ${ok.length}/${DOMAIN_NAMES.length}`);

  const allRecords = [];
  for (const d of ok) {
    process.stdout.write(`  ${d.id}… `);
    try {
      const result = await collectFromDomain(d);
      allRecords.push(result);
      const recs = (result.records || []).filter((x) => x.summary).length;
      const div = (result.records || []).reduce((s, r) => s + (r.summary?.divergent || 0), 0);
      console.log(`${recs} records, ${div} divergent`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      allRecords.push({ domain: d.id, error: e.message, records: [] });
    }
  }

  const date = new Date().toISOString().split("T")[0];
  const jsonOut = path.join(ROOT, "docs", `jointsolver-divergence-phase3e-${date}.json`);
  const mdOut = path.join(ROOT, "docs", `jointsolver-divergence-phase3e-${date}.md`);

  fs.writeFileSync(jsonOut, JSON.stringify({
    generatedAt: new Date().toISOString(),
    phase: "3e",
    notes: "respectRoleCanExecute: true, per-role symmetric comparison",
    domains: allRecords,
  }, null, 2));
  fs.writeFileSync(mdOut, generateMarkdown(allRecords));

  console.log("");
  console.log(`[Phase 3e] Output:`);
  console.log(`  ${path.relative(ROOT, jsonOut)}`);
  console.log(`  ${path.relative(ROOT, mdOut)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
