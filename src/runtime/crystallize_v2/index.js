/**
 * crystallizeV2: INTENTS + PROJECTIONS + ONTOLOGY → { projId: artifact }.
 *
 * Поддерживает 6 архетипов: feed, catalog, detail, form, canvas, dashboard.
 * Артефакт содержит nav.outgoing/incoming из deriveNavGraph.
 * Автогенерация синтетических edit-проекций (kind: form) из detail-проекций.
 *
 * @module crystallize_v2
 */

/** @typedef {import('../../types/idf.d.ts').IntentsMap} IntentsMap */
/** @typedef {import('../../types/idf.d.ts').ProjectionsMap} ProjectionsMap */
/** @typedef {import('../../types/idf.d.ts').Ontology} Ontology */
/** @typedef {import('../../types/idf.d.ts').Artifact} Artifact */

import { assignToSlots } from "./assignToSlots.js";
import { hashInputs } from "./hash.js";
import { deriveNavGraph } from "./navGraph.js";
import { generateEditProjections, buildFormSpec } from "./formGrouping.js";
import { validateArtifact } from "../renderer/validation/validateArtifact.js";

const SUPPORTED_ARCHETYPES = new Set(["feed", "catalog", "detail", "form", "canvas", "dashboard"]);

/**
 * Кристаллизация: INTENTS + PROJECTIONS + ONTOLOGY → артефакты v2.
 *
 * @param {IntentsMap} INTENTS — определения намерений домена
 * @param {ProjectionsMap} PROJECTIONS — определения проекций домена
 * @param {Ontology} ONTOLOGY — онтология домена
 * @param {string} [domainId] — идентификатор домена
 * @returns {Record<string, Artifact>} — артефакты по projection id
 */
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
    } else if (archetype === "canvas") {
      // Canvas-архетип: минимальный артефакт, рендер делегируется domain-specific компоненту.
      slots = {
        header: [],
        toolbar: [],
        body: { type: "canvas", mainEntity: proj.mainEntity },
        context: [],
        fab: [],
        overlay: [],
      };
    } else if (archetype === "dashboard") {
      // Dashboard-архетип: widgets — массив ссылок на другие проекции.
      slots = {
        header: [],
        toolbar: [],
        body: { type: "dashboard", widgets: proj.widgets || [] },
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

    // postCreate: дополнить heroCreate nav-данными из nav-графа
    if (slots.hero) {
      for (const hero of slots.hero) {
        if (hero.postCreate && !hero.postCreate.navigateTo) {
          const detailEdge = navGraph.edges.find(e =>
            e.kind === "edit-action" && allProjections[e.from]?.mainEntity === proj.mainEntity
          );
          if (detailEdge) {
            hero.postCreate.navigateTo = detailEdge.to;
            hero.postCreate.idParam = Object.keys(detailEdge.params)[0];
          }
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
