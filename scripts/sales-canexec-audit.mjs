#!/usr/bin/env node
/**
 * sales-canexec-audit — Phase 3d.3 prep.
 *
 * Generate detailed audit dataset для sales role-canExecute violations:
 * для каждого intent в derived UI который не в role.canExecute, output
 * decision matrix:
 *   { intent, role, projection, slot, recommendation }
 *
 * Recommendation heuristics:
 *   - intent uses 'agent' / 'admin' role pattern → typically intentional
 *     (agents act on behalf, admins see all)
 *   - intent.creates === mainEntity → check if role should create
 *     (probably bug for non-creator roles)
 *   - intent has 'view' / 'see' / 'read' verb → observer-eligible (likely intentional)
 *   - else → potential bug, manual review needed
 *
 * Output:
 *   docs/sales-canexec-audit-2026-04-27.json — full dataset
 *   docs/sales-canexec-audit-2026-04-27.md — actionable groups
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crystallizeV2 } from "@intent-driven/core";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

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

function classifyRecommendation(intentId, intent, role) {
  const lower = intentId.toLowerCase();
  const verbs = lower.split("_");

  // 1. Read-only verbs — observer-friendly (typically intentional)
  if (verbs.some((v) => ["view", "see", "read", "browse", "filter", "search", "sort", "open", "close"].includes(v))) {
    return { kind: "intentional-read", reason: "read-only verb (observer/agent eligible)" };
  }

  // 2. Agent / admin / observer roles — typically see all
  if (["agent", "admin", "observer", "auditor", "moderator"].includes(role)) {
    return { kind: "intentional-system-role", reason: `${role} typically has broad access` };
  }

  // 3. Cross-role intent (suggests intentional shared UI)
  if (verbs.some((v) => ["share", "report", "flag", "rate", "review"].includes(v))) {
    return { kind: "intentional-cross-role", reason: "social/community action" };
  }

  // 4. Creator/edit on mainEntity — probably bug for non-owner
  if (intent?.creates) {
    return { kind: "likely-bug", reason: `intent creates ${intent.creates} — non-creator role shouldn't see` };
  }
  const effects = intent?.particles?.effects || [];
  const hasReplace = effects.some((e) => (e?.α || e?.alpha) === "replace");
  const hasRemove = effects.some((e) => (e?.α || e?.alpha) === "remove");
  if (hasReplace || hasRemove) {
    return { kind: "likely-bug", reason: "mutation intent — non-permitted role shouldn't see" };
  }

  // 5. Default — manual review
  return { kind: "manual-review", reason: "no clear pattern" };
}

async function main() {
  const file = path.join(ROOT, "src", "domains", "sales", "domain.js");
  const mod = await import(pathToFileURL(file).href);
  const intents = mod.INTENTS || {};
  const ontology = mod.ONTOLOGY || null;
  const projections = mod.PROJECTIONS || {};

  const roles = Object.keys(ontology?.roles || {});
  console.log(`[sales-canexec-audit] Loaded ${Object.keys(intents).length} intents, ${roles.length} roles, ${Object.keys(projections).length} projections`);

  // Run без respectRoleCanExecute (получаем full derived) и собираем violations
  const violations = [];
  for (const role of roles) {
    let artifacts;
    try {
      artifacts = crystallizeV2(intents, projections, ontology, "sales", { role });
    } catch (e) { continue; }

    const allowedSet = new Set(ontology?.roles?.[role]?.canExecute || []);

    for (const [projId, projection] of Object.entries(projections)) {
      const kind = projection.archetype || projection.kind || null;
      if (kind !== "catalog" && kind !== "detail") continue;
      const artifact = artifacts[projId];
      if (!artifact || !artifact.slots) continue;

      const derived = extractDerivedAssignment(artifact.slots);
      for (const [intentId, slot] of derived) {
        if (allowedSet.has(intentId)) continue; // not violation
        const intent = intents[intentId];
        const rec = classifyRecommendation(intentId, intent, role);
        violations.push({
          projection: projId, role, archetype: kind,
          mainEntity: projection.mainEntity,
          intentId, slot,
          ...rec,
        });
      }
    }
  }

  // Group by intentId
  const byIntent = new Map();
  for (const v of violations) {
    if (!byIntent.has(v.intentId)) byIntent.set(v.intentId, { intent: intents[v.intentId], rolesViewed: new Set(), records: [] });
    const ent = byIntent.get(v.intentId);
    ent.rolesViewed.add(v.role);
    ent.records.push(v);
  }

  // Group by role
  const byRole = new Map();
  for (const v of violations) {
    if (!byRole.has(v.role)) byRole.set(v.role, []);
    byRole.get(v.role).push(v);
  }

  // Recommendation summary
  const kindCounts = new Map();
  for (const v of violations) kindCounts.set(v.kind, (kindCounts.get(v.kind) || 0) + 1);

  const date = new Date().toISOString().split("T")[0];
  const jsonOut = path.join(ROOT, "docs", `sales-canexec-audit-${date}.json`);
  const mdOut = path.join(ROOT, "docs", `sales-canexec-audit-${date}.md`);

  fs.writeFileSync(jsonOut, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalViolations: violations.length,
    violations,
    byIntent: Object.fromEntries([...byIntent.entries()].map(([id, v]) => [id, {
      rolesViewed: [...v.rolesViewed], count: v.records.length,
    }])),
    kindCounts: Object.fromEntries(kindCounts),
  }, null, 2));

  // Markdown
  const lines = [];
  lines.push("# Sales canExecute audit — Phase 3d.3 prep");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`**Total violations:** ${violations.length}`);
  lines.push("");
  lines.push("## Recommendation distribution");
  lines.push("");
  lines.push("| Kind | Count | % |");
  lines.push("|------|-------|---|");
  const total = violations.length;
  for (const [kind, count] of [...kindCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| \`${kind}\` | ${count} | ${((count / total) * 100).toFixed(1)}% |`);
  }
  lines.push("");

  // By role
  lines.push("## By role");
  lines.push("");
  lines.push("| Role | Violations | Top intents |");
  lines.push("|------|-----------|-------------|");
  for (const [role, rs] of [...byRole.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const intentCounts = new Map();
    for (const r of rs) intentCounts.set(r.intentId, (intentCounts.get(r.intentId) || 0) + 1);
    const topIntents = [...intentCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, c]) => `\`${id}\`(${c})`).join(", ");
    lines.push(`| ${role} | ${rs.length} | ${topIntents} |`);
  }
  lines.push("");

  // Top intents
  lines.push("## Top violating intents");
  lines.push("");
  lines.push("| Intent | Roles | Count | Recommendation kind |");
  lines.push("|--------|-------|-------|--------------------|");
  const sortedIntents = [...byIntent.entries()].sort((a, b) => b[1].records.length - a[1].records.length);
  for (const [id, ent] of sortedIntents.slice(0, 30)) {
    const kind = ent.records[0].kind;
    lines.push(`| \`${id}\` | ${[...ent.rolesViewed].join(", ")} | ${ent.records.length} | \`${kind}\` |`);
  }
  lines.push("");

  // Likely bugs (priority)
  lines.push("## Priority: likely bugs (manual review needed)");
  lines.push("");
  const bugs = violations.filter((v) => v.kind === "likely-bug" || v.kind === "manual-review");
  const bugByIntent = new Map();
  for (const v of bugs) {
    if (!bugByIntent.has(v.intentId)) bugByIntent.set(v.intentId, { roles: new Set(), reasons: new Set() });
    bugByIntent.get(v.intentId).roles.add(v.role);
    bugByIntent.get(v.intentId).reasons.add(v.reason);
  }
  lines.push("| Intent | Roles where shown | Reasons |");
  lines.push("|--------|------------------|---------|");
  for (const [id, ent] of [...bugByIntent.entries()].sort((a, b) => b[1].roles.size - a[1].roles.size).slice(0, 20)) {
    lines.push(`| \`${id}\` | ${[...ent.roles].join(", ")} | ${[...ent.reasons].join("; ")} |`);
  }
  lines.push("");

  fs.writeFileSync(mdOut, lines.join("\n"));

  console.log("");
  console.log(`Output:`);
  console.log(`  ${path.relative(ROOT, jsonOut)}`);
  console.log(`  ${path.relative(ROOT, mdOut)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
