/**
 * curatorPromoter — server-side имплементация "Promote ref-candidate → SDK PR".
 *
 * Куратор тыкает кнопку → POST /api/patterns/promote-and-pr {patternId} →
 * сервер делает:
 *   1. Read ref-candidate JSON из refs/candidates/<refSource>.
 *   2. Generate JS-файл: idf-sdk/packages/core/src/patterns/candidate/<archetype>/<id>.js
 *      (export default {...JSON}).
 *   3. Append import + entry в curated.js (CURATED_CANDIDATES list).
 *   4. Write .changeset/<slug>.md (patch для @intent-driven/core).
 *   5. git checkout main && git pull && git checkout -b feat/curator-<id>-<ts>.
 *   6. git add / commit / push -u origin <branch>.
 *   7. gh pr create --base main --title "..." --body "...".
 *   8. Return {prUrl, branch, log}.
 *
 * Безопасность:
 *   - process.env.CURATOR_PR_ENABLED=1 — обязателен.
 *   - process.env.IDF_SDK_PATH — путь к idf-sdk worktree.
 *   - gh CLI должен быть авторизован (`gh auth status`).
 *
 * Errors mapping (status / message):
 *   - "disabled"        — CURATOR_PR_ENABLED не выставлен.
 *   - "sdk-path-missing"— IDF_SDK_PATH не задан или не существует.
 *   - "ref-not-found"   — нет refs/candidates/<refSource> или pattern.id не найден.
 *   - "collision"       — файл уже существует в idf-sdk.
 *   - "git-failed"      — git/gh упал; в `log` лежит stderr/stdout последней команды.
 */

const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { readFileSync, existsSync, mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { randomBytes, randomUUID } = require("node:crypto");
const { getRefCandidates } = require("./loadCandidatesFromRefs.cjs");
const db = require("./db.js");

const execFileP = promisify(execFile);

function shortId() {
  return randomBytes(3).toString("hex");
}

function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function escapeJs(value) {
  return JSON.stringify(value, null, 2);
}

/**
 * @param {Object} pattern — ref-candidate JSON (id, archetype, trigger, ...)
 * @returns {string} JS-источник для candidate/<archetype>/<id>.js
 */
function renderCandidateModule(pattern) {
  const safe = { ...pattern };
  delete safe.refSource; // host-only, не нужно в SDK
  const header = `/**
 * ${pattern.id} — promoted from refs/candidates/${pattern.refSource || "?"}
 * via curator workspace at ${new Date().toISOString()}.
 *
 * Plain ref-candidate (auto-generated). Структуру review'ит куратор в PR;
 * после merge в idf-sdk pattern становится частью candidate-bank и
 * matching-only — для apply нужен manual port в stable/.
 */
export default ${escapeJs(safe)};
`;
  return header;
}

/**
 * Вставляет import + добавление в CURATED_CANDIDATES в curated.js.
 *
 * Стратегия: ищет последнюю строку `import ...` в верхней части файла,
 * вставляет новый import после неё; затем находит `const CURATED_CANDIDATES = [`
 * и добавляет имя в массив перед closing bracket. Idempotent: skip если
 * import уже есть.
 *
 * @returns {{changed: boolean, reason?: string}}
 */
function patchCuratedJs(curatedPath, archetype, id) {
  const moduleVar = id.replace(/[^a-zA-Z0-9]/g, "_");
  const importLine = `import ${moduleVar} from "./${archetype}/${id}.js";`;
  let src = readFileSync(curatedPath, "utf8");
  if (src.includes(importLine)) {
    return { changed: false, reason: "already-imported" };
  }
  // 1. Insert import после последней import-строки.
  const importRe = /^import\s+.+;$/gm;
  let lastMatchEnd = -1;
  let m;
  while ((m = importRe.exec(src)) !== null) {
    lastMatchEnd = m.index + m[0].length;
  }
  if (lastMatchEnd === -1) {
    return { changed: false, reason: "no-imports-anchor" };
  }
  src = src.slice(0, lastMatchEnd) + "\n" + importLine + src.slice(lastMatchEnd);

  // 2. Append moduleVar в массив CURATED_CANDIDATES.
  const arrRe = /const\s+CURATED_CANDIDATES\s*=\s*\[/;
  const arrMatch = src.match(arrRe);
  if (!arrMatch) {
    return { changed: false, reason: "no-array-anchor" };
  }
  // Найти соответствующий ] — простейший counter, без вложенных массивов
  // в этом месте curated.js нет.
  const startIdx = arrMatch.index + arrMatch[0].length;
  let depth = 1;
  let endIdx = -1;
  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) {
    return { changed: false, reason: "unbalanced-brackets" };
  }
  const arrayBody = src.slice(startIdx, endIdx).replace(/,\s*$/, "");
  const sep = arrayBody.trim().length > 0 && !arrayBody.trimEnd().endsWith(",") ? "," : "";
  const newBody = `${arrayBody}${sep}\n  ${moduleVar},\n`;
  src = src.slice(0, startIdx) + newBody + src.slice(endIdx);

  writeFileSync(curatedPath, src, "utf8");
  return { changed: true };
}

/**
 * Аналог patchCuratedJs для anti/index.js (ANTI_PATTERNS array). Та же
 * стратегия: import после последней import-line + push в массив.
 */
function patchAntiIndex(antiIndexPath, archetype, id) {
  const moduleVar = id.replace(/[^a-zA-Z0-9]/g, "_");
  const importLine = `import ${moduleVar} from "./${archetype}/${id}.js";`;
  let src = readFileSync(antiIndexPath, "utf8");
  if (src.includes(importLine)) return { changed: false, reason: "already-imported" };

  // Insert import — если import'ов нет (scaffold), вставляем перед export.
  const importRe = /^import\s+.+;$/gm;
  let lastMatchEnd = -1;
  let m;
  while ((m = importRe.exec(src)) !== null) lastMatchEnd = m.index + m[0].length;
  if (lastMatchEnd === -1) {
    // anti/index.js scaffold не имеет imports — вставляем перед `export const ANTI_PATTERNS`
    const exportIdx = src.indexOf("export const ANTI_PATTERNS");
    if (exportIdx === -1) return { changed: false, reason: "no-anchor" };
    src = src.slice(0, exportIdx) + importLine + "\n\n" + src.slice(exportIdx);
  } else {
    src = src.slice(0, lastMatchEnd) + "\n" + importLine + src.slice(lastMatchEnd);
  }

  const arrRe = /export\s+const\s+ANTI_PATTERNS\s*=\s*\[/;
  const arrMatch = src.match(arrRe);
  if (!arrMatch) return { changed: false, reason: "no-array-anchor" };
  const startIdx = arrMatch.index + arrMatch[0].length;
  let depth = 1;
  let endIdx = -1;
  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) { endIdx = i; break; }
    }
  }
  if (endIdx === -1) return { changed: false, reason: "unbalanced-brackets" };
  const arrayBody = src.slice(startIdx, endIdx).replace(/,\s*$/, "");
  const sep = arrayBody.trim().length > 0 && !arrayBody.trimEnd().endsWith(",") ? "," : "";
  src = src.slice(0, startIdx) + `${arrayBody}${sep}\n  ${moduleVar},\n` + src.slice(endIdx);
  writeFileSync(antiIndexPath, src, "utf8");
  return { changed: true };
}

function renderChangeset(pattern, summary) {
  const head = `---\n"@intent-driven/core": patch\n---\n\n`;
  const body = (summary || `Promote candidate \`${pattern.id}\` from idf refs into curated bank.`).trim();
  return head + body + "\n";
}

async function gitExec(cwd, args, log) {
  log.push(`$ git ${args.join(" ")}  (cwd=${cwd})`);
  try {
    const { stdout, stderr } = await execFileP("git", args, { cwd, maxBuffer: 4 * 1024 * 1024 });
    if (stdout) log.push(stdout.trim());
    if (stderr) log.push(stderr.trim());
    return { stdout, stderr };
  } catch (e) {
    log.push(`error: ${e.message}`);
    if (e.stdout) log.push(e.stdout);
    if (e.stderr) log.push(e.stderr);
    throw e;
  }
}

async function ghExec(cwd, args, log) {
  log.push(`$ gh ${args.join(" ")}  (cwd=${cwd})`);
  try {
    const { stdout, stderr } = await execFileP("gh", args, { cwd, maxBuffer: 4 * 1024 * 1024 });
    if (stdout) log.push(stdout.trim());
    if (stderr) log.push(stderr.trim());
    return { stdout, stderr };
  } catch (e) {
    log.push(`error: ${e.message}`);
    if (e.stdout) log.push(e.stdout);
    if (e.stderr) log.push(e.stderr);
    throw e;
  }
}

/**
 * Гарантирует существование anti/index.js в idf-sdk; создаёт минимальный
 * scaffold если нет. Это позволяет первый anti-promote быть self-contained
 * (не нужен manual SDK-PR с инфраструктурой). registry автоматически
 * обнаруживает паттерны через index.js export ANTI_PATTERNS массивом.
 */
function ensureAntiIndex(antiRoot) {
  const indexJs = path.join(antiRoot, "index.js");
  if (existsSync(indexJs)) return { existed: true, path: indexJs };
  if (!existsSync(antiRoot)) mkdirSync(antiRoot, { recursive: true });
  const scaffold = `/**
 * Anti-pattern bank. Паттерны из реальных продуктов, которые куратор
 * явно пометил «так не делать» — чтобы Signal Classifier давал negative
 * score, а не игнорировал. Файлы добавляются через Curator workspace
 * (POST /api/patterns/promote-and-pr с kind="anti").
 *
 * Формат: \`export default { id, status: "anti", archetype, trigger,
 * structure, rationale (включая counterexample), falsification }\`.
 */
export const ANTI_PATTERNS = [];

export function getAntiPatterns() {
  return ANTI_PATTERNS.slice();
}
`;
  writeFileSync(indexJs, scaffold, "utf8");
  return { existed: false, path: indexJs };
}

/**
 * @param {Object} input — { patternId, summary?, branch?, kind? }
 *   kind: "stable" (default) → candidate/curated.js bank
 *         "anti"             → anti/<archetype>/<id>.js bank
 * @returns {Promise<{ok: true, prUrl, branch, log} | {ok: false, error, message, log}>}
 */
async function promoteToSdkPr(input) {
  const log = [];
  const { patternId } = input;
  const kind = input.kind === "anti" ? "anti" : "stable";

  if (process.env.CURATOR_PR_ENABLED !== "1") {
    return { ok: false, error: "disabled", message: "CURATOR_PR_ENABLED=1 не выставлен", log };
  }
  const sdkPath = process.env.IDF_SDK_PATH;
  if (!sdkPath || !existsSync(sdkPath)) {
    return {
      ok: false,
      error: "sdk-path-missing",
      message: `IDF_SDK_PATH не задан или не существует: ${sdkPath || "(empty)"}`,
      log,
    };
  }

  const pattern = getRefCandidates().find((p) => p.id === patternId);
  if (!pattern) {
    return { ok: false, error: "ref-not-found", message: `pattern '${patternId}' not in refs/candidates`, log };
  }
  // archetype приоритет: явный override из request body > pattern.archetype.
  // Если ни там ни там — error: куратор должен явно выбрать (UI показывает select).
  const archetype = input.archetype || pattern.archetype;
  const VALID_ARCHETYPES = ["catalog", "detail", "feed", "cross"];
  if (!archetype) {
    return {
      ok: false,
      error: "archetype-missing",
      message: "pattern.archetype не задан и не передан в request — выбери archetype в UI",
      log,
    };
  }
  if (!VALID_ARCHETYPES.includes(archetype)) {
    return {
      ok: false,
      error: "unsupported-archetype",
      message: `archetype '${archetype}' не поддерживается (допустимы: ${VALID_ARCHETYPES.join(", ")})`,
      log,
    };
  }

  // Bank-paths per kind.
  const bankRoot = kind === "anti"
    ? path.join(sdkPath, "packages", "core", "src", "patterns", "anti")
    : path.join(sdkPath, "packages", "core", "src", "patterns", "candidate");
  const sdkCandidateDir = path.join(bankRoot, archetype);
  const sdkPatternFile = path.join(sdkCandidateDir, `${patternId}.js`);
  if (existsSync(sdkPatternFile)) {
    return {
      ok: false,
      error: "collision",
      message: `файл уже существует: ${sdkPatternFile}`,
      log,
    };
  }
  // Stable: patch curated.js (он обязан быть). Anti: patch anti/index.js
  // (создадим scaffold если первый раз).
  const indexJs = kind === "anti"
    ? path.join(bankRoot, "index.js")
    : path.join(bankRoot, "curated.js");
  if (kind === "stable" && !existsSync(indexJs)) {
    return { ok: false, error: "curated-js-missing", message: `${indexJs} not found`, log };
  }

  const branchPrefix = kind === "anti" ? "feat/curator-anti" : "feat/curator-promote";
  const branch = input.branch || `${branchPrefix}-${slugify(patternId)}-${shortId()}`;
  const summary = input.summary || `Promote candidate \`${patternId}\` (${archetype}) from idf refs.`;

  try {
    // 1. Sync main, новая ветка
    await gitExec(sdkPath, ["fetch", "origin", "main"], log);
    await gitExec(sdkPath, ["checkout", "main"], log);
    await gitExec(sdkPath, ["reset", "--hard", "origin/main"], log);
    await gitExec(sdkPath, ["checkout", "-b", branch], log);

    // 2. Запись pattern .js файла. Anti: status=anti override.
    if (!existsSync(sdkCandidateDir)) {
      mkdirSync(sdkCandidateDir, { recursive: true });
      log.push(`mkdir ${sdkCandidateDir}`);
    }
    const patternForBank = kind === "anti"
      ? { ...pattern, status: "anti" }
      : pattern;
    writeFileSync(sdkPatternFile, renderCandidateModule(patternForBank), "utf8");
    log.push(`wrote ${sdkPatternFile} (kind=${kind})`);

    // 3. Patch index.js (curated.js для stable, anti/index.js для anti).
    if (kind === "anti") {
      const ensured = ensureAntiIndex(bankRoot);
      log.push(`ensureAntiIndex: ${JSON.stringify(ensured)}`);
      const patch = patchAntiIndex(indexJs, archetype, patternId);
      log.push(`patchAntiIndex: ${JSON.stringify(patch)}`);
      if (!patch.changed && patch.reason !== "already-imported") {
        throw new Error(`anti/index.js patch failed: ${patch.reason}`);
      }
    } else {
      const patch = patchCuratedJs(indexJs, archetype, patternId);
      log.push(`patchCuratedJs: ${JSON.stringify(patch)}`);
      if (!patch.changed && patch.reason !== "already-imported") {
        throw new Error(`curated.js patch failed: ${patch.reason}`);
      }
    }

    // 4. .changeset
    const changesetDir = path.join(sdkPath, ".changeset");
    if (!existsSync(changesetDir)) mkdirSync(changesetDir, { recursive: true });
    const changesetFile = path.join(changesetDir, `curator-${slugify(patternId)}-${shortId()}.md`);
    writeFileSync(changesetFile, renderChangeset(pattern, summary), "utf8");
    log.push(`wrote ${changesetFile}`);

    // 5. Commit + PR title — kind-specific семантика.
    const verb = kind === "anti" ? "mark-anti" : "promote";
    const commitMsg = `feat(patterns): ${verb} ${patternId} (curator workspace)`;
    await gitExec(sdkPath, ["add", "-A"], log);
    await gitExec(sdkPath, ["commit", "-m", commitMsg], log);

    // 6. Push
    await gitExec(sdkPath, ["push", "-u", "origin", branch], log);

    // 7. PR
    const bankNote = kind === "anti"
      ? "Pattern попадает в **anti-bank** — Signal Classifier даст negative score, паттерн помечен как 'так не делать'. Counterexample-evidence в rationale объясняет почему."
      : "Pattern попадает в candidate-bank (matching-only). Promotion в stable + apply — ручной шаг после merge.";
    const body = [
      "## Summary",
      "",
      summary,
      "",
      `Promoted via Curator workspace from idf \`refs/candidates/\` (kind=**${kind}**).`,
      "",
      `- pattern id: \`${patternId}\``,
      `- archetype: \`${archetype}\``,
      `- bank: \`${kind}\``,
      pattern.refSource ? `- ref source: \`${pattern.refSource}\`` : "",
      "",
      bankNote,
    ]
      .filter(Boolean)
      .join("\n");
    const prTitle = `feat(patterns): ${verb} ${patternId}`;
    const prRes = await ghExec(
      sdkPath,
      ["pr", "create", "--base", "main", "--title", prTitle, "--body", body],
      log,
    );
    const prUrl = (prRes.stdout || "").trim().split("\n").pop();

    // 8. Запись PatternPromotion в Φ → lifecycle chip и Inbox обновятся.
    // Создаём один effect с status=shipped + sdkPrUrl: после reload UI
    // увидит persisted state (PR URL, ветка, archetype) и не покажет
    // "сделай PR" второй раз. Если запись провалилась — это не критично,
    // PR уже создан; логируем warning и возвращаем ok.
    try {
      const promotionId = randomUUID();
      const now = Date.now();
      const ctx = {
        id: promotionId,
        candidateId: patternId,
        targetArchetype: archetype,
        targetBank: kind, // "stable" | "anti"
        rationale: summary,
        status: "shipped",
        sdkPrUrl: prUrl,
        sdkBranch: branch,
        weight: 50,
        requestedByUserId: "patternCurator",
        requestedAt: now,
        decidedAt: now,
      };
      db.prepare(`
        INSERT INTO effects (id, intent_id, alpha, target, value, scope, status,
                             ttl, context, created_at, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
      `).run(
        randomUUID(),
        "ship_pattern_promotion",
        "create",
        "PatternPromotion",
        JSON.stringify(ctx),
        "account",
        "confirmed",
        JSON.stringify(ctx),
        now,
        now,
      );
      log.push(`recorded PatternPromotion(${promotionId}) status=shipped sdkPrUrl=${prUrl}`);
    } catch (e) {
      log.push(`warning: PatternPromotion record failed: ${e.message}`);
    }

    return { ok: true, prUrl, branch, log };
  } catch (e) {
    return {
      ok: false,
      error: "git-failed",
      message: e.message,
      log,
    };
  }
}

/**
 * Bulk-вариант: куратор select'ит N паттернов в Heatmap, server делает
 * **один PR** с N file-writes + N entries в curated/anti index + один
 * changeset. Это лучше чем N отдельных PR'ов: меньше нагрузка на CI,
 * проще review (один diff), atomic — либо все promoted, либо rollback.
 *
 * Per-pattern архетип берётся из самого pattern.archetype, либо из
 * input.archetypeOverrides[id], либо input.archetype (fallback). Если
 * для какого-то pattern archetype не определён — он skip'ается с
 * error в perPattern, остальные продолжают.
 *
 * @param {Object} input — {
 *   patternIds: string[],
 *   archetype?: string,                       — fallback для всех
 *   archetypeOverrides?: { [patternId]: string },
 *   kind?: "stable" | "anti",
 *   summary?: string,
 *   branch?: string,
 * }
 * @returns {Promise<{ok: true, prUrl, branch, log, perPattern: Array<{id, ok, archetype?, error?}>}
 *   | {ok: false, error, message, log, perPattern}>}
 */
async function promoteBatchToSdkPr(input) {
  const log = [];
  const perPattern = [];
  const ids = Array.isArray(input.patternIds) ? input.patternIds : [];
  if (ids.length === 0) {
    return { ok: false, error: "empty-batch", message: "patternIds пуст", log, perPattern };
  }
  const kind = input.kind === "anti" ? "anti" : "stable";

  if (process.env.CURATOR_PR_ENABLED !== "1") {
    return { ok: false, error: "disabled", message: "CURATOR_PR_ENABLED=1 не выставлен", log, perPattern };
  }
  const sdkPath = process.env.IDF_SDK_PATH;
  if (!sdkPath || !existsSync(sdkPath)) {
    return {
      ok: false,
      error: "sdk-path-missing",
      message: `IDF_SDK_PATH не задан или не существует: ${sdkPath || "(empty)"}`,
      log, perPattern,
    };
  }

  const VALID_ARCHETYPES = ["catalog", "detail", "feed", "cross"];
  const refs = getRefCandidates();
  const overrides = input.archetypeOverrides || {};
  // Resolved patterns с архетипом + skip для невалидных
  const planned = [];
  for (const id of ids) {
    const pattern = refs.find((p) => p.id === id);
    if (!pattern) {
      perPattern.push({ id, ok: false, error: "ref-not-found" });
      continue;
    }
    const archetype = overrides[id] || pattern.archetype || input.archetype;
    if (!archetype || !VALID_ARCHETYPES.includes(archetype)) {
      perPattern.push({ id, ok: false, error: "archetype-missing-or-invalid", archetype });
      continue;
    }
    planned.push({ id, pattern, archetype });
  }
  if (planned.length === 0) {
    return {
      ok: false,
      error: "nothing-to-do",
      message: "Все patterns отсеяны валидацией (см. perPattern)",
      log, perPattern,
    };
  }

  const bankRoot = kind === "anti"
    ? path.join(sdkPath, "packages", "core", "src", "patterns", "anti")
    : path.join(sdkPath, "packages", "core", "src", "patterns", "candidate");
  const indexJs = kind === "anti"
    ? path.join(bankRoot, "index.js")
    : path.join(bankRoot, "curated.js");
  if (kind === "stable" && !existsSync(indexJs)) {
    return { ok: false, error: "curated-js-missing", message: `${indexJs} not found`, log, perPattern };
  }

  const branchPrefix = kind === "anti" ? "feat/curator-anti-batch" : "feat/curator-promote-batch";
  const branch = input.branch || `${branchPrefix}-${shortId()}`;
  const summary = input.summary || `Bulk ${kind === "anti" ? "mark-anti" : "promote"}: ${planned.length} patterns from idf refs.`;

  try {
    await gitExec(sdkPath, ["fetch", "origin", "main"], log);
    await gitExec(sdkPath, ["checkout", "main"], log);
    await gitExec(sdkPath, ["reset", "--hard", "origin/main"], log);
    await gitExec(sdkPath, ["checkout", "-b", branch], log);

    if (kind === "anti") {
      const ensured = ensureAntiIndex(bankRoot);
      log.push(`ensureAntiIndex: ${JSON.stringify(ensured)}`);
    }

    for (const item of planned) {
      const { id, pattern, archetype } = item;
      const dir = path.join(bankRoot, archetype);
      const file = path.join(dir, `${id}.js`);
      if (existsSync(file)) {
        perPattern.push({ id, ok: false, error: "collision", archetype });
        continue;
      }
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const patternForBank = kind === "anti" ? { ...pattern, status: "anti" } : pattern;
      writeFileSync(file, renderCandidateModule(patternForBank), "utf8");
      const patch = kind === "anti"
        ? patchAntiIndex(indexJs, archetype, id)
        : patchCuratedJs(indexJs, archetype, id);
      if (!patch.changed && patch.reason !== "already-imported") {
        perPattern.push({ id, ok: false, error: `index-patch-failed: ${patch.reason}`, archetype });
        continue;
      }
      perPattern.push({ id, ok: true, archetype });
      log.push(`+ ${id} (${archetype})`);
    }
    const successIds = perPattern.filter((p) => p.ok).map((p) => p.id);
    if (successIds.length === 0) {
      // Откатить ветку, не делать пустой PR
      await gitExec(sdkPath, ["checkout", "main"], log);
      await gitExec(sdkPath, ["branch", "-D", branch], log);
      return { ok: false, error: "all-skipped", message: "Все паттерны отсеялись (collision/invalid).", log, perPattern };
    }

    // Один changeset на всю партию
    const changesetDir = path.join(sdkPath, ".changeset");
    if (!existsSync(changesetDir)) mkdirSync(changesetDir, { recursive: true });
    const changesetFile = path.join(changesetDir, `curator-batch-${shortId()}.md`);
    const cs = `---\n"@intent-driven/core": patch\n---\n\n${summary}\n\nPatterns: ${successIds.map((s) => `\`${s}\``).join(", ")}\n`;
    writeFileSync(changesetFile, cs, "utf8");
    log.push(`wrote ${changesetFile}`);

    const verb = kind === "anti" ? "mark-anti batch" : "promote batch";
    const commitMsg = `feat(patterns): ${verb} (${successIds.length} patterns, curator workspace)`;
    await gitExec(sdkPath, ["add", "-A"], log);
    await gitExec(sdkPath, ["commit", "-m", commitMsg], log);
    await gitExec(sdkPath, ["push", "-u", "origin", branch], log);

    const bankNote = kind === "anti"
      ? "Patterns попадают в **anti-bank** — Signal Classifier даст negative score."
      : "Patterns попадают в **candidate-bank** (matching-only). Promotion в stable + apply — ручной шаг.";
    const body = [
      "## Bulk Curator Promotion",
      "",
      summary,
      "",
      `Bank: \`${kind}\` · ${successIds.length} patterns`,
      "",
      "### Patterns",
      ...successIds.map((id) => `- \`${id}\``),
      "",
      bankNote,
    ].join("\n");
    const prTitle = `feat(patterns): ${verb} (${successIds.length} from curator)`;
    const prRes = await ghExec(
      sdkPath,
      ["pr", "create", "--base", "main", "--title", prTitle, "--body", body],
      log,
    );
    const prUrl = (prRes.stdout || "").trim().split("\n").pop();

    // Запись N PatternPromotion'ов в Φ — каждый pattern получает свою запись.
    try {
      const now = Date.now();
      const stmt = db.prepare(`
        INSERT INTO effects (id, intent_id, alpha, target, value, scope, status,
                             ttl, context, created_at, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
      `);
      for (const item of perPattern.filter((p) => p.ok)) {
        const promotionId = randomUUID();
        const ctx = {
          id: promotionId,
          candidateId: item.id,
          targetArchetype: item.archetype,
          targetBank: kind,
          rationale: summary,
          status: "shipped",
          sdkPrUrl: prUrl,
          sdkBranch: branch,
          weight: 50,
          requestedByUserId: "patternCurator",
          requestedAt: now,
          decidedAt: now,
        };
        stmt.run(
          randomUUID(), "ship_pattern_promotion", "create", "PatternPromotion",
          JSON.stringify(ctx), "account", "confirmed", JSON.stringify(ctx), now, now,
        );
      }
      log.push(`recorded ${successIds.length} PatternPromotion(s)`);
    } catch (e) {
      log.push(`warning: PatternPromotion bulk record failed: ${e.message}`);
    }

    return { ok: true, prUrl, branch, log, perPattern };
  } catch (e) {
    return {
      ok: false,
      error: "git-failed",
      message: e.message,
      log,
      perPattern,
    };
  }
}

module.exports = {
  promoteToSdkPr,
  promoteBatchToSdkPr,
  // Экспорт для тестов
  renderCandidateModule,
  renderChangeset,
  patchCuratedJs,
  patchAntiIndex,
  slugify,
};
