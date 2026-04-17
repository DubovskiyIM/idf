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

const { Router } = require("express");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  getDefaultRegistry,
  loadStablePatterns,
  evaluateTriggerExplained,
  explainMatch,
} = require("@intent-driven/core");

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
    const projections = mod.PROJECTIONS || {};
    if (!ontology) {
      DOMAIN_CACHE.set(domainName, null);
      return null;
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
    // (registerPattern проверяет getPattern перед вставкой).
    const registry = getDefaultRegistry();
    try {
      loadStablePatterns(registry);
    } catch (err) {
      return res.status(500).json({ error: "pattern_bank_load_failed", reason: err.message });
    }
    const { stable, candidate, anti } = collectByStatus(registry);
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
    } catch (err) {
      return res.status(500).json({ error: "pattern_bank_load_failed", reason: err.message });
    }

    const pattern = registry.getPattern(id);
    if (!pattern) {
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

    const intents = filterIntentsForProjection(domain.intents, projection);
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
      res.json(result);
    } catch (err) {
      console.warn(`[patterns] explainMatch(${domainName}/${projectionId}) failed:`, err.message);
      res.status(500).json({ error: "explain_failed", reason: err.message });
    }
  });

  return router;
}

module.exports = { makePatternsRouter };
