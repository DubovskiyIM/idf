#!/usr/bin/env node
/**
 * mcp-meta — MCP-сервер мета-домена IDF.
 *
 * Stdio JSON-RPC 2.0 (spec 2024-11-05). Exposes propose-only subset
 * meta-intents как MCP tools — Claude Desktop / Claude Code могут вызывать
 * `meta_add_backlog_item`, `meta_propose_witness` и т.д. напрямую.
 *
 * Allowed list совпадает с `roles.agent.canExecute` в
 * `src/domains/meta/ontology.js` (state-transitions и propose_meta_intent
 * сознательно не expose'нуты — irreversibility и human-review).
 *
 * Режимы (ENV IDF_MCP_MODE):
 *   offline (default)  — пишет в server/idf.db через scripts/meta-cli.mjs
 *   online             — POST /api/agent/meta/exec/<id> с Bearer JWT
 *                        (IDF_TOKEN, IDF_SERVER)
 *
 * Регистрация в Claude Code:
 *   ~/.claude/mcp.json → "idf-meta": { command: "node", args: ["<repo>/scripts/mcp-meta.mjs"] }
 */

import { createInterface } from "node:readline";
import { stdin, stdout, stderr } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "idf-meta", version: "0.1.0" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const TOOL_PREFIX = "meta_";

// Должно совпадать с roles.agent.canExecute в meta ontology.
export const ALLOWED_INTENTS = new Set([
  "add_backlog_item",
  "propose_witness",
  "propose_intent_salience",
  "request_pattern_promotion",
]);

export async function loadIntents() {
  const mod = await import(join(REPO_ROOT, "src", "domains", "meta", "intents.js"));
  return mod.INTENTS;
}

const TYPE_MAP = {
  text: "string",
  textarea: "string",
  url: "string",
  entityRef: "string",
  select: "string",
  number: "number",
  datetime: "string",
};

export function buildToolDef(intentId, intent) {
  const properties = {};
  const required = [];
  for (const p of intent.parameters || []) {
    const schema = {
      type: TYPE_MAP[p.type] || "string",
      description: p.label || p.name,
    };
    if (p.type === "select" && p.options) schema.enum = p.options;
    if (p.entity) schema.description += ` (ref → ${p.entity})`;
    properties[p.name] = schema;
    if (p.required) required.push(p.name);
  }
  const irr = intent.context?.__irr;
  let description = `${intent.name} (α:${intent.α} target:${intent.target})`;
  if (irr) description += `\n⚠ irreversibility=${irr.point}: ${irr.reason}`;
  return {
    name: `${TOOL_PREFIX}${intentId}`,
    description,
    inputSchema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  };
}

async function executeOnline(intentId, args) {
  const token = process.env.IDF_TOKEN;
  if (!token) throw new Error("IDF_TOKEN required for online mode");
  const base = (process.env.IDF_SERVER || "http://localhost:3001").replace(/\/+$/, "");
  const res = await fetch(`${base}/api/agent/meta/exec/${intentId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(args),
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const detail = data.message || data.reason || data.error || "error";
    const issues = Array.isArray(data.issues) ? "\n" + JSON.stringify(data.issues, null, 2) : "";
    throw new Error(`HTTP ${res.status} ${data.error || ""}: ${detail}${issues}`);
  }
  return data;
}

async function executeOffline(intentId, args) {
  const argv = ["exec", intentId];
  for (const [k, v] of Object.entries(args || {})) {
    argv.push(`--${k}=${v}`);
  }
  if (process.env.IDF_DB_PATH) argv.push(`--db=${process.env.IDF_DB_PATH}`);
  const { run } = await import("./meta-cli.mjs");
  const buf = [];
  const origLog = console.log;
  console.log = (...a) => buf.push(a.map(String).join(" "));
  try {
    await run(argv);
  } finally {
    console.log = origLog;
  }
  return { mode: "offline", logs: buf };
}

export async function executeIntent(intentId, args) {
  const mode = process.env.IDF_MCP_MODE || "offline";
  if (mode === "online") return executeOnline(intentId, args);
  return executeOffline(intentId, args);
}

export function makeHandlers(intents) {
  return {
    initialize: () => ({
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    }),
    "notifications/initialized": () => null,
    "tools/list": () => ({
      tools: Object.keys(intents)
        .filter((id) => ALLOWED_INTENTS.has(id))
        .sort()
        .map((id) => buildToolDef(id, intents[id])),
    }),
    "tools/call": async ({ name, arguments: args }) => {
      // Все ошибки tool'а возвращаем как { isError: true }, не как JSON-RPC
      // error — это согласуется с MCP spec для tool-execution failures.
      try {
        if (!name || !name.startsWith(TOOL_PREFIX)) {
          throw new Error(`unknown tool: ${name}`);
        }
        const intentId = name.slice(TOOL_PREFIX.length);
        if (!ALLOWED_INTENTS.has(intentId)) {
          throw new Error(`tool not allowed: ${name}`);
        }
        const result = await executeIntent(intentId, args || {});
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: false,
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
          isError: true,
        };
      }
    },
  };
}

export async function dispatch(handlers, msg) {
  const handler = handlers[msg.method];
  if (!handler) {
    return msg.id != null
      ? { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `method not found: ${msg.method}` } }
      : null;
  }
  try {
    const result = await handler(msg.params || {});
    if (msg.id == null || result === null) return null;
    return { jsonrpc: "2.0", id: msg.id, result };
  } catch (e) {
    if (msg.id == null) return null;
    return { jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: e.message } };
  }
}

async function main() {
  const intents = await loadIntents();
  const handlers = makeHandlers(intents);
  stderr.write(`[mcp-meta] ready, ${Object.keys(intents).filter(id => ALLOWED_INTENTS.has(id)).length} tools, mode=${process.env.IDF_MCP_MODE || "offline"}\n`);
  const rl = createInterface({ input: stdin, terminal: false });
  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch (e) {
      stderr.write(`[mcp-meta] parse error: ${e.message}\n`);
      return;
    }
    const response = await dispatch(handlers, msg);
    if (response) stdout.write(JSON.stringify(response) + "\n");
  });
  rl.on("close", () => process.exit(0));
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((e) => {
    stderr.write(`[mcp-meta] fatal: ${e.message}\n`);
    process.exit(1);
  });
}
