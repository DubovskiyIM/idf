#!/usr/bin/env node
/**
 * demo-env.mjs — one-command setup для 30-мин PM live-demo.
 *
 * Создаёт ./.demo/ (или --out dir) с:
 *   - accounts.json — owner/agent/observer с JWT (подписан JWT_SECRET из окружения)
 *   - world.json    — пустой Φ skeleton для seeding
 *   - mcp-config.json — готовый блок для Claude Desktop config (~/Library/Application Support/Claude/)
 *
 * Usage:
 *   node scripts/demo-env.mjs [--fresh] [--out PATH] [--domain DOMAIN] [--server URL]
 *
 *   --fresh           Очистить директорию перед setup
 *   --out PATH        Директория для файлов (default: ./.demo)
 *   --domain DOMAIN   Pre-fix domain в mcp-config (default: client-onboarding)
 *   --server URL      IDF API URL в mcp-config (default: http://localhost:3001)
 *
 * Environment:
 *   JWT_SECRET — если не задан, берём idf-messenger-secret-dev (совместим с server/auth.js)
 *
 * Экранный вывод — credentials и next-step инструкции. Все диагностические
 * сообщения на stderr, ключевые данные на stdout — для shell substitution.
 */

import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fresh") out.fresh = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const key = eq > -1 ? a.slice(2, eq) : a.slice(2);
      const val = eq > -1 ? a.slice(eq + 1) : (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true);
      out[key] = val;
    }
  }
  return out;
}

function makeAccount(role, { jwtSecret }) {
  const id = `demo_${role}_${crypto.randomBytes(4).toString("hex")}`;
  const email = `${role}@demo.local`;
  const token = jwt.sign({ userId: id, email }, jwtSecret, { expiresIn: "7d" });
  return { id, email, role, name: `demo-${role}`, token };
}

function printHelp() {
  process.stderr.write(`
demo-env.mjs — one-command setup для 30-мин PM live-demo.

Usage:
  node scripts/demo-env.mjs [--fresh] [--out PATH] [--domain DOMAIN] [--server URL]

Options:
  --fresh           Очистить директорию перед setup
  --out PATH        Директория для файлов (default: ./.demo)
  --domain DOMAIN   Pre-fix domain в mcp-config (default: client-onboarding)
  --server URL      IDF API URL (default: http://localhost:3001)
  --help            Эта справка

Environment:
  JWT_SECRET        Секрет для подписи токенов. Должен совпадать с server.
                    Default: idf-messenger-secret-dev (= server/auth.js default).
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return 0; }

  const outDir = path.resolve(String(args.out || "./.demo"));
  const domain = String(args.domain || "client-onboarding");
  const server = String(args.server || "http://localhost:3001");
  const jwtSecret = process.env.JWT_SECRET || "idf-messenger-secret-dev";

  if (args.fresh && existsSync(outDir)) {
    rmSync(outDir, { recursive: true });
    process.stderr.write(`[demo-env] --fresh: очищено ${outDir}\n`);
  }
  mkdirSync(outDir, { recursive: true });

  const accounts = {
    owner: makeAccount("owner", { jwtSecret }),
    agent: makeAccount("agent", { jwtSecret }),
    observer: makeAccount("observer", { jwtSecret }),
  };
  writeFileSync(path.join(outDir, "accounts.json"), JSON.stringify(accounts, null, 2));

  const world = {
    effects: [],
    meta: {
      seeded_at: new Date().toISOString(),
      note: "Пустой Φ skeleton. Заполняется через Studio authoring + commit flow.",
    },
  };
  writeFileSync(path.join(outDir, "world.json"), JSON.stringify(world, null, 2));

  const mcpConfig = {
    mcpServers: {
      [`idf-${domain}`]: {
        command: "npx",
        args: ["@intent-driven/mcp-server"],
        env: {
          IDF_SERVER: server,
          IDF_DOMAIN: domain,
          IDF_TOKEN: accounts.agent.token,
          IDF_AGENT_EMAIL: accounts.agent.email,
        },
      },
    },
  };
  writeFileSync(path.join(outDir, "mcp-config.json"), JSON.stringify(mcpConfig, null, 2));

  // Human-facing вывод в stdout
  process.stdout.write(`
IDF demo environment готов.

Каталог:      ${outDir}
IDF сервер:   ${server}
Domain:       ${domain}

Следующие шаги:
  1. npm run server        # :3001 Express
  2. npm run dev           # :5173 Vite + Studio
  3. Claude Desktop → Settings → Developer → Edit Config
     скопировать содержимое ${path.join(outDir, "mcp-config.json")}
     в ~/Library/Application Support/Claude/claude_desktop_config.json

Credentials (для curl):
  owner:    Bearer ${accounts.owner.token.slice(0, 32)}...
  agent:    Bearer ${accounts.agent.token.slice(0, 32)}...
  observer: Bearer ${accounts.observer.token.slice(0, 32)}...

Полные токены в ${path.join(outDir, "accounts.json")}
`);

  return 0;
}

process.exit(main());
