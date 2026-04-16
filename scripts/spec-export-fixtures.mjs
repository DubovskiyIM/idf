#!/usr/bin/env node
/**
 * Экспортирует corpus conformance-тестов из reference-прототипа:
 *  - tests/artifacts/<domain>/<projection>.json  — canonical артефакты v2
 *  - tests/effects/sample-confirmed.json         — выборка confirmed эффектов из server/idf.db
 *
 * Usage: node scripts/spec-export-fixtures.mjs
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { crystallizeV2 } from "@intent-driven/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TESTS_DIR = join(ROOT, "docs/spec-v0.1/tests");

const DOMAINS = [
  "booking", "planning", "workflow", "messenger",
  "sales", "lifequest", "reflect", "invest", "delivery",
];

function safeJson(s) {
  try { return JSON.parse(s); } catch { return s; }
}

async function exportArtifacts() {
  const manifest = { tests: [] };
  for (const name of DOMAINS) {
    const mod = await import(`../src/domains/${name}/domain.js`);
    const { INTENTS, PROJECTIONS, ONTOLOGY } = mod;
    const artifacts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, name, { anchoring: "soft" });

    const domainDir = join(TESTS_DIR, "artifacts", name);
    if (!existsSync(domainDir)) mkdirSync(domainDir, { recursive: true });

    for (const [pid, art] of Object.entries(artifacts)) {
      const fixturePath = join(domainDir, `${pid}.json`);
      // Сбрасываем generatedAt для стабильности (hash входных данных остаётся)
      const normalized = { ...art, generatedAt: 0 };
      writeFileSync(fixturePath, JSON.stringify(normalized, null, 2) + "\n");
      manifest.tests.push({
        kind: "artifact",
        domain: name,
        projection: pid,
        archetype: art.archetype,
        fixture: `artifacts/${name}/${pid}.json`,
      });
    }
    console.log(`[${name}] ${Object.keys(artifacts).length} artifacts -> tests/artifacts/${name}/`);
  }
  return manifest;
}

function exportEffects(manifest) {
  const dbPath = join(ROOT, "server/idf.db");
  if (!existsSync(dbPath)) {
    console.error(`[effects] DB не найдена (${dbPath}) — пропускаю`);
    return;
  }
  const res = spawnSync("sqlite3", [
    dbPath,
    "-json",
    "SELECT id, intent_id, alpha, target, value, scope, parent_id, status, ttl, context, created_at, resolved_at FROM effects WHERE status='confirmed' ORDER BY created_at LIMIT 100",
  ], { encoding: "utf8" });
  if (res.status !== 0) {
    console.error(`[effects] sqlite3 упал: ${res.stderr}`);
    return;
  }
  const rows = res.stdout.trim() ? JSON.parse(res.stdout) : [];
  const effects = rows.map(row => ({
    id: row.id,
    intent_id: row.intent_id,
    alpha: row.alpha,
    target: row.target,
    value: row.value ? safeJson(row.value) : undefined,
    scope: row.scope || "account",
    parent_id: row.parent_id || null,
    status: row.status || "proposed",
    ttl: row.ttl ?? null,
    context: row.context ? safeJson(row.context) : {},
    created_at: row.created_at,
    resolved_at: row.resolved_at ?? null,
  }));

  const effectsPath = join(TESTS_DIR, "effects", "sample-confirmed.json");
  if (!existsSync(dirname(effectsPath))) mkdirSync(dirname(effectsPath), { recursive: true });
  writeFileSync(effectsPath, JSON.stringify({
    description: "Выборка из 100 confirmed-эффектов reference-прототипа. Каждый эффект MUST валидироваться против effect.schema.json.",
    effects,
  }, null, 2) + "\n");
  console.log(`[effects] ${effects.length} effects -> tests/effects/sample-confirmed.json`);
  manifest.tests.push({
    kind: "effect-corpus",
    source: "reference prototype idf.db",
    count: effects.length,
    fixture: "effects/sample-confirmed.json",
  });
}

function writeManifest(manifest) {
  const path = join(TESTS_DIR, "manifest.json");
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\n[manifest] ${manifest.tests.length} tests -> tests/manifest.json`);
}

async function main() {
  if (!existsSync(TESTS_DIR)) mkdirSync(TESTS_DIR, { recursive: true });
  const manifest = await exportArtifacts();
  exportEffects(manifest);
  writeManifest(manifest);
}

main().catch(err => {
  console.error("Export failed:", err);
  process.exit(1);
});
