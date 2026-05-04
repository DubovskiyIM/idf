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
const { randomBytes } = require("node:crypto");
const { getRefCandidates } = require("./loadCandidatesFromRefs.cjs");

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
 * @param {Object} input — { patternId, summary?, branch? }
 * @returns {Promise<{ok: true, prUrl, branch, log} | {ok: false, error, message, log}>}
 */
async function promoteToSdkPr(input) {
  const log = [];
  const { patternId } = input;

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

  const sdkCandidateDir = path.join(sdkPath, "packages", "core", "src", "patterns", "candidate", archetype);
  const sdkPatternFile = path.join(sdkCandidateDir, `${patternId}.js`);
  if (existsSync(sdkPatternFile)) {
    return {
      ok: false,
      error: "collision",
      message: `файл уже существует: ${sdkPatternFile}`,
      log,
    };
  }
  const curatedJs = path.join(sdkPath, "packages", "core", "src", "patterns", "candidate", "curated.js");
  if (!existsSync(curatedJs)) {
    return { ok: false, error: "curated-js-missing", message: `${curatedJs} not found`, log };
  }

  const branch = input.branch || `feat/curator-promote-${slugify(patternId)}-${shortId()}`;
  const summary = input.summary || `Promote candidate \`${patternId}\` (${archetype}) from idf refs.`;

  try {
    // 1. Sync main, новая ветка
    await gitExec(sdkPath, ["fetch", "origin", "main"], log);
    await gitExec(sdkPath, ["checkout", "main"], log);
    await gitExec(sdkPath, ["reset", "--hard", "origin/main"], log);
    await gitExec(sdkPath, ["checkout", "-b", branch], log);

    // 2. Запись pattern .js файла
    if (!existsSync(sdkCandidateDir)) {
      mkdirSync(sdkCandidateDir, { recursive: true });
      log.push(`mkdir ${sdkCandidateDir}`);
    }
    writeFileSync(sdkPatternFile, renderCandidateModule(pattern), "utf8");
    log.push(`wrote ${sdkPatternFile} (${renderCandidateModule(pattern).length} bytes)`);

    // 3. Patch curated.js
    const patch = patchCuratedJs(curatedJs, archetype, patternId);
    log.push(`patchCuratedJs: ${JSON.stringify(patch)}`);
    if (!patch.changed && patch.reason !== "already-imported") {
      throw new Error(`curated.js patch failed: ${patch.reason}`);
    }

    // 4. .changeset
    const changesetDir = path.join(sdkPath, ".changeset");
    if (!existsSync(changesetDir)) mkdirSync(changesetDir, { recursive: true });
    const changesetFile = path.join(changesetDir, `curator-${slugify(patternId)}-${shortId()}.md`);
    writeFileSync(changesetFile, renderChangeset(pattern, summary), "utf8");
    log.push(`wrote ${changesetFile}`);

    // 5. Commit
    await gitExec(sdkPath, ["add", "-A"], log);
    await gitExec(sdkPath, ["commit", "-m", `feat(patterns): promote ${patternId} (curator workspace)`], log);

    // 6. Push
    await gitExec(sdkPath, ["push", "-u", "origin", branch], log);

    // 7. PR
    const body = [
      "## Summary",
      "",
      summary,
      "",
      "Promoted via Curator workspace from idf `refs/candidates/`.",
      "",
      `- pattern id: \`${patternId}\``,
      `- archetype: \`${archetype}\``,
      pattern.refSource ? `- ref source: \`${pattern.refSource}\`` : "",
      "",
      "Pattern попадает в candidate-bank (matching-only). Promotion в stable + apply — ручной шаг после merge.",
    ]
      .filter(Boolean)
      .join("\n");
    const prRes = await ghExec(
      sdkPath,
      ["pr", "create", "--base", "main", "--title", `feat(patterns): promote ${patternId}`, "--body", body],
      log,
    );
    const prUrl = (prRes.stdout || "").trim().split("\n").pop();
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

module.exports = {
  promoteToSdkPr,
  // Экспорт для тестов
  renderCandidateModule,
  renderChangeset,
  patchCuratedJs,
  slugify,
};
