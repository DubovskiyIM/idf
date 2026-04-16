const path = require("path");
const { pathToFileURL } = require("url");

function normalizeFields(fields) {
  if (Array.isArray(fields)) {
    return fields.map((name) => ({ name, type: "unknown" }));
  }
  return Object.entries(fields || {}).map(([name, spec]) => ({
    name,
    type: spec?.type || "unknown",
    label: spec?.label,
    read: spec?.read,
    write: spec?.write,
  }));
}

async function importDomain(domainName) {
  const entry = path.resolve(__dirname, "..", "..", "src", "domains", domainName, "domain.js");
  const url = pathToFileURL(entry).href + `?t=${Date.now()}`;
  return await import(url);
}

async function buildGraph(domainName) {
  const mod = await importDomain(domainName);
  const ONTOLOGY = mod.ONTOLOGY || {};
  const INTENTS = mod.INTENTS || {};

  const nodes = [];
  const edges = [];

  for (const [entityName, entity] of Object.entries(ONTOLOGY.entities || {})) {
    nodes.push({
      id: `entity:${entityName}`,
      kind: "entity",
      name: entityName,
      entityKind: entity.type || "internal",
      ownerField: entity.ownerField || null,
      fields: normalizeFields(entity.fields),
      statuses: entity.statuses || null,
    });
  }

  for (const [intentId, intent] of Object.entries(INTENTS)) {
    nodes.push({
      id: `intent:${intentId}`,
      kind: "intent",
      name: intent.name || intentId,
      intentId,
      particles: intent.particles || {},
      antagonist: intent.antagonist || null,
      creates: intent.creates || null,
    });
  }

  return { domain: domainName, nodes, edges, warnings: [] };
}

module.exports = { buildGraph };
