#!/usr/bin/env node
/**
 * Build-time Φ-loader для meta-домена (Level 1, read-only).
 *
 * Источники:
 *   - src/domains/<d>/ontology.js             — entityCount, roleCount, ...
 *   - src/domains/<d>/intents.js              — список intent'ов
 *   - src/domains/<d>/projections.js          — projection metadata
 *   - ~/WebstormProjects/idf-sdk/packages/core/src/patterns/stable/<arch>/*.js
 *   - pattern-bank/candidate/*.json
 *   - ~/WebstormProjects/idf-sdk/packages/<pkg>/package.json — версии/license
 *
 * Output: src/domains/meta/meta-snapshot.json
 *
 * Importer статический и грубый — он не вычисляет ontology.js (там
 * default-export'ы), а парсит исходники регулярками. Это L1; точные
 * счётчики появятся когда мета-домен начнёт читать `audit-report.json`
 * через runtime route.
 */

import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename, relative, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";

import {
  crystallizeV2,
  deriveProjections,
  explainAllCrystallize,
  computeSlotAttribution,
} from "@intent-driven/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
// SDK_ROOT — соседний репо, не дочерний. В worktree ".." указывает в
// .claude/worktrees/, поэтому используем абсолютный resolver через WebstormProjects.
const SDK_ROOT = process.env.IDF_SDK_ROOT
  || join(homedir(), "WebstormProjects", "idf-sdk");
const NOW = Date.now();

const DOMAIN_META = {
  booking: { title: "📅 Бронирование", adapter: "mantine", fieldTestNumber: 1 },
  planning: { title: "📊 Планирование", adapter: "mantine", fieldTestNumber: 2 },
  workflow: { title: "⚡ Workflow", adapter: "mantine", fieldTestNumber: 3 },
  messenger: { title: "💬 Мессенджер", adapter: "mantine", fieldTestNumber: 4 },
  sales: { title: "🛒 Sales", adapter: "mantine", fieldTestNumber: 5 },
  lifequest: { title: "📓 LifeQuest", adapter: "shadcn", fieldTestNumber: 6 },
  reflect: { title: "🌀 Reflect", adapter: "apple", fieldTestNumber: 9 },
  invest: { title: "💼 Invest", adapter: "antd", fieldTestNumber: 10 },
  delivery: { title: "🚚 Delivery", adapter: "antd", fieldTestNumber: 11 },
  freelance: { title: "🛠 Freelance", adapter: "antd", fieldTestNumber: 12 },
  compliance: { title: "📑 Compliance", adapter: "antd", fieldTestNumber: 13 },
  gravitino: { title: "🗂 Gravitino", adapter: "antd", fieldTestNumber: 14 },
  keycloak: { title: "🔐 Keycloak", adapter: "antd", fieldTestNumber: 15 },
  argocd: { title: "🚀 ArgoCD", adapter: "antd", fieldTestNumber: 16 },
  automation: { title: "⚙️ Automation", adapter: "antd", fieldTestNumber: 17 },
  notion: { title: "📝 Notion", adapter: "antd", fieldTestNumber: 18 },
};

const ADAPTERS = [
  { id: "antd", packageName: "@intent-driven/adapter-antd", style: "AntD enterprise-fintech", defaultFor: "invest, gravitino, keycloak, argocd, automation, notion" },
  { id: "mantine", packageName: "@intent-driven/adapter-mantine", style: "Corporate / data-dense", defaultFor: "booking, planning, workflow, messenger, sales" },
  { id: "shadcn", packageName: "@intent-driven/adapter-shadcn", style: "Handcrafted / sketch", defaultFor: "lifequest" },
  { id: "apple", packageName: "@intent-driven/adapter-apple", style: "Premium / minimal", defaultFor: "reflect" },
];

// ─────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────

async function readSafe(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function listDir(dir) {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

/**
 * Грубый парсер ontology.js: считает кол-во entity / role / invariant
 * через сопоставление верхне-уровневых ключей в литералах объектов.
 */
function parseOntologyShape(src) {
  if (!src) return { entities: 0, roles: 0, invariants: 0, rules: 0 };

  // entities: { Foo: {…}, Bar: {…} } — считаем top-level keys внутри `entities: {`
  const entitiesBlock = extractBlock(src, /entities\s*:\s*\{/);
  const rolesBlock = extractBlock(src, /roles\s*:\s*\{/);
  const invariantsArr = extractArray(src, /invariants\s*:\s*\[/);
  const rulesArr = extractArray(src, /rules\s*:\s*\[/);

  return {
    entities: countTopLevelKeys(entitiesBlock),
    roles: countTopLevelKeys(rolesBlock),
    invariants: countArrayItems(invariantsArr),
    rules: countArrayItems(rulesArr),
  };
}

function extractBlock(src, openRe) {
  const m = openRe.exec(src);
  if (!m) return "";
  const start = m.index + m[0].length;
  return sliceBalanced(src, start, "{", "}");
}

function extractArray(src, openRe) {
  const m = openRe.exec(src);
  if (!m) return "";
  const start = m.index + m[0].length;
  return sliceBalanced(src, start, "[", "]");
}

function sliceBalanced(src, start, open, close) {
  let depth = 1;
  let i = start;
  let inStr = null;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (inStr) {
      if (c === "\\") { i += 2; continue; }
      if (c === inStr) inStr = null;
    } else if (c === '"' || c === "'" || c === "`") {
      inStr = c;
    } else if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    } else if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i + 2);
      if (i === -1) return "";
      i += 2;
      continue;
    } else if (c === open) {
      depth += 1;
    } else if (c === close) {
      depth -= 1;
      if (depth === 0) return src.slice(start, i);
    }
    i += 1;
  }
  return "";
}

function countTopLevelKeys(block) {
  if (!block) return 0;
  const keys = [];
  let i = 0;
  let depth = 0;
  let inStr = null;
  let lineStart = true;
  while (i < block.length) {
    const c = block[i];
    if (inStr) {
      if (c === "\\") { i += 2; continue; }
      if (c === inStr) inStr = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; i += 1; continue; }
    if (c === "/" && block[i + 1] === "/") {
      while (i < block.length && block[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && block[i + 1] === "*") {
      i = block.indexOf("*/", i + 2);
      if (i === -1) break;
      i += 2;
      continue;
    }
    if (c === "{" || c === "[" || c === "(") depth += 1;
    else if (c === "}" || c === "]" || c === ")") depth -= 1;
    else if (depth === 0 && /[A-Za-z_$]/.test(c) && lineStart) {
      let j = i;
      while (j < block.length && /[A-Za-z0-9_$]/.test(block[j])) j += 1;
      const id = block.slice(i, j);
      let k = j;
      while (k < block.length && /\s/.test(block[k])) k += 1;
      if (block[k] === ":") {
        keys.push(id);
        i = k + 1;
        lineStart = false;
        continue;
      }
    }
    if (c === "\n" || c === ",") lineStart = true;
    else if (!/\s/.test(c)) lineStart = false;
    i += 1;
  }
  return keys.length;
}

function countArrayItems(arr) {
  if (!arr) return 0;
  let depth = 0;
  let count = 0;
  let saw = false;
  let inStr = null;
  for (let i = 0; i < arr.length; i += 1) {
    const c = arr[i];
    if (inStr) {
      if (c === "\\") { i += 1; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{" || c === "[" || c === "(") { depth += 1; saw = true; continue; }
    if (c === "}" || c === "]" || c === ")") { depth -= 1; continue; }
    if (depth === 0 && c === ",") { if (saw) count += 1; saw = false; continue; }
    if (!/\s/.test(c)) saw = true;
  }
  if (saw) count += 1;
  return count;
}

/**
 * Парсит intents.js: для каждого top-level ключа в `INTENTS = { … }`
 * вытаскивает α / target / confirmation / __irr.point.
 */
function parseIntents(src, domainId) {
  if (!src) return [];
  const block = extractBlock(src, /(?:export\s+const\s+)?INTENTS\s*=\s*\{/);
  if (!block) return [];

  const out = [];
  let i = 0;
  while (i < block.length) {
    const c = block[i];
    if (/\s/.test(c) || c === ",") { i += 1; continue; }
    if (c === "/" && block[i + 1] === "/") {
      while (i < block.length && block[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && block[i + 1] === "*") {
      i = block.indexOf("*/", i + 2);
      if (i === -1) break;
      i += 2;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < block.length && /[A-Za-z0-9_$]/.test(block[j])) j += 1;
      const id = block.slice(i, j);
      let k = j;
      while (k < block.length && /\s/.test(block[k])) k += 1;
      if (block[k] === ":") {
        const valStart = k + 1;
        let p = valStart;
        while (p < block.length && /\s/.test(block[p])) p += 1;
        if (block[p] === "{") {
          const body = sliceBalanced(block, p + 1, "{", "}");
          out.push({
            domainId,
            intentId: id,
            ...parseIntentBody(body),
          });
          i = p + 1 + body.length + 1;
          continue;
        }
      }
    }
    i += 1;
  }
  return out;
}

function parseIntentBody(body) {
  const grab = (re) => {
    const m = re.exec(body);
    return m ? m[1] : null;
  };
  const name = grab(/name\s*:\s*"([^"]+)"/);
  const alpha = grab(/[αa]lpha\s*:\s*"([^"]+)"/) || grab(/α\s*:\s*"([^"]+)"/);
  const target = grab(/target\s*:\s*"([^"]+)"/);
  const confirmation = grab(/confirmation\s*:\s*"([^"]+)"/);
  const irrPoint = grab(/__irr\s*:\s*\{[^}]*point\s*:\s*"([^"]+)"/);
  return {
    name: name || null,
    alpha: alpha || null,
    target: target || null,
    confirmation: confirmation || null,
    hasIrr: irrPoint !== null,
    irrPoint: irrPoint || null,
  };
}

function parseProjections(src, domainId) {
  if (!src) return [];
  const block = extractBlock(src, /(?:export\s+const\s+)?PROJECTIONS\s*=\s*\{/);
  if (!block) return [];
  // GAP-meta-5: regex-парсер не AST-aware. helper-стиль авторства
  // (`projection_id: catalog(...)` в gravitino) не даёт парсеру
  // структуру projection'а — body вычисляется в рантайме. Подсчёт
  // через top-level keys работает, но shape (archetype/witnesses)
  // экстрактится только если автор использовал object-literal.
  return walkTopLevelKeys(block).map((k) => ({
    domainId,
    projectionId: k.id,
    ...(k.body ? parseProjectionBody(k.body) : {
      title: null,
      archetype: null,
      mainEntity: null,
      forRoles: null,
      witnessCount: 0,
    }),
  }));
}

/**
 * Парсит body как набор top-level ключей. Если значение — object-literal `{…}`,
 * возвращает body этого литерала; иначе body=null (helper-call).
 * Корректно скиппует nested `()`, `[]`, `{}`, чтобы не подобрать nested keys.
 */
function walkTopLevelKeys(block) {
  const out = [];
  let i = 0;
  while (i < block.length) {
    const c = block[i];
    if (/\s/.test(c) || c === ",") { i += 1; continue; }
    if (c === "/" && block[i + 1] === "/") {
      while (i < block.length && block[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && block[i + 1] === "*") {
      i = block.indexOf("*/", i + 2);
      if (i === -1) break;
      i += 2;
      continue;
    }
    if (!/[A-Za-z_$]/.test(c)) { i += 1; continue; }
    let j = i;
    while (j < block.length && /[A-Za-z0-9_$]/.test(block[j])) j += 1;
    const id = block.slice(i, j);
    let k = j;
    while (k < block.length && /\s/.test(block[k])) k += 1;
    if (block[k] !== ":") { i = j; continue; }
    let p = k + 1;
    while (p < block.length && /\s/.test(block[p])) p += 1;
    if (block[p] === "{") {
      const body = sliceBalanced(block, p + 1, "{", "}");
      out.push({ id, body });
      i = p + 1 + body.length + 1;
      continue;
    }
    // Helper-call / array / primitive — пропускаем balanced expression
    out.push({ id, body: null });
    i = skipExpression(block, p);
  }
  return out;
}

function skipExpression(block, start) {
  let i = start;
  let depth = 0;
  let inStr = null;
  while (i < block.length) {
    const c = block[i];
    if (inStr) {
      if (c === "\\") { i += 2; continue; }
      if (c === inStr) inStr = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; i += 1; continue; }
    if (c === "(" || c === "[" || c === "{") { depth += 1; i += 1; continue; }
    if (c === ")" || c === "]" || c === "}") { depth -= 1; i += 1; continue; }
    if (depth === 0 && c === ",") return i;
    i += 1;
  }
  return i;
}

function parseProjectionBody(body) {
  const grab = (re) => {
    const m = re.exec(body);
    return m ? m[1] : null;
  };
  return {
    title: grab(/title\s*:\s*"([^"]+)"/),
    archetype: grab(/archetype\s*:\s*"([^"]+)"/),
    mainEntity: grab(/mainEntity\s*:\s*"([^"]+)"/),
    forRoles: grab(/forRoles\s*:\s*\[([^\]]*)\]/),
    witnessCount: countWitnesses(body),
  };
}

function countWitnesses(body) {
  const m = /witnesses\s*:\s*\[([^\]]*)\]/.exec(body);
  if (!m) return 0;
  const inner = m[1].trim();
  if (!inner) return 0;
  return inner.split(",").filter((s) => s.trim()).length;
}

// ─────────────────────────────────────────────────────────────────
// Pattern Bank scanner
// ─────────────────────────────────────────────────────────────────

async function scanStablePatterns() {
  const root = join(SDK_ROOT, "packages", "core", "src", "patterns", "stable");
  const out = [];
  for (const arch of ["catalog", "cross", "detail", "feed"]) {
    const dir = join(root, arch);
    const files = await listDir(dir);
    for (const f of files) {
      if (!f.endsWith(".js") || f.endsWith(".test.js")) continue;
      const src = await readSafe(join(dir, f));
      if (!src) continue;
      out.push(parseStablePattern(src, arch, f));
    }
  }
  return out;
}

function parseStablePattern(src, arch, fname) {
  const grab = (re) => {
    const m = re.exec(src);
    return m ? m[1] : null;
  };
  const id = grab(/id\s*:\s*"([^"]+)"/) || basename(fname, ".js");
  const status = grab(/status\s*:\s*"([^"]+)"/) || "stable";
  const archetype = grab(/archetype\s*:\s*"([^"]+)"/) || arch;
  const versionStr = grab(/version\s*:\s*(\d+)/);
  const hasApply = /apply\s*\(/.test(src) || /apply:/.test(src);
  const looksMatchingOnly = !hasApply;
  return {
    patternId: id,
    name: id.replace(/-/g, " "),
    status,
    archetypeScope: archetype,
    axis: looksMatchingOnly ? "matching-only" : "structural",
    hasApply,
    version: versionStr ? Number(versionStr) : 1,
    bankPath: `idf-sdk/packages/core/src/patterns/stable/${arch}/${fname}`,
    sourceProduct: null,
  };
}

async function scanCandidatePatterns() {
  const dir = join(REPO_ROOT, "pattern-bank", "candidate");
  const files = await listDir(dir);
  const out = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const src = await readSafe(join(dir, f));
    if (!src) continue;
    // GAP-meta-3: pattern-bank/candidate/*.json не имеют declared
    // sourceProduct поля; naming convention `<product>-<pattern>.json`
    // — fallback. Спецификация pattern-bank/ должна формализовать
    // sourceProduct/observedIn как обязательное поле candidate-схемы.
    const filenameSource = f.split("-")[0];
    try {
      const j = JSON.parse(src);
      out.push({
        patternId: j.id || basename(f, ".json"),
        name: j.name || j.id || basename(f, ".json"),
        status: "candidate",
        archetypeScope: j.archetype || "any",
        axis: j.axis || "behavioral",
        hasApply: false,
        version: 0,
        bankPath: `pattern-bank/candidate/${f}`,
        sourceProduct: j.sourceProduct || j.source || filenameSource || null,
      });
    } catch {
      out.push({
        patternId: basename(f, ".json"),
        name: basename(f, ".json"),
        status: "candidate",
        archetypeScope: "any",
        axis: "behavioral",
        hasApply: false,
        version: 0,
        bankPath: `pattern-bank/candidate/${f}`,
        sourceProduct: null,
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// SDK package versions
// ─────────────────────────────────────────────────────────────────

async function readAdapterVersions() {
  const out = {};
  for (const a of ADAPTERS) {
    const pkgPath = join(SDK_ROOT, "packages", `adapter-${a.id}`, "package.json");
    const src = await readSafe(pkgPath);
    if (src) {
      try {
        const j = JSON.parse(src);
        out[a.id] = { version: j.version || null, license: j.license || null };
      } catch { /* noop */ }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Domain scanning
// ─────────────────────────────────────────────────────────────────

async function scanDomains() {
  const domainsRoot = join(REPO_ROOT, "src", "domains");
  const dirs = await listDir(domainsRoot);
  const domains = [];
  const intents = [];
  const projections = [];
  const rules = [];
  const witnesses = [];

  for (const d of dirs) {
    if (d === "meta") continue;
    const dirPath = join(domainsRoot, d);
    const s = await stat(dirPath).catch(() => null);
    if (!s || !s.isDirectory()) continue;
    const ontologySrc = await readSafe(join(dirPath, "ontology.js"));
    const intentsSrc = await readSafe(join(dirPath, "intents.js"));
    const projectionsSrc = await readSafe(join(dirPath, "projections.js"));

    const shape = parseOntologyShape(ontologySrc);
    const meta = DOMAIN_META[d] || {};
    const staticIntents = parseIntents(intentsSrc, d);
    const staticProjections = parseProjections(projectionsSrc, d);

    // Runtime-evaluate: динамический import domain.js → crystallizeV2 →
    // реальные witness'ы. Если файл не загружается (ESM-конструкции,
    // зависимости от @testing-library / window), fallback к static
    // shape без witness'ов.
    const runtime = await tryEvaluateDomain(dirPath, d);

    domains.push({
      id: d,
      name: d,
      title: meta.title || d,
      adapter: meta.adapter || "mantine",
      fieldTestNumber: meta.fieldTestNumber || null,
      domainScope: extractDomainScope(ontologySrc),
      entityCount: shape.entities,
      roleCount: shape.roles,
      invariantCount: shape.invariants,
      ruleCount: shape.rules,
      intentCount: runtime
        ? Object.keys(runtime.INTENTS || {}).length
        : staticIntents.length,
      projectionCount: runtime
        ? Object.keys(runtime.MERGED_PROJECTIONS || {}).length
        : staticProjections.length,
      runtimeLoaded: !!runtime,
      runtimeError: runtime?.error || null,
      snapshottedAt: NOW,
    });

    intents.push(...staticIntents);
    rules.push(...extractRules(ontologySrc, d));

    // §13.13 fix: используем merged projections из runtime (authored + derived),
    // потому что witness.projectionId ссылается на ВСЕ projections, включая
    // R1/R3/R7-derived. Static parsing видит только authored — FK ломаются.
    if (runtime?.MERGED_PROJECTIONS) {
      for (const [pid, p] of Object.entries(runtime.MERGED_PROJECTIONS)) {
        projections.push({
          domainId: d,
          projectionId: pid,
          title: p.title || p.name || null,
          archetype: p.archetype || p.kind || null,
          mainEntity: p.mainEntity || null,
          forRoles: Array.isArray(p.forRoles) ? p.forRoles.join(",") : null,
          witnessCount: Array.isArray(p.witnesses) ? p.witnesses.length : 0,
        });
      }
    } else {
      projections.push(...staticProjections);
    }

    if (runtime?.witnesses) {
      witnesses.push(...runtime.witnesses);
    }
  }

  return { domains, intents, projections, rules, witnesses };
}

async function tryEvaluateDomain(dirPath, domainId) {
  const domainFile = join(dirPath, "domain.js");
  const exists = await readSafe(domainFile);
  if (!exists) return null;
  try {
    const url = pathToFileURL(domainFile).href;
    const mod = await import(url);
    const INTENTS = mod.INTENTS || {};
    const ONTOLOGY = mod.ONTOLOGY || {};
    const PROJECTIONS = mod.PROJECTIONS || {};

    const derived = deriveProjections(INTENTS, ONTOLOGY) || {};
    const merged = { ...derived };
    for (const [id, p] of Object.entries(PROJECTIONS)) {
      merged[id] = { id, ...p };
    }
    for (const [id, p] of Object.entries(derived)) {
      if (!merged[id]) merged[id] = { id, ...p };
    }

    const artifacts = crystallizeV2(INTENTS, merged, ONTOLOGY, domainId) || {};
    const explained = explainAllCrystallize(artifacts) || {};

    const witnessRows = [];
    let idx = 0;
    for (const [projId, artifact] of Object.entries(artifacts)) {
      const ws = Array.isArray(artifact?.witnesses) ? artifact.witnesses : [];
      for (const w of ws) {
        const compositeProjectionId = `${domainId}__${projId}`;
        witnessRows.push({
          witnessId: `w_${domainId}_${idx++}`,
          domainId,
          projectionId: compositeProjectionId,
          archetype: artifact.archetype || null,
          slotPath: w.slot || w.field || w.example || w.basis || "—",
          basis: w.basis || "unknown",
          reliability: w.reliability || (w.basis === "pattern-bank" ? "rule-based" : "heuristic"),
          patternId: w.pattern || null,
          ruleId: w.ruleId || null,
          rationale: typeof w.rationale === "string" ? w.rationale.slice(0, 200) : null,
          origin: explained[projId]?.origin || null,
        });
      }
    }
    return {
      INTENTS,
      ONTOLOGY,
      MERGED_PROJECTIONS: merged,
      witnesses: witnessRows,
    };
  } catch (err) {
    return { error: err.message?.slice(0, 200) || String(err).slice(0, 200) };
  }
}

function extractDomainScope(src) {
  if (!src) return null;
  const m = /domainScope\s*:\s*"([^"]+)"/.exec(src);
  return m ? m[1] : null;
}

function extractRules(src, domainId) {
  if (!src) return [];
  const arr = extractArray(src, /rules\s*:\s*\[/);
  if (!arr) return [];
  const out = [];
  let i = 0;
  let idx = 0;
  while (i < arr.length) {
    const c = arr[i];
    if (/\s/.test(c) || c === ",") { i += 1; continue; }
    if (c === "{") {
      const body = sliceBalanced(arr, i + 1, "{", "}");
      const grab = (re) => {
        const m = re.exec(body);
        return m ? m[1] : null;
      };
      const name = grab(/name\s*:\s*"([^"]+)"/);
      const trigger = grab(/trigger\s*:\s*"([^"]+)"/);
      const kind = body.includes("threshold:")
        ? "threshold"
        : body.includes("schedule:")
          ? "schedule"
          : body.includes("aggregation:")
            ? "aggregation"
            : body.includes("condition:")
              ? "condition"
              : "event";
      out.push({
        ruleId: `${domainId}_rule_${idx}`,
        domainId,
        name: name || `${domainId}_rule_${idx}`,
        kind,
        trigger,
      });
      idx += 1;
      i += 1 + body.length + 1;
      continue;
    }
    i += 1;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Capabilities
// ─────────────────────────────────────────────────────────────────

const CAPABILITY_MATRIX = [
  // (adapterId, namespace, key, supported, variant?)
  ["antd", "chart", "line", true],
  ["antd", "chart", "pie", true],
  ["antd", "chart", "column", true],
  ["antd", "chart", "area", true],
  ["antd", "statistic", "default", true],
  ["antd", "sparkline", "default", true],
  ["antd", "shell", "sidebar", true],
  ["antd", "interaction", "externalSelection", false],
  ["antd", "primitive", "map", false],

  ["mantine", "chart", "line", true, "svg-fallback"],
  ["mantine", "chart", "pie", false],
  ["mantine", "statistic", "default", false],
  ["mantine", "sparkline", "default", false],
  ["mantine", "shell", "sidebar", true],
  ["mantine", "interaction", "externalSelection", false],

  ["shadcn", "chart", "line", true, "svg-fallback"],
  ["shadcn", "statistic", "default", false],
  ["shadcn", "shell", "sidebar", true],
  ["shadcn", "interaction", "externalSelection", false],

  ["apple", "chart", "line", true, "svg-fallback"],
  ["apple", "statistic", "default", false],
  ["apple", "shell", "sidebar", true],
  ["apple", "interaction", "externalSelection", false],
];

// ─────────────────────────────────────────────────────────────────
// Witnesses (placeholder — Level 1)
// ─────────────────────────────────────────────────────────────────

/**
 * В Level 1 witness'ы читаются «дешёво»: для каждой projection.witnesses
 * (csv в snapshot.projections) генерируем синтетические witness-rows
 * c basis="declaration-order", reliability="rule-based".
 *
 * Полевая аннотация (basis="pattern-bank" / "explicit-salience") появится,
 * когда мета-домен сможет звать /api/patterns/explain.
 */
function synthesizeWitnesses(projections) {
  const out = [];
  let idx = 0;
  for (const p of projections) {
    if (!p.witnessCount) continue;
    out.push({
      witnessId: `w_${idx}`,
      projectionId: `${p.domainId}__${p.projectionId}`,
      slotPath: `${p.archetype || "?"}.witnesses[${p.witnessCount}]`,
      basis: "declaration-order",
      reliability: "rule-based",
      patternId: null,
    });
    idx += 1;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────

async function main() {
  const { domains, intents, projections, rules, witnesses: realWitnesses } = await scanDomains();
  const stable = await scanStablePatterns();
  const candidate = await scanCandidatePatterns();
  const adapterVer = await readAdapterVersions();

  // Если хотя бы один домен загрузился runtime'ом — используем реальные
  // witness'ы из crystallizeV2. Иначе fallback на synthesized.
  const runtimeLoadedCount = domains.filter((d) => d.runtimeLoaded).length;
  const witnesses = realWitnesses.length > 0
    ? realWitnesses
    : synthesizeWitnesses(projections);

  const adapters = ADAPTERS.map((a) => ({
    id: a.id,
    packageName: a.packageName,
    version: adapterVer[a.id]?.version || null,
    license: adapterVer[a.id]?.license || null,
    style: a.style,
    defaultFor: a.defaultFor,
  }));

  const capabilities = CAPABILITY_MATRIX.map(([adapterId, namespace, key, supported, variant], idx) => ({
    capabilityId: `cap_${idx}`,
    adapterId,
    namespace,
    key,
    supported,
    variant: variant || null,
  }));

  const snapshot = {
    snapshottedAt: NOW,
    domains,
    intents,
    projections,
    rules,
    stablePatterns: stable,
    candidatePatterns: candidate,
    adapters,
    capabilities,
    witnesses,
    summary: {
      domains: domains.length,
      intents: intents.length,
      projections: projections.length,
      stablePatterns: stable.length,
      candidatePatterns: candidate.length,
      adapters: adapters.length,
      capabilities: capabilities.length,
      witnesses: witnesses.length,
      rules: rules.length,
    },
  };

  // GAP-meta-4: JSON-импорт через `import x from "./snap.json"` работает
  // только в Vite. В plain Node (CLI / server-side seed) падает с
  // ERR_IMPORT_ATTRIBUTE_MISSING. JS-форма (`export const SNAPSHOT = {...}`)
  // переносима между runtime'ами без изменения API seed.js.
  const outPath = join(REPO_ROOT, "src", "domains", "meta", "meta-snapshot.js");
  const body =
    "// AUTO-GENERATED by scripts/build-meta-snapshot.mjs — do not edit.\n" +
    "// JS-shape (не JSON) для совместимости с plain Node без `with: { type: \"json\" }`.\n" +
    `export const SNAPSHOT = ${JSON.stringify(snapshot, null, 2)};\n` +
    "export default SNAPSHOT;\n";
  await writeFile(outPath, body, "utf8");

  console.log(
    `meta-snapshot: ${domains.length} domains (${runtimeLoadedCount} runtime-loaded), ` +
    `${intents.length} intents, ${projections.length} projections, ` +
    `${stable.length} stable + ${candidate.length} candidate patterns, ` +
    `${adapters.length} adapters, ${capabilities.length} capabilities, ` +
    `${witnesses.length} witnesses (${realWitnesses.length > 0 ? "real" : "synthetic"}), ` +
    `${rules.length} rules → ${relative(REPO_ROOT, outPath)}`,
  );
  const failed = domains.filter((d) => !d.runtimeLoaded && d.runtimeError);
  if (failed.length > 0) {
    console.warn(`runtime-load failures (${failed.length}):`);
    for (const d of failed) console.warn(`  ${d.id}: ${d.runtimeError}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
