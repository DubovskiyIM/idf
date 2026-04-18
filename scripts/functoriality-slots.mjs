/**
 * Полный дамп слотов — проверить куда на самом деле уходит каждый intent.
 */
import { crystallizeV2 } from "@intent-driven/core";
import { INTENTS as workflowI, PROJECTIONS as workflowP, ONTOLOGY as workflowO } from "../src/domains/workflow/domain.js";
import { INTENTS as salesI, PROJECTIONS as salesP, ONTOLOGY as salesO } from "../src/domains/sales/domain.js";

function dump(name, intents, projections, ontology, projId) {
  const a = crystallizeV2(intents, projections, ontology, name)[projId];
  if (!a) return;
  console.log(`\n# ${name}.${projId} (${a.archetype})`);
  for (const [slotName, slot] of Object.entries(a.slots)) {
    if (!slot) continue;
    if (Array.isArray(slot) && slot.length === 0) continue;
    const items = Array.isArray(slot) ? slot : [slot];
    const ids = items.map(x => x?.intentId || x?.trigger?.intentId || x?.key || x?.type || "?").join(", ");
    console.log(`  ${slotName}: [${ids}]`);
  }
}

dump("workflow", workflowI, workflowP, workflowO, "workflow_list");
dump("sales", salesI, salesP, salesO, "listing_detail");
dump("sales", salesI, salesP, salesO, "listing_feed");
