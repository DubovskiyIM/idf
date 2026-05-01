// Quick-dump world-keys для gravitino после seed — чтобы увидеть,
// под какими именами коллекций эффекты складываются в мир.
import { fold, buildTypeMap } from "@intent-driven/core";
import { getSeedEffects } from "../src/domains/gravitino/seed.js";
import { ONTOLOGY } from "../src/domains/gravitino/ontology.js";

const seed = getSeedEffects();
const typeMap = buildTypeMap(ONTOLOGY);
console.log("typeMap:", typeMap);
console.log(`seed effects: ${seed.length}`);
console.log("first 3 effects:", seed.slice(0, 3).map(e => ({ target: e.target, ctxId: e.context?.id })));
const world = fold(seed, typeMap);
console.log("world keys:", Object.keys(world));
for (const [k, v] of Object.entries(world)) {
  console.log(`  ${k}: ${Array.isArray(v) ? v.length : typeof v}`);
}
