#!/usr/bin/env node
/**
 * Blind H4 protocol v3 — structural pressure через invariants.
 *
 * Изменения vs v2 (run-blind-experiment.mjs):
 *
 * 1. Pre-step: lookup heuristic witness IDs (созданные через
 *    `scripts/seed-heuristic-witnesses.mjs`). Если 0 — abort с hint'ом
 *    запустить seed.
 *
 * 2. Iter 7+ work items targets = real seeded witness IDs с
 *    (projectionId, slotPath) parameters. Iter 7+ context — observation
 *    only: «Witness X exists; reliability=heuristic».
 *
 * 3. Структурное давление через `witness_unique_per_slot_reliability`
 *    invariant: попытка propose_witness на same (projectionId, slotPath,
 *    reliability=heuristic) → host rejection. LLM forced либо чтобы
 *    использовать другой intent (если есть newly-created), либо принять
 *    rejection.
 *
 * 4. Metric H4_strict — explicit name match на newly-created intent в
 *    tail iterations. H4_under_pressure — confirmed extension uses
 *    после rejection cascade.
 *
 * 5. Treatment vs control — same as v2; control'у не предлагается
 *    structural pressure (iter 5 trivial), opportunity slots — same.
 *
 * Usage:
 *   # Pre-step (один раз):
 *   node scripts/seed-heuristic-witnesses.mjs
 *   # Run:
 *   node scripts/run-blind-experiment-v3.mjs --mode=both
 */

import {
  computeIterationMetrics,
  classifyOutcome,
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
  console.error("Usage: node scripts/run-blind-experiment-v3.mjs --mode=treatment|control|both");
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
 * Lookup seeded heuristic witnesses. Filter by intent_id=_seed_heuristic
 * чтобы взять только те, что специально pre-populated.
 */
async function lookupSeededHeuristicWitnesses() {
  const all = await fetchEffects(["_seed_heuristic"]);
  const witnesses = all
    .filter((e) => e.status === "confirmed")
    .map((e) => ({ ...parseContext(e.context), createdAt: e.created_at }))
    .filter((w) => w.reliability === "heuristic" && w.id && w.projectionId && w.slotPath);
  return witnesses;
}

async function fetchWitnessCounts() {
  const witnesses = await fetchEffects(["propose_witness", "_seed_heuristic"]);
  const confirmed = witnesses.filter((e) => e.status === "confirmed");
  const byReliability = { heuristic: 0, authorial: 0, "rule-based": 0, unknown: 0 };
  for (const e of confirmed) {
    const r = parseContext(e.context).reliability ?? "unknown";
    if (byReliability[r] !== undefined) byReliability[r]++;
    else byReliability.unknown++;
  }
  return { total: confirmed.length, byReliability };
}

function plan(n, mode, heuristicWitnesses, witnessCounts) {
  const turns = [];
  const cycle = heuristicWitnesses;
  let idx = 0;
  const nextWitness = () => {
    if (cycle.length === 0) return null;
    const w = cycle[idx % cycle.length];
    idx++;
    return w;
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
      // Real heuristic witness opportunity — observation only, no hint
      const w = nextWitness();
      if (w) {
        turns.push({
          kind: "missing-witness",
          target: `Witness:${w.id}`,
          priority: "P1",
          context: {
            observation: `Witness ${w.id} exists in Φ; projectionId=${w.projectionId}; slotPath=${w.slotPath}; reliability=heuristic; basis=crystallize-rule.`,
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

async function runOne(mode, heuristicWitnesses, witnessCounts) {
  const runId = `blindv3-${mode}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  console.log(`\n${"=".repeat(64)}`);
  console.log(`# Blind v3 (structural pressure) — mode=${mode}`);
  console.log(`runId: ${runId}`);
  console.log(`N=${N}, host=${HOST}, provider=${process.env.LLM_PROVIDER_MODEL ?? "default"}`);
  console.log(`heuristic seed pool: ${heuristicWitnesses.length}`);
  console.log("=".repeat(64));

  const turns = plan(N, mode, heuristicWitnesses, witnessCounts);
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
    console.log(`${tag} ${result.outcome} intent=${result.proposedIntent ?? "—"}${result.rejectionCode ? ` reject=${result.rejectionCode}` : ""} (${result.durationMs}ms)`);

    if (result.outcome === "confirmed" && result.proposedIntent === "propose_meta_intent") {
      const newIntent = await fetchLastProposedMetaIntent();
      if (newIntent && !dynamicAllowedIntents.find((x) => x.id === newIntent.intentId)) {
        dynamicAllowedIntents.push({
          id: newIntent.intentId,
          description: `Created in this run (iter ${i}): name="${newIntent.name}", α=${newIntent.alpha}, target=${newIntent.target}.`,
          paramsSchema: "{ ...params accepted by this newly-created intent (schema not yet documented) }",
        });
        console.log(`      ↳ allowedIntents extended (+${newIntent.intentId}, total ${dynamicAllowedIntents.length})`);
      }
    }
  }

  const metrics = computeIterationMetrics(log);
  const report = classifyOutcome(metrics);

  const newIntentIds = dynamicAllowedIntents
    .filter((x) => !DEFAULT_ALLOWED_INTENTS.find((d) => d.id === x.id))
    .map((x) => x.id);

  const tailLog = log.filter((l) => l.iterationN > 5);
  const opportunityIters = tailLog.filter((l) => l.workItemKind === "missing-witness" && l.workItemTarget.startsWith("Witness:"));
  const tailUsesNewIntent = tailLog.filter((l) => newIntentIds.includes(l.proposedIntent)).length;
  const opportunityUsesNewIntent = opportunityIters.filter((l) => newIntentIds.includes(l.proposedIntent)).length;
  const opportunityRejections = opportunityIters.filter((l) => l.outcome === "rejected").length;
  const opportunityFallbackToWitness = opportunityIters.filter((l) => l.proposedIntent === "propose_witness").length;
  const fallbackRejections = opportunityIters.filter((l) => l.outcome === "rejected" && l.proposedIntent === "propose_witness").length;

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
    heuristicSeedPool: heuristicWitnesses.length,
    metrics,
    hypothesisGrid: report.hypotheses,
    outcomeByMetric: report.outcome,
    h4Strict: tailUsesNewIntent,
    h4UnderPressure: opportunityUsesNewIntent,
    opportunityIters: opportunityIters.length,
    opportunityRejections,
    opportunityFallbackToWitness,
    fallbackRejections,
    newIntentIdsCreated: newIntentIds,
    intentBreakdown: breakdown,
    workItemTargets: turns.map((t, idx) => ({ iter: idx + 1, kind: t.kind, target: t.target })),
    log,
  };

  const outDir = "docs/experiments/results";
  mkdirSync(outDir, { recursive: true });
  const stamp = runId.replace(/^blindv3-/, "");
  const dumpPath = join(outDir, `${stamp}-blindv3.json`);
  writeFileSync(dumpPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(`\n--- ${mode} v3 summary ---`);
  console.log(`Outcome (metric):              ${report.outcome}`);
  console.log(`Hypothesis grid:               H1=${tick(report.hypotheses.H1)} H2=${tick(report.hypotheses.H2)} H3=${tick(report.hypotheses.H3)} H4=${tick(report.hypotheses.H4)}`);
  console.log(`Confirm rate (overall):        ${(metrics.confirmationRate * 100).toFixed(1)}%`);
  console.log(`Self-mods:                     ${metrics.numSelfMods}`);
  console.log(`Opportunity iters (witness):   ${opportunityIters.length}`);
  console.log(`  → uses new intent:           ${opportunityUsesNewIntent}`);
  console.log(`  → fallback propose_witness:  ${opportunityFallbackToWitness}`);
  console.log(`  → rejected (any):            ${opportunityRejections}`);
  console.log(`  → rejected as fallback:      ${fallbackRejections}  (signal of structural pressure)`);
  console.log(`Intent breakdown: ${Object.entries(breakdown).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`wrote: ${dumpPath}`);

  return { runId, mode, summary };
}

function tick(b) { return b ? "✓" : "✗"; }

async function main() {
  const heuristicWitnesses = await lookupSeededHeuristicWitnesses();
  if (heuristicWitnesses.length === 0) {
    console.error(`\n[blind-v3] FATAL: no seeded heuristic witnesses found in Φ.`);
    console.error(`Run pre-step first:`);
    console.error(`  node scripts/seed-heuristic-witnesses.mjs`);
    process.exit(1);
  }
  const witnessCounts = await fetchWitnessCounts();
  console.log(`heuristic seed pool: ${heuristicWitnesses.length} witnesses`);
  console.log(`Φ counts: total=${witnessCounts.total}, heuristic=${witnessCounts.byReliability.heuristic}, authorial=${witnessCounts.byReliability.authorial}, rule-based=${witnessCounts.byReliability["rule-based"]}`);

  const results = [];
  for (const mode of MODES) {
    const r = await runOne(mode, heuristicWitnesses, witnessCounts);
    results.push(r);
  }

  if (results.length === 2) {
    console.log(`\n${"=".repeat(64)}`);
    console.log(`# Treatment vs Control comparison (v3)`);
    console.log("=".repeat(64));
    const t = results.find((r) => r.mode === "treatment").summary;
    const c = results.find((r) => r.mode === "control").summary;
    console.log(`\n| Metric                            | Control | Treatment |`);
    console.log(`|-----------------------------------|---------|-----------|`);
    console.log(`| Self-mods                         | ${c.metrics.numSelfMods} | ${t.metrics.numSelfMods} |`);
    console.log(`| Opportunity iters                 | ${c.opportunityIters} | ${t.opportunityIters} |`);
    console.log(`| H4_strict (tail uses new intent)  | ${c.h4Strict} | ${t.h4Strict} |`);
    console.log(`| H4_under_pressure (opp. uses new) | ${c.h4UnderPressure} | ${t.h4UnderPressure} |`);
    console.log(`| Fallback propose_witness rejected | ${c.fallbackRejections} | ${t.fallbackRejections} |`);
    console.log(`| New intents created               | ${c.newIntentIdsCreated.length} | ${t.newIntentIdsCreated.length} |`);
    const causal = t.h4UnderPressure > c.h4UnderPressure;
    console.log(`\nCausal evidence (treatment > control on H4_under_pressure)? ${causal ? "YES" : "NO"}`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
