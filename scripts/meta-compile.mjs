#!/usr/bin/env node
/**
 * meta-compile — soft-authoring compiler для meta-домена (§13.0 решение «б»).
 *
 * НЕ READER формата (4 reader'а §1 манифеста timeless), а **writer-of-source**:
 * читает мета-Φ через server's foldWorld, эмиттит idempotent patch'и в .md/.json/.cjs
 * между стабильными маркерами `<!-- meta-compile: <id> -->`.
 *
 * Compile target'ы:
 *   - `docs/sdk-improvements-backlog.md` блок `backlog-inbox` ← BacklogItem'ы
 *
 * Runtime:
 *   - Без сервера: `node scripts/meta-compile.mjs --offline` читает Φ
 *     прямо из server/idf.db через better-sqlite3 + foldWorld stub.
 *   - С сервером: `node scripts/meta-compile.mjs` GET /api/effects → fold локально.
 *
 * Idempotency: если содержимое между маркерами совпадает — файл не трогается.
 * Безопасно перезапускать: каждый compile вычисляет полный snapshot из Φ.
 *
 * После compile эмиттит `α:replace` на BacklogItem.compiledAt — это даёт
 * trail когда patch применился. Без сервера эта запись пропускается.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const MARKER_OPEN = "<!-- meta-compile: backlog-inbox -->";
const MARKER_CLOSE = "<!-- /meta-compile -->";
const TARGET_FILE = join(REPO_ROOT, "docs", "sdk-improvements-backlog.md");

const SERVER_URL = process.env.IDF_SERVER || "http://localhost:3001";
const OFFLINE = process.argv.includes("--offline");
const DRY_RUN = process.argv.includes("--dry-run");

// ─────────────────────────────────────────────────────────────────
// Φ readers
// ─────────────────────────────────────────────────────────────────

async function readPhiOnline() {
  const r = await fetch(`${SERVER_URL}/api/effects`);
  if (!r.ok) throw new Error(`server returned ${r.status}`);
  const effects = await r.json();
  return effects.filter((e) => e.status === "confirmed");
}

async function readPhiOffline() {
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(join(REPO_ROOT, "server", "idf.db"), { readonly: true });
  const rows = db
    .prepare("SELECT * FROM effects WHERE status = 'confirmed' ORDER BY created_at ASC")
    .all();
  db.close();
  return rows;
}

/**
 * Минимальный fold для меты: проигрывает effects на target=`backlogItems`,
 * учитывает create / replace на field-path / remove. Идемпотентно.
 */
function foldBacklogItems(effects) {
  const items = {};
  for (const ef of effects) {
    if (!ef.target?.startsWith("backlogItems") && !ef.target?.startsWith("BacklogItem")) {
      continue;
    }
    const ctx = typeof ef.context === "string" ? JSON.parse(ef.context) : ef.context;
    const id = ctx?.id || ef.id;
    const isFieldUpdate = ef.target.includes(".");
    const fieldName = isFieldUpdate ? ef.target.split(".")[1] : null;

    switch (ef.alpha) {
      case "add":
      case "create":
        items[id] = { ...(items[id] || {}), ...ctx };
        break;
      case "replace":
        if (isFieldUpdate && items[id]) {
          items[id] = { ...items[id], ...ctx };
        } else if (items[id]) {
          items[id] = { ...items[id], ...ctx };
        }
        break;
      case "remove":
        delete items[id];
        break;
    }
  }
  return Object.values(items);
}

// ─────────────────────────────────────────────────────────────────
// Renderer
// ─────────────────────────────────────────────────────────────────

const SECTION_LABELS = {
  P0: "P0 (блокеры)",
  P1: "P1 (важно)",
  P2: "P2 (nice-to-have)",
  research: "Research",
  deferred: "Deferred",
};

const STATUS_BADGE = {
  open: "🟢 open",
  scheduled: "🟡 scheduled",
  closed: "✅ closed",
  rejected: "⛔ rejected",
};

function renderBacklogItems(items) {
  if (items.length === 0) {
    return ["", "_Backlog пуст. Добавь через intent `add_backlog_item` в /meta._", ""].join("\n");
  }

  // Группа по section, сорт по createdAt desc
  const grouped = {};
  for (const it of items) {
    const sec = it.section || "deferred";
    if (!grouped[sec]) grouped[sec] = [];
    grouped[sec].push(it);
  }
  for (const sec of Object.keys(grouped)) {
    grouped[sec].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  const lines = [""];
  const sectionOrder = ["P0", "P1", "P2", "research", "deferred"];
  for (const sec of sectionOrder) {
    const list = grouped[sec];
    if (!list || list.length === 0) continue;
    lines.push(`### ${SECTION_LABELS[sec] || sec}`);
    lines.push("");
    for (const it of list) {
      const badge = STATUS_BADGE[it.status] || it.status;
      const ref = it.sourceLink ? ` ([ref](${it.sourceLink}))` : "";
      const dom = it.affectedDomain ? ` · домен \`${it.affectedDomain}\`` : "";
      const dt = it.createdAt
        ? new Date(it.createdAt).toISOString().slice(0, 10)
        : "—";
      lines.push(`- ${badge} **${escapeMarkdown(it.title)}**${ref}${dom} · ${dt}`);
      if (it.description) {
        lines.push(`  ${escapeMarkdown(it.description)}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function escapeMarkdown(s) {
  if (!s) return "";
  return String(s).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

// ─────────────────────────────────────────────────────────────────
// Patcher
// ─────────────────────────────────────────────────────────────────

async function applyPatch(filePath, openMarker, closeMarker, newBlock) {
  const src = await readFile(filePath, "utf8");
  const openIdx = src.indexOf(openMarker);
  const closeIdx = src.indexOf(closeMarker);
  if (openIdx === -1 || closeIdx === -1 || closeIdx < openIdx) {
    throw new Error(`markers not found in ${filePath}: ${openMarker}…${closeMarker}`);
  }
  const before = src.slice(0, openIdx + openMarker.length);
  const after = src.slice(closeIdx);
  const next = `${before}\n${newBlock}\n${after}`;
  if (next === src) {
    return { changed: false, bytesBefore: src.length, bytesAfter: src.length };
  }
  if (DRY_RUN) {
    return { changed: true, dryRun: true, bytesBefore: src.length, bytesAfter: next.length };
  }
  await writeFile(filePath, next, "utf8");
  return { changed: true, bytesBefore: src.length, bytesAfter: next.length };
}

// ─────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(TARGET_FILE)) {
    throw new Error(`target file missing: ${TARGET_FILE}`);
  }

  let effects;
  try {
    effects = OFFLINE ? await readPhiOffline() : await readPhiOnline();
  } catch (err) {
    if (!OFFLINE) {
      console.warn(`server unreachable (${err.message}), falling back to --offline`);
      effects = await readPhiOffline();
    } else {
      throw err;
    }
  }

  const items = foldBacklogItems(effects);
  const block = renderBacklogItems(items);

  const result = await applyPatch(TARGET_FILE, MARKER_OPEN, MARKER_CLOSE, block);

  if (!result.changed) {
    console.log(`meta-compile: backlog-inbox unchanged (${items.length} items, ${result.bytesBefore} bytes)`);
    return;
  }
  const verb = result.dryRun ? "would patch" : "patched";
  console.log(
    `meta-compile: ${verb} backlog-inbox (${items.length} items, ` +
    `${result.bytesBefore} → ${result.bytesAfter} bytes)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
