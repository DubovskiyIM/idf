#!/usr/bin/env node
/**
 * derivation-diff.mjs
 *
 * Standalone diff: какие slots добавлены/изменены при применении
 * pattern.structure.apply для projection домена.
 *
 * Usage:
 *   node scripts/derivation-diff.mjs --domain <name> --projection <id>
 *   node scripts/derivation-diff.mjs --domain <name> --projection <id> --pattern <patternId>
 *   node scripts/derivation-diff.mjs --domain <name> --projection <id> --without <patternId>
 *   node scripts/derivation-diff.mjs --domain <name> --projection <id> --json
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { computeSlotAttribution } from "@intent-driven/core";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

async function loadDomain(name) {
  const file = path.join(ROOT, "src", "domains", name, "domain.js");
  const mod = await import(pathToFileURL(file).href);
  return {
    ontology: mod.ONTOLOGY,
    intents: mod.INTENTS || {},
    projections: mod.PROJECTIONS || {},
  };
}

function formatHuman(out) {
  const lines = [];
  lines.push(`${out.domain} / ${out.projection}`);
  lines.push("=".repeat(40));
  if (out.patterns.length === 0) {
    lines.push("(no derived slots)");
    return lines.join("\n");
  }
  for (const p of out.patterns) {
    lines.push("");
    lines.push(`Pattern: ${p.patternId} (${p.changes.length} change${p.changes.length === 1 ? "" : "s"})`);
    for (const c of p.changes) {
      const sym = c.action === "added" ? "+" : "~";
      lines.push(`${sym} ${c.path}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.domain || !args.projection) {
    console.error("usage: derivation-diff.mjs --domain <name> --projection <id> [--pattern <id>] [--without <id>] [--json]");
    process.exit(2);
  }

  const domain = await loadDomain(args.domain);
  const projection = domain.projections[args.projection];
  if (!projection) {
    console.error(`projection "${args.projection}" not found in domain "${args.domain}"`);
    process.exit(2);
  }

  const intents = Object.entries(domain.intents)
    .map(([id, intent]) => ({ id, ...intent }));
  const attribution = computeSlotAttribution(intents, domain.ontology, {
    ...projection,
    id: args.projection,
  });

  const groups = new Map();
  for (const [p, info] of Object.entries(attribution)) {
    if (!groups.has(info.patternId)) groups.set(info.patternId, []);
    groups.get(info.patternId).push({ path: p, action: info.action });
  }

  let filteredGroups = [...groups.entries()];
  if (args.pattern) {
    filteredGroups = filteredGroups.filter(([id]) => id === args.pattern);
  }
  if (args.without) {
    filteredGroups = filteredGroups.filter(([id]) => id !== args.without);
  }

  const out = {
    domain: args.domain,
    projection: args.projection,
    mode: args.without ? "without" : args.pattern ? "single" : "all",
    excluded: args.without || null,
    only: args.pattern || null,
    patterns: filteredGroups.map(([patternId, changes]) => ({ patternId, changes })),
  };

  if (args.json) {
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  } else {
    process.stdout.write(formatHuman(out) + "\n");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
