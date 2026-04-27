#!/usr/bin/env node
/**
 * jointsolver-residue-analyze — A2 Phase 3f (residue categorization).
 *
 * После Phase 3e: derivedOnly уменьшился с 873 → 432 (−50.5%) после
 * активации opts.respectRoleCanExecute через crystallizeV2 pipeline.
 * 432 residue требуется decomposeить на root causes для Phase 3f fixes.
 *
 * Гипотезы:
 *   A. missing-entity-reference (Phase 3d показал 98) — author bugs
 *      когда intent.particles не упоминает mainEntity.
 *   B. synthesized-intent-without-source — heroCreate / inline-creators
 *      где intent.id отсутствует в INTENTS map (synthesized по creates).
 *   C. role-canExecute-passes-but-permittedFor-blocks — intent в
 *      canExecute, но permittedFor исключает role; alternate respects,
 *      derived игнорирует.
 *   D. intent-not-in-INTENTS — intent.id в derived slot, но не в
 *      INTENTS map (host injection / programmatic add).
 *   E. accessibleIntents-stricter-on-targets — derived принимает
 *      intent через wider entity matching, alternate strict.
 *
 * Output:
 *   docs/jointsolver-residue-2026-04-27.json
 *   docs/jointsolver-residue-2026-04-27.md
 *
 * Backlog: idf-sdk § A2 Phase 3f.
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

const stripRole = (entityRef) =>
  String(entityRef).split(":").pop().trim().replace(/\[\]$/, "");

function intentTouchesEntity(intent, entityName) {
  if (!intent || !entityName) return false;
  const particles = intent?.particles || {};
  const entities = (particles.entities || []).map(stripRole);
  if (entities.includes(entityName)) return true;
  if (intent.creates === entityName) return true;
  const targets = (particles.effects || []).map(
    (e) => stripRole(String(e.target || "").split(".")[0])
  );
  return targets.includes(entityName);
}

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

function classifyResidueReason({
  intentId, intent, projection, role, ONTOLOGY,
}) {
  const reasons = [];
  const mainEntity = projection?.mainEntity;

  // Hypothesis D: intent отсутствует в INTENTS
  if (!intent) {
    reasons.push("intent-not-in-INTENTS");
    return reasons;
  }

  // Hypothesis A: missing-entity-reference
  if (mainEntity && !intentTouchesEntity(intent, mainEntity)) {
    reasons.push("missing-entity-reference");
  }

  // Hypothesis C: permittedFor blocks (role в canExecute, но не в permittedFor)
  const roleDef = ONTOLOGY?.roles?.[role];
  const inCanExec = roleDef && Array.isArray(roleDef.canExecute)
    ? roleDef.canExecute.includes(intentId)
    : true;
  const inPermitted = !Array.isArray(intent.permittedFor) || intent.permittedFor.length === 0
    ? true
    : intent.permittedFor.includes(role);

  if (inCanExec && !inPermitted) {
    reasons.push("permittedFor-blocks");
  }
  if (!inCanExec) {
    // Should have been caught by pre-filter — flag as anomaly
    reasons.push("canExec-leak");
  }

  // Hypothesis B: synthesized inline-creator (heroCreate)
  // Эти не имеют entry в INTENTS — handled by D. Если intent есть,
  // но он creator-style (creates field set + no entities), помечаем.
  if (intent && intent.creates && (!intent.particles?.entities || intent.particles.entities.length === 0)) {
    if (mainEntity && intent.creates === mainEntity) {
      reasons.push("creator-without-entities");
    }
  }

  if (reasons.length === 0) reasons.push("unknown");
  return reasons;
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

async function analyzeDomain(domain) {
  const { ontology, intents, projections, id } = domain;
  const roles = Object.keys(ontology?.roles || {});
  const records = [];

  for (const role of roles) {
    let artifacts;
    try {
      artifacts = crystallizeV2(intents, projections, ontology, id, {
        role,
        respectRoleCanExecute: true,
      });
    } catch (e) {
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
        continue;
      }
      const alternate = alt.assignment;

      // Residue: derived ∖ alternate
      for (const [intentId, slot] of derived) {
        if (alternate.has(intentId)) continue;
        const intent = intents[intentId];
        const reasons = classifyResidueReason({
          intentId, intent, projection, role, ONTOLOGY: ontology,
        });
        records.push({
          domain: id,
          projection: projId,
          role,
          archetype: kind,
          mainEntity: projection.mainEntity,
          intentId,
          slot,
          reasons,
          intentExists: !!intent,
          intentCreates: intent?.creates || null,
          intentEntities: intent?.particles?.entities || null,
        });
      }
    }
  }

  return { domain: id, records };
}

function aggregate(records) {
  const reasonCounts = new Map();
  const reasonByDomain = new Map();
  for (const r of records) {
    if (r.error) continue;
    for (const rec of r.records) {
      for (const reason of rec.reasons) {
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
        const k = `${rec.domain}::${reason}`;
        reasonByDomain.set(k, (reasonByDomain.get(k) || 0) + 1);
      }
    }
  }
  return { reasonCounts, reasonByDomain };
}

function generateMarkdown(records, agg) {
  const lines = [];
  lines.push("# JointSolver residue 432 — A2 Phase 3f categorization");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("> Phase 3e показал что после opts.respectRoleCanExecute активации derivedOnly падает с 873 до 432 (−50.5%). Phase 3f categorize'ит оставшиеся 432 на root causes.");
  lines.push("");

  const total = records.reduce((s, r) => s + (r.records?.length || 0), 0);
  lines.push(`**Total residue observations:** ${total}`);
  lines.push("");

  lines.push("## Reason frequency");
  lines.push("");
  lines.push("| Reason | Count | % |");
  lines.push("|--------|-------|---|");
  const sorted = [...agg.reasonCounts.entries()].sort((a, b) => b[1] - a[1]);
  const totalReasons = sorted.reduce((s, [, v]) => s + v, 0);
  for (const [reason, count] of sorted) {
    lines.push(`| \`${reason}\` | ${count} | ${((count / totalReasons) * 100).toFixed(1)}% |`);
  }
  lines.push("");

  lines.push("## Per-domain × reason");
  lines.push("");
  const reasons = sorted.map(([r]) => r);
  lines.push(`| Domain | Records | ${reasons.map(r => `\`${r}\``).join(" | ")} |`);
  lines.push(`|--------|---------|${reasons.map(() => "---").join("|")}|`);
  for (const r of records) {
    if (r.error) {
      lines.push(`| ${r.domain} | ERROR | ${reasons.map(() => "—").join(" | ")} |`);
      continue;
    }
    const cells = reasons.map(reason => agg.reasonByDomain.get(`${r.domain}::${reason}`) || 0);
    lines.push(`| ${r.domain} | ${r.records.length} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  lines.push("## Examples (first 5 per top reason)");
  lines.push("");
  for (const [reason, count] of sorted) {
    if (count === 0) continue;
    lines.push(`### \`${reason}\` (${count})`);
    lines.push("");
    let shown = 0;
    for (const r of records) {
      if (r.error) continue;
      for (const rec of r.records) {
        if (shown >= 5) break;
        if (!rec.reasons.includes(reason)) continue;
        const meta = [];
        if (rec.intentExists === false) meta.push("intent missing in INTENTS");
        if (rec.intentCreates) meta.push(`creates=${rec.intentCreates}`);
        if (rec.intentEntities) meta.push(`entities=[${rec.intentEntities.join(",")}]`);
        lines.push(`- **${rec.domain}**/${rec.projection} × ${rec.role} (${rec.archetype}, mainEntity: ${rec.mainEntity}): \`${rec.intentId}\` → \`${rec.slot}\`${meta.length ? ` _(${meta.join(", ")})_` : ""}`);
        shown++;
      }
      if (shown >= 5) break;
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  console.log("[Phase 3f residue] Loading 17 domains…");
  const domains = await Promise.all(DOMAIN_NAMES.map(loadDomain));
  const ok = domains.filter(d => d.ok);
  console.log(`Loaded ${ok.length}/${DOMAIN_NAMES.length}`);

  const allRecords = [];
  for (const d of ok) {
    process.stdout.write(`  ${d.id}… `);
    try {
      const result = await analyzeDomain(d);
      allRecords.push(result);
      console.log(`${result.records.length} residue`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      allRecords.push({ domain: d.id, error: e.message, records: [] });
    }
  }

  const agg = aggregate(allRecords);
  const date = new Date().toISOString().split("T")[0];
  const jsonOut = path.join(ROOT, "docs", `jointsolver-residue-${date}.json`);
  const mdOut = path.join(ROOT, "docs", `jointsolver-residue-${date}.md`);

  fs.writeFileSync(jsonOut, JSON.stringify({
    generatedAt: new Date().toISOString(),
    phase: "3f",
    totalRecords: allRecords.reduce((s, r) => s + (r.records?.length || 0), 0),
    domains: allRecords,
  }, null, 2));
  fs.writeFileSync(mdOut, generateMarkdown(allRecords, agg));

  console.log("");
  console.log(`Output:`);
  console.log(`  ${path.relative(ROOT, jsonOut)}`);
  console.log(`  ${path.relative(ROOT, mdOut)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
