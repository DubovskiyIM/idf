/**
 * Минимальный воспроизводящий пример — взять один проблемный случай
 * и показать: какие intent'ы конкурируют за слот, какая логика выбирает.
 */
import { crystallizeV2 } from "@intent-driven/core";
import { INTENTS as workflowI, PROJECTIONS as workflowP, ONTOLOGY as workflowO } from "../src/domains/workflow/domain.js";
import { INTENTS as salesI, PROJECTIONS as salesP, ONTOLOGY as salesO } from "../src/domains/sales/domain.js";

function permute(obj) {
  const keys = Object.keys(obj).reverse(); // максимально отличное от исходного
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

function inspect(name, intents, projections, ontology, projId) {
  const a = crystallizeV2(intents, projections, ontology, name);
  const b = crystallizeV2(permute(intents), projections, ontology, name);
  console.log(`\n# ${name}.${projId}`);
  console.log("baseline toolbar:", JSON.stringify(a[projId]?.slots?.toolbar?.map(t => ({
    intentId: t.intentId, key: t.key, type: t.type,
  })), null, 2));
  console.log("permuted toolbar:", JSON.stringify(b[projId]?.slots?.toolbar?.map(t => ({
    intentId: t.intentId, key: t.key, type: t.type,
  })), null, 2));
}

inspect("workflow", workflowI, workflowP, workflowO, "workflow_list");
inspect("sales", salesI, salesP, salesO, "listing_detail");
