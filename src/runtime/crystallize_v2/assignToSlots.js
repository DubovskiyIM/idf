/**
 * §3.1 дизайна: назначение намерений в слоты feed-архетипа.
 * Упрощение M1: только feed, только минимальные правила — достаточно для chat_view.
 */

import { inferParameters } from "./inferParameters.js";
import { inferControlType } from "./inferControlType.js";
import { wrapByConfirmation } from "./wrapByConfirmation.js";

export function assignToSlots(INTENTS, projection, ONTOLOGY) {
  const slots = {
    header: [],
    toolbar: [],
    body: buildBody(projection),
    context: [],
    fab: [],
    overlay: [],
    composer: null,
  };

  const itemIntents = new Set();
  const antagonistPairsHandled = new Set();

  // Группировка антагонистов
  const toggles = [];
  for (const [id, intent] of Object.entries(INTENTS)) {
    if (antagonistPairsHandled.has(id)) continue;
    const partnerId = intent.antagonist;
    if (partnerId && INTENTS[partnerId] && !antagonistPairsHandled.has(partnerId)) {
      const toggle = {
        type: "toggle",
        intents: [id, partnerId],
        state: findStateField(intent),
        label: intent.name,
      };
      toggles.push(toggle);
      antagonistPairsHandled.add(id);
      antagonistPairsHandled.add(partnerId);
    }
  }

  for (const [id, intent] of Object.entries(INTENTS)) {
    if (antagonistPairsHandled.has(id)) continue;

    // Применимость к проекции
    if (!appliesToProjection(intent, projection)) continue;

    const parameters = inferParameters(intent, ONTOLOGY).map(p => ({
      ...p,
      control: inferControlType(p, ONTOLOGY),
    }));

    const wrapped = wrapByConfirmation(intent, id, parameters);
    if (wrapped === null) continue; // confirmation: auto

    const isPerItem = isPerItemIntent(intent, projection);
    const isComposerEntry = wrapped.type === "composerEntry";
    const hasOverlay = wrapped.trigger && wrapped.overlay;

    // composer: единственное намерение confirmation:"enter" + creates → composer
    if (isComposerEntry && intent.creates && !slots.composer) {
      slots.composer = buildComposer(id, intent, parameters, INTENTS);
      continue;
    }

    // formModal/confirmDialog — overlay + toolbar trigger
    if (hasOverlay) {
      slots.toolbar.push(wrapped.trigger);
      slots.overlay.push(wrapped.overlay);
      continue;
    }

    // Per-item intent → body.item.intents
    if (isPerItem && wrapped.type === "intentButton" && !wrapped.opens) {
      itemIntents.add(id);
      continue;
    }

    // Projection-level click без overlay → toolbar
    slots.toolbar.push(wrapped);
  }

  // Toggles → header
  slots.header.push(...toggles);

  // Собрать item.intents в body
  if (slots.body.item) {
    slots.body.item.intents = Array.from(itemIntents);
  }

  // Overflow: если в toolbar > 5 — свернуть хвост в меню
  if (slots.toolbar.length > 5) {
    const overflow = slots.toolbar.splice(5);
    slots.toolbar.push({ type: "overflow", children: overflow });
  }

  return slots;
}

function appliesToProjection(intent, projection) {
  const projEntities = new Set(projection.entities || []);
  const intentEntities = (intent.particles?.entities || []).map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
  if (intentEntities.some(e => projEntities.has(e))) return true;
  const witnesses = intent.particles?.witnesses || [];
  for (const w of witnesses) {
    const base = w.split(".")[0];
    if (projEntities.has(base) || projEntities.has(capitalize(base))) return true;
  }
  // Projection-level utility: нет entity-привязки и нет точечных witnesses →
  // намерение принадлежит текущей проекции как общая утилита (поиск, фильтры, настройки).
  const hasDottedWitness = witnesses.some(w => w.includes("."));
  if (intentEntities.length === 0 && !hasDottedWitness) return true;
  return false;
}

function isPerItemIntent(intent, projection) {
  // Per-item: намерение применяется к единичному элементу коллекции проекции
  const intentEntities = (intent.particles?.entities || []).map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
  const mainEntity = projection.mainEntity || "Message";
  return intentEntities.includes(mainEntity) && !intent.creates;
}

function findStateField(intent) {
  const effect = intent.particles?.effects?.[0];
  return effect?.target || null;
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function buildBody(projection) {
  return {
    type: "list",
    source: "messages",
    filter: "item.conversationId === world.currentConversationId",
    sort: "createdAt",
    direction: "bottom-up",
    item: {
      type: "card",
      children: [
        {
          type: "row",
          children: [
            { type: "avatar", bind: "item.sender.name", size: 32 },
            {
              type: "column",
              children: [
                { type: "text", bind: "item.sender.name", style: "heading" },
                { type: "text", bind: "item.content" },
              ],
            },
          ],
        },
      ],
      intents: [],
    },
  };
}

function buildComposer(intentId, intent, parameters, INTENTS) {
  const primaryParam = parameters[0]?.name || "text";
  // attach-намерения: остальные creates:Message с confirmation:"file" или "click"
  const attachments = [];
  for (const [id, i] of Object.entries(INTENTS)) {
    if (id === intentId) continue;
    if (i.creates === "Message" &&
        (i.particles?.confirmation === "file" || i.particles?.confirmation === "click")) {
      attachments.push(id);
    }
  }
  return {
    type: "composer",
    primaryIntent: intentId,
    primaryParameter: primaryParam,
    placeholder: "Сообщение…",
    attachments,
  };
}
