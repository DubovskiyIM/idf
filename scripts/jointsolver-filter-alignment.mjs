#!/usr/bin/env node
/**
 * jointsolver-filter-alignment — A2 Phase 3d (filter mismatch research).
 *
 * Для каждого derivedOnly intent (intent в slot existing assignToSlots*,
 * но computeAlternateAssignment его не выдаёт) категоризирует причины
 * отсутствия в alternate:
 *
 *   missing-entity-reference — intent.particles не упоминает mainEntity
 *     ни через `entities`, ни через `creates`, ни через effect.target →
 *     `intentTouchesEntity` returns false.
 *
 *   role-canExecute-restriction — ontology.roles[role].canExecute = []
 *     явно не включает intent.id.
 *
 *   permittedFor-mismatch — intent.permittedFor задан, но не включает role.
 *
 *   synthesized-intent — intent в derived есть, но в INTENTS его нет
 *     (synthesized assignToSlots — например heroCreate через creates,
 *     wrap'ed inline-create variant).
 *
 *   no-role-defined — role не определена в ontology, но derived всё равно
 *     отдал intents (no role guard).
 *
 *   unknown — ни одна из выше; индикатор bug.
 *
 * Прогон на 17 доменах (16 + meta = idf-on-idf).
 *
 * Output:
 *   docs/jointsolver-filter-alignment-2026-04-27.json — per-intent reasons
 *   docs/jointsolver-filter-alignment-2026-04-27.md   — summary + decision
 *
 * Backlog: idf-sdk § A2 Phase 3d.
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
  "gravitino", "meta", // meta = idf-on-idf, level 1 (рекурсивное описание формата)
];

// ============================================================================
// intentTouchesEntity replica (из core/crystallize_v2/accessibleIntents.js)
// ============================================================================

const stripRole = (entityRef) =>
  String(entityRef).split(":").pop().trim().replace(/\[\]$/, "");

function intentTouchesEntity(intent, entityName) {
  const particles = intent?.particles || {};
  const entities = (particles.entities || []).map(stripRole);
  if (entities.includes(entityName)) return true;
  if (intent.creates === entityName) return true;
  const targets = (particles.effects || []).map(
    (e) => stripRole(String(e.target || "").split(".")[0])
  );
  return targets.includes(entityName);
}

// ============================================================================
// Reason classification
// ============================================================================

function classifyReason(intentId, intent, projection, role, ONTOLOGY) {
  const reasons = [];
  const mainEntity = projection?.mainEntity;

  if (!intent) {
    reasons.push("synthesized-intent");
    return reasons;
  }

  if (mainEntity && !intentTouchesEntity(intent, mainEntity)) {
    reasons.push("missing-entity-reference");
  }

  const roleDef = ONTOLOGY?.roles?.[role];
  if (!roleDef) {
    reasons.push("no-role-defined");
  } else {
    if (Array.isArray(roleDef.canExecute) && !roleDef.canExecute.includes(intentId)) {
      reasons.push("role-canExecute-restriction");
    }
  }

  if (Array.isArray(intent.permittedFor) && intent.permittedFor.length > 0) {
    if (!intent.permittedFor.includes(role)) {
      reasons.push("permittedFor-mismatch");
    }
  }

  if (reasons.length === 0) reasons.push("unknown");
  return reasons;
}

// ============================================================================
// Extract derived assignment + diff
// ============================================================================

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

// ============================================================================
// Main loop
// ============================================================================

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

async function analyzeDomain(domain) {
  const { ontology, intents, projections, id } = domain;
  const records = [];
  const roles = Object.keys(ontology?.roles || {});

  let artifacts;
  try {
    artifacts = crystallizeV2(intents, projections, ontology, id, {});
  } catch (e) {
    return { domain: id, error: e.message, records: [] };
  }

  for (const [projId, projection] of Object.entries(projections)) {
    const kind = projectionKind(projection);
    if (kind !== "catalog" && kind !== "detail") continue;
    const artifact = artifacts[projId];
    if (!artifact || !artifact.slots) continue;

    const derived = extractDerivedAssignment(artifact.slots);

    for (const role of roles) {
      let alt;
      try {
        alt = computeAlternateAssignment(intents, projection, ontology, { role });
      } catch (e) {
        continue;
      }
      const alternate = alt.assignment;

      // derivedOnly = derived.keys ∖ alternate.keys
      for (const [intentId, slot] of derived) {
        if (alternate.has(intentId)) continue;
        const intent = intents[intentId];
        const reasons = classifyReason(intentId, intent, projection, role, ontology);
        records.push({
          domain: id,
          projection: projId,
          role,
          archetype: kind,
          mainEntity: projection.mainEntity,
          intentId,
          derivedSlot: slot,
          reasons,
          intentExists: !!intent,
        });
      }
    }
  }

  return { domain: id, records };
}

function aggregateReasons(allRecords) {
  const reasonCounts = new Map();
  const reasonByDomain = new Map();
  const reasonByArchetype = new Map();

  for (const r of allRecords) {
    if (r.error) continue;
    for (const rec of r.records) {
      for (const reason of rec.reasons) {
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);

        const domKey = `${rec.domain}::${reason}`;
        reasonByDomain.set(domKey, (reasonByDomain.get(domKey) || 0) + 1);

        const arcKey = `${rec.archetype}::${reason}`;
        reasonByArchetype.set(arcKey, (reasonByArchetype.get(arcKey) || 0) + 1);
      }
    }
  }
  return { reasonCounts, reasonByDomain, reasonByArchetype };
}

function generateMarkdown(allRecords, agg) {
  const lines = [];
  lines.push("# JointSolver filter alignment — A2 Phase 3d");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("> Категоризация причин почему `derivedOnly` intents (intent в slot existing `assignToSlots*` output, но `computeAlternateAssignment` его не выдаёт) отсутствуют в alternate. 17 доменов включая meta (idf-on-idf).");
  lines.push("");

  // Top-level summary
  const totalRecords = allRecords.reduce((s, r) => s + (r.records?.length || 0), 0);
  lines.push(`**Total derivedOnly observations:** ${totalRecords}`);
  lines.push("");

  // Reason frequency
  lines.push("## Reason frequency (top-level)");
  lines.push("");
  lines.push("| Reason | Count | % |");
  lines.push("|--------|-------|---|");
  const sortedReasons = [...agg.reasonCounts.entries()].sort((a, b) => b[1] - a[1]);
  const totalReasons = sortedReasons.reduce((s, [, v]) => s + v, 0);
  for (const [reason, count] of sortedReasons) {
    const pct = ((count / totalReasons) * 100).toFixed(1);
    lines.push(`| \`${reason}\` | ${count} | ${pct}% |`);
  }
  lines.push("");

  // By archetype
  lines.push("## Reason distribution per archetype");
  lines.push("");
  const archetypes = new Set();
  for (const key of agg.reasonByArchetype.keys()) {
    archetypes.add(key.split("::")[0]);
  }
  const reasonsList = sortedReasons.map(([r]) => r);
  lines.push(`| Archetype | ${reasonsList.map((r) => `\`${r}\``).join(" | ")} |`);
  lines.push(`|-----------|${reasonsList.map(() => "---").join("|")}|`);
  for (const archetype of archetypes) {
    const cells = reasonsList.map((r) => agg.reasonByArchetype.get(`${archetype}::${r}`) || 0);
    lines.push(`| ${archetype} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  // Per-domain breakdown
  lines.push("## Per-domain breakdown");
  lines.push("");
  lines.push(`| Domain | Records | ${reasonsList.map((r) => `\`${r}\``).join(" | ")} |`);
  lines.push(`|--------|---------|${reasonsList.map(() => "---").join("|")}|`);
  for (const r of allRecords) {
    if (r.error) {
      lines.push(`| ${r.domain} | ERROR: ${r.error} | ${reasonsList.map(() => "—").join(" | ")} |`);
      continue;
    }
    const cells = reasonsList.map((reason) => agg.reasonByDomain.get(`${r.domain}::${reason}`) || 0);
    lines.push(`| ${r.domain} | ${r.records.length} | ${cells.join(" | ")} |`);
  }
  lines.push("");

  // Examples per reason
  lines.push("## Examples (first 5 per reason)");
  lines.push("");
  for (const [reason, count] of sortedReasons) {
    if (count === 0) continue;
    lines.push(`### \`${reason}\` (${count})`);
    lines.push("");
    let shown = 0;
    for (const r of allRecords) {
      if (r.error) continue;
      for (const rec of r.records) {
        if (shown >= 5) break;
        if (!rec.reasons.includes(reason)) continue;
        lines.push(`- **${rec.domain}**/${rec.projection} × ${rec.role} (${rec.archetype}, mainEntity: ${rec.mainEntity}): \`${rec.intentId}\` → derived \`${rec.derivedSlot}\``);
        shown++;
      }
      if (shown >= 5) break;
    }
    lines.push("");
  }

  // Decision section
  lines.push("## Decision: filter alignment path forward");
  lines.push("");
  const topReason = sortedReasons[0]?.[0];
  const topCount = sortedReasons[0]?.[1] || 0;
  const topPct = ((topCount / totalReasons) * 100).toFixed(1);
  lines.push(`Top blocker: **\`${topReason}\`** (${topPct}%, ${topCount} cases).`);
  lines.push("");
  lines.push("### Path A: align `computeAlternateAssignment` filter под `assignToSlots*`");
  lines.push("");
  lines.push("Заменить `accessibleIntents` (strict) внутри `computeAlternateAssignment` на тот же filter chain, что и `assignToSlots*` (включая `appliesToProjection`, IB whitelist, custom checks).");
  lines.push("");
  lines.push("- ✅ Closes derivedOnly bottleneck.");
  lines.push("- ❌ Couples bridge module к internal assignToSlots* logic. Bridge перестаёт быть чистой утилитой над ontology.");
  lines.push("- ❌ Вид filter logic дублируется или импортируется в bridge.");
  lines.push("");
  lines.push("### Path B: pre-filter derived через `accessibleIntents` для honest like-for-like");
  lines.push("");
  lines.push("В Phase 3a/3c'' validation script post-filter'овать derivedAssignment через `accessibleIntents` перед сравнением.");
  lines.push("");
  lines.push("- ✅ Bridge остаётся чистой утилитой.");
  lines.push("- ✅ `accessibleIntents` becomes canonical filter — derived non-conformant cases помечаются как drift.");
  lines.push("- ❌ Не фактически меняет UI behaviour — только метрика.");
  lines.push("");
  lines.push("### Path C: hybrid — `assignToSlots*` использует `accessibleIntents` как pre-filter");
  lines.push("");
  lines.push("Внутри `assignToSlotsCatalog/Detail` добавить opt-in pre-filter через `accessibleIntents`. Default off (back-compat). Активация в host'е через opts.");
  lines.push("");
  lines.push("- ✅ Single source of truth для accessible intents.");
  lines.push("- ✅ Co-located filter logic.");
  lines.push("- ⚠️ Behavioral change — некоторые intents которые derived раньше принимал, после opt-in перестанут попадать. Risk regression in real domains.");
  lines.push("");
  lines.push("### Recommendation");
  lines.push("");
  lines.push("Зависит от dominant reason class. Если `missing-entity-reference` (intent не упоминает mainEntity) — это **author bug**, intent неправильно структурирован → Path B + warn в derived. Если `role-canExecute-restriction` — это **strict role policy in ontology**, derived должен respect → Path C.");
  lines.push("");
  lines.push("Конкретно (на основе данных):");
  if (topReason === "missing-entity-reference") {
    lines.push(`- ${topPct}% случаев — **\`missing-entity-reference\`**: author не указал \`particles.entities\` или \`creates\`. Это authoring gap, не filter issue. **Path B** + add \`missing-entity-reference\` witness в \`assignToSlots*\` для surface.`);
  } else if (topReason === "role-canExecute-restriction") {
    lines.push(`- ${topPct}% случаев — **\`role-canExecute-restriction\`**: derived не respects role.canExecute. **Path C** — opt-in pre-filter в derived для honest UI.`);
  } else if (topReason === "no-role-defined") {
    lines.push(`- ${topPct}% случаев — **\`no-role-defined\`**: role не задана в ontology. Это incomplete ontology — author должен добавить, либо derived должен fall back на observer-equivalent.`);
  } else {
    lines.push(`- Top reason \`${topReason}\` — нестандартная причина, требуется case-by-case анализ.`);
  }
  lines.push("");

  return lines.join("\n");
}

async function main() {
  console.log("[filter-alignment] Loading 17 domains (incl. meta = idf-on-idf)…");
  const domains = await Promise.all(DOMAIN_NAMES.map(loadDomain));
  const ok = domains.filter((d) => d.ok);
  const failed = domains.filter((d) => !d.ok);
  console.log(`[filter-alignment] Loaded ${ok.length}/${DOMAIN_NAMES.length} (failed: ${failed.map((f) => `${f.id}(${f.error})`).join(", ") || "none"})`);

  const allRecords = [];
  for (const d of ok) {
    process.stdout.write(`  ${d.id}… `);
    try {
      const result = await analyzeDomain(d);
      allRecords.push(result);
      const recs = result.records?.length || 0;
      console.log(`${recs} derivedOnly records`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      allRecords.push({ domain: d.id, error: e.message, records: [] });
    }
  }

  const agg = aggregateReasons(allRecords);
  const date = new Date().toISOString().split("T")[0];
  const jsonOut = path.join(ROOT, "docs", `jointsolver-filter-alignment-${date}.json`);
  const mdOut = path.join(ROOT, "docs", `jointsolver-filter-alignment-${date}.md`);

  fs.writeFileSync(jsonOut, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalRecords: allRecords.reduce((s, r) => s + (r.records?.length || 0), 0),
    domains: allRecords,
  }, null, 2));
  fs.writeFileSync(mdOut, generateMarkdown(allRecords, agg));

  console.log("");
  console.log("[filter-alignment] Output:");
  console.log(`  ${path.relative(ROOT, jsonOut)}`);
  console.log(`  ${path.relative(ROOT, mdOut)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
