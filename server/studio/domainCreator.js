const fs = require("fs");
const path = require("path");

const DOMAINS_DIR = path.resolve(__dirname, "..", "..", "src", "domains");

function createDomainSkeleton(name, description = "") {
  if (!/^[a-z_][a-z0-9_-]*$/.test(name)) {
    throw new Error(`invalid name: ${name}`);
  }
  const dir = path.join(DOMAINS_DIR, name);
  if (fs.existsSync(dir)) {
    throw new Error(`domain "${name}" already exists`);
  }
  fs.mkdirSync(dir);

  fs.writeFileSync(path.join(dir, "intents.js"), `export const INTENTS = {\n};\n`);
  fs.writeFileSync(path.join(dir, "ontology.js"), `export const ONTOLOGY = {\n  entities: {},\n  roles: {},\n};\n`);
  fs.writeFileSync(path.join(dir, "projections.js"), `export const PROJECTIONS = {};\nexport const ROOT_PROJECTIONS = [];\n`);
  fs.writeFileSync(path.join(dir, "domain.js"), `/**
 * Домен: ${description || name}
 */
export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";

export const DOMAIN_ID = "${name}";
export const DOMAIN_NAME = ${JSON.stringify(description || name)};
`);
}

module.exports = { createDomainSkeleton };
