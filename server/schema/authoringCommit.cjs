/**
 * Studio authoring commit — материализует spec в файл src/domains/<id>/domain.js.
 *
 * Файл — валидный ESM-модуль с named exports META / INTENTS / ONTOLOGY /
 * PROJECTIONS + default export. После записи ontologyRegistry должен быть
 * перезагружен — см. routes/studio-authoring.js integration с reloadDomain.
 */

const fs = require("node:fs/promises");
const path = require("node:path");

function serializeValue(value, indent = 0) {
  // JSON.stringify всё делает правильно для нашего content'а (JSON-совместимая спека)
  return JSON.stringify(value, null, 2);
}

async function finalizeDomain(spec, { targetDir }) {
  if (!spec || typeof spec !== "object") throw new Error("finalizeDomain: spec required");
  if (!targetDir) throw new Error("finalizeDomain: targetDir required");

  const intents = spec.INTENTS || {};
  const entities = spec.ONTOLOGY?.entities || {};

  if (Object.keys(intents).length === 0) {
    throw new Error("finalizeDomain: spec has no intents — cannot commit empty domain");
  }
  if (Object.keys(entities).length === 0) {
    throw new Error("finalizeDomain: spec has no entities — cannot commit empty domain");
  }

  await fs.mkdir(targetDir, { recursive: true });
  const filePath = path.join(targetDir, "domain.js");

  const meta = { ...(spec.meta || {}) };
  const ontology = {
    entities,
    roles: spec.ONTOLOGY?.roles || {},
    invariants: spec.ONTOLOGY?.invariants || [],
  };
  const projections = spec.PROJECTIONS || {};

  const body = `// Сгенерировано Studio authoring flow ${new Date().toISOString()}
// Domain: ${meta.id || "<unknown>"}
// Описание: ${(meta.description || "").replace(/\n/g, " ")}
//
// Не редактировать вручную — файл перезаписывается при следующем commit'е
// из Studio. Для ручных правок: скопируй в отдельный domain и переименуй id.

export const META = ${serializeValue(meta)};

export const INTENTS = ${serializeValue(intents)};

export const ONTOLOGY = ${serializeValue(ontology)};

export const PROJECTIONS = ${serializeValue(projections)};

export default { META, INTENTS, ONTOLOGY, PROJECTIONS };
`;

  await fs.writeFile(filePath, body, "utf8");
  return { path: filePath };
}

module.exports = { finalizeDomain };
