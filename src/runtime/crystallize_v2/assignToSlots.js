/**
 * Dispatcher по архетипу. Каждый архетип имеет свой набор правил назначения
 * в слоты. Feed-логика (chat-стиль) осталась здесь; catalog и detail вынесены
 * в отдельные модули.
 */

import { inferParameters } from "./inferParameters.js";
import { inferControlType } from "./inferControlType.js";
import { wrapByConfirmation } from "./wrapByConfirmation.js";
import { assignToSlotsCatalog } from "./assignToSlotsCatalog.js";
import { assignToSlotsDetail } from "./assignToSlotsDetail.js";

export function assignToSlots(INTENTS, projection, ONTOLOGY) {
  const kind = projection.kind;
  if (kind === "catalog") return assignToSlotsCatalog(INTENTS, projection, ONTOLOGY);
  if (kind === "detail") return assignToSlotsDetail(INTENTS, projection, ONTOLOGY);
  return assignToSlotsFeed(INTENTS, projection, ONTOLOGY);
}

// Witnesses, которые обозначают *результат* специализированного захвата
// (голосовая запись, стикер, GIF, геолокация, опрос). Такие интенты требуют
// кастомных виджетов, которых в M1 нет — пропускаем целиком, не пытаясь
// строить абстрактную форму из их частиц.
const CAPTURE_WITNESSES = new Set([
  "recording_duration",
  "sticker_id", "sticker_pack", "sticker_image",
  "gif_url",
  "latitude", "longitude",
  "video_duration", "video_size",
  "question", "options",
  "poll_results",
  "wallpaper_preview", "album_cover",
  "contacts_file",
]);

function needsCustomCapture(intent) {
  const witnesses = intent.particles?.witnesses || [];
  return witnesses.some(w => CAPTURE_WITNESSES.has(w));
}

function assignToSlotsFeed(INTENTS, projection, ONTOLOGY) {
  const slots = {
    header: [],
    toolbar: [],
    body: buildBody(projection),
    context: [],
    fab: [],
    overlay: [],
    composer: null,
  };

  // item.intents = [{intentId, opens?, overlayKey?}]
  const itemIntents = [];
  const itemIntentIds = new Set();
  const addItemIntent = (spec) => {
    if (itemIntentIds.has(spec.intentId)) return;
    itemIntentIds.add(spec.intentId);
    itemIntents.push(spec);
  };
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

    // M1: пропускаем интенты, требующие кастомных виджетов захвата.
    // Голосовые, стикеры, GIF, геолокация, опросы — всё это придёт в M2+.
    if (needsCustomCapture(intent)) continue;

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
    // Вторичные composerEntry (reply_to_message и т.п.) пропускаем — их UX в M1 не поддержан
    // (нужен inline-режим композера с reply-контекстом, это M2).
    if (isComposerEntry) {
      if (!isPerItem && intent.creates && !slots.composer) {
        slots.composer = buildComposer(id, intent, parameters, INTENTS);
      }
      continue;
    }

    // Пропускаем per-item intents, которые создают новую сущность, но требуют
    // доп. ввода (react_to_message, forward_message, bookmark_message...) — в M1
    // у нас нет inline-пикеров эмодзи/беседы, без них кнопка бесполезна.
    if (isPerItem && intent.creates && !hasOverlay) {
      continue;
    }

    // formModal/confirmDialog — overlay + trigger
    if (hasOverlay) {
      slots.overlay.push(wrapped.overlay);
      if (isPerItem) {
        addItemIntent({
          intentId: id,
          opens: "overlay",
          overlayKey: wrapped.overlay.key,
          label: intent.name,
          conditions: intent.particles.conditions || [],
        });
      } else {
        slots.toolbar.push(wrapped.trigger);
      }
      continue;
    }

    // Per-item intent (plain click, no params) → body.item.intents
    if (isPerItem && wrapped.type === "intentButton") {
      addItemIntent({
        intentId: id,
        label: intent.name,
        conditions: intent.particles.conditions || [],
      });
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
    slots.body.item.intents = itemIntents;
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
    filter: "conversationId === world.currentConversationId && !((deletedFor||[]).includes(viewer && viewer.id)) && !((deletedFor||[]).includes('*'))",
    sort: "createdAt",
    direction: "bottom-up",
    gap: 8,
    item: {
      type: "card",
      variant: "chat",
      children: [
        // Имя отправителя (только для чужих — Card управляет видимостью через condition)
        {
          type: "text",
          bind: "senderName",
          style: { fontSize: 11, fontWeight: 600, color: "#6366f1", marginBottom: 2 },
          condition: "senderId !== viewer.id",
        },
        { type: "text", bind: "content", style: { fontSize: 14, whiteSpace: "pre-wrap" } },
      ],
      intents: [],
    },
  };
}

function buildComposer(intentId, intent, parameters, INTENTS) {
  const primaryParam = parameters[0]?.name || "text";
  // attach-намерения: остальные creates:Message с confirmation:"file"
  // (голосовые/стикеры/GIF пропускаем — для них нужны кастомные виджеты захвата).
  const attachments = [];
  for (const [id, i] of Object.entries(INTENTS)) {
    if (id === intentId) continue;
    if (needsCustomCapture(i)) continue;
    if (i.creates === "Message" && i.particles?.confirmation === "file") {
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
