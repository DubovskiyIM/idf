#!/usr/bin/env node
/**
 * Salience suggestions — находит alphabetical-fallback witnesses и предлагает
 * `intent.salience` аннотации для разрешения tie'ов.
 *
 * Spec: ~/WebstormProjects/idf-manifest-v2.1/docs/design/intent-salience-spec.md
 *
 * Heuristic winner picking в tie-set:
 *   - intent.creates + effect α:"create" → primary
 *   - effects.α === "replace" на mainEntity → primary (edit)
 *   - intent.particles.confirmation === "enter" → primary (inline-create)
 *   - intent.irreversibility === "high" → secondary (danger — не в first tier)
 *   - effects.α === "remove" → utility (в overflow)
 *   - Default → secondary
 *
 * Output: docs/salience-suggestions.md + .json
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

function intentNameMatches(id, patterns) {
  return patterns.some(re => re.test(id));
}

/**
 * Одна primary рекомендация per tie-set. Picks лучшего кандидата:
 *   1. name matches /^(edit|update)_<mainEntity>$/i — canonical edit action
 *   2. name matches /^(edit|update|rename)_/i — edit-like action
 *   3. name matches /^(publish|confirm|submit|accept|approve)_/i — promotion
 *   4. effects α:"replace" на mainEntity без дополнительных conditions
 *   5. Если ничего не подошло — null (требует ручной judgement)
 */
function pickPrimary(tiedIds, intents, mainEntity) {
  const lowerMain = mainEntity ? mainEntity.toLowerCase() : "";
  const coreEditRe = new RegExp(`^(edit|update)_${lowerMain}$`, "i");
  const editRe = /^(edit|update|rename)_/i;
  const promoteRe = /^(publish|confirm|submit|accept|approve|complete|resolve|finalize)_/i;

  // Tier 1: canonical edit of mainEntity
  for (const id of tiedIds) {
    if (coreEditRe.test(id)) return { id, tier: 1, reason: `canonical edit ${lowerMain}` };
  }

  // Tier 2: edit/update/rename anything
  for (const id of tiedIds) {
    if (editRe.test(id)) return { id, tier: 2, reason: "edit-like action" };
  }

  // Tier 3: promote/confirm/submit action
  for (const id of tiedIds) {
    if (promoteRe.test(id)) return { id, tier: 3, reason: "promotion action" };
  }

  // Tier 4: first intent с replace на mainEntity без conditions
  for (const id of tiedIds) {
    const intent = intents[id];
    if (!intent) continue;
    const effects = intent.particles?.effects || [];
    const conds = (intent.particles?.conditions || []).length + (intent.particles?.witnesses || []).length;
    const replacesMain = effects.some(e =>
      e.α === "replace" && typeof e.target === "string" &&
      (e.target === lowerMain || e.target.startsWith(lowerMain + "."))
    );
    if (replacesMain && conds === 0) {
      return { id, tier: 4, reason: "simple replace on mainEntity" };
    }
  }

  return null;
}

function extractTiedIntents(witness) {
  // Реальная SDK форма alphabetical-fallback witness:
  //   { basis: "alphabetical-fallback", slot, projection, salience,
  //     chosen: <alphaWinnerId>, peers: [...tied others], recommendation: ... }
  if (witness.chosen && Array.isArray(witness.peers)) {
    return [witness.chosen, ...witness.peers];
  }
  // Fallback на альтернативные формы
  if (Array.isArray(witness.tiedIds)) return witness.tiedIds;
  if (Array.isArray(witness.tied)) return witness.tied;
  if (Array.isArray(witness.candidates)) return witness.candidates;
  if (witness.details?.tied) return witness.details.tied;
  return null;
}

function collectAlphabeticalWitnesses(domain) {
  const { ontology, intents, projections, id } = domain;
  const witnessList = [];

  for (const [projId, projection] of Object.entries(projections)) {
    const projFullId = { ...projection, id: projId };
    let art;
    try {
      const artifacts = crystallizeV2(intents, { [projId]: projFullId }, ontology, id, {});
      art = artifacts[projId];
    } catch { continue; }

    const witnesses = art?.witnesses || [];
    for (const w of witnesses) {
      if (w.basis !== "alphabetical-fallback") continue;
      witnessList.push({
        domain: id,
        projectionId: projId,
        mainEntity: projection.mainEntity,
        witness: w,
        tiedIds: extractTiedIntents(w),
      });
    }
  }

  return witnessList;
}

function suggestSalience(witnesses, intents) {
  const suggestions = [];
  // Группируем witnesses по tied-set, чтобы одно предложение на tie
  const seen = new Set();

  for (const w of witnesses) {
    const tiedIds = w.tiedIds;
    if (!tiedIds || tiedIds.length < 2) {
      suggestions.push({
        domain: w.domain,
        projectionId: w.projectionId,
        tied: null,
        note: `Witness без tied-info: ${JSON.stringify(w.witness).slice(0, 200)}`,
      });
      continue;
    }
    const key = `${w.domain}:${[...tiedIds].sort().join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const primary = pickPrimary(tiedIds, intents, w.mainEntity);

    suggestions.push({
      domain: w.domain,
      projectionId: w.projectionId,
      mainEntity: w.mainEntity,
      slot: w.witness.slot,
      salienceScore: w.witness.salience,
      tiedCount: tiedIds.length,
      chosenByAlpha: w.witness.chosen,
      tied: tiedIds,
      recommendation: primary ? [
        { id: primary.id, suggested: "primary", tier: primary.tier, reason: primary.reason },
      ] : [],
      needsManual: !primary,
    });
  }

  return suggestions;
}

function renderMarkdown(data) {
  const { generatedAt, totalWitnesses, byDomain, suggestions } = data;
  const lines = [];
  lines.push(`# Salience suggestions — ${generatedAt.slice(0, 10)}`);
  lines.push("");
  lines.push(`**Generated:** ${generatedAt}`);
  lines.push(`**Alphabetical-fallback witnesses:** ${totalWitnesses}`);
  lines.push("");
  lines.push(`> Каждая tied-group → предложение явного \`intent.salience\` для разрешения ties. Target после apply: alphabetical-fallback count → 0.`);
  lines.push("");

  lines.push(`## Per-domain counts`);
  lines.push("");
  lines.push("| Domain | Witnesses |");
  lines.push("|--------|-----------|");
  for (const [d, c] of Object.entries(byDomain).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${d} | ${c} |`);
  }
  lines.push("");

  lines.push(`## Suggestions`);
  lines.push("");
  for (const s of suggestions) {
    lines.push(`### ${s.domain}/${s.projectionId}` + (s.mainEntity ? ` (mainEntity: ${s.mainEntity})` : ""));
    lines.push("");
    if (!s.tied) {
      lines.push(s.note || "_нет tied data_");
      lines.push("");
      continue;
    }
    lines.push(`**Slot:** ${s.slot || "?"} · **Score:** ${s.salienceScore ?? "?"} · **Chosen (alpha):** \`${s.chosenByAlpha}\` · **Tied total:** ${s.tiedCount}`);
    lines.push("");
    if (s.tied.length <= 8) {
      lines.push(`**Tied intents:** ${s.tied.map(id => `\`${id}\``).join(", ")}`);
    } else {
      lines.push(`**Tied intents (${s.tied.length}):** ${s.tied.slice(0, 6).map(id => `\`${id}\``).join(", ")}, …`);
    }
    lines.push("");
    if (s.recommendation.length === 0) {
      lines.push(`⚠️ **Нужна ручная judgement** — heuristic не нашёл canonical primary.`);
      lines.push("");
      continue;
    }
    for (const r of s.recommendation) {
      lines.push(`✅ **Promote:** \`${r.id}\` → \`salience: "${r.suggested}"\` _(tier ${r.tier}: ${r.reason})_`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const domains = [];
  for (const name of DOMAIN_NAMES) {
    domains.push(await loadDomain(name));
  }

  let allWitnesses = [];
  const byDomain = {};
  for (const d of domains) {
    if (!d.ok) continue;
    const ws = collectAlphabeticalWitnesses(d);
    byDomain[d.id] = ws.length;
    allWitnesses = allWitnesses.concat(ws);
  }

  const intentsByDomain = {};
  for (const d of domains) {
    if (d.ok) intentsByDomain[d.id] = d.intents;
  }

  // Группируем по доменам — предложения per-domain
  const suggestions = [];
  for (const d of domains) {
    if (!d.ok) continue;
    const domainWs = allWitnesses.filter(w => w.domain === d.id);
    const sugg = suggestSalience(domainWs, d.intents);
    suggestions.push(...sugg);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalWitnesses: allWitnesses.length,
    byDomain,
    witnesses: allWitnesses,
    suggestions,
  };

  const docsDir = path.join(ROOT, "docs");
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  const jsonPath = path.join(docsDir, "salience-suggestions.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`wrote ${path.relative(ROOT, jsonPath)}`);

  const mdPath = path.join(docsDir, "salience-suggestions.md");
  fs.writeFileSync(mdPath, renderMarkdown(report));
  console.log(`wrote ${path.relative(ROOT, mdPath)}`);

  console.log(`\nTotal alphabetical-fallback witnesses: ${allWitnesses.length}`);
  console.log(`Domains affected: ${Object.keys(byDomain).filter(d => byDomain[d] > 0).length}`);
  console.log(`Suggestions: ${suggestions.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
