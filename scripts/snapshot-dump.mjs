#!/usr/bin/env node
/**
 * Dump текущего состояния demo-tenant'а в JSON-файл.
 *
 *   node scripts/snapshot-dump.mjs --out /path/to/snapshot.json
 *   node scripts/snapshot-dump.mjs --out -                  # stdout
 *
 * Дампит:
 *   - effects (только status='confirmed' — proposed/rejected не нужны)
 *   - ontology (domain definitions)
 *   - rule_state (счётчики Rules Engine)
 *
 * Не дампит:
 *   - artifacts (пересоздаются из effects + ontology)
 *
 * IDF_DB_PATH override через env (default: server/idf.db).
 */

import Database from "better-sqlite3";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.IDF_DB_PATH || join(__dirname, "..", "server", "idf.db");

const args = parseArgs(process.argv.slice(2));
if (!args.out) {
  console.error("Usage: snapshot-dump.mjs --out <path>|-");
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

const effects = db.prepare("SELECT * FROM effects WHERE status='confirmed' ORDER BY created_at").all();
const ontology = db.prepare("SELECT * FROM ontology").all();
const ruleState = db.prepare("SELECT * FROM rule_state").all();

const snapshot = {
  version: 1,
  takenAt: new Date().toISOString(),
  source: DB_PATH,
  counts: {
    effects: effects.length,
    ontology: ontology.length,
    ruleState: ruleState.length,
  },
  effects,
  ontology,
  ruleState,
};

const json = JSON.stringify(snapshot, null, 2);

if (args.out === "-") {
  process.stdout.write(json + "\n");
} else {
  writeFileSync(args.out, json);
  console.error(`✓ snapshot written: ${args.out} (${effects.length} effects, ${ontology.length} domains)`);
}

db.close();

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out.out = argv[++i];
  }
  return out;
}
