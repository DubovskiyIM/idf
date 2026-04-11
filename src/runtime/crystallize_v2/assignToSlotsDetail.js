/**
 * §3.1 дизайна (detail-ветвь): слоты detail-архетипа.
 */

import { inferParameters } from "./inferParameters.js";
import { inferControlType } from "./inferControlType.js";
import { wrapByConfirmation } from "./wrapByConfirmation.js";
import {
  needsCustomCapture,
  needsEntityPicker,
  isUnsupportedInM2,
} from "./assignToSlotsShared.js";

const SYSTEM_DETAIL_FIELDS = new Set([
  "id", "createdAt", "updatedAt", "deletedAt", "deletedFor",
]);

export function assignToSlotsDetail(INTENTS, projection, ONTOLOGY) {
  const slots = {
    header: [],
    toolbar: [],
    body: buildDetailBody(projection, ONTOLOGY),
    context: [],
    fab: [],
    overlay: [],
  };

  const mainEntity = projection.mainEntity;
  if (!mainEntity) return slots;

  for (const [id, intent] of Object.entries(INTENTS)) {
    if (isUnsupportedInM2(id)) continue;
    if (!appliesToMainEntity(intent, mainEntity)) continue;
    if (needsCustomCapture(intent)) continue;
    if (needsEntityPicker(intent, projection)) continue;

    // Read-only intents без эффектов не применяются к detail
    const hasEffects = (intent.particles?.effects || []).length > 0;
    if (!hasEffects) continue;

    // Creator-интент не применяется к detail проекции чужой сущности
    if (intent.creates && intent.creates !== mainEntity) continue;

    const parameters = inferParameters(intent, ONTOLOGY).map(p => ({
      ...p,
      control: inferControlType(p, ONTOLOGY),
    }));

    const wrapped = wrapByConfirmation(intent, id, parameters);
    if (wrapped === null) continue;
    if (wrapped.type === "composerEntry") continue;

    const hasOverlay = wrapped.trigger && wrapped.overlay;

    if (hasOverlay) {
      slots.toolbar.push(wrapped.trigger);
      slots.overlay.push(wrapped.overlay);
      continue;
    }

    if (wrapped.type === "intentButton") {
      slots.toolbar.push(wrapped);
    }
  }

  if (slots.toolbar.length > 5) {
    const overflow = slots.toolbar.splice(5);
    slots.toolbar.push({ type: "overflow", children: overflow });
  }

  return slots;
}

function appliesToMainEntity(intent, mainEntity) {
  const intentEntities = (intent.particles?.entities || [])
    .map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
  return intentEntities.includes(mainEntity);
}

function buildDetailBody(projection, ONTOLOGY) {
  const mainEntity = projection.mainEntity;
  const entity = ONTOLOGY?.entities?.[mainEntity];
  const fields = (entity?.fields || []).filter(f => !SYSTEM_DETAIL_FIELDS.has(f));

  const children = [];

  if (fields.includes("avatar")) {
    children.push({ type: "avatar", bind: "avatar", size: 96 });
  }

  if (fields.includes("name")) {
    children.push({ type: "heading", bind: "name", level: 1 });
  } else if (fields.includes("title")) {
    children.push({ type: "heading", bind: "title", level: 1 });
  }

  for (const field of fields) {
    if (field === "avatar" || field === "name" || field === "title") continue;
    children.push({
      type: "row",
      gap: 8,
      children: [
        { type: "text", content: field + ":", style: "secondary" },
        { type: "text", bind: field },
      ],
    });
  }

  return {
    type: "column",
    gap: 12,
    children,
  };
}
