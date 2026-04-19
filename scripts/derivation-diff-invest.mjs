/**
 * Derivation diff для invest — та же логика, что в derivation-diff-sales,
 * но на domain-heavy авторском домене (AntD enterprise-fintech).
 *
 * Гипотеза: в invest много dashboard'ов и canvas-проекций, Layer 1 покроет
 * меньше. Проверяем — сколько derived vs authored, какие архетипы.
 */
// Требует @intent-driven/core >= 0.17 (PR #61). До release — запустить через
// npm link или указать sibling worktree-путь локально.
import { deriveProjections } from "@intent-driven/core";
import { INTENTS, PROJECTIONS, ONTOLOGY } from "../src/domains/invest/domain.js";

const derived = deriveProjections(INTENTS, ONTOLOGY);
const authoredIds = new Set(Object.keys(PROJECTIONS));
const derivedIds  = new Set(Object.keys(derived));

const onlyAuthored = [...authoredIds].filter(id => !derivedIds.has(id));
const onlyDerived  = [...derivedIds].filter(id => !authoredIds.has(id));
const shared       = [...authoredIds].filter(id =>  derivedIds.has(id));

console.log(`# invest — derivation diff\n`);
console.log(`authored:      ${authoredIds.size}`);
console.log(`derived:       ${derivedIds.size}`);
console.log(`shared id:     ${shared.length}`);
console.log(`only authored: ${onlyAuthored.length}`);
console.log(`only derived:  ${onlyDerived.length}`);

// Разбивка authored по архетипам — сколько «невыводимых» (dashboard/canvas/wizard/form)
const archetypes = {};
for (const id of authoredIds) {
  const k = PROJECTIONS[id].kind || "other";
  archetypes[k] = (archetypes[k] || 0) + 1;
}
console.log(`\n## Authored по архетипам:`);
for (const [k, c] of Object.entries(archetypes).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(12)} ${c}`);
}

// Quick hypothesis: derived проекции (catalog/detail) могли бы заменить authored
// через rename (as:). Найдём: для каждого authored с mainEntity X и kind catalog/detail,
// есть ли derived с тем же (mainEntity, kind)?
console.log(`\n## Authored которые ПОКРЫВАЮТСЯ деривацией (через rename)`);
let coveredByDerived = 0;
const coverageCandidates = [];
for (const id of authoredIds) {
  const a = PROJECTIONS[id];
  if (!a.kind || !["catalog", "feed", "detail"].includes(a.kind)) continue;
  if (!a.mainEntity) continue;
  // Ищем derived с тем же (kind, mainEntity)
  for (const [dId, d] of Object.entries(derived)) {
    if (d.kind === a.kind && d.mainEntity === a.mainEntity && dId !== id) {
      // Дополнительно — совпадение фильтра (my_ vs общий)
      const aHasFilter = !!a.filter;
      const dHasFilter = !!d.filter;
      if (aHasFilter !== dHasFilter) continue;
      coveredByDerived++;
      coverageCandidates.push({ authored: id, derived: dId, kind: a.kind, entity: a.mainEntity });
      break;
    }
  }
}
console.log(`  ${coveredByDerived} из ${authoredIds.size} authored можно получить через rename derived`);
for (const c of coverageCandidates) {
  console.log(`    ${c.authored.padEnd(28)} ← rename(${c.derived})  [${c.kind}/${c.entity}]`);
}

// Архетип-free остаток (dashboard, canvas, wizard, form) — Layer 2 EXTRA
const layer2 = [...authoredIds].filter(id => {
  const k = PROJECTIONS[id].kind;
  return ["dashboard", "canvas", "wizard", "form"].includes(k);
});
console.log(`\n## Layer 2 EXTRA (архетип без R-правила):`);
for (const id of layer2) {
  console.log(`  ${id.padEnd(28)} kind=${PROJECTIONS[id].kind}`);
}

// Гипотетический override-coefficient v2
const layer1 = coveredByDerived;
const layer2Count = layer2.length;
const uncovered = authoredIds.size - layer1 - layer2Count;
const totalNew = layer1 + layer2Count + uncovered;
const odebt = (layer2Count / totalNew).toFixed(2);

console.log(`\n## Потенциальный override-coefficient v2 для invest:`);
console.log(`  Layer 1 (override поверх derived): ${layer1}`);
console.log(`  Layer 2 (hand-authored exception): ${layer2Count}`);
console.log(`  Uncovered (ни derivation, ни Layer 2): ${uncovered}`);
console.log(`  spec-debt = Layer 2 / total = ${layer2Count} / ${totalNew} = ${odebt}`);
console.log(`  baseline v1 (authored / total):     ${(authoredIds.size / authoredIds.size).toFixed(2)} = 1.00`);
