/**
 * Дамп toolbar[0..N] всех projection'ов во всех доменах.
 * Позволяет быстро увидеть, где primary intent неоптимален.
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

for (const d of DOMAINS) {
  const art = crystallizeV2(d.I, d.P, d.O, d.id);
  console.log(`\n=== ${d.id} ===`);
  for (const [projId, a] of Object.entries(art)) {
    if (!a?.slots?.toolbar) continue;
    if (!Array.isArray(a.slots.toolbar) || a.slots.toolbar.length === 0) continue;
    const ids = a.slots.toolbar.map(t =>
      t.intentId
        ? `${t.intentId}${t.salience !== undefined ? `(${t.salience})` : ""}`
        : t.type
    );
    console.log(`  ${projId.padEnd(35)} [${a.archetype}] ${ids.join(", ")}`);
  }
}
