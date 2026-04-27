#!/usr/bin/env node
/**
 * Triage candidate patterns по promote-worthiness и эмиттит:
 * 1. ~/Desktop/idf/<DATE>-pattern-triage.html — отчёт со scored ranking
 * 2. /tmp/promotion-seeds.json — массив effects вида request_pattern_promotion,
 *    готовых для bulk seed через POST /api/effects/seed.
 *
 * Scoring (heuristic):
 *   +5 — evidence array с ≥3 sources (production observation)
 *   +3 — has falsificationFixtures (testable)
 *   +3 — has structure.apply OR structure.slot (executable)
 *   +2 — archetype в {catalog, cross, detail, feed} (canonical)
 *   +1 — version >= 1
 *  +1/-1 — длина rationale > 200 / < 50 (proxy для thought-depth)
 *
 * Promotion threshold: score >= 8 → "promote-now"
 *                      score 5-7  → "review"
 *                      score < 5  → "park"
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
// __dirname uses worktree path; fall back via env override or detect repo
const CANDIDATES_DIR = process.env.IDF_REPO
  ? join(process.env.IDF_REPO, "refs", "candidates")
  : "/Users/ignatdubovskiy/WebstormProjects/idf/refs/candidates";

async function loadCandidates() {
  const files = await readdir(CANDIDATES_DIR);
  const out = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    if (!f.startsWith("2026-04-26-")) continue;
    try {
      const src = await readFile(join(CANDIDATES_DIR, f), "utf8");
      const j = JSON.parse(src);
      out.push({ file: f, data: j });
    } catch (err) {
      console.warn(`skip ${f}: ${err.message}`);
    }
  }
  return out;
}

function scorePattern(c, stableIds) {
  let score = 0;
  const reasons = [];

  // Evidence — granular: ≥5 prod sources = strong signal
  const ev = c.rationale?.evidence || [];
  if (ev.length >= 5) { score += 5; reasons.push(`evidence×${ev.length}`); }
  else if (ev.length >= 3) { score += 2; reasons.push(`evidence×${ev.length}`); }
  else if (ev.length >= 1) { score += 0; reasons.push(`evidence×${ev.length} (weak)`); }

  // Falsification: оба массива vs один
  const sm = Array.isArray(c.shouldMatch) ? c.shouldMatch.length : 0;
  const sn = Array.isArray(c.shouldNotMatch) ? c.shouldNotMatch.length : 0;
  if (sm > 0 && sn > 0) { score += 4; reasons.push(`falsification(${sm}+${sn})`); }
  else if (sm > 0 || sn > 0) { score += 1; reasons.push("falsification(half)"); }

  // Structure: apply executable vs slot-only
  if (typeof c.structure?.apply === "object" || typeof c.structure?.apply === "string") {
    score += 5; reasons.push("structure.apply");
  } else if (c.structure?.slot) {
    score += 1; reasons.push("slot-only");
  }

  // Trigger formal definition
  const tr = c.trigger?.requires;
  if (Array.isArray(tr) && tr.length >= 3) { score += 3; reasons.push(`trigger×${tr.length}`); }
  else if (Array.isArray(tr) && tr.length >= 1) { score += 1; reasons.push(`trigger×${tr.length}`); }

  // Archetype canonical
  const arch = c.archetype || "any";
  if (["catalog", "cross", "detail", "feed", "form"].includes(arch)) {
    score += 2; reasons.push(`archetype:${arch}`);
  }

  // Hypothesis depth
  const rationaleText = c.rationale?.hypothesis || "";
  if (rationaleText.length > 400) { score += 2; reasons.push("deep-rationale"); }
  else if (rationaleText.length > 200) { score += 1; reasons.push("rationale-ok"); }
  else if (rationaleText.length < 80) { score -= 2; reasons.push("shallow"); }

  // Penalty: уже в SDK stable (id collision)
  if (stableIds.has(c.id)) {
    score -= 5;
    reasons.push("already-in-stable");
  }

  return { score, reasons };
}

function bucket(score) {
  if (score >= 14) return "promote-now";
  if (score >= 9) return "review";
  return "park";
}

async function loadStableIds() {
  const stableRoot = join(homedir(), "WebstormProjects", "idf-sdk", "packages", "core", "src", "patterns", "stable");
  const out = new Set();
  for (const arch of ["catalog", "cross", "detail", "feed"]) {
    try {
      const dir = join(stableRoot, arch);
      const files = await readdir(dir);
      for (const f of files) {
        if (!f.endsWith(".js") || f.endsWith(".test.js")) continue;
        const src = await readFile(join(dir, f), "utf8");
        const m = /id:\s*"([^"]+)"/.exec(src);
        if (m) out.add(m[1]);
      }
    } catch { /* skip */ }
  }
  return out;
}

async function main() {
  const cands = await loadCandidates();
  const stableIds = await loadStableIds();
  console.log(`stable patterns in SDK: ${stableIds.size}`);
  const scored = cands.map(({ file, data }) => {
    const { score, reasons } = scorePattern(data, stableIds);
    return {
      file,
      id: data.id,
      archetype: data.archetype || "any",
      sourceProduct: file.split("-").slice(2, 4).join("-"),
      hypothesis: (data.rationale?.hypothesis || "").slice(0, 240),
      evidenceCount: Array.isArray(data.rationale?.evidence) ? data.rationale.evidence.length : 0,
      score,
      reasons,
      bucket: bucket(score),
    };
  });
  scored.sort((a, b) => b.score - a.score);

  const promoteNow = scored.filter((s) => s.bucket === "promote-now");
  const review = scored.filter((s) => s.bucket === "review");
  const park = scored.filter((s) => s.bucket === "park");

  // Generate seed effects: promote-now (auto) + top-10 review (semi-auto).
  // Review записываются с rationale="auto-triage top-N", оператор решает в UI.
  const topReview = review.slice(0, 10);
  const seedSource = [...promoteNow, ...topReview];
  const NOW = Date.now();
  const seeds = seedSource.map((s, idx) => ({
    id: `pp_triage_${s.id.slice(0, 40)}_${idx}`,
    intent_id: "request_pattern_promotion",
    alpha: "create",
    scope: "account",
    parent_id: null,
    status: "confirmed",
    ttl: null,
    created_at: NOW + idx,
    resolved_at: NOW + idx,
    target: "PatternPromotion",
    value: null,
    context: {
      id: `pp_triage_${s.id.slice(0, 40)}_${idx}`,
      candidateId: `candidate__${s.id}`,
      targetArchetype: ["catalog", "cross", "detail", "feed"].includes(s.archetype)
        ? s.archetype
        : "cross",
      rationale: `Auto-triage score=${s.score}. ${s.reasons.join(", ")}. Source: ${s.sourceProduct}.`,
      falsificationFixtures: null,
      status: "pending",
      requestedByUserId: "auto-triage",
      requestedAt: NOW + idx,
    },
  }));

  await writeFile("/tmp/promotion-seeds.json", JSON.stringify(seeds, null, 2));

  // HTML report
  const date = new Date().toISOString().slice(0, 10);
  const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Pattern triage — ${date}</title>
<style>
body { font-family: -apple-system, system-ui, sans-serif; background: #0d0d10; color: #e8e8ec; max-width: 1080px; margin: 40px auto; padding: 0 24px; line-height: 1.6; }
h1 { font-family: "Times New Roman", serif; font-weight: 400; font-size: 32px; }
h2 { font-size: 20px; margin-top: 32px; padding-bottom: 6px; border-bottom: 1px solid #2a2a32; color: #f0f0f4; }
h3 { font-size: 14px; margin-top: 16px; color: #c8c8d0; }
.tag { font-size: 11px; color: #7a7a85; text-transform: uppercase; letter-spacing: 0.1em; }
.row { padding: 12px 0; border-bottom: 1px dashed #2a2a32; display: grid; grid-template-columns: 60px 280px 100px 1fr; gap: 12px; align-items: baseline; }
.row.head { color: #7a7a85; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #2a2a32; }
.score { font-size: 20px; font-weight: 300; color: #f0f0f4; text-align: right; }
.score.promote { color: #3fb950; }
.score.review { color: #daa520; }
.score.park { color: #5a5a64; }
.id { font-family: ui-monospace, monospace; font-size: 12px; color: #c8c8d0; word-break: break-all; }
.hypo { color: #9f9faa; font-size: 12px; line-height: 1.5; }
.reasons { font-size: 11px; color: #7a7a85; margin-top: 4px; }
.product { color: #7c8aff; font-size: 11px; font-family: monospace; }
.summary { display: flex; gap: 24px; margin: 24px 0; }
.summary div { flex: 1; padding: 16px; border: 1px solid #2a2a32; border-radius: 6px; background: #15151a; }
.summary .num { font-size: 28px; font-weight: 300; color: #f0f0f4; }
.summary .label { font-size: 11px; color: #7a7a85; text-transform: uppercase; }
pre { font-family: ui-monospace, monospace; font-size: 11px; background: #1a1a20; padding: 12px; border-radius: 4px; overflow-x: auto; color: #c8c8d0; }
</style></head><body>
<div class="tag">Pattern triage report · IDF meta-domain dogfood · ${date}</div>
<h1>Pattern triage — ${cands.length} candidate'ов</h1>
<p style="color: #9f9faa; font-size: 14px;">
Output pattern researcher'а на 5 эталонных продуктах
(coda / confluence / notion / obsidian / roam) проскорен по эвристике
(evidence count, falsification, structure, archetype). Bucket'ы:
<strong style="color:#3fb950">promote-now</strong> (≥8) ·
<strong style="color:#daa520">review</strong> (5-7) ·
<strong style="color:#5a5a64">park</strong> (&lt;5).
</p>

<div class="summary">
  <div><div class="num" style="color:#3fb950">${promoteNow.length}</div><div class="label">promote-now</div></div>
  <div><div class="num" style="color:#daa520">${review.length}</div><div class="label">review</div></div>
  <div><div class="num" style="color:#5a5a64">${park.length}</div><div class="label">park</div></div>
  <div><div class="num">${cands.length}</div><div class="label">всего</div></div>
</div>

<h2>🟢 Promote-now (${promoteNow.length}) — auto-fired через request_pattern_promotion</h2>
<p style="color: #9f9faa; font-size: 12px;">Seed effects сохранены в <code>/tmp/promotion-seeds.json</code>. Загрузить в Φ:<br/>
<code>curl -X POST http://localhost:3001/api/effects/seed -H "Content-Type: application/json" --data-binary @/tmp/promotion-seeds.json</code></p>

<div class="row head"><span>Score</span><span>Pattern</span><span>Archetype</span><span>Hypothesis · Reasons</span></div>
${promoteNow.map((s) => `
<div class="row">
  <span class="score promote">${s.score}</span>
  <span><span class="id">${s.id}</span><div class="product">${s.sourceProduct}</div></span>
  <span class="id">${s.archetype}</span>
  <span><div class="hypo">${escape(s.hypothesis)}</div><div class="reasons">${s.reasons.join(" · ")}</div></span>
</div>`).join("")}

<h2>🟡 Review (${review.length}) — нужно человеческое решение</h2>
<div class="row head"><span>Score</span><span>Pattern</span><span>Archetype</span><span>Hypothesis · Reasons</span></div>
${review.map((s) => `
<div class="row">
  <span class="score review">${s.score}</span>
  <span><span class="id">${s.id}</span><div class="product">${s.sourceProduct}</div></span>
  <span class="id">${s.archetype}</span>
  <span><div class="hypo">${escape(s.hypothesis)}</div><div class="reasons">${s.reasons.join(" · ")}</div></span>
</div>`).join("")}

<h2>⚫ Park (${park.length}) — отложить</h2>
<details><summary style="color:#7a7a85; cursor:pointer; font-size: 13px;">Раскрыть список</summary>
<div class="row head"><span>Score</span><span>Pattern</span><span>Archetype</span><span>Hypothesis · Reasons</span></div>
${park.map((s) => `
<div class="row">
  <span class="score park">${s.score}</span>
  <span><span class="id">${s.id}</span><div class="product">${s.sourceProduct}</div></span>
  <span class="id">${s.archetype}</span>
  <span><div class="hypo">${escape(s.hypothesis)}</div><div class="reasons">${s.reasons.join(" · ")}</div></span>
</div>`).join("")}
</details>

<div style="font-size: 11px; color: #5a5a64; margin-top: 40px; text-align: center;">
Generated by scripts/triage-candidates.mjs · meta-domain dogfood
</div>
</body></html>`;

  const outPath = join(homedir(), "Desktop", "idf", `${date}-pattern-triage.html`);
  await writeFile(outPath, html);
  console.log(`triage: ${cands.length} candidates · promote-now=${promoteNow.length} · review=${review.length} · park=${park.length}`);
  console.log(`HTML report: ${outPath}`);
  console.log(`Seed effects: /tmp/promotion-seeds.json (${seeds.length} effects)`);
}

function escape(s) {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

main().catch((err) => { console.error(err); process.exit(1); });
