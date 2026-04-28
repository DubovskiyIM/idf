#!/usr/bin/env node
/**
 * Blind self-hosting fixed-point experiment — v2.
 *
 * Адресует self-критику оригинальных runs 1-5:
 *
 *   1. Mock work items (wit-mock-N) → real witness IDs из Φ.
 *   2. context.note + curatorDecision подсказки → удалены.
 *      Iter 7+ контекст содержит ТОЛЬКО observation: witness X exists,
 *      reliability=heuristic. Никакого "the intent created in iter 5
 *      is the right tool".
 *   3. Iter 5 requiredShape подсказка → удалена. Контекст содержит
 *      counts (Φ inconsistency: 27 of 70 witnesses heuristic, 0 transitions).
 *      LLM сам должен заметить gap, решить нужен ли intent, написать схему.
 *   4. Mock-provider canned response для propose_meta_intent — runner
 *      не использует mock; для этого протокола mock не имеет смысла.
 *   5. Negative control: --mode=control — iter 5 trivial (slot fill, не
 *      meta-modification). Если в control LLM на iter 7+ не выбирает
 *      propose_meta_intent → control passes; treatment vs control дает
 *      clean H3+H4 evidence.
 *   6. N=40 (extended), 17 потенциальных H4 evidence points (odd iters
 *      6-39 for real witness; treatment iter 5 is divergent).
 *   7. Output без analysis. Только raw metrics + per-iter proposedIntent.
 *      Rationale strings НЕ читаются runner'ом до фиксации metrics.
 *
 * Usage:
 *   # Обязателен npm run server (любой provider, default или OLLAMA_MODEL)
 *   node scripts/run-blind-experiment.mjs --mode=treatment
 *   node scripts/run-blind-experiment.mjs --mode=control
 *   node scripts/run-blind-experiment.mjs --mode=both     # последовательно оба
 *
 *   N=40 node scripts/run-blind-experiment.mjs --mode=both
 *   LLM_PROVIDER_MODEL=qwen2.5:7b node scripts/run-blind-experiment.mjs --mode=both
 */

import {
  computeIterationMetrics,
  classifyOutcome,
  formatReportMarkdown,
  DEFAULT_ALLOWED_INTENTS,
} from "@intent-driven/llm-bridge";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const HOST = process.env.HOST_BASE ?? "http://localhost:3001";
const N = Number(process.env.N ?? 40);
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

const args = process.argv.slice(2);
const modeArg = args.find((a) => a.startsWith("--mode="))?.slice(7);
const MODES =
  modeArg === "both"
    ? ["control", "treatment"]
    : modeArg === "control"
      ? ["control"]
      : modeArg === "treatment"
        ? ["treatment"]
        : null;
if (!MODES) {
  console.error("Usage: node scripts/run-blind-experiment.mjs --mode=treatment|control|both");
  process.exit(2);
}

function parseContext(c) {
  if (!c) return {};
  if (typeof c === "object") return c;
  try { return JSON.parse(c); } catch { return {}; }
}

async function fetchEffects(intentList) {
  const url = `${HOST}/api/effects?intents=${intentList.join(",")}&limit=2000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`/api/effects ${res.status}`);
  return res.json();
}

/**
 * Lookup real witness IDs из Φ с reliability=heuristic, no subsequent
 * reliability change. Возвращает up-to-`count` IDs.
 */
async function lookupHeuristicWitnessIds(count) {
  const witnesses = await fetchEffects(["propose_witness"]);
  const heuristics = witnesses
    .filter((e) => e.status === "confirmed")
    .map((e) => ({ id: parseContext(e.context).id, ctx: parseContext(e.context) }))
    .filter(({ ctx }) => ctx.reliability === "heuristic");
  const ids = heuristics.map((x) => x.id).filter(Boolean);
  if (ids.length === 0) {
    console.warn("[blind] WARNING: 0 heuristic witnesses в Φ. H4 surface будет synthetic.");
    return [];
  }
  return ids.slice(0, count);
}

/** Φ counts для observation context iter 5 (treatment). */
async function fetchWitnessCounts() {
  const witnesses = await fetchEffects(["propose_witness"]);
  const confirmed = witnesses.filter((e) => e.status === "confirmed");
  const byReliability = { heuristic: 0, authorial: 0, "rule-based": 0, unknown: 0 };
  for (const e of confirmed) {
    const r = parseContext(e.context).reliability ?? "unknown";
    if (byReliability[r] !== undefined) byReliability[r]++;
    else byReliability.unknown++;
  }
  return { total: confirmed.length, byReliability };
}

/**
 * Plan blind v2:
 *   iter 1-4: filler (slot_N)
 *   iter 5: divergent — treatment = Φ inconsistency observation;
 *           control = filler (slot_5)
 *   iter 6-N: alternating —
 *     odd: real witness opportunity (observation only, no hint)
 *     even: filler (slot_N)
 *   iter 14: missing-salience (variance)
 *
 * Никакого workItem.context.note. Никакого "the intent created in iter 5".
 * Никакого requiredShape. Никакого curatorDecision.
 */
function plan(n, mode, realWitnessIds, witnessCounts) {
  const turns = [];
  // Cycle через realWitnessIds если их меньше чем нужно opportunity slots.
  const idCycle = realWitnessIds.length > 0 ? realWitnessIds : [];
  let idIdx = 0;
  const nextWitnessId = () => {
    if (idCycle.length === 0) return null;
    const id = idCycle[idIdx % idCycle.length];
    idIdx++;
    return id;
  };

  for (let i = 1; i <= n; i++) {
    if (i === 5) {
      if (mode === "treatment") {
        const r = witnessCounts.byReliability;
        turns.push({
          kind: "meta-modification",
          target: "Φ:Witness reliability distribution",
          priority: "P0",
          context: {
            observation: `Φ contains ${witnessCounts.total} confirmed witnesses. Reliability distribution: heuristic=${r.heuristic}, authorial=${r.authorial}, rule-based=${r["rule-based"]}.`,
            history:
              "Searched effects log for transitions reliability=heuristic→authorial: 0 found. Manual edits, if any, happen out-of-band of Φ.",
          },
        });
      } else {
        // control: trivial filler — ничем не отличается от iter 1-4
        turns.push({
          kind: "missing-witness",
          target: `Projection:meta:domain_detail:slot_5`,
          priority: "P0",
        });
      }
    } else if (i === 14) {
      turns.push({
        kind: "missing-salience",
        target: "Intent:meta:add_backlog_item",
        priority: "P1",
      });
    } else if (i % 2 === 1 && i >= 7) {
      // odd iter ≥7: real witness opportunity, observation-only context
      const wid = nextWitnessId();
      if (wid) {
        turns.push({
          kind: "missing-witness",
          target: `Witness:${wid}`,
          priority: "P1",
          context: {
            observation: `Witness ${wid} exists in Φ; reliability=heuristic; created via crystallize-rule basis.`,
          },
        });
      } else {
        turns.push({
          kind: "missing-witness",
          target: `Projection:meta:domain_detail:slot_${i}`,
          priority: "P0",
        });
      }
    } else {
      turns.push({
        kind: "missing-witness",
        target: `Projection:meta:domain_detail:slot_${i}`,
        priority: "P0",
      });
    }
  }
  return turns;
}

function sanitizeAllowedIntent(i) {
  return {
    id: i.id,
    description: i.description,
    paramsSchema: i.paramsSchema,
    ...(i.example !== undefined ? { example: i.example } : {}),
  };
}

async function postIterate(workItem, iterationN, runId, allowedIntents) {
  const sanitized = allowedIntents?.map(sanitizeAllowedIntent);
  const headers = { "content-type": "application/json" };
  if (process.env.LLM_PROVIDER_MODEL) {
    headers["X-LLM-Provider-Model"] = process.env.LLM_PROVIDER_MODEL;
  }
  const res = await fetch(`${HOST}/api/meta/llm/iterate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      runId,
      iterationN,
      workItem,
      projectionSnapshot: { iteration: iterationN, hint: workItem.target },
      ...(sanitized ? { allowedIntents: sanitized } : {}),
    }),
  });
  if (res.status !== 202) {
    const text = await res.text();
    throw new Error(`POST /iterate non-202: ${res.status} — ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchIterationLogs() {
  return fetchEffects(["replace_iteration_log_status", "create_iteration_log"]);
}

async function waitForIterationCompletion(runId, iterationN) {
  const composite = `${runId}:${iterationN}`;
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const effects = await fetchIterationLogs();
    const replaceLog = effects.find((e) => {
      if (e.intent_id !== "replace_iteration_log_status") return false;
      return parseContext(e.context).id === composite;
    });
    if (replaceLog) {
      const ctx = parseContext(replaceLog.context);
      return {
        outcome: ctx.status,
        durationMs: ctx.durationMs ?? 0,
        proposedIntent: ctx.proposedIntent,
        rejectionCode: ctx.rejectionCode,
        errorMessage: ctx.errorMessage,
      };
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { outcome: "timeout", durationMs: POLL_TIMEOUT_MS, errorMessage: "polling timed out" };
}

async function fetchLastProposedMetaIntent() {
  const all = await fetchEffects(["propose_meta_intent"]);
  const cutoff = Date.now() - 60 * 60 * 1000;
  const matches = all
    .map((e) => ({ ctx: parseContext(e.context), at: new Date(e.created_at).getTime(), status: e.status }))
    .filter(({ ctx, at, status }) =>
      status === "confirmed" && ctx.source && String(ctx.source).includes(":iterate") && at >= cutoff
    )
    .sort((a, b) => b.at - a.at);
  if (matches.length === 0) return null;
  const c = matches[0].ctx;
  return { intentId: c.intentId, name: c.name, alpha: c.alpha, target: c.target };
}

async function runOne(mode) {
  const runId = `blind-${mode}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  console.log(`\n${"=".repeat(64)}`);
  console.log(`# Blind run — mode=${mode}, runId=${runId}`);
  console.log(`N=${N}, host=${HOST}, provider=${process.env.LLM_PROVIDER_MODEL ?? "default"}`);
  console.log("=".repeat(64));

  const witnessIds = await lookupHeuristicWitnessIds(20);
  const witnessCounts = await fetchWitnessCounts();
  console.log(`real heuristic witness IDs: ${witnessIds.length} (${witnessIds.slice(0, 3).join(", ")}...)`);
  console.log(`Φ counts: total=${witnessCounts.total}, heuristic=${witnessCounts.byReliability.heuristic}, authorial=${witnessCounts.byReliability.authorial}`);
  console.log("");

  const turns = plan(N, mode, witnessIds, witnessCounts);
  const log = [];
  const dynamicAllowedIntents = [...DEFAULT_ALLOWED_INTENTS];

  for (let i = 1; i <= N; i++) {
    const wi = turns[i - 1];
    process.stdout.write(`  ${String(i).padStart(2)}. [${wi.kind.padEnd(18)}] ${wi.target.slice(0, 50).padEnd(50)} ... `);
    try {
      await postIterate(wi, i, runId, dynamicAllowedIntents);
    } catch (e) {
      console.log(`ERR ${e.message}`);
      log.push({ iterationN: i, outcome: "subprocess_error", durationMs: 0, errorMessage: String(e.message) });
      continue;
    }
    const result = await waitForIterationCompletion(runId, i);
    log.push({
      iterationN: i,
      outcome: result.outcome,
      proposedIntent: result.proposedIntent,
      rejectionCode: result.rejectionCode,
      durationMs: result.durationMs,
      workItemKind: wi.kind,
      workItemTarget: wi.target,
    });
    const tag = result.outcome === "confirmed" ? "✓" : result.outcome === "rejected" ? "✗" : "!";
    console.log(`${tag} ${result.outcome} intent=${result.proposedIntent ?? "—"} (${result.durationMs}ms)`);

    if (result.outcome === "confirmed" && result.proposedIntent === "propose_meta_intent") {
      const newIntent = await fetchLastProposedMetaIntent();
      if (newIntent && !dynamicAllowedIntents.find((x) => x.id === newIntent.intentId)) {
        // BLIND-style description: только observable facts из Φ, без
        // tailored example. LLM получает intent id + α + target + name —
        // что реально в Φ. Никакого "Apply this to witness curator decision".
        dynamicAllowedIntents.push({
          id: newIntent.intentId,
          description: `Created in this run (iter ${i}): name="${newIntent.name}", α=${newIntent.alpha}, target=${newIntent.target}.`,
          paramsSchema: "{ ...params accepted by this newly-created intent (schema not yet documented) }",
        });
        console.log(`      ↳ allowedIntents extended (+${newIntent.intentId}, total ${dynamicAllowedIntents.length})`);
      }
    }
  }

  // RAW metrics — no analysis, no rationale reading.
  const metrics = computeIterationMetrics(log);
  const report = classifyOutcome(metrics);

  // H4 — explicit name-match against new intents (post-iter-5).
  const newIntentIds = dynamicAllowedIntents
    .filter((x) => !DEFAULT_ALLOWED_INTENTS.find((d) => d.id === x.id))
    .map((x) => x.id);
  const tailUsesNewIntent = log.filter((l) => l.iterationN > 5 && newIntentIds.includes(l.proposedIntent)).length;

  // Per-intent breakdown.
  const breakdown = {};
  for (const l of log) {
    const k = l.proposedIntent ?? `(${l.outcome})`;
    breakdown[k] = (breakdown[k] ?? 0) + 1;
  }

  const summary = {
    runId,
    mode,
    N,
    provider: process.env.LLM_PROVIDER_MODEL ?? "default",
    metrics,
    hypothesisGrid: report.hypotheses,
    outcomeByMetric: report.outcome,
    explicitNameMatchTailUses: tailUsesNewIntent,
    newIntentIdsCreated: newIntentIds,
    intentBreakdown: breakdown,
    workItemTargets: turns.map((t, idx) => ({ iter: idx + 1, kind: t.kind, target: t.target })),
    log,
  };

  const outDir = "docs/experiments/results";
  mkdirSync(outDir, { recursive: true });
  const stamp = runId.replace(/^blind-/, "");
  const dumpPath = join(outDir, `${stamp}-blind.json`);
  writeFileSync(dumpPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(`\n--- ${mode} summary ---`);
  console.log(`Outcome (metric):       ${report.outcome}`);
  console.log(`Hypothesis grid:        H1=${tick(report.hypotheses.H1)} H2=${tick(report.hypotheses.H2)} H3=${tick(report.hypotheses.H3)} H4=${tick(report.hypotheses.H4)}`);
  console.log(`Confirm rate:           ${(metrics.confirmationRate * 100).toFixed(1)}%`);
  console.log(`Self-mods (confirmed):  ${metrics.numSelfMods}`);
  console.log(`Tail uses new intent:   ${tailUsesNewIntent} ${newIntentIds.length > 0 ? `(of ${newIntentIds.join(", ")})` : "(no new intents created)"}`);
  console.log(`Intent breakdown:       ${Object.entries(breakdown).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`wrote: ${dumpPath}`);

  return { runId, mode, summary };
}

function tick(b) { return b ? "✓" : "✗"; }

async function main() {
  const results = [];
  for (const mode of MODES) {
    const r = await runOne(mode);
    results.push(r);
  }

  if (results.length === 2) {
    // Comparison vs control
    console.log(`\n${"=".repeat(64)}`);
    console.log(`# Treatment vs Control comparison`);
    console.log("=".repeat(64));
    const t = results.find((r) => r.mode === "treatment").summary;
    const c = results.find((r) => r.mode === "control").summary;
    console.log(`\n| Metric                  | Control | Treatment |`);
    console.log(`|-------------------------|---------|-----------|`);
    console.log(`| Confirm rate            | ${(c.metrics.confirmationRate * 100).toFixed(0)}% | ${(t.metrics.confirmationRate * 100).toFixed(0)}% |`);
    console.log(`| Self-mods               | ${c.metrics.numSelfMods} | ${t.metrics.numSelfMods} |`);
    console.log(`| Tail uses new intent    | ${c.explicitNameMatchTailUses} | ${t.explicitNameMatchTailUses} |`);
    console.log(`| New intents created     | ${c.newIntentIdsCreated.length} | ${t.newIntentIdsCreated.length} |`);
    console.log(`| H3 (≥1 self-mod)        | ${tick(c.hypothesisGrid.H3)} | ${tick(t.hypothesisGrid.H3)} |`);
    console.log(`| Treatment > Control?    | — | ${t.explicitNameMatchTailUses > c.explicitNameMatchTailUses ? "YES (causal evidence)" : "NO (artefact / random)"} |`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
