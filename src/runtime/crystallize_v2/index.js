/**
 * crystallizeV2: INTENTS + PROJECTIONS + ONTOLOGY → { projId: artifact }.
 * M1: поддерживает только архетип "feed". Остальные kinds возвращают пустой каркас.
 */

import { assignToSlots } from "./assignToSlots.js";
import { hashInputs } from "./hash.js";
import { validateArtifact } from "../renderer/validation/validateArtifact.js";

export function crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, domainId = "unknown") {
  const artifacts = {};
  const inputsHash = hashInputs(INTENTS, PROJECTIONS, ONTOLOGY);
  const generatedAt = Date.now();

  for (const [projId, proj] of Object.entries(PROJECTIONS)) {
    const archetype = proj.kind || inferArchetype(proj);
    if (archetype !== "feed") {
      // M1: только feed. Остальные будут в M2-M3.
      continue;
    }

    const slots = assignToSlots(INTENTS, { ...proj, id: projId }, ONTOLOGY);

    const artifact = {
      projection: projId,
      name: proj.name || projId,
      domain: domainId,
      layer: "canonical",
      archetype,
      version: 2,
      generatedAt,
      generatedBy: "rules",
      inputsHash,
      slots,
      nav: { outgoing: [], incoming: [] },
    };

    const validation = validateArtifact(artifact);
    if (!validation.ok) {
      console.warn(`[crystallize_v2] артефакт "${projId}" не прошёл валидацию:`, validation.errors);
    }

    artifacts[projId] = artifact;
  }

  return artifacts;
}

function inferArchetype(proj) {
  const query = (proj.query || "").toLowerCase();
  if (query.includes("сообщения") || query.includes("лента")) return "feed";
  if (query.includes("список") || query.includes("все")) return "catalog";
  if (query.includes("один") || query.includes("детали")) return "detail";
  return "catalog";
}
