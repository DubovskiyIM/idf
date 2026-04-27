#!/usr/bin/env node
/**
 * jointsolver-default-flip-audit — A2 follow-up: SDK default-flip audit.
 *
 * Step 5 из tier-routing roadmap (idf-sdk #434/#436/#438): прежде чем
 * flip'нуть `salienceDrivenRouting` default с opt-in (===true) на opt-out
 * (!==false), нужен audit — какие creator-of-main intents переедут
 * toolbar→hero автоматически по всем 17 доменам.
 *
 * Скрипт purely analytical — НЕ запускает crystallizeV2. Для каждого
 * домена × catalog projection × creator-of-main intent предсказывает
 * tier classification через `classifyIntentRole(intent, mainEntity)`.
 *
 * Out: docs/jointsolver-default-flip-audit-YYYY-MM-DD.{json,md}
 *
 * Categories per intent:
 *   - explicit-primary       — intent.salience >= 80
 *   - implicit-primary       — creator-of-main без explicit salience (#438 закроет)
 *   - explicit-non-primary   — intent.salience задан но < 80 (не promote)
 *   - non-creator            — не creator-of-main (никогда не promote)
 *
 * Risk surface: implicit-primary intents — основной target audit'а.
 * Если автор не задал explicit salience, они полагаются на default
 * (toolbar) — flip перенесёт их в hero. Author может не ожидать.
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { classifyIntentRole } from "@intent-driven/core";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const DOMAIN_NAMES = [
  "booking", "planning", "workflow", "messenger", "sales",
  "lifequest", "reflect", "invest", "delivery", "freelance",
  "compliance", "keycloak", "argocd", "notion", "automation",
  "gravitino", "meta",
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

function projectionKind(p) {
  return p.archetype || p.kind || null;
}

function classifyCandidate(intent, mainEntity) {
  const isCreator =
    typeof intent?.creates === "string" && intent.creates === mainEntity;
  if (!isCreator) return { category: "non-creator", reason: "creates !== mainEntity" };

  const hasExplicit = typeof intent?.salience === "number";
  if (hasExplicit) {
    if (intent.salience >= 80)
      return { category: "explicit-primary", reason: `salience=${intent.salience} (>=80)` };
    return { category: "explicit-non-primary", reason: `salience=${intent.salience} (<80)` };
  }

  // No explicit salience → classifyIntentRole returns "primary" for creator-of-main
  const roles = classifyIntentRole(intent, mainEntity);
  if (roles.includes("primary"))
    return { category: "implicit-primary", reason: "creator-of-main, no explicit salience" };

  return { category: "non-creator", reason: "edge: no explicit salience, not classified primary" };
}

async function auditDomain(d) {
  const { ontology, intents, projections, id } = d;

  const candidates = [];
  for (const [projId, proj] of Object.entries(projections)) {
    const kind = projectionKind(proj);
    if (kind !== "catalog") continue; // только catalog имеет hero promotion
    const mainEntity = proj.mainEntity;
    if (!mainEntity) continue;

    for (const [intentId, intent] of Object.entries(intents)) {
      const cls = classifyCandidate(intent, mainEntity);
      if (cls.category === "non-creator") continue; // только creators interesting
      candidates.push({
        projection: projId,
        mainEntity,
        intentId,
        intentName: intent.name || intentId,
        category: cls.category,
        reason: cls.reason,
        currentSalience: intent.salience,
        confirmation: intent.particles?.confirmation || intent.confirmation,
      });
    }
  }

  // Per-intent (one row per unique creator intent, even если в нескольких projections)
  const perIntent = new Map();
  for (const c of candidates) {
    const key = c.intentId;
    if (!perIntent.has(key)) {
      perIntent.set(key, { ...c, projections: [c.projection] });
    } else {
      perIntent.get(key).projections.push(c.projection);
    }
  }

  return {
    domain: id,
    candidates,
    uniqueIntents: [...perIntent.values()],
    featureEnabled: ontology?.features?.salienceDrivenRouting === true,
  };
}

function generateMarkdown(domains) {
  const lines = [];
  lines.push("# JointSolver default-flip audit (creator-of-main → hero promotion)");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("> Predicts какие creator-of-main intents переедут `toolbar → hero`");
  lines.push("> автоматически когда SDK default-flip'нет `salienceDrivenRouting`");
  lines.push("> с opt-in (`=== true`) на opt-out (`!== false`). Только catalog projections.");
  lines.push("");

  let totals = {
    "explicit-primary": 0,
    "implicit-primary": 0,
    "explicit-non-primary": 0,
  };
  const perDomain = [];

  for (const d of domains) {
    const counts = {
      "explicit-primary": 0,
      "implicit-primary": 0,
      "explicit-non-primary": 0,
    };
    const intentCounts = {
      "explicit-primary": 0,
      "implicit-primary": 0,
      "explicit-non-primary": 0,
    };
    for (const c of d.candidates) counts[c.category] = (counts[c.category] || 0) + 1;
    for (const u of d.uniqueIntents) intentCounts[u.category] = (intentCounts[u.category] || 0) + 1;
    for (const [k, v] of Object.entries(counts)) totals[k] = (totals[k] || 0) + v;
    perDomain.push({ id: d.domain, counts, intentCounts, featureEnabled: d.featureEnabled, candidates: d.candidates, uniqueIntents: d.uniqueIntents });
  }

  lines.push("## Per-domain summary (unique creator-of-main intents in catalog)");
  lines.push("");
  lines.push("| Domain | features.salienceDrivenRouting | explicit-primary | implicit-primary | explicit-non-primary | Total candidates |");
  lines.push("|---|---|---:|---:|---:|---:|");
  for (const d of perDomain) {
    const total = d.intentCounts["explicit-primary"] + d.intentCounts["implicit-primary"] + d.intentCounts["explicit-non-primary"];
    lines.push(`| ${d.id} | ${d.featureEnabled ? "✓" : "—"} | ${d.intentCounts["explicit-primary"]} | ${d.intentCounts["implicit-primary"]} | ${d.intentCounts["explicit-non-primary"]} | ${total} |`);
  }

  const grandUniqueExpl = perDomain.reduce((s, d) => s + d.intentCounts["explicit-primary"], 0);
  const grandUniqueImpl = perDomain.reduce((s, d) => s + d.intentCounts["implicit-primary"], 0);
  const grandUniqueExplNon = perDomain.reduce((s, d) => s + d.intentCounts["explicit-non-primary"], 0);
  lines.push(`| **TOTAL** | — | **${grandUniqueExpl}** | **${grandUniqueImpl}** | **${grandUniqueExplNon}** | **${grandUniqueExpl + grandUniqueImpl + grandUniqueExplNon}** |`);
  lines.push("");

  lines.push("## Categories explained");
  lines.push("");
  lines.push("- **explicit-primary** — `intent.salience >= 80`, явный author signal. Default-flip их уже промотирует через #434. **Безопасно**.");
  lines.push("- **implicit-primary** — creator-of-main БЕЗ explicit salience. Default-flip их промотирует через #438 (classifyIntentRole consultation). **Главный risk surface** — author может не ожидать hero.");
  lines.push("- **explicit-non-primary** — `intent.salience` задан и < 80 (secondary/navigation/utility). Default-flip их **НЕ** промотирует.");
  lines.push("");

  // Implicit-primary breakdown — основной risk surface
  lines.push("## Implicit-primary intents (default-flip risk surface)");
  lines.push("");
  lines.push("Intents которые переедут toolbar→hero автоматически если #438 + default-flip merged. Для каждого автор НЕ задал salience explicit — полагается на default toolbar placement.");
  lines.push("");
  lines.push("| Domain | Intent | Confirmation | Projections | Notes |");
  lines.push("|---|---|---|---|---|");
  for (const d of perDomain) {
    const impl = d.uniqueIntents.filter((u) => u.category === "implicit-primary");
    for (const u of impl) {
      const projs = u.projections.join(", ");
      lines.push(`| ${d.id} | \`${u.intentId}\` | ${u.confirmation || "—"} | ${projs} | ${u.intentName} |`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

async function main() {
  console.log("[default-flip-audit] Loading 17 domains…");
  const domains = await Promise.all(DOMAIN_NAMES.map(loadDomain));
  const ok = domains.filter((d) => d.ok);
  console.log(`[default-flip-audit] Loaded ${ok.length}/${DOMAIN_NAMES.length}`);

  const results = [];
  for (const d of ok) {
    process.stdout.write(`  ${d.id}… `);
    const audit = await auditDomain(d);
    const total = audit.uniqueIntents.length;
    const impl = audit.uniqueIntents.filter((u) => u.category === "implicit-primary").length;
    console.log(`${total} unique creator candidates (${impl} implicit-primary)`);
    results.push(audit);
  }

  const date = new Date().toISOString().split("T")[0];
  const jsonOut = path.join(ROOT, "docs", `jointsolver-default-flip-audit-${date}.json`);
  const mdOut = path.join(ROOT, "docs", `jointsolver-default-flip-audit-${date}.md`);

  fs.writeFileSync(jsonOut, JSON.stringify({ generatedAt: new Date().toISOString(), domains: results }, null, 2));
  fs.writeFileSync(mdOut, generateMarkdown(results));

  console.log("");
  console.log(`[default-flip-audit] Output:`);
  console.log(`  ${path.relative(ROOT, jsonOut)}`);
  console.log(`  ${path.relative(ROOT, mdOut)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
