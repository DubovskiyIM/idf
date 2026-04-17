#!/usr/bin/env node
/**
 * Claude Researcher Pipeline — extraction UX-паттернов из реальных продуктов.
 *
 * Два режима:
 *   --source <name> [--url, --image, --description] → extract mode (фазы 1-2-3)
 *   --analyze → self-improving loop (scan overrides → hypothesize)
 *
 * Usage:
 *   node scripts/pattern-researcher.mjs --source "linear-issue" --url "https://..."
 *   node scripts/pattern-researcher.mjs --analyze
 *   node scripts/pattern-researcher.mjs --source "test" --description "Todo list" --dry-run
 */

import { execFile, spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "prompts");
const REFS_DIR = join(__dirname, "..", "refs");

// ─── Утилиты (экспортируются для тестов) ───

export function extractJSON(text) {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) throw new Error("No JSON block found in Claude response");
  return JSON.parse(match[1]);
}

export function buildPrompt(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export function parseArgs(argv) {
  const args = { mode: null, source: null, url: null, image: null, description: null, archetype: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--analyze": args.mode = "analyze"; break;
      case "--source": args.source = argv[++i]; break;
      case "--url": args.url = argv[++i]; break;
      case "--image": args.image = argv[++i]; break;
      case "--description": args.description = argv[++i]; break;
      case "--archetype": args.archetype = argv[++i]; break;
      case "--dry-run": args.dryRun = true; break;
    }
  }
  if (!args.mode && args.source) args.mode = "extract";
  if (!args.mode) throw new Error("Usage: --source <name> [--url|--image|--description] or --analyze");
  if (args.mode === "extract" && !args.url && !args.image && !args.description && !args.dryRun) {
    throw new Error("Extract mode requires at least one of: --url, --image, --description");
  }
  return args;
}

export function callClaude(prompt, { images = [], timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const args = ["-p", "-", "--output-format", "json"];
    for (const img of images) args.push("--image", img);
    const proc = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", d => { stdout += d; });
    proc.stderr.on("data", d => { stderr += d; });
    proc.on("close", code => {
      if (code !== 0) return reject(new Error(`Claude exited ${code}: ${stderr.slice(0, 500)}`));
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed.result || parsed.content || stdout);
      } catch {
        resolve(stdout);
      }
    });
    proc.on("error", reject);
    proc.stdin.write(prompt);
    proc.stdin.end();
    const timer = setTimeout(() => { try { proc.kill(); } catch {} reject(new Error("Claude timeout")); }, timeoutMs);
    proc.on("close", () => { try { clearTimeout(timer); } catch {} });
  });
}

function loadPrompt(name) {
  return readFileSync(join(PROMPTS_DIR, name), "utf-8");
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Extract Mode ───

async function runExtract(args) {
  console.log(`\n═══ Extract Mode: ${args.source} ═══\n`);

  // Фаза 1: Extract domain model
  console.log("Phase 1: Extracting domain model...");
  let extractedModel;

  if (args.dryRun) {
    extractedModel = {
      source: args.source,
      entities: [{ name: "Task", fields: ["title", "status"], statusValues: ["todo", "done"] }],
      intents: [{ id: "create_task", α: "add", creates: "Task" }],
      roles: ["owner"],
      observations: ["Simple CRUD list"],
    };
    console.log("  [dry-run] Using mock extracted model");
  } else {
    const template = loadPrompt("extract-domain-model.md");
    const prompt = buildPrompt(template, {
      INPUT_URL: args.url || "(не предоставлен)",
      INPUT_DESCRIPTION: args.description || "(не предоставлено)",
      ARCHETYPE_HINT: args.archetype || "любой",
    });
    const images = args.image ? [args.image] : [];
    const response = await callClaude(prompt, { images });
    extractedModel = extractJSON(response);
  }

  ensureDir(join(REFS_DIR, "extracted"));
  const extractedPath = join(REFS_DIR, "extracted", `${today()}-${args.source}.json`);
  writeFileSync(extractedPath, JSON.stringify(extractedModel, null, 2));
  console.log(`  Saved: ${extractedPath}`);

  // Фаза 2: Hypothesize pattern
  console.log("\nPhase 2: Generating candidate pattern...");
  let candidateResponse;

  if (args.dryRun) {
    candidateResponse = {
      covered: [],
      candidates: [{
        id: `${args.source}-candidate`,
        version: 1,
        status: "candidate",
        archetype: args.archetype || "catalog",
        trigger: { requires: [{ kind: "intent-creates", entity: "$mainEntity" }] },
        structure: { slot: "hero", description: "Auto-generated candidate" },
        rationale: { hypothesis: "Dry run", evidence: [{ source: args.source, description: "mock", reliability: "low" }] },
        falsification: {
          shouldMatch: [{ domain: "test", projection: "list", reason: "mock" }],
          shouldNotMatch: [{ domain: "test", projection: "detail", reason: "mock" }],
        },
      }],
    };
    console.log("  [dry-run] Using mock candidate");
  } else {
    const template = loadPrompt("hypothesize-pattern.md");
    const existingPatterns = getExistingPatternsDescription();
    const prompt = buildPrompt(template, {
      EXTRACTED_MODEL: JSON.stringify(extractedModel, null, 2),
      EXISTING_PATTERNS: existingPatterns,
      SOURCE_NAME: args.source,
    });
    const response = await callClaude(prompt);
    candidateResponse = extractJSON(response);
  }

  // Покрытие
  if (candidateResponse.covered?.length) {
    console.log("\n  Already covered:");
    for (const c of candidateResponse.covered) {
      console.log(`    ${c.observation} → ${c.coveredBy}`);
    }
  }

  // Фаза 3: Validate каждый candidate
  const candidates = candidateResponse.candidates || [];
  console.log(`\nPhase 3: Validating ${candidates.length} candidate(s)...`);

  ensureDir(join(REFS_DIR, "candidates"));
  for (const candidate of candidates) {
    candidate.status = "candidate";
    const report = validateCandidate(candidate);
    console.log(`  ${candidate.id}: format ${report.formatValid ? "✅" : "❌ " + report.formatError}, overlap ${report.overlaps.length === 0 ? "✅" : "⚠ " + report.overlaps.join(", ")}`);

    const path = join(REFS_DIR, "candidates", `${today()}-${args.source}-${candidate.id}.json`);
    writeFileSync(path, JSON.stringify(candidate, null, 2));
    console.log(`  Saved: ${path}`);
  }

  console.log(`\n  Review candidates and promote to stable/ when ready.`);
  return { extractedModel, candidates };
}

// ─── Analyze Mode (Self-Improving Loop) ───

async function runAnalyze(args) {
  console.log("\n═══ Self-Improving Loop: Analyze Overrides ═══\n");

  const overrides = collectExplicitOverrides();
  console.log(`Found ${overrides.length} explicit overrides across domains\n`);

  const covered = [];
  const notCovered = [];

  for (const ov of overrides) {
    const classification = classifyOverride(ov);
    if (classification.covered) {
      covered.push({ ...ov, coveredBy: classification.coveredBy });
    } else {
      notCovered.push(ov);
    }
  }

  console.log(`✅ Covered by existing patterns: ${covered.length}`);
  for (const c of covered) {
    console.log(`   ${c.domain}/${c.projection}.${c.type} → ${c.coveredBy}`);
  }

  console.log(`\n⚠ Not covered: ${notCovered.length}`);
  for (const nc of notCovered) {
    console.log(`   ${nc.domain}/${nc.projection}.${nc.type}`);
  }

  if (notCovered.length === 0) {
    console.log("\nAll overrides covered!");
    return { covered, notCovered, candidates: [] };
  }

  const candidates = [];
  if (!args.dryRun) {
    console.log(`\nGenerating candidates for ${notCovered.length} uncovered overrides...`);
    const template = loadPrompt("analyze-override.md");
    const existingPatterns = getExistingPatternsDescription();

    for (const ov of notCovered) {
      console.log(`  Analyzing: ${ov.domain}/${ov.projection}.${ov.type}...`);
      const prompt = buildPrompt(template, {
        DOMAIN: ov.domain,
        PROJECTION: ov.projection,
        KIND: ov.kind || "detail",
        MAIN_ENTITY: ov.mainEntity || "unknown",
        OVERRIDE_TYPE: ov.type,
        OVERRIDE_VALUE: JSON.stringify(ov.value, null, 2),
        EXISTING_PATTERNS: existingPatterns,
        ENTITIES: "{}",
        INTENTS: "{}",
      });
      try {
        const response = await callClaude(prompt);
        const candidate = extractJSON(response);
        candidate.status = "candidate";
        candidates.push(candidate);
        console.log(`    → Generated: ${candidate.id}`);
      } catch (err) {
        console.log(`    → Error: ${err.message}`);
        ensureDir(join(REFS_DIR, "errors"));
        writeFileSync(join(REFS_DIR, "errors", `${today()}-${ov.domain}-${ov.projection}.txt`), err.message);
      }
    }

    ensureDir(join(REFS_DIR, "candidates"));
    for (const c of candidates) {
      const report = validateCandidate(c);
      const path = join(REFS_DIR, "candidates", `${today()}-analyze-${c.id}.json`);
      writeFileSync(path, JSON.stringify({ candidate: c, validation: report }, null, 2));
      console.log(`  Saved: ${path}`);
    }
  } else {
    console.log("\n[dry-run] Skipping Claude calls");
  }

  const rate = overrides.length > 0 ? ((covered.length / overrides.length) * 100).toFixed(1) : "N/A";
  console.log(`\n═══ Summary ═══`);
  console.log(`Overrides: ${overrides.length} total, ${covered.length} covered, ${notCovered.length} not covered`);
  console.log(`Candidates generated: ${candidates.length}`);
  console.log(`Coverage rate: ${rate}%`);

  return { covered, notCovered, candidates };
}

// ─── Helpers ───

const OVERRIDE_FIELDS = ["subCollections", "layout", "footerIntents", "progress", "voterSelector", "embedded"];

export function collectExplicitOverrides() {
  const domainsDir = join(__dirname, "..", "src", "domains");
  const overrides = [];

  if (!existsSync(domainsDir)) return overrides;

  for (const domain of readdirSync(domainsDir)) {
    const projPath = join(domainsDir, domain, "projections.js");
    if (!existsSync(projPath)) continue;

    const content = readFileSync(projPath, "utf-8");

    for (const field of OVERRIDE_FIELDS) {
      // Ищем projectionId: { ... kind: "X", ... mainEntity: "Y", ... field: ...}
      // Используем простую regex-эвристику по структуре
      const pattern = new RegExp(
        `(\\w+):\\s*\\{[\\s\\S]*?kind:\\s*"(\\w+)"[\\s\\S]*?mainEntity:\\s*"(\\w+)"[\\s\\S]*?${field}\\s*:`,
        "g"
      );
      let match;
      while ((match = pattern.exec(content)) !== null) {
        overrides.push({
          domain,
          projection: match[1],
          kind: match[2],
          mainEntity: match[3],
          type: field,
        });
      }
    }
  }

  const seen = new Set();
  return overrides.filter(o => {
    const key = `${o.domain}/${o.projection}/${o.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function classifyOverride(override) {
  const knownPatterns = {
    subCollections: "subcollections",
    layout: "grid-card-layout",
    footerIntents: "footer-inline-setter",
    progress: null,
    voterSelector: null,
    embedded: null,
  };
  const coveredBy = knownPatterns[override.type];
  return { covered: !!coveredBy, coveredBy };
}

function getExistingPatternsDescription() {
  return [
    "hero-create: catalog + intent creates mainEntity с confirmation enter/click",
    "phase-aware-primary-cta: detail + entity.status select ≥3 + replace .status",
    "subcollections: detail + sub-entity с foreignKey на mainEntity",
    "irreversible-confirm: cross + intent.irreversibility=high",
    "grid-card-layout: catalog + entity с image ИЛИ ≥3 money/percentage полей",
    "inline-search: cross + intent witnesses query+results, entities=[]",
    "composer-entry: feed + intent creates mainEntity, confirmation=enter",
    "vote-group: detail + ≥2 intent creates Entity(discriminator) одной base",
    "antagonist-toggle: feed + intent.antagonist парный intent",
    "footer-inline-setter: detail + 1-param replace на одном поле mainEntity",
  ].join("\n");
}

export function validateCandidate(candidate) {
  const report = { formatValid: true, formatError: null, overlaps: [] };
  try {
    if (!candidate.id) throw new Error("missing id");
    if (!candidate.trigger?.requires) throw new Error("missing trigger.requires");
    if (!candidate.structure) throw new Error("missing structure");
    if (!candidate.rationale) throw new Error("missing rationale");
    if (!candidate.falsification?.shouldMatch?.length) throw new Error("missing falsification.shouldMatch");
    if (!candidate.falsification?.shouldNotMatch?.length) throw new Error("missing falsification.shouldNotMatch");
  } catch (err) {
    report.formatValid = false;
    report.formatError = err.message;
  }

  const existingIds = [
    "hero-create", "phase-aware-primary-cta", "subcollections", "irreversible-confirm",
    "grid-card-layout", "inline-search", "composer-entry", "vote-group",
    "antagonist-toggle", "footer-inline-setter",
  ];
  if (existingIds.includes(candidate.id)) {
    report.overlaps.push(candidate.id);
  }

  return report;
}

// ─── Main ───

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "extract") {
    await runExtract(args);
  } else if (args.mode === "analyze") {
    await runAnalyze(args);
  }
}

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith("pattern-researcher.mjs") &&
  !process.env.VITEST
);

if (isDirectRun) {
  main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
