/**
 * §15 zazor #3 phase 1 — batch analyzer для heuristic promotion candidates.
 *
 * Для каждого домена:
 *   1. Прогоняет inferFieldRole на каждом поле каждой entity
 *   2. Прогоняет computeAlgebraWithEvidence на intents
 * Собирает heuristic results, группирует по witness.pattern, ранжирует по count.
 *
 * Usage:
 *   node scripts/zazor3-candidates.mjs
 *   node scripts/zazor3-candidates.mjs --format json
 *   node scripts/zazor3-candidates.mjs --min-count 1
 *   node scripts/zazor3-candidates.mjs --domain booking
 */

import { inferFieldRole, computeAlgebraWithEvidence } from "@intent-driven/core";

const DOMAINS = [
  "booking", "planning", "workflow", "messenger",
  "sales", "lifequest", "reflect", "invest", "delivery",
];

const SUGGESTIONS = {
  "name:title-synonym":          "ontology.fieldPatterns.title = { names: ['title', 'name', 'label'] }",
  "name:description-synonym":    "ontology.fieldPatterns.description = { names: ['description', 'bio', 'content'], requiresType: 'textarea' }",
  "name:price-substring":        "ontology.fieldPatterns.price = { substrings: ['price', 'cost', 'amount'], requiresType: 'number' }",
  "name:timer-suffix":           "ontology.fieldPatterns.timer = { suffixPatterns: ['end', 'deadline', 'expir'], requiresType: 'datetime' }",
  "name:coordinate-set":         "ontology.fieldPatterns.coordinate = { names: ['lat', 'lng', 'coords', 'position'] }",
  "name:address-suffix":         "ontology.fieldPatterns.address = { suffixRegex: '/address$/i' }",
  "name:zone-set":               "ontology.fieldPatterns.zone = { names: ['zone', 'polygon', 'area'] }",
  "name:location-set":           "ontology.fieldPatterns.location = { names: ['location', 'city'], suffix: 'from' }",
  "name:badge-status":           "ontology.fieldPatterns.badge = { names: ['status', 'condition'] }",
  "type:number-metric-fallback": "entity.fields[X].fieldRole = 'metric' — явно декларировать, либо добавить в fieldPatterns",
  "fallback:info":               "(обычно игнорируется — info — универсальный fallback)",
  "antagonist-declared":         "entity.transitions с bidirectional rule, или парные α:'replace' effects для structural antagonism",
};

function parseArgs(argv) {
  const args = { format: "human", minCount: 3, domain: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--format") args.format = argv[++i];
    else if (argv[i] === "--min-count") args.minCount = parseInt(argv[++i], 10);
    else if (argv[i] === "--domain") args.domain = argv[++i];
  }
  return args;
}

export function normalizeFieldNames(entity) {
  const f = entity?.fields;
  if (Array.isArray(f)) return f.map(n => ({ name: n, def: {} }));
  if (f && typeof f === "object") return Object.entries(f).map(([name, def]) => ({ name, def }));
  return [];
}

export async function collectRecords(domainName, mod) {
  const records = [];
  const { INTENTS, ONTOLOGY } = mod;
  if (!INTENTS || !ONTOLOGY) return records;

  // Field-level heuristics
  const entities = ONTOLOGY.entities || {};
  for (const [entityName, entity] of Object.entries(entities)) {
    for (const { name: fieldName, def } of normalizeFieldNames(entity)) {
      const result = inferFieldRole(fieldName, def);
      if (result?.reliability === "heuristic" && result.pattern) {
        records.push({
          pattern: result.pattern,
          role: result.role,
          location: `${domainName}/${entityName}.${fieldName}`,
          domain: domainName,
        });
      }
    }
  }

  // Intent-relation heuristics
  const evidence = computeAlgebraWithEvidence(INTENTS, ONTOLOGY);
  for (const [intentId, data] of Object.entries(evidence || {})) {
    const pairs = data?.antagonistsEvidence || {};
    for (const [otherId, pair] of Object.entries(pairs)) {
      if (pair?.reliability === "heuristic" && pair.witness?.pattern) {
        if (intentId < otherId) {
          records.push({
            pattern: pair.witness.pattern,
            location: `${domainName}/${intentId} ⇌ ${otherId}`,
            domain: domainName,
          });
        }
      }
    }
  }

  return records;
}

export function groupByPattern(records) {
  const groups = {};
  for (const r of records) {
    if (!groups[r.pattern]) groups[r.pattern] = [];
    groups[r.pattern].push(r);
  }
  return groups;
}

export function rankGroups(groups) {
  return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
}

function printHuman(sorted, minCount) {
  console.log("=== zazor #3 heuristic promotion candidates ===\n");

  let totalRecords = 0;
  let shownPatterns = 0;

  for (const [pattern, recs] of sorted) {
    totalRecords += recs.length;
    if (recs.length < minCount) continue;
    shownPatterns++;

    const domains = [...new Set(recs.map(r => r.domain))];
    console.log(`[${pattern}] ${recs.length} occurrences across ${domains.length} domain(s): ${domains.join(", ")}`);

    const suggestion = SUGGESTIONS[pattern] || "(no template — add to SUGGESTIONS in zazor3-candidates.mjs)";
    console.log(`  Suggested ontology-rule: ${suggestion}`);

    const examples = recs.slice(0, 5).map(r => r.location).join(", ");
    console.log(`  Examples: ${examples}`);
    if (recs.length > 5) console.log(`  ... и ещё ${recs.length - 5}`);
    console.log();
  }

  console.log("=== Summary ===");
  console.log(`Total heuristic occurrences: ${totalRecords}`);
  console.log(`Unique patterns: ${sorted.length}`);
  console.log(`Candidates (≥${minCount} occurrences): ${shownPatterns}`);
}

function printJson(sorted, minCount) {
  const patterns = sorted
    .filter(([, recs]) => recs.length >= minCount)
    .map(([pattern, recs]) => {
      const domains = [...new Set(recs.map(r => r.domain))];
      return {
        pattern,
        count: recs.length,
        domains,
        examples: recs.slice(0, 5).map(r => r.location),
        suggestion: SUGGESTIONS[pattern] || null,
      };
    });
  console.log(JSON.stringify({ patterns, minCount }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv);
  const domains = args.domain ? [args.domain] : DOMAINS;

  const allRecords = [];
  for (const name of domains) {
    let mod;
    try {
      mod = await import(`../src/domains/${name}/domain.js`);
    } catch (err) {
      console.error(`[${name}] не удалось импортировать: ${err.message}`);
      continue;
    }
    const records = await collectRecords(name, mod);
    allRecords.push(...records);
  }

  if (allRecords.length === 0) {
    console.log("Нет эвристических срабатываний — все findings structural или rule-based.");
    process.exit(0);
  }

  const groups = groupByPattern(allRecords);
  const sorted = rankGroups(groups);

  if (args.format === "json") printJson(sorted, args.minCount);
  else printHuman(sorted, args.minCount);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error("Analyzer failed:", err);
    process.exit(1);
  });
}
