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
  DEFAULT_ALLOWED_INTENTS,
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
      // Iter 5 — real witness-promotion gap (run 3 setup; H3 closed).
      // After Claude propose_meta_intent confirmed, host adds new intent
      // в dynamicAllowedIntents. Iter 7/11/17 ниже формулируют work
      // items, которые попадают именно в этот gap → Claude может
      // выбрать new intent для compounding evidence (H4).
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
    } else if (i === 7 || i === 11 || i === 17) {
      // Run 4 H4 surface: 3 work items, которые требуют newly-created
      // intent (after iter 5 confirmed). Если dynamic allowedIntents
      // прокидывает this new intent в prompt, Claude может выбрать
      // его — это compounding signal.
      turns.push({
        kind: "missing-witness",
        target: `Witness:reviewed-${i}:promote-heuristic-to-authorial`,
        priority: "P1",
        context: {
          existingWitnessId: `wit-mock-${i}`,
          currentReliability: "heuristic",
          curatorDecision: "approved-as-authorial",
          note:
            "Curator has reviewed this witness and confirmed it should be reliability=authorial. The intent created in iter 5 is the right tool — apply it here.",
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

function sanitizeAllowedIntent(i) {
  // zod instance в paramsZodSchema нельзя сериализовать через JSON.stringify
  // (получится "{}" — non-nullish, и nullish-coalescing на bridge'е не
  // сработает, schema упадёт на parsing). Отправляем только
  // serializable-поля; bridge восстанавливает paramsZodSchema для
  // known built-in IDs из BUILT_IN_PARAMS_SCHEMAS, для extension intents
  // fallback'ит на generic z.record(z.string(), z.unknown()).
  return {
    id: i.id,
    description: i.description,
    paramsSchema: i.paramsSchema,
    ...(i.example !== undefined ? { example: i.example } : {}),
  };
}

async function postIterate(workItem, iterationN, runId, allowedIntents) {
  const sanitized = allowedIntents?.map(sanitizeAllowedIntent);
  const res = await fetch(`${HOST}/api/meta/llm/iterate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
  // Bridge'овский finalize пишет replace_iteration_log_status с
  // entityId = `${runId}:${iterationN}` — host effects-adapter мапит
  // его в context.id. Других маркеров нет, ищем по composite id.
  const composite = `${runId}:${iterationN}`;
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const effects = await fetchEffects();
    const replaceLog = effects.find((e) => {
      if (e.intent_id !== "replace_iteration_log_status") return false;
      const ctx = parseContext(e.context);
      return ctx.id === composite;
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

async function fetchLastProposedMetaIntent(runId) {
  const res = await fetch(
    `${HOST}/api/effects?intents=propose_meta_intent&limit=200`
  );
  if (!res.ok) return null;
  const all = await res.json();
  // Нам нужен последний confirmed propose_meta_intent именно из текущего run'а.
  // Source content включает "llm:claude-cli:iterate", но не runId напрямую —
  // фильтруем по timestamp (в пределах последних 30 минут это достаточно).
  const cutoff = Date.now() - 30 * 60 * 1000;
  const matches = all
    .map((e) => ({ e, ctx: parseContext(e.context), at: new Date(e.created_at).getTime() }))
    .filter(
      ({ e, ctx, at }) =>
        e.status === "confirmed" &&
        ctx.source &&
        String(ctx.source).includes(":iterate") &&
        at >= cutoff
    )
    .sort((a, b) => b.at - a.at);
  if (matches.length === 0) return null;
  const ctx = matches[0].ctx;
  return {
    intentId: ctx.intentId,
    name: ctx.name,
    alpha: ctx.alpha,
    target: ctx.target,
    rationale: ctx.rationale,
  };
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

  // Run 4: dynamic allowedIntents. Стартуем с DEFAULT (built-in 3),
  // расширяем после каждого confirmed propose_meta_intent. Передаём в
  // POST /iterate body чтобы Claude видел extension'ы в prompt'е и
  // schema их принимала.
  const dynamicAllowedIntents = [...DEFAULT_ALLOWED_INTENTS];

  for (let i = 1; i <= N; i++) {
    const wi = turns[i - 1];
    const before = (await countWitnesses()) ?? witnessBaseline;
    process.stdout.write(`  ${String(i).padStart(2)}. [${wi.kind.padEnd(18)}] ${wi.target} ... `);
    try {
      await postIterate(wi, i, runId, dynamicAllowedIntents);
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

    // Run 4: после confirmed propose_meta_intent — извлечь intentId из
    // последнего propose_meta_intent effect'а и расширить allowedIntents.
    // С iter+1 LLM получает new intent в prompt'е и в dynamic schema.
    if (
      result.outcome === "confirmed" &&
      result.proposedIntent === "propose_meta_intent"
    ) {
      const newIntent = await fetchLastProposedMetaIntent(runId);
      if (newIntent && !dynamicAllowedIntents.find((x) => x.id === newIntent.intentId)) {
        dynamicAllowedIntents.push({
          id: newIntent.intentId,
          description: `Newly created in iter ${i} (this run): ${newIntent.name}. ${newIntent.rationale ?? ""} α=${newIntent.alpha}, target=${newIntent.target}.`,
          paramsSchema: `{ ...params for newly created intent ${newIntent.intentId} ... }`,
          example: JSON.stringify(
            {
              intent: newIntent.intentId,
              params: {
                witnessId: "<existing-witness-id>",
                reliability: "authorial",
                alpha: newIntent.alpha,
                target: newIntent.target,
              },
              rationale: "Apply the just-created meta-intent to the witness curator decision.",
            },
            null,
            2
          ),
        });
        console.log(
          `      ↳ allowedIntents extended (+${newIntent.intentId}, total ${dynamicAllowedIntents.length})`
        );
      }
    }
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
