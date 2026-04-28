#!/usr/bin/env node
/**
 * Self-hosting fixed-point experiment — host runner (этап 6).
 *
 * Запускает N итераций через POST /api/meta/llm/iterate, polling'ом ловит
 * IterationLog rows из /api/effects, агрегирует метрики через
 * @intent-driven/llm-bridge::computeIterationMetrics + classifyOutcome,
 * сохраняет artifact в docs/experiments/results/.
 *
 * Требует:
 *   - npm run server (host idf на :3001 с mounted /api/meta/llm)
 *   - NODE_ENV=test или DEMO_LLM_MOCK=1 для mock-provider'а;
 *     иначе ClaudeCliProvider требует залогиненный `claude` CLI.
 *
 * Usage:
 *   node scripts/run-self-hosting-experiment.mjs               # N=20, real Claude
 *   N=5 node scripts/run-self-hosting-experiment.mjs           # короткий run
 *   DEMO_LLM_MOCK=1 node scripts/run-self-hosting-experiment.mjs  # mock provider
 */

import {
  computeIterationMetrics,
  classifyOutcome,
  formatReportMarkdown,
} from "@intent-driven/llm-bridge";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const HOST = process.env.HOST_BASE ?? "http://localhost:3001";
const N = Number(process.env.N ?? 20);
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function plan(n) {
  const turns = [];
  for (let i = 1; i <= n; i++) {
    if (i === 5) {
      // Real witness-promotion gap: existing 3 intents структурно НЕ
      // могут закрыть transition Witness.reliability=heuristic →
      // reliability=authorial после curator review. Это не synthetic
      // checkpoint — natural mismatch между current 3-intent surface
      // и required workflow. Если Claude всё равно отдаёт witness —
      // это finding о fundamental limit; если propose_meta_intent с
      // alpha:replace target:Witness.reliability — risk minimization
      // была обусловленной, не структурной.
      turns.push({
        kind: "meta-modification",
        target: "Witness.reliability:heuristic→authorial",
        priority: "P0",
        context: {
          gap:
            "Witness curator's review workflow needs an intent that takes an existing Witness id and replaces its reliability from heuristic to authorial. The 3 available intents cannot express this: propose_witness only creates new Witness rows (alpha=create), not transitions; propose_intent_salience targets Intent.salience (wrong entity); propose_meta_intent creates a new Intent (different cardinality, not a Witness mutation).",
          requiredShape:
            "A new meta-intent: alpha=replace, target='Witness.reliability', taking witnessId + new reliability value as params. This is the intent you need to create.",
          observedReliabilityGap:
            "Many witnesses in Φ have reliability=heuristic. After curator review they become authorial. But Φ has no event for this transition — manual edits happen out-of-band. This is the gap.",
        },
      });
    } else if (i === 14) {
      turns.push({
        kind: "missing-salience",
        target: "Intent:meta:add_backlog_item",
        priority: "P1",
      });
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

async function postIterate(workItem, iterationN, runId) {
  const res = await fetch(`${HOST}/api/meta/llm/iterate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      runId,
      iterationN,
      workItem,
      projectionSnapshot: { iteration: iterationN, hint: workItem.target },
    }),
  });
  if (res.status !== 202) {
    const text = await res.text();
    throw new Error(`POST /iterate non-202: ${res.status} — ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchEffects() {
  const res = await fetch(
    `${HOST}/api/effects?intents=replace_iteration_log_status,create_iteration_log&limit=2000`
  );
  if (!res.ok) throw new Error(`/api/effects ${res.status}`);
  return res.json();
}

function parseContext(c) {
  if (!c) return {};
  if (typeof c === "object") return c;
  try { return JSON.parse(c); } catch { return {}; }
}

async function waitForIterationCompletion(runId, iterationN) {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const effects = await fetchEffects();
    const replaceLog = effects.find((e) => {
      if (e.intent_id !== "replace_iteration_log_status") return false;
      const ctx = parseContext(e.context);
      return ctx.runId === runId && ctx.iterationN === iterationN;
    });
    if (replaceLog) {
      const ctx = parseContext(replaceLog.context);
      return {
        outcome: ctx.status,
        durationMs: ctx.durationMs ?? 0,
        proposedIntent: ctx.proposedIntent,
        rejectionCode: ctx.rejectionCode,
        errorMessage: ctx.errorMessage,
        rawCtx: ctx,
      };
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { outcome: "timeout", durationMs: POLL_TIMEOUT_MS, errorMessage: "polling timed out" };
}

async function countWitnesses() {
  const res = await fetch(`${HOST}/api/effects?intents=propose_witness&limit=2000`);
  if (!res.ok) return null;
  const all = await res.json();
  return all.filter((e) => e.status === "confirmed").length;
}

async function main() {
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  console.log(`# Self-hosting fixed-point experiment — REAL RUN`);
  console.log(`runId: ${runId}`);
  console.log(`N: ${N}, host: ${HOST}, mock: ${process.env.DEMO_LLM_MOCK === "1" ? "yes" : "no"}`);
  console.log("");

  const turns = plan(N);
  const log = [];
  const witnessBaseline = (await countWitnesses()) ?? 0;
  console.log(`witness baseline: ${witnessBaseline}`);
  console.log("");

  for (let i = 1; i <= N; i++) {
    const wi = turns[i - 1];
    const before = (await countWitnesses()) ?? witnessBaseline;
    process.stdout.write(`  ${String(i).padStart(2)}. [${wi.kind.padEnd(18)}] ${wi.target} ... `);
    try {
      await postIterate(wi, i, runId);
    } catch (e) {
      console.log(`ERR ${e.message}`);
      log.push({
        iterationN: i,
        outcome: "subprocess_error",
        durationMs: 0,
        errorMessage: String(e.message),
      });
      continue;
    }
    const result = await waitForIterationCompletion(runId, i);
    const after = (await countWitnesses()) ?? before;
    const witnessDelta = after - before;
    log.push({
      iterationN: i,
      outcome: result.outcome,
      proposedIntent: result.proposedIntent,
      rejectionCode: result.rejectionCode,
      durationMs: result.durationMs,
      witnessCoverageBefore: witnessBaseline === 0 ? 0 : (before - witnessBaseline) / 100,
      witnessCoverageAfter: witnessBaseline === 0 ? after / 100 : (after - witnessBaseline) / 100,
      newIntentId:
        result.proposedIntent === "propose_meta_intent"
          ? result.rawCtx?.proposedMetaIntentId
          : undefined,
    });
    const tag =
      result.outcome === "confirmed" ? "✓" : result.outcome === "rejected" ? "✗" : "!";
    console.log(
      `${tag} ${result.outcome}${
        result.proposedIntent ? `  intent=${result.proposedIntent}` : ""
      }${witnessDelta ? `  witness+${witnessDelta}` : ""}  (${result.durationMs}ms)`
    );
  }

  const metrics = computeIterationMetrics(log);
  const report = classifyOutcome(metrics);
  const md = formatReportMarkdown(report);

  console.log("\n" + md);

  const outDir = "docs/experiments/results";
  mkdirSync(outDir, { recursive: true });
  const stamp = runId.replace(/^run-/, "");
  const reportPath = join(outDir, `${stamp}-report.md`);
  const dumpPath = join(outDir, `${stamp}-iterations.json`);
  writeFileSync(reportPath, md, "utf8");
  writeFileSync(
    dumpPath,
    JSON.stringify({ runId, N, turns, log, metrics, report }, null, 2),
    "utf8"
  );
  console.log(`\nwrote ${reportPath}`);
  console.log(`wrote ${dumpPath}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
