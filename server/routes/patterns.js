/**
 * /api/patterns — Pattern Bank surface (§UX Pattern Layer, v1.8).
 *
 * GET /catalog — сериализованный каталог всех паттернов реестра (stable /
 *   candidate / anti). Клиент получает достаточно данных для UI Pattern Bank:
 *   trigger (requires + matchSource), structure (slot + description + applySource),
 *   rationale, falsification, hasApply-флаг.
 *
 * GET /falsification?id=<patternId> — live falsification: для каждой записи
 *   в pattern.falsification.{shouldMatch,shouldNotMatch} подгружает реальные
 *   ontology + intents + projections домена и прогоняет evaluateTriggerExplained.
 *   Возвращает {shouldMatch, shouldNotMatch, regressions}. Regressions — случаи,
 *   где expected ≠ actual (сигнал, что паттерн разошёлся с реальностью).
 *
 * Функции trigger.match и structure.apply сериализуются как строки (их .toString()),
 * чтобы UI мог показать исходник правил; исполнение — только серверное.
 *
 * Domain loading: domains лежат в src/domains/<name>/domain.js как ESM-модули;
 * server — CJS, поэтому используется dynamic import(). Загруженные домены
 * кэшируются в in-memory Map на время жизни процесса.
 */

const express = require("express");
const { Router } = express;
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  getDefaultRegistry,
  loadStablePatterns,
  evaluateTriggerExplained,
  explainMatch,
  computeSlotAttribution,
  deriveProjections,
} = require("@intent-driven/core");
const { writePatternPreference } = require("../patternPreferenceWriter.js");
const {
  loadCandidatesFromRefs,
  getRefCandidates,
  serializeRefCandidate,
} = require("../loadCandidatesFromRefs.cjs");
const { evaluateGenericRequires } = require("../genericTriggerEvaluator.cjs");
const { promoteToSdkPr } = require("../curatorPromoter.cjs");

// Кэш загруженных доменов: { [domainName]: { ontology, intents, projections } | null }
const DOMAIN_CACHE = new Map();

/**
 * Подгрузить домен с диска через dynamic import().
 *
 * Возвращает нормализованный объект { ontology, intents, projections } или
 * null, если файл не найден / не экспортирует нужные символы.
 *
 * NB: domains — ESM, server — CJS; import() — единственный cross-boundary путь.
 * Результат кэшируется (module loader тоже кэширует, но кэш здесь читабельнее
 * в логах и позволяет явно отдать null при ошибке, не роняя endpoint).
 */
async function loadDomain(domainName) {
  if (!domainName || typeof domainName !== "string") return null;
  if (DOMAIN_CACHE.has(domainName)) return DOMAIN_CACHE.get(domainName);

  const domainFile = path.join(__dirname, "..", "..", "src", "domains", domainName, "domain.js");
  try {
    const mod = await import(pathToFileURL(domainFile).href);
    const ontology = mod.ONTOLOGY || null;
    const intents = mod.INTENTS || {};
    const authoredProjections = mod.PROJECTIONS || {};
    if (!ontology) {
      DOMAIN_CACHE.set(domainName, null);
      return null;
    }
    // Зеркалим host V2Shell: derived + authored с field-level merge.
    // Top-level merge ({ ...derived, ...authored }) перезаписывал бы derived.X
    // целиком, теряя kind/mainEntity/derivedBy, если authored.X декларирует
    // только overrides (witnesses/toolbar/patterns) — без этих полей
    // explainMatch деградирует до archetype="catalog" и computeSlotAttribution
    // возвращает {}. Per-projection spread сохраняет derived-поля без override.
    let derived = {};
    try {
      const intentsArr = Object.entries(intents).map(([id, i]) => ({ id, ...i }));
      derived = deriveProjections(intentsArr, ontology);
    } catch {}
    const projections = { ...derived };
    for (const [id, authored] of Object.entries(authoredProjections)) {
      projections[id] = projections[id] ? { ...projections[id], ...authored } : authored;
    }
    const domain = { id: domainName, ontology, intents, projections };
    DOMAIN_CACHE.set(domainName, domain);
    return domain;
  } catch (err) {
    console.warn(`[patterns] loadDomain(${domainName}) failed:`, err.message);
    DOMAIN_CACHE.set(domainName, null);
    return null;
  }
}

/**
 * Intent-объекты проекции: фильтруем по mainEntity через particles.entities.
 * entities формат — "alias: Entity" либо "Entity"; берём часть после ":".
 * Если у проекции нет mainEntity — считаем все intents релевантными.
 */
function filterIntentsForProjection(intents, projection) {
  const main = projection?.mainEntity;
  return Object.entries(intents || {})
    .filter(([, intent]) => {
      if (!main) return true;
      const entities = (intent?.particles?.entities || [])
        .map(e => String(e).split(":").pop().trim());
      return entities.includes(main);
    })
    .map(([id, intent]) => ({ id, ...intent }));
}

function serializePattern(pattern) {
  const trigger = pattern.trigger || {};
  const structure = pattern.structure || {};
  return {
    id: pattern.id,
    version: pattern.version,
    status: pattern.status,
    archetype: pattern.archetype,
    trigger: {
      requires: Array.isArray(trigger.requires) ? trigger.requires : [],
      matchSource: typeof trigger.match === "function" ? trigger.match.toString() : null,
    },
    structure: {
      slot: structure.slot,
      description: structure.description ?? null,
    },
    rationale: pattern.rationale ?? null,
    falsification: pattern.falsification ?? null,
    hasApply: typeof structure.apply === "function",
    applySource: typeof structure.apply === "function" ? structure.apply.toString() : null,
  };
}

function collectByStatus(registry) {
  const stable = [];
  const candidate = [];
  const anti = [];
  const all = typeof registry.getAllPatterns === "function" ? registry.getAllPatterns() : [];
  for (const p of all) {
    const serialized = serializePattern(p);
    if (p.status === "stable") stable.push(serialized);
    else if (p.status === "candidate") candidate.push(serialized);
    else if (p.status === "anti") anti.push(serialized);
  }
  return { stable, candidate, anti };
}

function makePatternsRouter() {
  const router = Router();

  router.get("/catalog", (_req, res) => {
    // Registry — singleton-default; loadStablePatterns идемпотентен
    // (registerPattern проверяет getPattern перед вставкой). Кандидаты из
    // refs/candidates/ — отдельный side-channel (registry строго валидирует
    // trigger.kind, а pattern-researcher выкатывает новые kind'ы; куратор
    // их триажит в /studio?view=curator).
    const registry = getDefaultRegistry();
    try {
      loadStablePatterns(registry);
      loadCandidatesFromRefs();
    } catch (err) {
      return res.status(500).json({ error: "pattern_bank_load_failed", reason: err.message });
    }
    const { stable, candidate, anti } = collectByStatus(registry);
    // Дополняем candidate'ами из refs/candidates/ (с защитой от дубликатов).
    const knownIds = new Set([
      ...stable.map((p) => p.id),
      ...candidate.map((p) => p.id),
      ...anti.map((p) => p.id),
    ]);
    for (const ref of getRefCandidates()) {
      if (knownIds.has(ref.id)) continue;
      candidate.push(serializeRefCandidate(ref));
    }
    res.json({ stable, candidate, anti });
  });

  router.get("/falsification", async (req, res) => {
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: "missing_id", message: "query-param ?id= обязателен" });
    }

    const registry = getDefaultRegistry();
    try {
      loadStablePatterns(registry);
      loadCandidatesFromRefs();
    } catch (err) {
      return res.status(500).json({ error: "pattern_bank_load_failed", reason: err.message });
    }

    const pattern = registry.getPattern(id);
    if (!pattern) {
      // Fallback на side-channel: ref-кандидаты не попадают в registry
      // (registerPattern строго валидирует trigger.kind), но у них есть
      // requires[] и static falsification fixtures. Запускаем generic
      // evaluator (server/genericTriggerEvaluator.cjs) — best-effort
      // matching по kind'у; для placeholder'ов или unknown kind'ов
      // возвращаем actual=null (live-undecidable).
      const refPattern = getRefCandidates().find((p) => p.id === id);
      if (refPattern) {
        const runRefCase = async (entry, expected) => {
          const domain = await loadDomain(entry.domain);
          if (!domain) {
            return { ...entry, expected, actual: null, error: "domain-not-loaded" };
          }
          const projection = domain.projections?.[entry.projection];
          if (!projection) {
            return { ...entry, expected, actual: null, error: "projection-not-found" };
          }
          const projIntents = filterIntentsForProjection(domain.intents, projection);
          const result = evaluateGenericRequires(refPattern.trigger, {
            intents: projIntents,
            ontology: domain.ontology,
            projection: { ...projection, id: entry.projection },
          });
          return {
            ...entry,
            expected,
            actual: result.matched, // true | false | null
            perRequire: result.perRequire,
            error: result.matched === null ? "live-undecidable" : null,
          };
        };
        const shouldMatch = await Promise.all(
          (refPattern.falsification?.shouldMatch || []).map((e) => runRefCase(e, true)),
        );
        const shouldNotMatch = await Promise.all(
          (refPattern.falsification?.shouldNotMatch || []).map((e) => runRefCase(e, false)),
        );
        const regressions = [...shouldMatch, ...shouldNotMatch].filter(
          (r) => r.actual !== null && r.actual !== r.expected,
        );
        return res.json({
          id,
          shouldMatch,
          shouldNotMatch,
          regressions,
          note: "ref-candidate: generic evaluator best-effort (no trigger.match function)",
        });
      }
      return res.status(404).json({ error: "pattern_not_found", id });
    }

    const runCase = async (entry, expected) => {
      const domain = await loadDomain(entry.domain);
      if (!domain) {
        return { ...entry, expected, actual: null, error: "domain-not-loaded" };
      }
      const projection = domain.projections?.[entry.projection];
      if (!projection) {
        return { ...entry, expected, actual: null, error: "projection-not-found" };
      }
      const projIntents = filterIntentsForProjection(domain.intents, projection);
      try {
        const explain = evaluateTriggerExplained(
          pattern.trigger,
          projIntents,
          domain.ontology,
          projection,
        );
        return {
          ...entry,
          expected,
          actual: explain.ok,
          requirements: explain.requirements,
        };
      } catch (err) {
        return { ...entry, expected, actual: null, error: `evaluate-failed: ${err.message}` };
      }
    };

    const shouldMatchEntries = pattern.falsification?.shouldMatch || [];
    const shouldNotMatchEntries = pattern.falsification?.shouldNotMatch || [];
    const shouldMatch = await Promise.all(shouldMatchEntries.map(e => runCase(e, true)));
    const shouldNotMatch = await Promise.all(shouldNotMatchEntries.map(e => runCase(e, false)));

    const regressions = [
      ...shouldMatch.filter(e => e.expected === true && e.actual === false),
      ...shouldNotMatch.filter(e => e.expected === false && e.actual === true),
    ];

    res.json({ shouldMatch, shouldNotMatch, regressions });
  });

  /**
   * GET /explain?domain=X&projection=Y — inspector-surface: полный результат
   *   SDK explainMatch для конкретной (domain, projection) пары.
   *
   * Query:
   *   - domain, projection — обязательные; 400 без них, 404 если домен или
   *     проекция не найдены.
   *   - includeNearMiss=1 — добавляет structural.nearMiss.
   *   - previewPatternId=<id> — если у паттерна есть structure.apply,
   *     возвращает artifactAfter (обогащённые слоты).
   *
   * Зачем endpoint: UI Pattern Inspector (таск B3 плана) показывает, какие
   *   паттерны матчатся на реальной проекции, какие witnesses строятся,
   *   и позволяет preview-нуть structure.apply без модификации domain-кода.
   */
  router.get("/explain", async (req, res) => {
    const domainName = req.query.domain;
    const projectionId = req.query.projection;

    if (!domainName || !projectionId) {
      return res.status(400).json({
        error: "missing_params",
        message: "query-params ?domain= и ?projection= обязательны",
      });
    }

    const domain = await loadDomain(domainName);
    if (!domain) {
      return res.status(404).json({ error: "domain_not_found", domain: domainName });
    }

    const projection = domain.projections?.[projectionId];
    if (!projection) {
      return res.status(404).json({
        error: "projection_not_found",
        domain: domainName,
        projection: projectionId,
      });
    }

    // Передаём ВСЕ intents домена, не только по mainEntity: structure.apply
    // (напр. subcollections.apply → buildSection) ищет intents для sub-entities
    // (Position, Transaction, ...), которые отфильтровались бы по mainEntity.
    // Pattern trigger evaluation при этом работает как раньше — большинство
    // триггеров проверяют ontology-структуру, а не intent-scope.
    const intents = Object.entries(domain.intents || {})
      .map(([id, intent]) => ({ id, ...intent }));
    const includeNearMiss = req.query.includeNearMiss === "1";
    const previewPatternId = req.query.previewPatternId
      ? String(req.query.previewPatternId)
      : undefined;

    try {
      const result = explainMatch(
        intents,
        domain.ontology,
        { ...projection, id: projectionId },
        { includeNearMiss, previewPatternId },
      );

      // Аннотируем matched/nearMiss флагом hasApply: JSON.stringify роняет
      // function-ключи, поэтому structure.apply теряется при сериализации.
      // UI использует этот флаг, чтобы показать apply-badge и заблокировать
      // Preview radio для паттернов без apply-функции.
      const registry = getDefaultRegistry();
      const annotateHasApply = (entry) => {
        if (!entry?.pattern?.id) return;
        const full = registry.getPattern(entry.pattern.id);
        entry.pattern.hasApply = typeof full?.structure?.apply === "function";
      };
      (result?.structural?.matched || []).forEach(annotateHasApply);
      (result?.structural?.nearMiss || []).forEach(annotateHasApply);

      // slotAttribution — карта { slotPath → { patternId, action } } для
      // X-ray режима PatternInspector: какой паттерн породил/изменил каждый slot.
      let slotAttribution = {};
      try {
        slotAttribution = computeSlotAttribution(
          intents,
          domain.ontology,
          { ...projection, id: projectionId },
        );
      } catch (e) {
        console.warn(`[patterns] computeSlotAttribution(${domainName}/${projectionId}) failed:`, e.message);
      }

      res.json({ ...result, slotAttribution });
    } catch (err) {
      console.warn(`[patterns] explainMatch(${domainName}/${projectionId}) failed:`, err.message);
      res.status(500).json({ error: "explain_failed", reason: err.message });
    }
  });

  /**
   * GET /projections?domain=X — список id проекций домена.
   *
   * Используется UI-компонентом AppliesTo: сканировать все домены на предмет
   * матча конкретного паттерна требует итерации по проекциям. Прямого способа
   * получить список проекций у клиента нет (domain.js — ESM на диске), поэтому
   * сервер отдаёт плоский массив id через тот же loadDomain-кэш, что и другие
   * pattern-endpoint'ы.
   *
   * 400 — если ?domain= не передан; 404 — если домен не найден.
   */
  router.get("/projections", async (req, res) => {
    const domainName = req.query.domain;
    if (!domainName) {
      return res.status(400).json({
        error: "missing_params",
        message: "query-param ?domain= обязателен",
      });
    }
    const domain = await loadDomain(domainName);
    if (!domain) {
      return res.status(404).json({ error: "domain_not_found", domain: domainName });
    }
    const projections = Object.keys(domain.projections || {});
    res.json({ domain: domainName, projections });
  });

  /**
   * GET /heatmap — таблица actual для каждого ref-кандидата на каждой
   * host-projection. Куратор видит "этот pattern уже подходит к 5
   * проекциям host'а" → одна кнопка → bulk-promote. Cache в памяти
   * на process lifetime (refresh: ?force=1).
   *
   * Output: {
   *   domains: ["argocd", "automation", ...],
   *   projections: [{ domain, projection, mainEntity }, ...],
   *   patterns: [{
   *     id, archetype, refSource,
   *     matches: { "argocd/foo": "true"|"false"|"null", ... },
   *     stats: { match: N, miss: M, undecidable: K }
   *   }],
   * }
   *
   * Stable patterns пропускаются (для них уже есть proper falsification).
   * Domain.kind=meta тоже пропускаются (self-referential).
   */
  let _heatmapCache = null;
  router.get("/heatmap", async (req, res) => {
    if (_heatmapCache && req.query.force !== "1") {
      return res.json({ ...(_heatmapCache), cached: true });
    }
    try {
      loadCandidatesFromRefs();
    } catch (err) {
      return res.status(500).json({ error: "load_failed", reason: err.message });
    }
    const refs = getRefCandidates();
    const domainsRoot = path.join(__dirname, "..", "..", "src", "domains");
    let domainNames = [];
    try {
      domainNames = require("node:fs")
        .readdirSync(domainsRoot)
        .filter((d) => d !== "meta")
        .sort();
    } catch (err) {
      return res.status(500).json({ error: "domains_scan_failed", reason: err.message });
    }
    // Загружаем все домены параллельно (с кэшем — повторный вызов дёшев).
    const domains = await Promise.all(domainNames.map(loadDomain));
    const projectionList = [];
    for (let i = 0; i < domainNames.length; i++) {
      const d = domains[i];
      if (!d) continue;
      for (const [projId, proj] of Object.entries(d.projections || {})) {
        projectionList.push({
          key: `${domainNames[i]}/${projId}`,
          domain: domainNames[i],
          projection: projId,
          mainEntity: proj.mainEntity || null,
          _proj: proj,
          _intents: filterIntentsForProjection(d.intents, proj),
          _ontology: d.ontology,
        });
      }
    }
    const patterns = refs.map((p) => {
      const matches = {};
      const stats = { match: 0, miss: 0, undecidable: 0 };
      for (const pj of projectionList) {
        const r = evaluateGenericRequires(p.trigger, {
          intents: pj._intents,
          ontology: pj._ontology,
          projection: { ...pj._proj, id: pj.projection },
        });
        const v = r.matched === true ? "true" : r.matched === false ? "false" : "null";
        matches[pj.key] = v;
        if (v === "true") stats.match++;
        else if (v === "false") stats.miss++;
        else stats.undecidable++;
      }
      return {
        id: p.id,
        archetype: p.archetype || null,
        refSource: p.refSource || null,
        matches,
        stats,
      };
    });
    const result = {
      domains: domainNames,
      projections: projectionList.map(({ key, domain, projection, mainEntity }) => ({
        key,
        domain,
        projection,
        mainEntity,
      })),
      patterns,
      generatedAt: Date.now(),
    };
    _heatmapCache = result;
    res.json({ ...result, cached: false });
  });

  /**
   * POST /promote-and-pr — куратор тыкает кнопку → server делает PR в idf-sdk.
   *
   * Body: { patternId, summary?, branch? }
   *
   * Steps (в server/curatorPromoter.cjs):
   *   1. Read refs/candidates/<refSource> JSON.
   *   2. Generate candidate/<archetype>/<id>.js (export default JSON).
   *   3. Patch curated.js: import + entry в CURATED_CANDIDATES.
   *   4. Write .changeset/curator-<slug>.md (patch для @intent-driven/core).
   *   5. git checkout main; reset --hard origin/main; checkout -b feat/...
   *   6. git add / commit / push.
   *   7. gh pr create --base main.
   *   8. Return {prUrl, branch, log}.
   *
   * Required env: CURATOR_PR_ENABLED=1, IDF_SDK_PATH, gh authenticated.
   */
  router.post("/promote-and-pr", async (req, res) => {
    const { patternId, summary, branch, archetype } = req.body || {};
    if (!patternId) {
      return res.status(400).json({ error: "missing_patternId" });
    }
    // Make sure refs are loaded.
    try {
      loadCandidatesFromRefs();
    } catch (err) {
      return res.status(500).json({ error: "load_failed", reason: err.message });
    }
    const result = await promoteToSdkPr({ patternId, summary, branch, archetype });
    if (!result.ok) {
      const status =
        result.error === "disabled" ? 403 :
        result.error === "ref-not-found" ? 404 :
        result.error === "collision" ? 409 :
        result.error === "archetype-missing" || result.error === "unsupported-archetype" ? 400 :
        result.error === "sdk-path-missing" || result.error === "curated-js-missing" ? 503 :
        500;
      return res.status(status).json(result);
    }
    return res.json(result);
  });

  /**
   * POST /mark-shipped — recovery-route для промоушенов, чей PR смержен,
   * но shipped-effect не записан в Φ (старая версия server'а, рестарт в
   * середине auto-promote, ручной merge без curator workspace).
   *
   * Body: { patternId, sdkPrUrl, archetype, rationale? }
   * → пишет один effect ship_pattern_promotion + status=shipped в Φ.
   *
   * Без gating'а: это просто запись в локальный server/idf.db, без git
   * операций. CURATOR_PR_ENABLED не требуется.
   */
  router.post("/mark-shipped", (req, res) => {
    const { patternId, sdkPrUrl, archetype, sdkBranch, rationale } = req.body || {};
    if (!patternId || !sdkPrUrl) {
      return res.status(400).json({ error: "missing_params", message: "patternId и sdkPrUrl обязательны" });
    }
    try {
      const { randomUUID } = require("node:crypto");
      const dbMod = require("../db.js");
      const now = Date.now();
      const promotionId = randomUUID();
      const ctx = {
        id: promotionId,
        candidateId: patternId,
        targetArchetype: archetype || null,
        rationale: rationale || `Mark-shipped recovery: PR ${sdkPrUrl}`,
        status: "shipped",
        sdkPrUrl,
        sdkBranch: sdkBranch || null,
        weight: 50,
        requestedByUserId: "patternCurator",
        requestedAt: now,
        decidedAt: now,
      };
      dbMod.prepare(`
        INSERT INTO effects (id, intent_id, alpha, target, value, scope, status,
                             ttl, context, created_at, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
      `).run(
        randomUUID(), "ship_pattern_promotion", "create", "PatternPromotion",
        JSON.stringify(ctx), "account", "confirmed", JSON.stringify(ctx), now, now,
      );
      return res.json({ ok: true, promotionId });
    } catch (e) {
      return res.status(500).json({ error: "db_failed", message: e.message });
    }
  });

  /**
   * POST /preference — author-decision writer (§3.4, §16).
   *
   * Body: { domain, projection, patternId, action }
   *   action ∈ "enable" | "disable" | "clear"
   *
   * Пишет решение автора в `src/domains/<domain>/projections.js` через
   * AST-safe codemod (recast). Это preference, а не snapshot:
   * сохраняется комбинация `patterns.{enabled,disabled}`, из которой
   * кристаллизатор собирает эффективный набор паттернов для проекции.
   *
   * Dev-only: в production отдаёт 403 — писать на live-код с UI-кнопки
   * нельзя, это инструмент авторской среды (Studio).
   */
  router.post("/preference", express.json(), (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "dev-only" });
    }
    const { domain, projection, patternId, action } = req.body || {};
    if (!domain || !projection || !patternId || !action) {
      return res.status(400).json({ error: "missing fields" });
    }
    const filePath = path.resolve(
      process.cwd(),
      `src/domains/${domain}/projections.js`,
    );
    try {
      writePatternPreference(filePath, projection, patternId, action);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}

module.exports = { makePatternsRouter };
