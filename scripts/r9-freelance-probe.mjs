/**
 * Проверка R9 impact на freelance: есть ли compositions в derived,
 * совпадает ли derived с authored после enrichment.
 */
import { deriveProjections, crystallizeV2 } from "@intent-driven/core";
import { INTENTS, ONTOLOGY, PROJECTIONS } from "../src/domains/freelance/domain.js";

const derived = deriveProjections(INTENTS, ONTOLOGY);

console.log("# Derived проекции с compositions:\n");
for (const [id, p] of Object.entries(derived)) {
  if (Array.isArray(p.compositions) && p.compositions.length > 0) {
    console.log(`${id.padEnd(28)} mainEntity=${p.mainEntity}  compositions=${p.compositions.length}`);
    for (const c of p.compositions) {
      console.log(`  ${c.as.padEnd(12)} via ${c.via.padEnd(14)} → ${c.entity} (${c.mode})`);
    }
  }
}

console.log("\n# Artifact.witnesses с R9:\n");
const artifacts = crystallizeV2(INTENTS, derived, ONTOLOGY, "freelance");
for (const [id, art] of Object.entries(artifacts)) {
  const r9 = art?.witnesses?.filter(w => w.ruleId === "R9") || [];
  if (r9.length > 0) {
    console.log(`${id.padEnd(28)} R9×${r9.length}  entities=[${(art.slots?.body?.entities || art.entities || []).join(", ")}]`);
  }
}

console.log("\n# Сравнение: authored multi-entity vs derived multi-entity\n");
const multiEntityAuthored = Object.entries(PROJECTIONS).filter(([, p]) => (p.entities || []).length > 1);
console.log("Authored с entities.length>1:");
for (const [id, p] of multiEntityAuthored) {
  console.log(`  ${id.padEnd(28)} kind=${p.kind}  main=${p.mainEntity}  entities=[${p.entities.join(", ")}]`);
  // Найдём эквивалент в derived
  const match = Object.entries(derived).find(([, d]) => d.mainEntity === p.mainEntity && d.kind === p.kind);
  if (match) {
    console.log(`    ↔ derived.${match[0].padEnd(22)} entities=[${match[1].entities.join(", ")}]  compositions=${match[1].compositions?.length || 0}`);
  } else {
    console.log(`    ↔ no derived equivalent`);
  }
}
