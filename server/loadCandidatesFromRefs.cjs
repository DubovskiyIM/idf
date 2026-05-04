/**
 * Загружает candidate-паттерны из refs/candidates/*.json в side-channel
 * (не в SDK registry). Эти JSON-файлы выкатывает pattern-researcher.mjs
 * (gravitino / datahub / hubspot и др. полевые анализы); раньше они были
 * видны только через ручной grep, теперь попадают в /api/patterns/catalog
 * и в Pattern Curator workspace для триажа.
 *
 * Почему side-channel, не registry.registerPattern:
 * SDK registry строго валидирует trigger.kind против whitelist (intent-
 * creates, entity-field, sub-entity-exists, …). Pattern researcher
 * выкатывает новые kind'ы из реальных продуктов ("mirror", "polymorphic",
 * "timeslot-like", "session", "reference", "polymorphic-context", …) —
 * registerPattern их отвергает, и куратор не видел бы 274 из 399.
 * Side-channel позволяет показать их «как есть» для триажа: куратор сам
 * решает, добавить ли новый kind в SDK или отклонить паттерн.
 *
 * /api/patterns/catalog мержит candidate'ы из side-channel с тем что в
 * registry. /falsification и /explain пока не работают для refs-кандидатов
 * (нет trigger.match-функции, registry их не знает) — это ожидаемо для
 * stage'а триажа.
 */

const { readdirSync, readFileSync } = require("node:fs");
const path = require("node:path");

const REFS_DIR = path.join(__dirname, "..", "refs", "candidates");

let _loaded = false;
let _candidates = [];

function listCandidateFiles() {
  try {
    return readdirSync(REFS_DIR).filter((f) => f.endsWith(".json")).sort();
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

function readPatternFile(file) {
  const full = path.join(REFS_DIR, file);
  try {
    const raw = readFileSync(full, "utf8");
    const pattern = JSON.parse(raw);
    if (!pattern.id) {
      // analyze-*.json и подобные manifest-файлы pattern-researcher без id
      // — не паттерны, а технические записи. Молча skip.
      return null;
    }
    if (!pattern.status) pattern.status = "candidate";
    pattern.refSource = file;
    return pattern;
  } catch (e) {
    console.warn(`[loadCandidates] ${file}: parse error ${e.message}`);
    return null;
  }
}

/**
 * Загружает refs/candidates/*.json в side-channel массив.
 * Idempotent: повторные вызовы возвращают cached результат.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.force] — перезагрузить даже если уже было.
 * @returns {{ loaded: number, total: number, cached?: boolean }}
 */
function loadCandidatesFromRefs(opts = {}) {
  if (_loaded && !opts.force) {
    return { loaded: _candidates.length, total: _candidates.length, cached: true };
  }
  const files = listCandidateFiles();
  const out = [];
  for (const file of files) {
    const pattern = readPatternFile(file);
    if (!pattern) continue;
    out.push(pattern);
  }
  _candidates = out;
  _loaded = true;
  return { loaded: out.length, total: files.length };
}

/**
 * @returns {Array} текущие side-channel candidates (после loadCandidatesFromRefs).
 */
function getRefCandidates() {
  return _candidates;
}

function resetLoadedFlag() {
  _loaded = false;
  _candidates = [];
}

/**
 * Минимальная сериализация ref-кандидата для /catalog UI.
 * Дублирует ключевые поля что и serializePattern в server/routes/patterns.js,
 * но без trigger.match.toString() / structure.apply.toString() (этих
 * функций у refs-кандидатов нет — они plain JSON).
 */
function serializeRefCandidate(p) {
  return {
    id: p.id,
    version: p.version || 1,
    status: p.status || "candidate",
    archetype: p.archetype || null,
    axis: p.axis || null,
    archetypeScope: p.archetypeScope || null,
    trigger: p.trigger || null,
    structure: p.structure || null,
    rationale: p.rationale || null,
    falsification: p.falsification || null,
    refSource: p.refSource || null,
    hasApply: false,
  };
}

module.exports = {
  loadCandidatesFromRefs,
  getRefCandidates,
  serializeRefCandidate,
  resetLoadedFlag,
  listCandidateFiles,
};
