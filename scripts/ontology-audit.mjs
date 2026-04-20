/**
 * Ontology audit — поиск FK-полей с неверной типизацией.
 *
 * Ищем поля вида `<entityName>Id: { type: "text" }`, где `<entityName>`
 * совпадает с именем существующей сущности в онтологии. Такие поля
 * должны быть `type: "entityRef"` — это позволяет `detectForeignKeys`
 * их находить, R1b детектировать read-only catalog'и, invariants
 * работать правильно.
 *
 * Выход — список кандидатов на изменение типа. Конверсия `"text"` →
 * `"entityRef"` → закрытие U проекций, предсказанное R1b-spec'ом.
 */
import { INTENTS as bookingI, PROJECTIONS as bookingP, ONTOLOGY as bookingO } from "../src/domains/booking/domain.js";
import { INTENTS as planningI, PROJECTIONS as planningP, ONTOLOGY as planningO } from "../src/domains/planning/domain.js";
import { INTENTS as workflowI, PROJECTIONS as workflowP, ONTOLOGY as workflowO } from "../src/domains/workflow/domain.js";
import { INTENTS as messengerI, PROJECTIONS as messengerP, ONTOLOGY as messengerO } from "../src/domains/messenger/domain.js";
import { INTENTS as salesI, PROJECTIONS as salesP, ONTOLOGY as salesO } from "../src/domains/sales/domain.js";
import { INTENTS as lifequestI, PROJECTIONS as lifequestP, ONTOLOGY as lifequestO } from "../src/domains/lifequest/domain.js";
import { INTENTS as reflectI, PROJECTIONS as reflectP, ONTOLOGY as reflectO } from "../src/domains/reflect/domain.js";
import { INTENTS as investI, PROJECTIONS as investP, ONTOLOGY as investO } from "../src/domains/invest/domain.js";
import { INTENTS as deliveryI, PROJECTIONS as deliveryP, ONTOLOGY as deliveryO } from "../src/domains/delivery/domain.js";
import { INTENTS as freelanceI, PROJECTIONS as freelanceP, ONTOLOGY as freelanceO } from "../src/domains/freelance/domain.js";

const DOMAINS = [
  { id: "booking",   O: bookingO },
  { id: "planning",  O: planningO },
  { id: "workflow",  O: workflowO },
  { id: "messenger", O: messengerO },
  { id: "sales",     O: salesO },
  { id: "lifequest", O: lifequestO },
  { id: "reflect",   O: reflectO },
  { id: "invest",    O: investO },
  { id: "delivery",  O: deliveryO },
  { id: "freelance", O: freelanceO },
];

console.log(`# Ontology audit — FK-поля с неверной типизацией\n`);

let totalFindings = 0;
const perDomain = [];
const entityTypeGain = {};   // entityName → set of domains where gaining type:entityRef would make R1b fire

for (const d of DOMAINS) {
  const entities = d.O.entities || {};
  const entityNames = Object.keys(entities);
  const findings = [];

  for (const [entityName, entityDef] of Object.entries(entities)) {
    const fields = entityDef.fields || {};
    if (Array.isArray(fields)) continue;

    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      if (fieldName === "id") continue;
      if (!fieldName.endsWith("Id")) continue;

      const refName = fieldName.replace(/Id$/, "");
      const refersTo = entityNames.find(e => e.toLowerCase() === refName.toLowerCase());
      if (!refersTo) continue;  // поле <x>Id, но нет такой entity — не FK

      const currentType = fieldDef.type;
      if (currentType !== "entityRef") {
        findings.push({
          entity: entityName,
          field: fieldName,
          currentType: currentType || "(missing)",
          refersTo,
        });
        // Отметим цель — если она получит entityRef-backlink, R1b сможет её детектировать
        if (!entityTypeGain[refersTo]) entityTypeGain[refersTo] = new Set();
        entityTypeGain[refersTo].add(d.id);
      }
    }
  }

  totalFindings += findings.length;
  perDomain.push({ id: d.id, findings });
  if (findings.length > 0) {
    console.log(`## ${d.id} (${findings.length} findings)`);
    for (const f of findings) {
      console.log(`  ${f.entity}.${f.field.padEnd(16)} ${(f.currentType === "entityRef" ? "" : `type:"${f.currentType}"`).padEnd(20)} → ожидается type:"entityRef"  (ссылается на ${f.refersTo})`);
    }
    console.log();
  }
}

console.log(`\n## Сводка`);
console.log(`  Всего findings: ${totalFindings}`);
console.log(`  По доменам: ${perDomain.filter(d => d.findings.length > 0).map(d => `${d.id}:${d.findings.length}`).join(", ")}`);

console.log(`\n## Entities, которые получили бы R1b-coverage после fix`);
for (const [entity, domains] of Object.entries(entityTypeGain).sort()) {
  console.log(`  ${entity.padEnd(22)} ← referenced в: ${[...domains].join(", ")}`);
}

console.log(`\n## Ожидаемый impact на uncovered`);
console.log(`  Текущий U (после R1b): 23`);
console.log(`  Из них ontology-gap candidates (R1b-ready после fix):`);
const expectedClose = [
  { domain: "booking",   proj: "service_catalog",   entity: "Service" },
  { domain: "delivery",  proj: "couriers_list",     entity: "Courier" },
  { domain: "delivery",  proj: "zones_catalog",     entity: "Zone" },
  { domain: "invest",    proj: "asset_detail",      entity: "Asset" },  // уже сработал для catalog
  { domain: "lifequest", proj: "badge_list",        entity: "Badge" },
];
for (const c of expectedClose) {
  const gained = entityTypeGain[c.entity];
  const marker = gained ? "✓" : "?";
  console.log(`    ${marker} ${c.domain}.${c.proj}  (${c.entity})`);
}
