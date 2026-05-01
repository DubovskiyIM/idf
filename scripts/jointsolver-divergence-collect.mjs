#!/usr/bin/env node
/**
 * jointsolver-divergence-collect — A2 Phase 3a (calibration data collection).
 *
 * Запускает existing assignToSlots* (через crystallizeV2) и параллельно
 * computeAlternateAssignment (jointSolver bridge) на 14 доменах × все
 * roles × все projections. Накапливает divergences (intents в разных
 * слотах между derived и alternate).
 *
 * Output:
 *   docs/jointsolver-divergence-2026-04-27.json — raw dataset
 *   docs/jointsolver-divergence-2026-04-27.md — summary report
 *
 * Usage:
 *   node scripts/jointsolver-divergence-collect.mjs
 *
 * Backlog: idf-sdk § A2 Phase 3.
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
  "gravitino",
];

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

/**
 * Извлечь Map<intentId, slotName> из slots-структуры assignToSlots*.
 * Reproduces logic из Phase 2c extractDerivedAssignment (не released).
 */
function extractDerivedAssignment(slots) {
  const map = new Map();
  if (!slots || typeof slots !== "object") return map;
  for (const [slotName, nodes] of Object.entries(slots)) {
    if (!Array.isArray(nodes)) continue;
    for (const n of nodes) {
      if (n && typeof n === "object" && typeof n.intentId === "string") {
        if (!map.has(n.intentId)) map.set(n.intentId, slotName);
      }
    }
  }
  return map;
}

/**
 * Сравнить derived и alternate assignments.
 * Reproduces Phase 2c diagnoseAssignment diff logic.
 */
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

function projectionKind(projection) {
  return projection.archetype || projection.kind || null;
}

async function collectFromDomain(domain) {
  const { ontology, intents, projections, id } = domain;
  const roles = Object.keys(ontology?.roles || {});
  const records = [];

  // crystallizeV2 — single call даёт artifacts с derived slots
  let artifacts;
  try {
    artifacts = crystallizeV2(intents, projections, ontology, id, {});
  } catch (e) {
    return { domain: id, error: `crystallizeV2: ${e.message}`, records: [] };
  }

  for (const [projId, projection] of Object.entries(projections)) {
    const kind = projectionKind(projection);
    if (kind !== "catalog" && kind !== "detail") continue;

    const artifact = artifacts[projId];
    if (!artifact || !artifact.slots) continue;

    const derived = extractDerivedAssignment(artifact.slots);

    // Roles: per-role alternate (так как accessibleIntents зависит от role).
    // Для derived используем same artifact, но он построен без role'и —
    // это compromise. crystallizeV2 в нашем pipeline does not differentiate,
    // мы сравниваем derived (всё доступное) vs alternate per-role.
    for (const role of roles) {
      let alternate;
      try {
        const alt = computeAlternateAssignment(intents, projection, ontology, { role });
        alternate = alt.assignment;
      } catch (e) {
        records.push({
          projection: projId, role, archetype: kind,
          error: `computeAlternateAssignment: ${e.message}`,
        });
        continue;
      }

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
  lines.push("# JointSolver divergence — A2 Phase 3 calibration");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("> Сравнение derived (existing assignToSlots*) vs alternate (jointSolver Hungarian) на real domains. Каждый row — divergence per intent в projection × role.");
  lines.push("");

  // Per-domain summary
  lines.push("## Per-domain summary");
  lines.push("");
  lines.push("| Domain | Records | Total intents | Divergent | Derived-only | Alternate-only | Agreed |");
  lines.push("|--------|---------|---------------|-----------|--------------|----------------|--------|");
  let grandTotal = 0, grandDiv = 0, grandDOnly = 0, grandAOnly = 0, grandAgreed = 0;
  for (const r of allRecords) {
    if (r.error) {
      lines.push(`| ${r.domain} | ERROR | — | — | — | — | — |`);
      continue;
    }
    const totals = r.records.reduce((acc, x) => {
      if (!x.summary) return acc;
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
    lines.push(`| ${r.domain} | ${r.records.length} | ${totals.total} | ${totals.div} | ${totals.dOnly} | ${totals.aOnly} | ${totals.agreed} |`);
  }
  lines.push(`| **TOTAL** | — | **${grandTotal}** | **${grandDiv}** | **${grandDOnly}** | **${grandAOnly}** | **${grandAgreed}** |`);
  lines.push("");

  const agreedPct = grandTotal > 0 ? ((grandAgreed / grandTotal) * 100).toFixed(1) : "0.0";
  const divPct = grandTotal > 0 ? ((grandDiv / grandTotal) * 100).toFixed(1) : "0.0";
  lines.push(`**Agreement rate:** ${agreedPct}% (${grandAgreed}/${grandTotal})`);
  lines.push(`**Divergence rate:** ${divPct}% (${grandDiv}/${grandTotal})`);
  lines.push("");

  // Top divergent slots
  lines.push("## Slot divergence patterns");
  lines.push("");
  const slotPairCounts = new Map();
  for (const r of allRecords) {
    if (r.error) continue;
    for (const rec of r.records) {
      if (!rec.diff) continue;
      for (const d of rec.diff) {
        if (d.kind !== "divergent") continue;
        const key = `${d.derived} → ${d.alternate}`;
        slotPairCounts.set(key, (slotPairCounts.get(key) || 0) + 1);
      }
    }
  }
  const topPairs = [...slotPairCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  if (topPairs.length === 0) {
    lines.push("_(no divergent slot pairs)_");
  } else {
    lines.push("| Derived → Alternate | Count |");
    lines.push("|---------------------|-------|");
    for (const [k, v] of topPairs) lines.push(`| ${k} | ${v} |`);
  }
  lines.push("");

  // Per-domain detail (compact)
  lines.push("## Per-domain divergent records");
  lines.push("");
  for (const r of allRecords) {
    if (r.error) {
      lines.push(`### ${r.domain} — ERROR: ${r.error}`);
      lines.push("");
      continue;
    }
    if (r.records.length === 0) {
      lines.push(`### ${r.domain} — no projection×role с alternate output`);
      lines.push("");
      continue;
    }
    const divergentRecs = r.records.filter((rec) => rec.summary && rec.summary.divergent > 0);
    if (divergentRecs.length === 0) {
      lines.push(`### ${r.domain} — все ${r.records.length} records aligned (no divergence)`);
      lines.push("");
      continue;
    }
    lines.push(`### ${r.domain} (${divergentRecs.length} divergent records)`);
    lines.push("");
    for (const rec of divergentRecs.slice(0, 10)) {
      lines.push(`#### ${rec.projection} × ${rec.role} (${rec.archetype}, mainEntity: ${rec.mainEntity})`);
      lines.push("");
      lines.push("| Intent | Derived | Alternate | Kind |");
      lines.push("|--------|---------|-----------|------|");
      for (const d of (rec.diff || []).filter((x) => x.kind === "divergent").slice(0, 10)) {
        lines.push(`| \`${d.intentId}\` | ${d.derived || "—"} | ${d.alternate || "—"} | divergent |`);
      }
      lines.push("");
    }
    if (divergentRecs.length > 10) {
      lines.push(`_… ещё ${divergentRecs.length - 10} divergent records (см. JSON)_`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function main() {
  console.log("[jointsolver-divergence-collect] Loading 16 domains…");
  const domains = await Promise.all(DOMAIN_NAMES.map(loadDomain));
  const ok = domains.filter((d) => d.ok);
  const failed = domains.filter((d) => !d.ok);
  console.log(`[jointsolver-divergence-collect] Loaded ${ok.length}/${DOMAIN_NAMES.length} (failed: ${failed.map((f) => f.id).join(", ") || "none"})`);

  const allRecords = [];
  for (const d of ok) {
    process.stdout.write(`  ${d.id}… `);
    try {
      const result = await collectFromDomain(d);
      allRecords.push(result);
      const recs = result.records?.length || 0;
      const div = (result.records || []).reduce((s, r) => s + (r.summary?.divergent || 0), 0);
      console.log(`${recs} records, ${div} divergent intents`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      allRecords.push({ domain: d.id, error: e.message, records: [] });
    }
  }

  const date = new Date().toISOString().split("T")[0];
  const jsonOut = path.join(ROOT, "docs", `jointsolver-divergence-${date}.json`);
  const mdOut = path.join(ROOT, "docs", `jointsolver-divergence-${date}.md`);

  fs.writeFileSync(jsonOut, JSON.stringify({ generatedAt: new Date().toISOString(), domains: allRecords }, null, 2));
  fs.writeFileSync(mdOut, generateMarkdown(allRecords));

  console.log("");
  console.log(`[jointsolver-divergence-collect] Output:`);
  console.log(`  ${path.relative(ROOT, jsonOut)}`);
  console.log(`  ${path.relative(ROOT, mdOut)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
