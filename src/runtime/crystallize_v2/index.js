/**
 * crystallizeV2: INTENTS + PROJECTIONS + ONTOLOGY → { projId: artifact }.
 * Поддерживает архетипы feed, catalog, detail, form.
 * Артефакт содержит nav.outgoing/incoming из deriveNavGraph.
 *
 * M3.4b: автогенерация синтетических edit-проекций (kind: form) из
 * detail-проекций через generateEditProjections. §16 манифеста:
 * «производные проекции».
 */

import { assignToSlots } from "./assignToSlots.js";
import { hashInputs } from "./hash.js";
import { deriveNavGraph } from "./navGraph.js";
import { generateEditProjections, buildFormSpec } from "./formGrouping.js";
import { validateArtifact } from "../renderer/validation/validateArtifact.js";

const SUPPORTED_ARCHETYPES = new Set(["feed", "catalog", "detail", "form"]);

export function crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, domainId = "unknown") {
  const artifacts = {};

  // Автогенерация edit-проекций (М3.4b)
  const editProjections = generateEditProjections(INTENTS, PROJECTIONS, ONTOLOGY);
  const allProjections = { ...PROJECTIONS, ...editProjections };

  const inputsHash = hashInputs(INTENTS, allProjections, ONTOLOGY);
  const generatedAt = Date.now();
  const navGraph = deriveNavGraph(allProjections);

  for (const [projId, proj] of Object.entries(allProjections)) {
    const archetype = proj.kind || inferArchetype(proj);
    if (!SUPPORTED_ARCHETYPES.has(archetype)) {
      // dashboard, canvas — будущие M
      continue;
    }

    let slots;
    if (archetype === "form") {
      // Form-архетип: не проходит через обычный assignToSlots.
      // body — formSpec (fields для ArchetypeForm), остальные слоты пустые.
      const formSpec = buildFormSpec(proj, INTENTS, ONTOLOGY, "self");
      slots = {
        header: [],
        toolbar: [],
        body: { type: "formBody", ...formSpec },
        context: [],
        fab: [],
        overlay: [],
      };
    } else {
      slots = assignToSlots(INTENTS, { ...proj, id: projId }, ONTOLOGY);
    }

    // onItemClick: (1) явно объявленный автором в проекции, (2) выведенный из navGraph.
    if (slots.body?.type === "list") {
      if (proj.onItemClick) {
        slots.body.onItemClick = proj.onItemClick;
      } else {
        const outgoing = navGraph.edgesFrom(projId).filter(e => e.kind === "item-click");
        if (outgoing.length > 0) {
          const edge = outgoing[0];
          slots.body.onItemClick = {
            action: "navigate",
            to: edge.to,
            params: edge.params,
          };
        }
      }
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
      // Для detail: ссылка на соответствующую edit-проекцию (если есть)
      editProjection: editProjections[projId + "_edit"] ? (projId + "_edit") : null,
      // Для form: ссылка на исходную detail
      sourceProjection: proj.sourceProjection || null,
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
