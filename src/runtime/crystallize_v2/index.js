/**
 * crystallizeV2: INTENTS + PROJECTIONS + ONTOLOGY → { projId: artifact }.
 * M2: поддерживает архетипы feed, catalog, detail.
 * Артефакт содержит nav.outgoing/incoming из deriveNavGraph.
 */

import { assignToSlots } from "./assignToSlots.js";
import { hashInputs } from "./hash.js";
import { deriveNavGraph } from "./navGraph.js";
import { validateArtifact } from "../renderer/validation/validateArtifact.js";

const SUPPORTED_ARCHETYPES = new Set(["feed", "catalog", "detail"]);

export function crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, domainId = "unknown") {
  const artifacts = {};
  const inputsHash = hashInputs(INTENTS, PROJECTIONS, ONTOLOGY);
  const generatedAt = Date.now();
  const navGraph = deriveNavGraph(PROJECTIONS);

  for (const [projId, proj] of Object.entries(PROJECTIONS)) {
    const archetype = proj.kind || inferArchetype(proj);
    if (!SUPPORTED_ARCHETYPES.has(archetype)) {
      // dashboard и canvas — M3+
      continue;
    }

    const slots = assignToSlots(INTENTS, { ...proj, id: projId }, ONTOLOGY);

    // Прикрепить onItemClick к body-list, если есть исходящее item-click ребро.
    const outgoing = navGraph.edgesFrom(projId).filter(e => e.kind === "item-click");
    if (outgoing.length > 0 && slots.body?.type === "list") {
      const edge = outgoing[0];
      slots.body.onItemClick = {
        action: "navigate",
        to: edge.to,
        params: edge.params,
      };
    }

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
      nav: {
        outgoing: navGraph.edgesFrom(projId),
        incoming: navGraph.edgesTo(projId),
      },
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
  if (query.includes("список") || query.includes("все") || query.includes("беседы") || query.includes("контакты")) return "catalog";
  if (query.includes("один") || query.includes("детали") || query.includes("профиль")) return "detail";
  return "catalog";
}
