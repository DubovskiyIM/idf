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
import { getEntityFields, canRead } from "./ontologyHelpers.js";

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

    const wrapped = wrapByConfirmation(intent, id, parameters, { projection });
    if (wrapped === null) continue;
    if (wrapped.type === "composerEntry") continue;

    const hasOverlay = wrapped.trigger && wrapped.overlay;
    // Ownership-условие: для detail mainEntity (напр. User) write-intent'ы
    // должны быть доступны только owner'у. SlotRenderer у атомов проверяет
    // item.condition как JS-выражение с ctx = {...contextItem, viewer, world}.
    // Хардкод для User: id === viewer.id. В M4 вынести в ontology.ownerField.
    const ownershipCond = ownershipConditionFor(intent, mainEntity);

    if (hasOverlay) {
      const trigger = ownershipCond
        ? { ...wrapped.trigger, condition: ownershipCond }
        : wrapped.trigger;
      slots.toolbar.push(trigger);
      slots.overlay.push(wrapped.overlay);
      continue;
    }

    if (wrapped.type === "intentButton") {
      const btn = ownershipCond
        ? { ...wrapped, condition: ownershipCond }
        : wrapped;
      slots.toolbar.push(btn);
    }
  }

  if (slots.toolbar.length > 5) {
    const overflow = slots.toolbar.splice(5);
    slots.toolbar.push({ type: "overflow", children: overflow });
  }

  return slots;
}

/**
 * Ownership-condition для detail: если intent меняет mainEntity и сущность
 * принадлежит viewer'у по правилу self-ownership, возвращает JS-выражение
 * для item.condition. SlotRenderer применит его к toolbar'ной кнопке.
 *
 * Пока hardcoded для User: id === viewer.id. В M4 расширить через
 * ontology.entities[X].ownerField (Message.senderId и т.п.).
 */
function ownershipConditionFor(intent, mainEntity) {
  if (mainEntity !== "User") return null;
  const lower = mainEntity.toLowerCase();
  const effects = intent.particles?.effects || [];
  const mutatesMain = effects.some(e =>
    (e.α === "replace" || e.α === "remove") &&
    typeof e.target === "string" &&
    (e.target === lower || e.target.startsWith(lower + "."))
  );
  if (!mutatesMain) return null;
  return "id === viewer.id";
}

function appliesToMainEntity(intent, mainEntity) {
  const intentEntities = (intent.particles?.entities || [])
    .map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
  return intentEntities.includes(mainEntity);
}

function buildDetailBody(projection, ONTOLOGY, viewerRole = "self") {
  const mainEntity = projection.mainEntity;
  const entity = ONTOLOGY?.entities?.[mainEntity];
  // Нормализованные поля + фильтр системных + проверка read-доступа по роли
  const allFields = getEntityFields(entity || {});
  const fields = allFields.filter(f =>
    !SYSTEM_DETAIL_FIELDS.has(f.name) && canRead(f, viewerRole)
  );
  const fieldNames = fields.map(f => f.name);

  const children = [];

  if (fieldNames.includes("avatar")) {
    children.push({ type: "avatar", bind: "avatar", size: 96 });
  }

  if (fieldNames.includes("name")) {
    children.push({ type: "heading", bind: "name", level: 1 });
  } else if (fieldNames.includes("title")) {
    children.push({ type: "heading", bind: "title", level: 1 });
  }

  for (const field of fields) {
    if (field.name === "avatar" || field.name === "name" || field.name === "title") continue;
    children.push({
      type: "row",
      gap: 8,
      children: [
        { type: "text", content: (field.label || field.name) + ":", style: "secondary" },
        { type: "text", bind: field.name },
      ],
    });
  }

  return {
    type: "column",
    gap: 12,
    children,
  };
}
