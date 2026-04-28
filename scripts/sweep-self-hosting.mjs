#!/usr/bin/env node
/**
 * Self-hosting fixed-point experiment — model sweep.
 *
 * Прогоняет тот же 20-iter trajectory на нескольких моделях через
 * Ollama. Без рестартов server'а — runner отправляет header
 * X-LLM-Provider-Model, и routes/meta-llm.js per-request override'ит
 * provider на свежий OllamaProvider.
 *
 * После всех runs — генерирует comparison report.
 *
 * Требования: host server запущен (любая default настройка), Ollama
 * с pulled моделями.
 *
 * Usage:
 *   node scripts/sweep-self-hosting.mjs
 *   MODELS=llama3.2:latest,qwen2.5:7b,deepseek-r1:8b node scripts/sweep-self-hosting.mjs
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const HOST = process.env.HOST_BASE ?? "http://localhost:3001";
const MODELS = (
  process.env.MODELS ??
  "llama3.2:latest,qwen2.5:7b,deepseek-r1:8b"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`# Self-hosting sweep — ${MODELS.length} модель(и)`);
console.log(`Host: ${HOST}`);
console.log(`Models: ${MODELS.join(", ")}`);
console.log("");

const sweepStart = new Date().toISOString().replace(/[:.]/g, "-");
const sweepDir = `docs/experiments/results/sweep-${sweepStart}`;
mkdirSync(sweepDir, { recursive: true });

const results = [];

for (let i = 0; i < MODELS.length; i++) {
  const model = MODELS[i];
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${i + 1}/${MODELS.length}] ${model}`);
  console.log("=".repeat(60));

  // Spawn runner с header override.
  const env = {
    ...process.env,
    LLM_PROVIDER_MODEL: model,
  };
  const r = spawnSync("node", ["scripts/run-self-hosting-experiment.mjs"], {
    env,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.log(`[sweep] WARNING: runner exited ${r.status} for ${model}`);
    results.push({ model, error: `exit ${r.status}` });
    continue;
  }
  // Найти последний report.md в docs/experiments/results/
  const recent = findLatestReport();
  if (recent) {
    results.push({
      model,
      ...recent,
    });
    console.log(`[sweep] saved: ${recent.runId}`);
  } else {
    results.push({ model, error: "report not found" });
  }
}

// Comparison report
console.log(`\n${"=".repeat(60)}`);
console.log(`SWEEP COMPLETE — ${results.length} runs`);
console.log("=".repeat(60));

const md = formatComparison(results);
const path = join(sweepDir, "comparison.md");
writeFileSync(path, md, "utf8");
writeFileSync(join(sweepDir, "raw.json"), JSON.stringify(results, null, 2), "utf8");

console.log(md);
console.log(`\nwrote ${path}`);

function findLatestReport() {
  const r = spawnSync("ls", ["-t", "docs/experiments/results/"], { encoding: "utf8" });
  const files = r.stdout.split("\n").filter((f) => f.endsWith("-iterations.json"));
  if (files.length === 0) return null;
  const path = `docs/experiments/results/${files[0]}`;
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    return {
      runId: data.runId,
      outcome: data.report?.outcome,
      hypotheses: data.report?.hypotheses,
      confirmRate: data.metrics?.confirmationRate,
      monotonicViolations: data.metrics?.monotonicViolations,
      numSelfMods: data.metrics?.numSelfMods,
      meanDurationMs: data.metrics?.meanDurationMs,
      iterations: data.metrics?.iterationCount,
    };
  } catch {
    return null;
  }
}

function formatComparison(rows) {
  let s = `# Self-hosting fixed-point — model sweep comparison\n\n`;
  s += `Sweep at ${sweepStart}, ${rows.length} model(s).\n\n`;
  s += `| Model | Outcome | H1 | H2 | H3 | H4 | confirm % | mean iter ms | iter count |\n`;
  s += `|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of rows) {
    if (r.error) {
      s += `| \`${r.model}\` | ERROR: ${r.error} | — | — | — | — | — | — | — |\n`;
      continue;
    }
    const h = r.hypotheses ?? {};
    const tick = (b) => (b ? "✓" : "✗");
    s += `| \`${r.model}\` | \`${r.outcome ?? "?"}\` | ${tick(h.H1)} | ${tick(h.H2)} | ${tick(h.H3)} | ${tick(h.H4)} | ${((r.confirmRate ?? 0) * 100).toFixed(0)}% | ${(r.meanDurationMs ?? 0).toFixed(0)} | ${r.iterations ?? 0} |\n`;
  }
  s += `\n## Notes\n\n`;
  s += `- "Outcome" — auto-classification per spec'у. \`partial-B\` с H4 ✓ часто = success по существу (tail/head rate-diff = 0 при 100/100 → metric artefact, см. run 4/5 analysis).\n`;
  s += `- H4 metric — head-vs-tail confirm rate diff (≥ 5pt). По существу H4 ≈ tail uses newly-created intent на iter 7/11/17. Нужен \`compoundingByNameMatch\` refinement в SDK.\n`;
  s += `- mean iter ms — ~9000 для Opus, ~10000-150000 для local моделей (зависит от size + thinking).\n`;
  return s;
}
