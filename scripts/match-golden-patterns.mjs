#!/usr/bin/env node
/**
 * Прогон matchPatterns() на всех доменах IDF и проверка falsification
 * для 7 новых golden-standard паттернов (v0.10 Pattern Bank).
 *
 * Usage:
 *   node scripts/match-golden-patterns.mjs [--verbose]
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDefaultRegistry, loadStablePatterns } from "@intent-driven/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOMAINS_DIR = join(__dirname, "..", "src", "domains");
const verbose = process.argv.includes("--verbose");

const GOLDEN_PATTERNS = [
  "global-command-palette",
  "optimistic-replace-with-undo",
  "bulk-action-toolbar",
  "kanban-phase-column-board",
  "keyboard-property-popover",
  "observer-readonly-escape",
  "lifecycle-locked-parameters",
];

async function loadDomain(name) {
  const domainPath = join(DOMAINS_DIR, name, "domain.js");
  if (!existsSync(domainPath)) return null;
  try {
    return await import(domainPath);
  } catch (e) {
    return { __error: e.message };
  }
}

function collectIntents(domain) {
  const INTENTS = domain.INTENTS || {};
  return Object.entries(INTENTS).map(([id, intent]) => ({ id, ...intent }));
}

async function main() {
  const registry = getDefaultRegistry();
  loadStablePatterns(registry);
  const allPatterns = registry.getAllPatterns("stable");
  console.log(`\nPattern Bank: ${allPatterns.length} stable patterns loaded\n`);

  const domains = readdirSync(DOMAINS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  // Domain → pattern matches
  const matchMatrix = {};
  const patternHits = {};

  for (const name of domains) {
    const mod = await loadDomain(name);
    if (!mod || mod.__error) {
      console.log(`  ${name}: ERROR ${mod?.__error || "not loaded"}`);
      continue;
    }
    const intents = collectIntents(mod);
    const ontology = mod.ONTOLOGY || {};
    const projections = mod.PROJECTIONS || {};
    matchMatrix[name] = {};

    for (const [projId, proj] of Object.entries(projections)) {
      try {
        const matched = registry.matchPatterns(intents, ontology, {
          ...proj,
          id: projId,
        });
        matchMatrix[name][projId] = matched.map((m) => m.id);
        for (const m of matched) {
          patternHits[m.id] = (patternHits[m.id] || 0) + 1;
        }

      } catch (e) {
        matchMatrix[name][projId] = { error: e.message };
      }
    }
  }

  // Hits по golden patterns
  console.log("=== Golden-standard pattern hits ===\n");
  for (const pid of GOLDEN_PATTERNS) {
    const hits = patternHits[pid] || 0;
    console.log(`  ${hits > 0 ? "✓" : "·"} ${pid}: ${hits} hits`);
    if (verbose || hits > 0) {
      for (const [dom, projs] of Object.entries(matchMatrix)) {
        for (const [proj, ids] of Object.entries(projs)) {
          if (Array.isArray(ids) && ids.includes(pid)) {
            console.log(`      ${dom}/${proj}`);
          }
        }
      }
    }
  }

  // Все паттерны по hit count
  console.log("\n=== All patterns by hit count ===\n");
  const sorted = Object.entries(patternHits).sort((a, b) => b[1] - a[1]);
  for (const [pid, count] of sorted) {
    const isGolden = GOLDEN_PATTERNS.includes(pid) ? " [golden]" : "";
    console.log(`  ${count.toString().padStart(3)} ${pid}${isGolden}`);
  }

  // Falsification check — загружаем из SDK expected results
  console.log("\n=== Falsification check для golden patterns ===\n");
  let correctMatches = 0;
  let expectedMatches = 0;
  let correctRejects = 0;
  let expectedRejects = 0;
  const mismatches = [];

  for (const pid of GOLDEN_PATTERNS) {
    const pattern = registry.getPattern(pid);
    if (!pattern) continue;

    for (const sm of pattern.falsification?.shouldMatch || []) {
      expectedMatches++;
      const actual = matchMatrix[sm.domain]?.[sm.projection] || [];
      const ok = Array.isArray(actual) && actual.includes(pid);
      if (ok) correctMatches++;
      else mismatches.push({ pattern: pid, type: "shouldMatch", ...sm });
    }

    for (const sn of pattern.falsification?.shouldNotMatch || []) {
      expectedRejects++;
      const actual = matchMatrix[sn.domain]?.[sn.projection] || [];
      const ok = Array.isArray(actual) && !actual.includes(pid);
      if (ok) correctRejects++;
      else mismatches.push({ pattern: pid, type: "shouldNotMatch", ...sn });
    }
  }

  const matchRate = expectedMatches ? (correctMatches / expectedMatches * 100).toFixed(1) : "—";
  const rejectRate = expectedRejects ? (correctRejects / expectedRejects * 100).toFixed(1) : "—";
  console.log(`  shouldMatch: ${correctMatches}/${expectedMatches} (${matchRate}%)`);
  console.log(`  shouldNotMatch: ${correctRejects}/${expectedRejects} (${rejectRate}%)`);

  if (mismatches.length > 0) {
    console.log("\n  Mismatches:");
    for (const m of mismatches) {
      console.log(`    ${m.pattern} ${m.type}: ${m.domain}/${m.projection} — ${m.reason}`);
    }
  }

  // JSON отчёт
  const report = {
    date: new Date().toISOString().slice(0, 10),
    corePatterns: allPatterns.length,
    domainCount: Object.keys(matchMatrix).length,
    patternHits,
    matchMatrix,
    falsification: {
      shouldMatch: { correct: correctMatches, total: expectedMatches, rate: matchRate },
      shouldNotMatch: { correct: correctRejects, total: expectedRejects, rate: rejectRate },
      mismatches,
    },
  };
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    join(__dirname, "..", "refs", `${report.date}-golden-match-report.json`),
    JSON.stringify(report, null, 2)
  );
  console.log(`\nReport: refs/${report.date}-golden-match-report.json`);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
