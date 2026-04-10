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

    // composer: первое projection-level намерение confirmation:"enter" + creates → composer.
    // Вторичные composerEntry (reply_to_message и т.п. — per-item) идут в item.intents.
    if (isComposerEntry) {
      if (!isPerItem && intent.creates && !slots.composer) {
        slots.composer = buildComposer(id, intent, parameters, INTENTS);
        continue;
      }
      // Иначе — per-item или уже есть composer. Для per-item кладём в item.intents,
      // иначе дропаем (обычно это reply/forward-like — они per-item).
      if (isPerItem) {
        itemIntents.add(id);
      }
      continue;
    }

    // formModal/confirmDialog — overlay + trigger
    if (hasOverlay) {
      slots.overlay.push(wrapped.overlay);
      if (isPerItem) {
        // Per-item overlay — триггер в item.intents (опциональный overlayKey)
        itemIntents.add(id);
      } else {
        slots.toolbar.push(wrapped.trigger);
      }
      continue;
    }

    // Per-item intent → body.item.intents
    if (isPerItem && wrapped.type === "intentButton") {
      itemIntents.add(id);
      continue;
    }

    // Projection-level click без overlay → toolbar
    slots.toolbar.push(wrapped);
  }

  // Toggles → header (ограничиваем первыми 3, остальные — overflow)
  const MAX_HEADER_TOGGLES = 3;
  if (toggles.length > MAX_HEADER_TOGGLES) {
    slots.header.push(...toggles.slice(0, MAX_HEADER_TOGGLES));
    slots.toolbar.push({ type: "overflow", children: toggles.slice(MAX_HEADER_TOGGLES) });
  } else {
    slots.header.push(...toggles);
  }

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
  // Per-item: намерение применяется к единичному экземпляру главной сущности проекции.
  // Признак: есть условие или точечный witness на mainEntity (нужна ссылка на конкретный
  // экземпляр), либо единственная entity — mainEntity без дополнительных.
  const mainEntity = projection.mainEntity || "Message";
  const mainLower = mainEntity.toLowerCase();
  const intentEntities = (intent.particles?.entities || [])
    .map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
  if (!intentEntities.includes(mainEntity)) return false;

  // Признак per-item: точечный witness referring to an existing instance
  const witnesses = intent.particles?.witnesses || [];
  const hasDottedMainWitness = witnesses.some(w => {
    const base = w.split(".")[0];
    return base === mainLower || base === mainEntity || base === "original_message";
  });
  if (hasDottedMainWitness) return true;

  // Признак per-item: условие на поле mainEntity (e.g. "message.senderId = me.id")
  const conditions = intent.particles?.conditions || [];
  const hasMainCondition = conditions.some(c => c.toLowerCase().startsWith(mainLower + "."));
  if (hasMainCondition) return true;

  // Если intent создаёт новую сущность mainEntity через композер — не per-item
  if (intent.creates === mainEntity && !hasDottedMainWitness && !hasMainCondition) return false;

  // Иначе — per-item (есть main entity в списке, но неясно зачем)
  return true;
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
    filter: "conversationId === world.currentConversationId",
    sort: "createdAt",
    direction: "bottom-up",
    item: {
      type: "card",
      children: [
        {
          type: "row",
          children: [
            { type: "avatar", bind: "senderName", size: 32 },
            {
              type: "column",
              sx: { flex: 1 },
              children: [
                { type: "text", bind: "senderName", style: "heading" },
                { type: "text", bind: "content" },
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
