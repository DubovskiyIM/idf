/**
 * §3.1 дизайна (catalog-ветвь): назначение намерений в слоты catalog-архетипа.
 */

import { inferParameters } from "./inferParameters.js";
import { inferControlType } from "./inferControlType.js";
import { wrapByConfirmation } from "./wrapByConfirmation.js";
import {
  needsCustomCapture,
  needsEntityPicker,
  appliesToProjection,
  isUnsupportedInM2,
} from "./assignToSlotsShared.js";
import { getIntentIcon } from "./getIntentIcon.js";

export function assignToSlotsCatalog(INTENTS, projection, ONTOLOGY) {
  const slots = {
    header: [],
    toolbar: [],
    body: buildCatalogBody(projection),
    context: [],
    fab: [],
    overlay: [],
  };

  const itemIntents = [];
  const itemIntentIds = new Set();
  const addItemIntent = (spec) => {
    if (itemIntentIds.has(spec.intentId)) return;
    itemIntentIds.add(spec.intentId);
    itemIntents.push(spec);
  };

  const mainEntity = projection.mainEntity;

  for (const [id, intent] of Object.entries(INTENTS)) {
    if (isUnsupportedInM2(id)) continue;
    if (!appliesToProjection(intent, projection)) continue;
    if (needsCustomCapture(intent)) continue;
    if (needsEntityPicker(intent, projection)) continue;

    // Catalog-специфика: интент должен либо касаться mainEntity напрямую,
    // либо быть pure projection-level utility (поиск/фильтры).
    // Иначе это sub-entity операция типа mute на Participant — бессмысленная
    // в catalog-toolbar без per-item toggle UX (M3).
    const intentEntities = (intent.particles?.entities || [])
      .map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
    const touchesMainEntity = mainEntity && intentEntities.includes(mainEntity);
    const isPureUtility = intentEntities.length === 0;
    if (!touchesMainEntity && !isPureUtility) continue;

    const parameters = inferParameters(intent, ONTOLOGY).map(p => ({
      ...p,
      control: inferControlType(p, ONTOLOGY),
    }));

    const wrapped = wrapByConfirmation(intent, id, parameters);
    if (wrapped === null) continue;

    const isPerItem = isPerItemIntent(intent, projection);
    const isComposerEntry = wrapped.type === "composerEntry";
    const hasOverlay = wrapped.trigger && wrapped.overlay;
    const isCreator = intent.creates === projection.mainEntity;

    // inlineSearch — всегда в toolbar как projection-level utility
    if (wrapped.type === "inlineSearch") {
      slots.toolbar.push(wrapped);
      continue;
    }

    if (isComposerEntry) continue;

    // Пропустить creator-интенты без collectable-параметров
    if (isCreator && parameters.length === 0) continue;

    // fab: создание главной сущности
    if (isCreator && !isPerItem) {
      if (hasOverlay) {
        slots.overlay.push(wrapped.overlay);
        slots.fab.push(wrapped.trigger);
      } else {
        slots.fab.push(wrapped);
      }
      continue;
    }

    // per-item с overlay
    if (isPerItem && hasOverlay) {
      slots.overlay.push(wrapped.overlay);
      addItemIntent({
        intentId: id,
        opens: "overlay",
        overlayKey: wrapped.overlay.key,
        label: intent.name,
        icon: getIntentIcon(id, intent),
        conditions: intent.particles.conditions || [],
      });
      continue;
    }

    // per-item простая кнопка
    if (isPerItem && wrapped.type === "intentButton") {
      addItemIntent({
        intentId: id,
        label: intent.name,
        icon: getIntentIcon(id, intent),
        conditions: intent.particles.conditions || [],
      });
      continue;
    }

    // projection-level с overlay
    if (hasOverlay) {
      slots.toolbar.push(wrapped.trigger);
      slots.overlay.push(wrapped.overlay);
      continue;
    }

    // projection-level простой click
    if (wrapped.type === "intentButton") {
      slots.toolbar.push(wrapped);
    }
  }

  if (slots.body.item) {
    slots.body.item.intents = itemIntents;
  }

  if (slots.toolbar.length > 5) {
    const overflow = slots.toolbar.splice(5);
    slots.toolbar.push({ type: "overflow", children: overflow });
  }

  return slots;
}

function isPerItemIntent(intent, projection) {
  const mainEntity = projection.mainEntity;
  if (!mainEntity) return false;
  const mainLower = mainEntity.toLowerCase();
  const intentEntities = (intent.particles?.entities || [])
    .map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
  if (!intentEntities.includes(mainEntity)) return false;

  const witnesses = intent.particles?.witnesses || [];
  const hasDottedMainWitness = witnesses.some(w => {
    const base = w.split(".")[0];
    return base === mainLower || base === mainEntity;
  });
  if (hasDottedMainWitness) return true;

  const conditions = intent.particles?.conditions || [];
  const hasMainCondition = conditions.some(c => c.toLowerCase().startsWith(mainLower + "."));
  if (hasMainCondition) return true;

  if (intent.creates === mainEntity) return false;

  return true;
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function buildCatalogBody(projection) {
  const mainEntity = projection.mainEntity;
  const source = mainEntity ? mainEntity.toLowerCase() + "s" : "items";

  const body = {
    type: "list",
    source,
    gap: 8,
    empty: { type: "text", content: "Пусто", style: "muted" },
    item: {
      type: "card",
      children: [
        {
          type: "row",
          gap: 10,
          children: [
            { type: "avatar", bind: "title", size: 40 },
            {
              type: "column",
              sx: { flex: 1 },
              children: [
                { type: "text", bind: "title", style: "heading" },
                { type: "text", bind: "lastMessage", style: "secondary" },
              ],
            },
          ],
        },
      ],
      intents: [],
    },
  };
  if (projection.filter) body.filter = projection.filter;
  if (projection.sort) body.sort = projection.sort;
  return body;
}
