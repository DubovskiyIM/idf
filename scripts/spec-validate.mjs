#!/usr/bin/env node
/**
 * Валидирует артефакты и эффекты против спецификации docs/spec-v0.1/.
 *
 * Usage:
 *   node scripts/spec-validate.mjs                  — все артефакты 9 доменов
 *   node scripts/spec-validate.mjs --domain booking — конкретный домен
 *   node scripts/spec-validate.mjs --effects        — выборка эффектов из server/idf.db
 *   node scripts/spec-validate.mjs --inputs         — валидация ONTOLOGY / INTENTS / PROJECTIONS каждого домена
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { crystallizeV2 } from "@intent-driven/core";

const require = createRequire(import.meta.url);
const AJV_ROOT = "/tmp/idf-spec-deps/node_modules";
const Ajv2020 = require(`${AJV_ROOT}/ajv/dist/2020.js`);
const addFormats = require(`${AJV_ROOT}/ajv-formats/dist/index.js`);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const DOMAINS = [
  "booking", "planning", "workflow", "messenger",
  "sales", "lifequest", "reflect", "invest", "delivery",
];

function parseArgs(argv) {
  const args = { domain: null, verbose: false, effects: false, inputs: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--domain") args.domain = argv[++i];
    else if (argv[i] === "--verbose" || argv[i] === "-v") args.verbose = true;
    else if (argv[i] === "--effects") args.effects = true;
    else if (argv[i] === "--inputs") args.inputs = true;
  }
  return args;
}

async function validateInputs(ajv, root, domains) {
  const ontologySchema = JSON.parse(readFileSync(join(root, "docs/spec-v0.1/ontology.schema.json"), "utf8"));
  const intentSchema   = JSON.parse(readFileSync(join(root, "docs/spec-v0.1/intent.schema.json"), "utf8"));
  const projSchema     = JSON.parse(readFileSync(join(root, "docs/spec-v0.1/projection.schema.json"), "utf8"));

  const validateOntology = ajv.compile(ontologySchema);
  const validateIntent   = ajv.compile(intentSchema);
  const validateProj     = ajv.compile(projSchema);

  const report = { ontology: [], intent: [], projection: [] };

  for (const name of domains) {
    let mod;
    try { mod = await import(`../src/domains/${name}/domain.js`); }
    catch (err) { console.error(`[${name}] не удалось загрузить: ${err.message}`); continue; }
    const { INTENTS, PROJECTIONS, ONTOLOGY } = mod;

    const okO = validateOntology(ONTOLOGY);
    if (!okO) {
      report.ontology.push({ domain: name, errors: validateOntology.errors });
    }

    let intentFail = 0, intentTotal = 0;
    for (const [id, intent] of Object.entries(INTENTS || {})) {
      intentTotal++;
      const ok = validateIntent(intent);
      if (!ok) { intentFail++; if (intentFail <= 3) report.intent.push({ domain: name, id, errors: validateIntent.errors }); }
    }

    let projFail = 0, projTotal = 0;
    for (const [id, proj] of Object.entries(PROJECTIONS || {})) {
      projTotal++;
      const ok = validateProj(proj);
      if (!ok) { projFail++; if (projFail <= 3) report.projection.push({ domain: name, id, errors: validateProj.errors }); }
    }

    console.log(`[${name}] ontology:${okO ? "✓" : "✗"}  intents:${intentTotal - intentFail}/${intentTotal}  projections:${projTotal - projFail}/${projTotal}`);
  }

  return report;
}

function parseEffectRow(row) {
  return {
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
  };
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return s; }
}

async function validateEffects(ajv, root) {
  const dbPath = join(root, "server/idf.db");
  const { existsSync } = await import("node:fs");
  if (!existsSync(dbPath)) {
    console.error(`[effects] DB не найдена по пути ${dbPath} — пропускаю`);
    return { total: 0, passed: 0, failures: [] };
  }
  const { spawnSync } = await import("node:child_process");
  const res = spawnSync("sqlite3", [
    dbPath,
    "-json",
    "SELECT id, intent_id, alpha, target, value, scope, parent_id, status, ttl, context, created_at, resolved_at FROM effects WHERE status='confirmed' LIMIT 200",
  ], { encoding: "utf8" });
  if (res.status !== 0) {
    console.error(`[effects] sqlite3 упал: ${res.stderr}`);
    return { total: 0, passed: 0, failures: [] };
  }
  const rows = res.stdout.trim() ? JSON.parse(res.stdout) : [];

  const schemaPath = join(root, "docs/spec-v0.1/effect.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const validate = ajv.compile(schema);

  let total = 0, passed = 0;
  const failures = [];
  for (const row of rows) {
    total++;
    const ef = parseEffectRow(row);
    const ok = validate(ef);
    if (ok) passed++;
    else failures.push({ id: ef.id, alpha: ef.alpha, target: ef.target, errors: validate.errors });
  }
  return { total, passed, failures };
}

async function loadDomain(name) {
  const mod = await import(`../src/domains/${name}/domain.js`);
  return mod;
}

async function main() {
  const args = parseArgs(process.argv);

  const AjvCtor = Ajv2020.default || Ajv2020;
  const fmt = addFormats.default || addFormats;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  fmt(ajv);

  if (args.inputs) {
    const domains = args.domain ? [args.domain] : DOMAINS;
    const report = await validateInputs(ajv, ROOT, domains);
    const issues = report.ontology.length + report.intent.length + report.projection.length;
    if (issues === 0) {
      console.log(`\n=== Inputs: all domains pass ontology/intent/projection schema ===`);
      return;
    }
    console.log(`\n=== Input failures ===`);
    for (const f of report.ontology) {
      console.log(`\n[${f.domain}] ontology:`);
      for (const err of f.errors.slice(0, 5)) console.log(`  ${err.instancePath || "/"}: ${err.message}`);
    }
    for (const f of report.intent.slice(0, 10)) {
      console.log(`\n[${f.domain}] intent ${f.id}:`);
      for (const err of f.errors.slice(0, 5)) console.log(`  ${err.instancePath || "/"}: ${err.message}`);
    }
    for (const f of report.projection.slice(0, 10)) {
      console.log(`\n[${f.domain}] projection ${f.id}:`);
      for (const err of f.errors.slice(0, 5)) console.log(`  ${err.instancePath || "/"}: ${err.message}`);
    }
    process.exit(1);
  }

  if (args.effects) {
    const { total, passed, failures } = await validateEffects(ajv, ROOT);
    console.log(`=== Effects ===`);
    console.log(`Total:  ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failures.length}`);
    if (failures.length > 0) {
      console.log(`\n=== Effect failures ===`);
      for (const f of failures.slice(0, 10)) {
        console.log(`\neffect ${f.id} (α=${f.alpha}, target=${f.target}):`);
        for (const err of f.errors) {
          console.log(`  ${err.instancePath || "/"}: ${err.message}`);
        }
      }
      if (failures.length > 10) console.log(`\n  ... ещё ${failures.length - 10}`);
      process.exit(1);
    }
    return;
  }

  const domains = args.domain ? [args.domain] : DOMAINS;
  const schemaPath = join(ROOT, "docs/spec-v0.1/artifact.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const validate = ajv.compile(schema);

  let total = 0, passed = 0;
  const failures = [];

  for (const name of domains) {
    let mod;
    try {
      mod = await loadDomain(name);
    } catch (err) {
      console.error(`[${name}] не удалось загрузить: ${err.message}`);
      continue;
    }
    const { INTENTS, PROJECTIONS, ONTOLOGY } = mod;
    if (!INTENTS || !PROJECTIONS || !ONTOLOGY) {
      console.error(`[${name}] отсутствуют INTENTS / PROJECTIONS / ONTOLOGY`);
      continue;
    }

    let artifacts;
    try {
      artifacts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, name, { anchoring: "soft" });
    } catch (err) {
      console.error(`[${name}] crystallizeV2 упал: ${err.message}`);
      continue;
    }

    for (const [pid, art] of Object.entries(artifacts)) {
      total++;
      const ok = validate(art);
      if (ok) {
        passed++;
        if (args.verbose) console.log(`  ✓ ${name}/${pid} (${art.archetype})`);
      } else {
        failures.push({ domain: name, pid, archetype: art.archetype, errors: validate.errors });
      }
    }
    console.log(`[${name}] ${Object.keys(artifacts).length} artifacts`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total:   ${total}`);
  console.log(`Passed:  ${passed}`);
  console.log(`Failed:  ${failures.length}`);

  if (failures.length > 0) {
    console.log(`\n=== Failures ===`);
    for (const f of failures) {
      console.log(`\n${f.domain}/${f.pid} (${f.archetype}):`);
      for (const err of f.errors) {
        console.log(`  ${err.instancePath || "/"}: ${err.message}${err.params ? " " + JSON.stringify(err.params) : ""}`);
      }
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Validator failed:", err);
  process.exit(1);
});
