#!/usr/bin/env node
/**
 * Restore demo-tenant'а из JSON-snapshot'а.
 *
 *   node scripts/snapshot-restore.mjs --in /path/to/snapshot.json
 *
 * ВАЖНО: server idf должен быть остановлен. Скрипт удаляет содержимое
 * effects/ontology/rule_state/artifacts (artifacts пересоздадутся при первом
 * запросе) и INSERT'ит из snapshot'а.
 *
 * IDF_DB_PATH override через env (default: server/idf.db).
 */

import Database from "better-sqlite3";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.IDF_DB_PATH || join(__dirname, "..", "server", "idf.db");

const args = parseArgs(process.argv.slice(2));
if (!args.in || !existsSync(args.in)) {
  console.error(`Usage: snapshot-restore.mjs --in <path>  (file must exist)`);
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(args.in, "utf8"));
if (snapshot.version !== 1) {
  console.error(`Unsupported snapshot version: ${snapshot.version}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF");

const tx = db.transaction(() => {
  db.exec("DELETE FROM artifacts");
  db.exec("DELETE FROM effects");
  db.exec("DELETE FROM ontology");
  db.exec("DELETE FROM rule_state");

  const insEffect = db.prepare(`
    INSERT INTO effects (id, intent_id, alpha, target, value, scope, parent_id, status, ttl, context, created_at, resolved_at)
    VALUES (@id, @intent_id, @alpha, @target, @value, @scope, @parent_id, @status, @ttl, @context, @created_at, @resolved_at)
  `);
  for (const e of snapshot.effects) insEffect.run(e);

  const insOnt = db.prepare(`
    INSERT INTO ontology (id, kind, name, definition, created_at, updated_at)
    VALUES (@id, @kind, @name, @definition, @created_at, @updated_at)
  `);
  for (const o of snapshot.ontology) insOnt.run(o);

  const insRule = db.prepare(`
    INSERT INTO rule_state (rule_id, user_id, counter, last_fired_at)
    VALUES (@rule_id, @user_id, @counter, @last_fired_at)
  `);
  for (const r of snapshot.ruleState) insRule.run(r);
});

tx();
db.close();

console.error(
  `✓ restored from ${args.in} (${snapshot.counts.effects} effects, ` +
    `${snapshot.counts.ontology} domains, taken ${snapshot.takenAt})`
);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--in") out.in = argv[++i];
  }
  return out;
}
