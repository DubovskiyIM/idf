/**
 * §3.1 дизайна (catalog-ветвь): назначение намерений в слоты catalog-архетипа.
 */

import { inferParameters } from "./inferParameters.js";
import { inferControlType } from "./inferControlType.js";
import { wrapByConfirmation } from "./wrapByConfirmation.js";
import {
  needsCustomCapture,
  appliesToProjection,
  isUnsupportedInM2,
  normalizeCreates,
} from "./assignToSlotsShared.js";
import { getIntentIcon } from "./getIntentIcon.js";

export function assignToSlotsCatalog(INTENTS, projection, ONTOLOGY) {
  const slots = {
    header: [],
    toolbar: [],
    hero: [], // inline-creator над body (heroCreate архетип)
    body: buildCatalogBody(projection, ONTOLOGY),
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
    // customCapture (voiceRecorder/emojiPicker/entityPicker) теперь пройдёт
    // через wrapByConfirmation — скипаем только непокрытые виджеты.
    if (needsCustomCapture(intent)) continue;

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

    const wrapped = wrapByConfirmation(intent, id, parameters, { projection });
    if (wrapped === null) continue;

    const isPerItem = isPerItemIntent(intent, projection);
    const isComposerEntry = wrapped.type === "composerEntry";
    const hasOverlay = wrapped.trigger && wrapped.overlay;
    const isCreator = normalizeCreates(intent.creates) === projection.mainEntity;

    // inlineSearch — всегда в toolbar как projection-level utility
    if (wrapped.type === "inlineSearch") {
      slots.toolbar.push(wrapped);
      continue;
    }

    // heroCreate — inline-создатель mainEntity над списком. Перехватывается
    // прежде обычного fab, даёт человеческий UX «ввёл название — Enter».
    if (wrapped.type === "heroCreate") {
      slots.hero.push(wrapped);
      continue;
    }

    if (isComposerEntry) continue;

    // Пропустить creator-интенты без collectable-параметров — за исключением
    // случая, когда wrapped имеет overlay (customCapture.entityPicker,
    // formModal и т.п.). Для customCapture «параметр» — это выбор сущности
    // внутри виджета, inferParameters его не видит.
    if (isCreator && parameters.length === 0 && !hasOverlay) continue;

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
        conditions: buildItemConditions(intent, projection, ONTOLOGY),
      });
      continue;
    }

    // per-item простая кнопка
    if (isPerItem && wrapped.type === "intentButton") {
      addItemIntent({
        intentId: id,
        label: intent.name,
        icon: getIntentIcon(id, intent),
        conditions: buildItemConditions(intent, projection, ONTOLOGY),
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

  if (normalizeCreates(intent.creates) === mainEntity) return false;

  return true;
}

function pluralizeLower(entity) {
  const lower = entity.toLowerCase();
  if (lower.endsWith("y")) return lower.slice(0, -1) + "ies";
  if (lower.endsWith("s")) return lower + "es";
  return lower + "s";
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Собрать conditions для per-item intent. К декларированным в намерении
 * условиям добавляется synthetic ownership check, если intent меняет
 * mainEntity (его эффекты — replace/remove на mainEntity.*) и
 * mainEntity — User-подобная сущность с ownerField="id".
 *
 * Без этой проверки per-item кнопки "Редактировать профиль" / "Сменить
 * статус" появились бы под каждой карточкой User в people_list, но
 * фактическое применение на чужом User было бы запрещено (и ломало бы
 * ожидания UX). Пока hardcoded для User (M3.5b) — в M4 ownerField
 * должен жить в ontology и работать для Message/Participant и др.
 */
function buildItemConditions(intent, projection, ONTOLOGY) {
  const conditions = [...(intent.particles?.conditions || [])];
  const mainEntity = projection.mainEntity;
  if (!mainEntity) return conditions;

  const lower = mainEntity.toLowerCase();
  const effects = intent.particles?.effects || [];
  const mutatesMain = effects.some(e =>
    (e.α === "replace" || e.α === "remove") &&
    typeof e.target === "string" &&
    (e.target === lower || e.target.startsWith(lower + "."))
  );

  if (mutatesMain) {
    const ownerField = ONTOLOGY?.entities?.[mainEntity]?.ownerField;
    if (ownerField) {
      conditions.push(`${lower}.${ownerField} = me.id`);
    } else if (mainEntity === "User") {
      // backward-compat: User не имеет ownerField, но self-owned по id
      conditions.push(`${lower}.id = me.id`);
    }
  }

  return conditions;
}

// Предотвращаем появление creator-intent другого main entity в catalog,
// НО разрешаем cross-entity creators если intent явно ссылается на
// mainEntity в particles.entities (пример: create_direct_chat создаёт
// Conversation, но работает как per-item action на User в people_list).
function isCreatorOfOther(intent, mainEntity) {
  const c = normalizeCreates(intent.creates);
  if (!c || !mainEntity || c === mainEntity) return false;
  // Cross-entity creator разрешён, если mainEntity есть в entities intent'а
  const intentEntities = (intent.particles?.entities || [])
    .map(e => e.split(":").pop().trim().replace(/\(.*\)/, "").replace(/\[\]/, ""));
  if (intentEntities.includes(mainEntity)) return false;
  return true;
}

function buildCatalogBody(projection, ONTOLOGY) {
  const mainEntity = projection.mainEntity;
  const source = mainEntity ? pluralizeLower(mainEntity) : "items";

  // Определяем titleField из ontology: name | title | id. Нормализуем
  // оба формата (legacy array и типизированный объект).
  const entity = ONTOLOGY?.entities?.[mainEntity];
  const fields = entity?.fields;
  const fieldNames = Array.isArray(fields)
    ? fields
    : (fields ? Object.keys(fields) : []);
  const titleField =
    fieldNames.includes("name") ? "name"
    : fieldNames.includes("title") ? "title"
    : "id";
  const subtitleField =
    fieldNames.includes("lastMessage") ? "lastMessage"
    : fieldNames.includes("email") ? "email"
    : fieldNames.includes("status") ? "status"
    : null;

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
            // Avatar: если item.avatar — data URL/URL, показывается картинка;
            // иначе инициал берётся из nameBind (titleField).
            { type: "avatar", bind: "avatar", nameBind: titleField, size: 40 },
            {
              type: "column",
              sx: { flex: 1 },
              children: [
                { type: "text", bind: titleField, style: "heading" },
                subtitleField
                  ? { type: "text", bind: subtitleField, style: "secondary" }
                  : null,
              ].filter(Boolean),
            },
          ],
        },
      ],
      intents: [],
    },
  };
  if (projection.filter) body.filter = projection.filter;
  if (projection.sort) body.sort = projection.sort;
  if (projection.layout) body.layout = projection.layout;
  return body;
}
