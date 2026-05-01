#!/usr/bin/env node
/**
 * jointsolver-apply-salience — A2 author audit applier (DORMANT MODE).
 *
 * Эмпирический findings: текущий `assignToSlotsCatalog/Detail` не консультирует
 * `intent.salience` для slot-routing решений (только для in-slot ordering).
 * `computeAlternateAssignment` использует salience через `classifyIntentRole`.
 * Поэтому host-side annotations с numeric salience НЕ улучшают agreement
 * метрику между derived и alternate (verified 2026-04-27 — 507→501 agreed).
 *
 * Этот script сохраняется как dormant tooling: когда SDK gains tier-driven
 * derived routing (follow-up SDK ticket), эти аннотации станут active.
 *
 * По умолчанию пишет ТОЛЬКО data-файлы `pattern-bank/salience-overrides/<dom>.json`,
 * НЕ модифицируя domain.js. Активация sidecar-style merge — отдельный шаг.
 *
 * Опции:
 *   --dry              — печать без записи
 *   --domains=X,Y,Z    — список доменов через запятую (default: все proposable)
 *   --primary          — только propose-primary
 *   --utility          — только propose-utility
 *   --apply-host       — DEPRECATED: модифицировать domain.js + intent-salience.js
 *                        (эмпирически не улучшает метрику; см. findings doc)
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry");
const ONLY_PRIMARY = args.has("--primary");
const ONLY_UTILITY = args.has("--utility");
const APPLY_HOST = args.has("--apply-host");
const domainsArg = [...args].find((a) => a.startsWith("--domains="));
const DOMAINS_FILTER = domainsArg ? domainsArg.replace("--domains=", "").split(",") : null;

// SDK ожидает intent.salience как NUMBER. Маппинг tier → numeric:
//   primary  ≥ 80 → 80
//   secondary 60-79 → 70
//   navigation 30-59 → 40
//   utility   < 30 → 10
const CATEGORY_TO_TIER = {
  "propose-primary": 80,
  "propose-secondary": 70,
  "propose-navigation": 40,
  "propose-utility": 10,
};

const date = new Date().toISOString().split("T")[0];
const triageFile = path.join(ROOT, "docs", `jointsolver-author-audit-triage-${date}.json`);

if (!fs.existsSync(triageFile)) {
  console.error(`Missing ${triageFile}. Run jointsolver-author-audit-triage.mjs first.`);
  process.exit(1);
}

const triage = JSON.parse(fs.readFileSync(triageFile, "utf-8"));

const byDomain = new Map();
for (const e of triage.intentSummary) {
  const cat = e.primaryCategory;
  if (!CATEGORY_TO_TIER[cat]) continue;
  if (ONLY_PRIMARY && cat !== "propose-primary") continue;
  if (ONLY_UTILITY && cat !== "propose-utility") continue;
  if (DOMAINS_FILTER && !DOMAINS_FILTER.includes(e.domain)) continue;
  if (!byDomain.has(e.domain)) byDomain.set(e.domain, new Map());
  byDomain.get(e.domain).set(e.intentId, CATEGORY_TO_TIER[cat]);
}

function tierLabel(num) {
  if (num >= 80) return "primary";
  if (num >= 60) return "secondary";
  if (num >= 30) return "navigation";
  return "utility";
}

console.log(`[apply-salience] ${byDomain.size} domains will receive salience overrides:`);
for (const [dom, m] of byDomain) {
  const counts = { primary: 0, secondary: 0, navigation: 0, utility: 0 };
  for (const tier of m.values()) counts[tierLabel(tier)]++;
  console.log(
    `  ${dom.padEnd(14)} ${m.size} intent(s) (` +
      Object.entries(counts).filter(([_, c]) => c > 0).map(([k, v]) => `${v} ${k}`).join(", ") +
      `)`,
  );
}

if (DRY) {
  console.log("");
  console.log("[apply-salience] --dry: пропускаем запись файлов");
  process.exit(0);
}

console.log("");
let changes = 0;

const dataDir = path.join(ROOT, "docs", "salience-overrides");
fs.mkdirSync(dataDir, { recursive: true });

for (const [dom, overrides] of byDomain) {
  // 1. Write data-only JSON в docs/salience-overrides/<dom>.json
  const entries = [...overrides.entries()].sort(([a], [b]) => a.localeCompare(b));
  const data = {
    domain: dom,
    generatedAt: new Date().toISOString(),
    note: "Numeric salience hints from author audit. NOT auto-applied to host (см. findings doc).",
    overrides: Object.fromEntries(entries.map(([id, tier]) => [id, { salience: tier, tier: tierLabel(tier) }])),
  };
  const dataPath = path.join(dataDir, `${dom}.json`);
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  console.log(`[apply-salience] wrote ${path.relative(ROOT, dataPath)}`);
  changes++;

  if (!APPLY_HOST) continue;

  // 2. (--apply-host) модифицировать host: sidecar + domain.js merge
  const sidecarPath = path.join(ROOT, "src", "domains", dom, "intent-salience.js");
  const domainPath = path.join(ROOT, "src", "domains", dom, "domain.js");

  const lines = [
    "/**",
    " * Salience overrides — A2 author audit (post-3d.3 default flip).",
    " *",
    " * SDK classifyIntentRole ожидает numeric salience:",
    " *   ≥80 → primary, 60-79 → secondary, 30-59 → navigation, <30 → utility.",
    " * NOTE: assignToSlots* не использует salience для slot-routing — эти",
    " * аннотации dormant до соответствующего SDK update'а.",
    " */",
    "",
    "export const INTENT_SALIENCE = {",
  ];
  for (const [id, tier] of entries) {
    lines.push(`  ${id}: ${tier}, // ${tierLabel(tier)}`);
  }
  lines.push("};");
  lines.push("");
  fs.writeFileSync(sidecarPath, lines.join("\n"));
  console.log(`[apply-salience] (--apply-host) wrote ${path.relative(ROOT, sidecarPath)}`);
  changes++;

  let src = fs.readFileSync(domainPath, "utf-8");
  const intentsMergeMarker = "/* INTENT_SALIENCE merge */";
  if (src.includes(intentsMergeMarker)) {
    console.log(`[apply-salience] ${dom}: domain.js already patched`);
    continue;
  }
  const re = /export\s*\{\s*INTENTS\s*\}\s*from\s*"\.\/intents\.js"\s*;?/m;
  if (!re.test(src)) {
    console.warn(`[apply-salience] ${dom}: domain.js не имеет re-export pattern, пропускаем patch`);
    continue;
  }
  const replacement = `${intentsMergeMarker}
import { INTENTS as RAW_INTENTS } from "./intents.js";
import { INTENT_SALIENCE } from "./intent-salience.js";
export const INTENTS = Object.fromEntries(
  Object.entries(RAW_INTENTS).map(([id, intent]) =>
    INTENT_SALIENCE[id] !== undefined && intent.salience === undefined
      ? [id, { ...intent, salience: INTENT_SALIENCE[id] }]
      : [id, intent]
  )
);`;
  src = src.replace(re, replacement);
  src = src.replace(/^import\s*\{\s*INTENTS\s*\}\s*from\s*"\.\/intents\.js"\s*;\s*$/m, "");
  fs.writeFileSync(domainPath, src);
  console.log(`[apply-salience] (--apply-host) patched ${path.relative(ROOT, domainPath)}`);
  changes++;
}

console.log("");
console.log(`[apply-salience] ${changes} files changed.`);
if (!APPLY_HOST) {
  console.log("[apply-salience] data-only mode (default). Use --apply-host для host-side merge.");
}
