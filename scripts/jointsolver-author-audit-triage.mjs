#!/usr/bin/env node
/**
 * jointsolver-author-audit-triage — A2 follow-up: author audit.
 *
 * Цель: после Phase 7 + 3d.3 default flip остаётся ~300 divergent intents
 * между derived (assignToSlots*) и alternate (computeAlternateAssignment).
 * Скрипт классифицирует каждый divergent intent и предлагает одну из категорий:
 *
 *   - explicit-already       — у intent уже есть `salience` (не действуем)
 *   - propose-primary        — alternate → primary slot, signals совпадают (creator-of-main / phase-transition)
 *   - propose-secondary      — alternate → secondary slot, signals совпадают
 *   - propose-navigation     — alternate → navigation slot, signals совпадают (search / list-utility)
 *   - propose-utility        — alternate → overflow slot, signals слабые (read / utility)
 *   - slot-model-mismatch    — alternate-only / derived-only (один solver не определил slot)
 *   - manual-review          — divergent без чёткого signal'а
 *
 * Output:
 *   docs/jointsolver-author-audit-triage-YYYY-MM-DD.json
 *   docs/jointsolver-author-audit-triage-YYYY-MM-DD.md
 *
 * Backlog: idf §A2 author audit (post-3d.3).
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const DOMAIN_NAMES = [
  "booking", "planning", "workflow", "messenger", "sales",
  "lifequest", "reflect", "invest", "delivery", "freelance",
  "compliance", "keycloak", "argocd", "notion", "automation",
  "gravitino", "meta",
];

const PRIMARY_SLOTS = new Set(["primaryCTA", "hero"]);
const SECONDARY_SLOTS = new Set(["secondary"]);
const NAVIGATION_SLOTS = new Set(["toolbar"]);
const OVERFLOW_SLOTS = new Set(["overlay", "footer"]);

function inferTierFromSlot(slot) {
  if (!slot) return null;
  if (PRIMARY_SLOTS.has(slot)) return "primary";
  if (SECONDARY_SLOTS.has(slot)) return "secondary";
  if (NAVIGATION_SLOTS.has(slot)) return "navigation";
  if (OVERFLOW_SLOTS.has(slot)) return "utility";
  return null;
}

function intentSignals(intent, mainEntity) {
  const eff = intent?.particles?.effects || [];
  const witnesses = intent?.particles?.witnesses || [];
  const mainLower = (mainEntity || "").toLowerCase();

  const isCreatorOfMain =
    intent?.creates && mainEntity && intent.creates === mainEntity;

  const isPhaseTransitionOnMain = eff.some((e) => {
    const a = e?.α || e?.alpha;
    if (a !== "replace") return false;
    const t = typeof e?.target === "string" ? e.target.toLowerCase() : "";
    return mainLower && t === `${mainLower}.status`;
  });

  const isReplaceOnMain = eff.some((e) => {
    const a = e?.α || e?.alpha;
    if (a !== "replace") return false;
    const t = typeof e?.target === "string" ? e.target.toLowerCase() : "";
    return mainLower && t.startsWith(`${mainLower}.`);
  });

  const isRemoveOnMain = eff.some((e) => {
    const a = e?.α || e?.alpha;
    if (a !== "remove") return false;
    const t = typeof e?.target === "string" ? e.target.toLowerCase() : "";
    return mainLower && t === mainLower;
  });

  const isSearch = witnesses.some((w) => {
    const id = typeof w === "string" ? w : w?.id || "";
    return id === "query" || id === "search" || id.endsWith("_query");
  });

  const hasExplicitSalience =
    typeof intent?.salience === "number" || typeof intent?.salience === "string";

  return {
    isCreatorOfMain,
    isPhaseTransitionOnMain,
    isReplaceOnMain,
    isRemoveOnMain,
    isSearch,
    hasExplicitSalience,
    salienceValue: intent?.salience,
  };
}

function classifyDiff(diff, intent, mainEntity) {
  const signals = intentSignals(intent, mainEntity);

  if (signals.hasExplicitSalience) {
    return { category: "explicit-already", reason: `intent.salience=${JSON.stringify(signals.salienceValue)}` };
  }

  if (diff.kind === "derived-only" || diff.kind === "alternate-only") {
    return {
      category: "slot-model-mismatch",
      reason: diff.kind === "derived-only"
        ? `derived placed in ${diff.derived}, alternate did not place`
        : `alternate placed in ${diff.alternate}, derived did not place`,
    };
  }

  // diff.kind === "divergent" — сравниваем slot tiers
  const dTier = inferTierFromSlot(diff.derived);
  const aTier = inferTierFromSlot(diff.alternate);

  // Creator-of-main → strong primary signal
  if (signals.isCreatorOfMain) {
    if (aTier === "primary") {
      return {
        category: "propose-primary",
        reason: `creator-of-main(${mainEntity}); alternate→${diff.alternate} (primary tier)`,
      };
    }
    if (dTier === "primary") {
      return {
        category: "propose-primary",
        reason: `creator-of-main(${mainEntity}); derived→${diff.derived} (primary tier) — lock`,
      };
    }
  }

  // Phase-transition → secondary
  if (signals.isPhaseTransitionOnMain) {
    if (aTier === "secondary") {
      return {
        category: "propose-secondary",
        reason: `phase-transition on ${mainEntity}.status; alternate→${diff.alternate} (secondary)`,
      };
    }
    if (dTier === "secondary") {
      return {
        category: "propose-secondary",
        reason: `phase-transition on ${mainEntity}.status; derived→${diff.derived} (secondary) — lock`,
      };
    }
  }

  // Search → navigation
  if (signals.isSearch) {
    if (aTier === "navigation") {
      return {
        category: "propose-navigation",
        reason: `search-utility (witness:query); alternate→${diff.alternate}`,
      };
    }
    if (dTier === "navigation") {
      return {
        category: "propose-navigation",
        reason: `search-utility; derived→${diff.derived} — lock`,
      };
    }
  }

  // Remove-on-main → utility (destructive lives in overlay)
  if (signals.isRemoveOnMain) {
    return {
      category: "propose-utility",
      reason: `remove on ${mainEntity}; destructive → utility tier`,
    };
  }

  // Replace-on-main без phase-transition → utility (regular edit)
  if (signals.isReplaceOnMain && !signals.isPhaseTransitionOnMain) {
    if (aTier === "utility" || dTier === "utility") {
      return {
        category: "propose-utility",
        reason: `replace on ${mainEntity} (regular edit); ${aTier === "utility" ? `alternate→${diff.alternate}` : `derived→${diff.derived}`}`,
      };
    }
  }

  return {
    category: "manual-review",
    reason: `divergent without strong signal: derived=${diff.derived} alternate=${diff.alternate}`,
  };
}

async function loadDomain(name) {
  const file = path.join(ROOT, "src", "domains", name, "domain.js");
  try {
    const mod = await import(pathToFileURL(file).href);
    return {
      id: name,
      ontology: mod.ONTOLOGY || null,
      intents: mod.INTENTS || {},
      ok: true,
    };
  } catch (e) {
    return { id: name, ok: false, error: e.message };
  }
}

async function main() {
  const date = new Date().toISOString().split("T")[0];
  const inputFile = path.join(ROOT, "docs", `jointsolver-divergence-phase3e-${date}.json`);

  if (!fs.existsSync(inputFile)) {
    console.error(`Missing ${inputFile}. Run jointsolver-divergence-collect-with-canexec.mjs first.`);
    process.exit(1);
  }

  const input = JSON.parse(fs.readFileSync(inputFile, "utf-8"));

  console.log("[author-audit] Loading 17 domains…");
  const domains = await Promise.all(DOMAIN_NAMES.map(loadDomain));
  const intentsByDomain = new Map();
  for (const d of domains) {
    if (d.ok) intentsByDomain.set(d.id, d.intents);
  }

  const proposals = [];
  const counts = {
    "explicit-already": 0,
    "propose-primary": 0,
    "propose-secondary": 0,
    "propose-navigation": 0,
    "propose-utility": 0,
    "slot-model-mismatch": 0,
    "manual-review": 0,
  };

  for (const dom of input.domains) {
    if (!dom.records) continue;
    const intents = intentsByDomain.get(dom.domain) || {};
    for (const rec of dom.records) {
      if (!rec.diff) continue;
      for (const d of rec.diff) {
        const intent = intents[d.intentId];
        if (!intent) continue; // unknown
        const cls = classifyDiff(d, intent, rec.mainEntity);
        counts[cls.category] = (counts[cls.category] || 0) + 1;
        proposals.push({
          domain: dom.domain,
          projection: rec.projection,
          role: rec.role,
          archetype: rec.archetype,
          mainEntity: rec.mainEntity,
          intentId: d.intentId,
          derived: d.derived,
          alternate: d.alternate,
          kind: d.kind,
          category: cls.category,
          reason: cls.reason,
        });
      }
    }
  }

  // Per-(intent, domain) — какие категории встречаются у одного intent в разных проекциях
  const perIntent = new Map();
  for (const p of proposals) {
    const key = `${p.domain}::${p.intentId}`;
    if (!perIntent.has(key)) {
      perIntent.set(key, {
        domain: p.domain,
        intentId: p.intentId,
        categories: new Set(),
        examples: [],
      });
    }
    const e = perIntent.get(key);
    e.categories.add(p.category);
    e.examples.push({
      projection: p.projection,
      role: p.role,
      archetype: p.archetype,
      kind: p.kind,
      derived: p.derived,
      alternate: p.alternate,
      category: p.category,
    });
  }

  const intentSummary = [...perIntent.values()].map((e) => ({
    domain: e.domain,
    intentId: e.intentId,
    categories: [...e.categories],
    proposalCount: e.examples.length,
    primaryCategory: pickPrimaryCategory([...e.categories]),
    examples: e.examples,
  }));

  const jsonOut = path.join(ROOT, "docs", `jointsolver-author-audit-triage-${date}.json`);
  const mdOut = path.join(ROOT, "docs", `jointsolver-author-audit-triage-${date}.md`);

  fs.writeFileSync(
    jsonOut,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceDivergence: path.basename(inputFile),
        counts,
        proposals,
        intentSummary,
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(mdOut, generateMarkdown(counts, intentSummary));

  console.log("");
  console.log("[author-audit] Triage counts:");
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(24)} ${v}`);
  }
  console.log("");
  console.log("[author-audit] Output:");
  console.log(`  ${path.relative(ROOT, jsonOut)}`);
  console.log(`  ${path.relative(ROOT, mdOut)}`);
}

function pickPrimaryCategory(categories) {
  // Приоритет: explicit-already > propose-primary > propose-secondary >
  // propose-navigation > propose-utility > slot-model-mismatch > manual-review
  const order = [
    "explicit-already",
    "propose-primary",
    "propose-secondary",
    "propose-navigation",
    "propose-utility",
    "slot-model-mismatch",
    "manual-review",
  ];
  for (const o of order) if (categories.includes(o)) return o;
  return categories[0];
}

function generateMarkdown(counts, intentSummary) {
  const lines = [];
  lines.push("# JointSolver author audit — triage");
  lines.push("");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("Per-intent triage над divergent diff'ом из Phase 3e (post-3d.3 default flip).");
  lines.push("Каждое intent классифицировано по сильнейшему signal'у; intents в нескольких");
  lines.push("проекциях агрегированы (primaryCategory = highest-priority).");
  lines.push("");

  lines.push("## Counts (per individual diff record)");
  lines.push("");
  lines.push("| Category | Count |");
  lines.push("|---|---:|");
  for (const [k, v] of Object.entries(counts)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push("");

  // Per-intent counts
  const intentByCategory = new Map();
  for (const e of intentSummary) {
    const c = e.primaryCategory;
    if (!intentByCategory.has(c)) intentByCategory.set(c, []);
    intentByCategory.get(c).push(e);
  }

  lines.push("## Counts (per unique intent)");
  lines.push("");
  lines.push("| Category | Unique intents |");
  lines.push("|---|---:|");
  for (const [k, arr] of intentByCategory.entries()) {
    lines.push(`| ${k} | ${arr.length} |`);
  }
  lines.push(`| **Total** | **${intentSummary.length}** |`);
  lines.push("");

  // Per-domain breakdown of propose-*
  const proposable = intentSummary.filter((e) => e.primaryCategory.startsWith("propose-"));
  const byDomain = new Map();
  for (const e of proposable) {
    if (!byDomain.has(e.domain)) byDomain.set(e.domain, []);
    byDomain.get(e.domain).push(e);
  }

  lines.push("## Proposable annotations by domain");
  lines.push("");
  lines.push("| Domain | propose-primary | propose-secondary | propose-navigation | propose-utility | Total |");
  lines.push("|---|---:|---:|---:|---:|---:|");
  for (const [dom, arr] of byDomain) {
    const c = { p: 0, s: 0, n: 0, u: 0 };
    for (const e of arr) {
      if (e.primaryCategory === "propose-primary") c.p++;
      else if (e.primaryCategory === "propose-secondary") c.s++;
      else if (e.primaryCategory === "propose-navigation") c.n++;
      else if (e.primaryCategory === "propose-utility") c.u++;
    }
    lines.push(`| ${dom} | ${c.p} | ${c.s} | ${c.n} | ${c.u} | ${arr.length} |`);
  }
  lines.push("");

  // Top manual-review intents (per domain)
  const manualReview = intentSummary.filter((e) => e.primaryCategory === "manual-review");
  lines.push(`## Manual-review intents (${manualReview.length})`);
  lines.push("");
  lines.push("| Domain | Intent | Slot pairs (derived→alternate) |");
  lines.push("|---|---|---|");
  for (const e of manualReview.slice(0, 80)) {
    const pairs = [...new Set(e.examples.map((x) => `${x.derived ?? "—"}→${x.alternate ?? "—"}`))].join(", ");
    lines.push(`| ${e.domain} | \`${e.intentId}\` | ${pairs} |`);
  }
  if (manualReview.length > 80) lines.push(`| _…+${manualReview.length - 80}_ | | |`);
  lines.push("");

  return lines.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
