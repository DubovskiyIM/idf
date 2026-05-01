/**
 * specSerializer — read/write IDF spec в файл src/domains/<id>/domain.js.
 *
 * loadSpecFromFile(path) — dynamic import ESM, возвращает {meta, INTENTS, ONTOLOGY, PROJECTIONS}.
 * saveSpecToFile(spec, path) — пишет валидный ESM-модуль (re-uses finalizeDomain).
 */

const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { finalizeDomain } = require("./authoringCommit.cjs");

async function loadSpecFromFile(filePath) {
  await fs.access(filePath); // throws ENOENT
  // Cache-bust через query-param: иначе повторные load'ы дают stale module.
  const url = pathToFileURL(filePath).href + `?t=${Date.now()}`;
  const mod = await import(url);
  const META = mod.META || mod.default?.META || { id: path.basename(path.dirname(filePath)) };
  const INTENTS = mod.INTENTS || mod.default?.INTENTS || {};
  const ONTOLOGY = mod.ONTOLOGY || mod.default?.ONTOLOGY || { entities: {}, roles: {}, invariants: [] };
  const PROJECTIONS = mod.PROJECTIONS || mod.default?.PROJECTIONS || {};
  return {
    meta: META,
    INTENTS,
    ONTOLOGY: {
      entities: ONTOLOGY.entities || {},
      roles: ONTOLOGY.roles || {},
      invariants: ONTOLOGY.invariants || [],
    },
    PROJECTIONS,
  };
}

async function saveSpecToFile(spec, filePath) {
  const targetDir = path.dirname(filePath);
  await finalizeDomain(spec, { targetDir });
  return { path: filePath };
}

module.exports = { loadSpecFromFile, saveSpecToFile };
