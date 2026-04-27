#!/usr/bin/env node
/**
 * jointsolver-empirical-slots — A2 Phase 3b (analysis + slot model proposal).
 *
 * Извлекает empirical shape archetype × slot из existing assignToSlots*
 * на 16 доменах:
 *   - Какие slots реально содержат intents (intent-bearing).
 *   - Capacity distribution (p25/p50/p75/max) per (archetype, slot).
 *   - Role coverage (observed allowedRoles) per slot — union из всех intents.
 *   - Destructive frequency (доля intents с remove на mainEntity).
 *
 * Output empirical model — drop-in для getDefaultSlotsForArchetype в SDK.
 * Phase 3c' применит этот model в idf-sdk и re-run покажет
 * agreement rate improvement.
 *
 * Usage: node scripts/jointsolver-empirical-slots.mjs
 *
 * Backlog: idf-sdk § A2 Phase 3.
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crystallizeV2 } from "@intent-driven/core";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const DOMAIN_NAMES = [
  "booking", "planning", "workflow", "messenger", "sales",
  "lifequest", "reflect", "invest", "delivery", "freelance",
  "compliance", "keycloak", "argocd", "notion", "automation",
  "gravitino",
];

// ============================================================================
// Role classification (повторяет classifyIntentRole из jointSolver.js)
// ============================================================================

const ROLE_PRIMARY = "primary";
const ROLE_SECONDARY = "secondary";
const ROLE_NAVIGATION = "navigation";
const ROLE_UTILITY = "utility";
const ROLE_DESTRUCTIVE = "destructive";

function classifyIntentRole(intent, mainEntity) {
  const roles = [];
  const salience = typeof intent?.salience === "number" ? intent.salience : 40;
  if (salience >= 80) roles.push(ROLE_PRIMARY);
  else if (salience >= 60) roles.push(ROLE_SECONDARY);
  else if (salience >= 30) roles.push(ROLE_NAVIGATION);
  else roles.push(ROLE_UTILITY);

  const effects = intent?.particles?.effects || [];
  const mainLower = (mainEntity || "").toLowerCase();
  const isDestructive = effects.some((e) => {
    if (e?.α !== "remove" && e?.alpha !== "remove") return false;
    const t = typeof e?.target === "string" ? e.target.toLowerCase() : "";
    return t === mainLower || t.startsWith(mainLower + ".");
  });
  if (isDestructive) roles.push(ROLE_DESTRUCTIVE);
  return roles;
}

// ============================================================================
// Extract intents per slot from artifact (intent-bearing nodes)
// ============================================================================

/**
 * Slot которые трактуются как intent-bearing (содержат actionable intents).
 * Не intent-bearing (skip): body (derived content), sidebar (authored cards),
 * gating (panel), extras (strategy meta).
 */
const INTENT_BEARING_SLOTS = new Set([
  "header", "toolbar", "hero", "primaryCTA", "secondary",
  "footer", "overlay", "fab", "context",
]);

function extractSlotIntents(slots) {
  // Returns Map<slotName, Array<intentId>>
  const map = new Map();
  if (!slots || typeof slots !== "object") return map;
  for (const [slotName, nodes] of Object.entries(slots)) {
    if (!INTENT_BEARING_SLOTS.has(slotName)) continue;
    if (!Array.isArray(nodes)) continue;
    const ids = [];
    for (const n of nodes) {
      if (n && typeof n === "object" && typeof n.intentId === "string") {
        ids.push(n.intentId);
      }
    }
    if (ids.length > 0) map.set(slotName, ids);
  }
  return map;
}

// ============================================================================
// Aggregation
// ============================================================================

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
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

function projectionKind(projection) {
  return projection.archetype || projection.kind || null;
}

async function collectFromDomain(domain) {
  const { ontology, intents, projections, id } = domain;

  let artifacts;
  try {
    artifacts = crystallizeV2(intents, projections, ontology, id, {});
  } catch (e) {
    return { domain: id, error: e.message };
  }

  // Per-projection observations: archetype, slot, intentCount, intentRoles
  const observations = [];

  for (const [projId, projection] of Object.entries(projections)) {
    const kind = projectionKind(projection);
    if (!kind) continue;
    const artifact = artifacts[projId];
    if (!artifact || !artifact.slots) continue;

    const slotIntents = extractSlotIntents(artifact.slots);
    const mainEntity = projection.mainEntity;

    for (const [slotName, intentIds] of slotIntents) {
      const rolesUnion = new Set();
      let destructiveCount = 0;
      for (const id of intentIds) {
        const intent = intents[id];
        if (!intent) continue;
        const roles = classifyIntentRole({ ...intent, id }, mainEntity);
        for (const r of roles) rolesUnion.add(r);
        if (roles.includes(ROLE_DESTRUCTIVE)) destructiveCount++;
      }
      observations.push({
        domain: id,
        projection: projId,
        archetype: kind,
        slot: slotName,
        count: intentIds.length,
        roles: [...rolesUnion],
        destructiveCount,
      });
    }
  }

  return { domain: id, observations };
}

function aggregateEmpirical(allObservations) {
  // Map<archetype, Map<slot, { counts: number[], roles: Map<role, count>,
  //   destructiveTotal, projectionCount }>>
  const byArch = new Map();

  for (const obs of allObservations) {
    if (!byArch.has(obs.archetype)) byArch.set(obs.archetype, new Map());
    const slotMap = byArch.get(obs.archetype);
    if (!slotMap.has(obs.slot)) {
      slotMap.set(obs.slot, {
        counts: [],
        roleHits: new Map(),
        destructiveTotal: 0,
        projectionCount: 0,
        domainSet: new Set(),
      });
    }
    const agg = slotMap.get(obs.slot);
    agg.counts.push(obs.count);
    agg.projectionCount++;
    agg.destructiveTotal += obs.destructiveCount;
    agg.domainSet.add(obs.domain);
    for (const role of obs.roles) {
      agg.roleHits.set(role, (agg.roleHits.get(role) || 0) + 1);
    }
  }

  // Distill в empirical model
  const empirical = {};
  for (const [archetype, slotMap] of byArch) {
    empirical[archetype] = {};
    for (const [slot, agg] of slotMap) {
      const sorted = [...agg.counts].sort((a, b) => a - b);
      const p25 = percentile(sorted, 25);
      const p50 = percentile(sorted, 50);
      const p75 = percentile(sorted, 75);
      const p95 = percentile(sorted, 95);
      const max = sorted[sorted.length - 1] || 0;

      // Allowed roles: те, что появляются в ≥ THRESHOLD% наблюдений.
      // Низкий threshold = inclusive (избегаем false-negative role exclusion).
      const TH = 0.05;
      const allowedRoles = [];
      for (const [role, hits] of agg.roleHits) {
        if (hits / agg.projectionCount >= TH) allowedRoles.push(role);
      }
      // Stable sort for reproducibility
      allowedRoles.sort();

      // Capacity: choose p95 (97.5% случаев помещается). Conservative.
      // Если p95 << max — небольшое padding +1 для tail tolerance.
      const capacity = Math.max(p95, p50 + 1);

      empirical[archetype][slot] = {
        capacity,
        allowedRoles,
        stats: {
          projectionCount: agg.projectionCount,
          domainCount: agg.domainSet.size,
          countsP25: p25, countsP50: p50, countsP75: p75, countsP95: p95, countsMax: max,
          destructiveRatio: agg.projectionCount === 0
            ? 0
            : Number((agg.destructiveTotal / Math.max(1, agg.counts.reduce((s, c) => s + c, 0))).toFixed(3)),
          roleHits: Object.fromEntries(agg.roleHits),
        },
      };
    }
  }

  return empirical;
}

function generateProposedCode(empirical) {
  const lines = [];
  for (const [archetype, slots] of Object.entries(empirical)) {
    if (Object.keys(slots).length === 0) continue;
    lines.push(`const SLOTS_${archetype.toUpperCase()} = {`);
    for (const [slotName, model] of Object.entries(slots)) {
      const rolesStr = model.allowedRoles.map((r) => `"${r}"`).join(", ");
      lines.push(`  ${slotName.padEnd(11)}: { capacity: ${String(model.capacity).padStart(2)}, allowedRoles: [${rolesStr}] },`);
    }
    lines.push("};");
    lines.push("");
  }
  return lines.join("\n");
}

function generateMarkdown(allDomainsObs, empirical) {
  const lines = [];
  lines.push("# Empirical archetype slot model — A2 Phase 3b");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("> Извлечено из existing `assignToSlots*` output на 16 доменах. Per archetype × slot: capacity (p95), observed roles, destructive ratio, projection coverage. Drop-in для `getDefaultSlotsForArchetype` в Phase 3c'.");
  lines.push("");

  // Per-archetype tables
  for (const [archetype, slots] of Object.entries(empirical)) {
    if (Object.keys(slots).length === 0) continue;
    lines.push(`## ${archetype}`);
    lines.push("");
    lines.push("| Slot | Capacity (p95) | Allowed roles | Domains | Projections | Median count | Max count | Destructive ratio |");
    lines.push("|------|---------------|---------------|---------|-------------|--------------|-----------|-------------------|");
    for (const [slotName, model] of Object.entries(slots)) {
      const s = model.stats;
      lines.push(`| \`${slotName}\` | ${model.capacity} | \`${model.allowedRoles.join(", ") || "(none)"}\` | ${s.domainCount} | ${s.projectionCount} | ${s.countsP50} | ${s.countsMax} | ${s.destructiveRatio} |`);
    }
    lines.push("");
  }

  // Proposed code
  lines.push("## Proposed `getDefaultSlotsForArchetype` body (Phase 3c')");
  lines.push("");
  lines.push("```js");
  lines.push(generateProposedCode(empirical).trim());
  lines.push("```");
  lines.push("");

  // Diff vs Phase 2b model
  lines.push("## Diff vs Phase 2b упрощённой модели");
  lines.push("");
  const phase2b = {
    catalog: ["hero", "toolbar", "context", "fab"],
    detail: ["primaryCTA", "secondary", "toolbar", "footer"],
    feed: ["toolbar", "context", "fab"],
  };
  lines.push("| Archetype | Phase 2b slots | Empirical slots | New (added) | Missing |");
  lines.push("|-----------|----------------|-----------------|-------------|---------|");
  for (const [archetype, slots] of Object.entries(empirical)) {
    const empSlots = Object.keys(slots);
    const p2bSlots = phase2b[archetype] || [];
    const added = empSlots.filter((s) => !p2bSlots.includes(s));
    const missing = p2bSlots.filter((s) => !empSlots.includes(s));
    lines.push(`| ${archetype} | ${p2bSlots.join(", ") || "—"} | ${empSlots.join(", ")} | ${added.join(", ") || "—"} | ${missing.join(", ") || "—"} |`);
  }
  lines.push("");

  return lines.join("\n");
}

async function main() {
  console.log("[empirical-slots] Loading 16 domains…");
  const domains = await Promise.all(DOMAIN_NAMES.map(loadDomain));
  const ok = domains.filter((d) => d.ok);
  console.log(`[empirical-slots] Loaded ${ok.length}/${DOMAIN_NAMES.length}`);

  const allObservations = [];
  for (const d of ok) {
    process.stdout.write(`  ${d.id}… `);
    try {
      const result = await collectFromDomain(d);
      if (result.error) {
        console.log(`ERROR: ${result.error}`);
        continue;
      }
      allObservations.push(...result.observations);
      console.log(`${result.observations.length} slot observations`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
  }

  const empirical = aggregateEmpirical(allObservations);
  const date = new Date().toISOString().split("T")[0];

  const jsonOut = path.join(ROOT, "docs", `empirical-slot-model-${date}.json`);
  const mdOut = path.join(ROOT, "docs", `empirical-slot-model-${date}.md`);

  fs.writeFileSync(jsonOut, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalObservations: allObservations.length,
    empirical,
  }, null, 2));

  fs.writeFileSync(mdOut, generateMarkdown(allObservations, empirical));

  console.log("");
  console.log("[empirical-slots] Output:");
  console.log(`  ${path.relative(ROOT, jsonOut)}`);
  console.log(`  ${path.relative(ROOT, mdOut)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
