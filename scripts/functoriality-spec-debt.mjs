/**
 * Дамп «spec debt» — количество alphabetical-fallback witnesses per проекция.
 *
 * alphabetical-fallback witness возникает, когда crystallize вынужден делать
 * выбор между intent'ами с равным salience через алфавитный tiebreak. Это
 * детерминированный выбор, но семантически пустой — автор не объявил
 * приоритет явно. Каждая такая запись — маркер неполноты спецификации.
 *
 * Вывод показывает, сколько «spec smells» в каждом домене. Цель — 0.
 */
import { crystallizeV2 } from "@intent-driven/core";
import { INTENTS as bookingI, PROJECTIONS as bookingP, ONTOLOGY as bookingO } from "../src/domains/booking/domain.js";
import { INTENTS as planningI, PROJECTIONS as planningP, ONTOLOGY as planningO } from "../src/domains/planning/domain.js";
import { INTENTS as workflowI, PROJECTIONS as workflowP, ONTOLOGY as workflowO } from "../src/domains/workflow/domain.js";
import { INTENTS as messengerI, PROJECTIONS as messengerP, ONTOLOGY as messengerO } from "../src/domains/messenger/domain.js";
import { INTENTS as salesI, PROJECTIONS as salesP, ONTOLOGY as salesO } from "../src/domains/sales/domain.js";
import { INTENTS as lifequestI, PROJECTIONS as lifequestP, ONTOLOGY as lifequestO } from "../src/domains/lifequest/domain.js";
import { INTENTS as reflectI, PROJECTIONS as reflectP, ONTOLOGY as reflectO } from "../src/domains/reflect/domain.js";
import { INTENTS as investI, PROJECTIONS as investP, ONTOLOGY as investO } from "../src/domains/invest/domain.js";
import { INTENTS as deliveryI, PROJECTIONS as deliveryP, ONTOLOGY as deliveryO } from "../src/domains/delivery/domain.js";

const DOMAINS = [
  { id: "booking", I: bookingI, P: bookingP, O: bookingO },
  { id: "planning", I: planningI, P: planningP, O: planningO },
  { id: "workflow", I: workflowI, P: workflowP, O: workflowO },
  { id: "messenger", I: messengerI, P: messengerP, O: messengerO },
  { id: "sales", I: salesI, P: salesP, O: salesO },
  { id: "lifequest", I: lifequestI, P: lifequestP, O: lifequestO },
  { id: "reflect", I: reflectI, P: reflectP, O: reflectO },
  { id: "invest", I: investI, P: investP, O: investO },
  { id: "delivery", I: deliveryI, P: deliveryP, O: deliveryO },
];

let grandTotal = 0;
const topWorst = [];

for (const d of DOMAINS) {
  const art = crystallizeV2(d.I, d.P, d.O, d.id);
  let domainTotal = 0;
  const details = [];
  for (const [projId, a] of Object.entries(art)) {
    if (!a?.witnesses) continue;
    const fallbacks = a.witnesses.filter(w => w.basis === "alphabetical-fallback");
    if (fallbacks.length > 0) {
      domainTotal += fallbacks.length;
      details.push({ projId, count: fallbacks.length, sample: fallbacks[0] });
      topWorst.push({ domain: d.id, projId, count: fallbacks.length, sample: fallbacks[0] });
    }
  }
  grandTotal += domainTotal;
  console.log(`${d.id.padEnd(12)} fallback-witnesses=${domainTotal}`);
  for (const det of details.slice(0, 3)) {
    const { chosen, peers, salience } = det.sample;
    console.log(`  ${det.projId.padEnd(32)} ×${det.count}  [${salience}] ${chosen} ← [${peers.join(", ")}]`);
  }
}

console.log(`\n# Грандтотал: ${grandTotal} alphabetical-fallback witnesses по 9 доменам`);
console.log(`# Цель: 0 (все ties разрешены explicit intent.salience)`);

topWorst.sort((a, b) => b.count - a.count);
console.log(`\n# Top-5 проекций с наибольшим spec debt:`);
for (const w of topWorst.slice(0, 5)) {
  console.log(`  ${w.domain}.${w.projId}: ${w.count} ties`);
}
