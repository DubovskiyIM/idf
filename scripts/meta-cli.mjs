#!/usr/bin/env node
/**
 * meta-cli — offline CLI клиент мета-домена для daily dogfood'инга.
 *
 * Загружает INTENTS из src/domains/meta/intents.js, валидирует параметры
 * против заявленной schema, интерполирует {{params.X}} / {{auto}} /
 * {{viewer.id}} / {{now}} в particles.effects, пишет confirmed-effects
 * напрямую в server/idf.db через better-sqlite3 (тот же DB-файл, что
 * читает meta-compile.mjs --offline).
 *
 * Это сознательно offline-клиент: invariant-checks не запускаются, роль
 * подразумевается formatAuthor (admin). Строгий путь с JWT — POST
 * /api/agent/meta/exec/<id> через server. CLI нужен для situations, где
 * Я хочу одной командой записать backlog/witness/promotion без поднятия
 * сервера.
 *
 * Команды:
 *   meta-cli list                       — список intents
 *   meta-cli schema <id>                — параметры конкретного intent'a
 *   meta-cli exec <id> --param=value …  — выполнить
 *
 * Системные флаги: --user=<id> · --db=<path> · --dry-run · --help.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
// ENV-источники резолвим лениво, чтобы тесты могли менять process.env уже
// после import'а модуля.
const defaultDb = () => process.env.IDF_DB_PATH || join(REPO_ROOT, "server", "idf.db");
const defaultServer = () => process.env.IDF_SERVER || "http://localhost:3001";

const SYSTEM_FLAGS = new Set([
  "user", "db", "dry-run", "help",
  "online", "token", "server",
]);

const HELP = `meta-cli — клиент мета-домена IDF (offline + online).

Команды:
  list                       Список доступных intents.
  schema <intentId>          Параметры конкретного intent'а.
  exec <intentId> [flags]    Выполнить, --param=value.

Режимы exec:
  offline (default)          Прямая запись confirmed-effects в server/idf.db.
                             Минует invariant-checks. role = formatAuthor (admin).
  --online                   POST /api/agent/meta/exec/<id> с Bearer JWT.
                             Проходит validateParams + ownership + preapproval +
                             invariants. role = agent (см. meta ontology).

Системные флаги:
  --user=<id>                viewer.id для интерполяции (default: cli).
  --db=<path>                путь к idf.db (default: server/idf.db).
  --token=<JWT>              JWT для --online (или ENV IDF_TOKEN).
  --server=<url>             base URL для --online (default: ENV IDF_SERVER или
                             http://localhost:3001).
  --dry-run                  не писать, распечатать сгенерированные эффекты.
  --help                     эта справка.

Пример:
  meta-cli exec add_backlog_item --section=P1 --title="…" --description="…"
`;

async function loadIntents() {
  const mod = await import(join(REPO_ROOT, "src", "domains", "meta", "intents.js"));
  return mod.INTENTS;
}

function parseFlags(argv) {
  const params = {};
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const [key, ...rest] = arg.slice(2).split("=");
    let value;
    if (rest.length) {
      value = rest.join("=");
    } else if (argv[i + 1] != null && !argv[i + 1].startsWith("--")) {
      value = argv[++i];
    } else {
      value = true;
    }
    (SYSTEM_FLAGS.has(key) ? flags : params)[key] = value;
  }
  return { positional, params, flags };
}

function ensureSchema(db) {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS effects (
      id          TEXT PRIMARY KEY,
      intent_id   TEXT NOT NULL,
      alpha       TEXT NOT NULL,
      target      TEXT NOT NULL,
      value       TEXT,
      scope       TEXT DEFAULT 'account',
      parent_id   TEXT REFERENCES effects(id),
      status      TEXT DEFAULT 'proposed',
      ttl         INTEGER,
      context     TEXT,
      created_at  INTEGER NOT NULL,
      resolved_at INTEGER
    );
  `);
}

function validateParams(intent, params) {
  const issues = [];
  const schemaParams = intent.parameters || [];
  const expected = new Set(schemaParams.map(p => p.name));
  for (const key of Object.keys(params)) {
    if (!expected.has(key)) issues.push(`unexpected param: ${key}`);
  }
  for (const p of schemaParams) {
    const v = params[p.name];
    if (p.required && (v == null || v === "")) {
      issues.push(`required param missing: ${p.name}`);
      continue;
    }
    if (v == null) continue;
    if (p.type === "number" && Number.isNaN(Number(v))) {
      issues.push(`param ${p.name}: ожидался number, получено ${v}`);
    }
    if (p.type === "select" && p.options && !p.options.includes(String(v))) {
      issues.push(`param ${p.name}: ожидалось ${p.options.join("|")}, получено ${v}`);
    }
  }
  return issues;
}

const PLACEHOLDER_FULL = /^\{\{\s*([^}]+)\s*\}\}$/;
const PLACEHOLDER_INNER = /\{\{\s*([^}]+)\s*\}\}/g;

function resolvePath(path, ctx) {
  const trimmed = path.trim();
  if (trimmed === "auto") return ctx.auto();
  if (trimmed === "now") return ctx.now;
  if (trimmed === "viewer.id") return ctx.viewer.id;
  if (trimmed.startsWith("params.")) return ctx.params[trimmed.slice(7)];
  return undefined;
}

function interpolate(template, ctx) {
  if (typeof template !== "string") return template;
  const full = template.match(PLACEHOLDER_FULL);
  if (full) return resolvePath(full[1], ctx);
  return template.replace(PLACEHOLDER_INNER, (_m, p) => {
    const v = resolvePath(p, ctx);
    return v == null ? "" : String(v);
  });
}

function buildEffectRows(intent, intentId, params, viewer) {
  const now = Date.now();
  const ctx = { params, viewer, now, auto: () => randomUUID() };
  const templates = intent?.particles?.effects || [];
  if (templates.length === 0) {
    throw new Error(`intent ${intentId}: particles.effects пуст`);
  }
  return templates.map((t, idx) => {
    const fields = {};
    for (const [k, v] of Object.entries(t.fields || {})) {
      fields[k] = interpolate(v, ctx);
    }
    // Для α=create entity-id живёт в fields.id (часто {{auto}}); для α=replace
    // на <Entity>.<field> — в params.id (соглашение mета-intents). meta-compile
    // foldBacklogItems падает на ef.id если context.id отсутствует, поэтому
    // явно прокидываем entityId в context.
    const entityId = fields.id || params.id || ctx.auto();
    if (t.α === "create") fields.id = entityId;
    const intentIrr = intent?.context?.__irr;
    return {
      id: randomUUID(),
      intent_id: intentId,
      alpha: t.α,
      target: t.target,
      value: JSON.stringify(fields),
      scope: "account",
      status: "confirmed",
      ttl: null,
      context: JSON.stringify({
        ...fields,
        id: entityId,
        ...(intentIrr ? { __irr: intentIrr } : {}),
      }),
      created_at: now + idx,
      resolved_at: now + idx,
    };
  });
}

function insertEffects(db, rows) {
  const stmt = db.prepare(`
    INSERT INTO effects (id, intent_id, alpha, target, value, scope, parent_id,
                         status, ttl, context, created_at, resolved_at)
    VALUES (@id, @intent_id, @alpha, @target, @value, @scope, NULL,
            @status, @ttl, @context, @created_at, @resolved_at)
  `);
  const tx = db.transaction(rs => { for (const r of rs) stmt.run(r); });
  tx(rows);
}

function commandList(intents) {
  const ids = Object.keys(intents).sort();
  console.log(`\nMeta intents (${ids.length}):\n`);
  for (const id of ids) {
    const it = intents[id];
    console.log(`  ${id.padEnd(36)} ${(it.α || "?").padEnd(8)} ${it.target}`);
  }
  console.log("");
}

function commandSchema(intents, intentId) {
  const it = intents[intentId];
  if (!it) throw new Error(`intent не найден: ${intentId}`);
  console.log(`\n${intentId} — ${it.name}`);
  console.log(`  α=${it.α}  target=${it.target}  confirmation=${it.confirmation}`);
  if (it.precondition) console.log(`  precondition: ${JSON.stringify(it.precondition)}`);
  if (it.context?.__irr) {
    console.log(`  __irr: ${it.context.__irr.point} — ${it.context.__irr.reason}`);
  }
  console.log("\n  Параметры:");
  for (const p of (it.parameters || [])) {
    const req = p.required ? " [REQUIRED]" : "";
    const opts = p.options ? ` (${p.options.join("|")})` : "";
    const ent = p.entity ? ` → ${p.entity}` : "";
    console.log(`    --${p.name.padEnd(28)} ${p.type}${opts}${ent}${req}  ${p.label || ""}`);
  }
  console.log("");
}

async function execOnline(intentId, params, flags) {
  const token = flags.token || process.env.IDF_TOKEN;
  if (!token) {
    console.error("✗ --online: требуется --token=<JWT> или ENV IDF_TOKEN");
    process.exit(4);
  }
  const serverUrl = flags.server || defaultServer();
  const url = `${serverUrl.replace(/\/+$/, "")}/api/agent/meta/exec/${intentId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    console.error(`✗ ${res.status} ${data.error || "error"}: ${data.message || data.reason || ""}`);
    if (Array.isArray(data.issues)) {
      for (const i of data.issues) console.error("  - " + JSON.stringify(i));
    }
    process.exit(3);
  }
  console.log(`✓ ${data.status || "ok"} ${data.id || ""}`);
  for (const e of (data.effects || [])) console.log(`  ${e.alpha}  ${e.target}`);
  if (data.createdEntity) {
    console.log(`  createdEntity: ${JSON.stringify(data.createdEntity)}`);
  }
  return data;
}

async function commandExec(intents, intentId, params, flags) {
  const intent = intents[intentId];
  if (!intent) throw new Error(`intent не найден: ${intentId}`);
  const issues = validateParams(intent, params);
  if (issues.length) {
    console.error("✗ Validation:");
    for (const m of issues) console.error("  - " + m);
    process.exit(2);
  }
  if (flags.online) {
    return execOnline(intentId, params, flags);
  }
  const viewer = { id: flags.user || "cli" };
  const rows = buildEffectRows(intent, intentId, params, viewer);
  if (flags["dry-run"]) {
    console.log("[dry-run] эффекты, которые были бы записаны:\n");
    console.log(JSON.stringify(rows, null, 2));
    return rows;
  }
  const dbPath = flags.db || defaultDb();
  const db = new Database(dbPath);
  ensureSchema(db);
  insertEffects(db, rows);
  db.close();
  console.log(`✓ записано ${rows.length} эффект(ов) в ${dbPath}`);
  for (const r of rows) console.log(`  ${r.id}  ${r.alpha}  ${r.target}`);
  return rows;
}

export async function run(argv) {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    console.log(HELP.trim());
    return;
  }
  const [command, ...rest] = argv;
  const { positional, params, flags } = parseFlags(rest);
  const intents = await loadIntents();
  switch (command) {
    case "list":
      return commandList(intents);
    case "schema":
      if (!positional[0]) throw new Error("schema: укажите <intentId>");
      return commandSchema(intents, positional[0]);
    case "exec":
      if (!positional[0]) throw new Error("exec: укажите <intentId>");
      return await commandExec(intents, positional[0], params, flags);
    default:
      throw new Error(`неизвестная команда: ${command}`);
  }
}

// Тесты импортируют run() напрямую; в CLI-режиме main-flag.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run(process.argv.slice(2)).catch(err => {
    console.error("✗ " + err.message);
    process.exit(1);
  });
}
