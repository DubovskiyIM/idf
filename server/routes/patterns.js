/**
 * /api/patterns — Pattern Bank surface (§UX Pattern Layer, v1.8).
 *
 * GET /catalog — сериализованный каталог всех паттернов реестра (stable /
 *   candidate / anti). Клиент получает достаточно данных для UI Pattern Bank:
 *   trigger (requires + matchSource), structure (slot + description + applySource),
 *   rationale, falsification, hasApply-флаг.
 *
 * Функции trigger.match и structure.apply сериализуются как строки (их .toString()),
 * чтобы UI мог показать исходник правил; исполнение — только серверное.
 */

const { Router } = require("express");
const { getDefaultRegistry, loadStablePatterns } = require("@intent-driven/core");

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

  return router;
}

module.exports = { makePatternsRouter };
