/**
 * §3.1 дизайна (detail-ветвь): слоты detail-архетипа.
 *
 * M4 step B: поддержка subCollections — декларативных секций со связанными
 * sub-сущностями (TimeOption/Participant/Vote для Poll). Секция содержит
 * inline-композер для добавления (если задано addable), list items с
 * per-item кнопками и counter в заголовке.
 */

import { inferParameters } from "./inferParameters.js";
import { inferControlType, enrichWithOptions } from "./inferControlType.js";
import { wrapByConfirmation } from "./wrapByConfirmation.js";
import {
  needsCustomCapture,
  needsEntityPicker,
  isUnsupportedInM2,
  normalizeCreates,
} from "./assignToSlotsShared.js";
import { getEntityFields, canRead, inferFieldRole } from "./ontologyHelpers.js";
import { getIntentIcon } from "./getIntentIcon.js";

const SYSTEM_DETAIL_FIELDS = new Set([
  "id", "createdAt", "updatedAt", "deletedAt", "deletedFor",
]);

const SYSTEM_SUB_FIELDS = new Set([
  "id", "createdAt", "updatedAt", "deletedAt",
]);

export function assignToSlotsDetail(INTENTS, projection, ONTOLOGY) {
  const slots = {
    header: [],
    toolbar: [],
    body: buildDetailBody(projection, ONTOLOGY),
    context: [],
    fab: [],
    overlay: [],
    // sections — новый слот для sub-collection секций (M4 step B).
    // Массив объектов, ArchetypeDetail рендерит их после body.
    sections: [],
    // primaryCTA — phase-changing intents (M4 step C). Intents, которые
    // переводят mainEntity в следующую фазу (replace {entity}.status).
    // Рендерятся как крупные primary-кнопки внизу body вместо обычного
    // toolbar, чтобы дать пользователю явный "что делать дальше".
    primaryCTA: [],
    // progress — декларативный progress-виджет (M4 step E). Проекция задаёт
    // spec в projection.progress, рантайм вычисляет значения из world.
    progress: projection.progress || null,
    // footer — intents, явно помеченные проекцией для inline-setter'а
    // (M4 step F). single-param intents как set_deadline рендерятся ниже
    // всех секций в виде «label: [input] Установить».
    footer: [],
    // voterSelector — view-state селектор «Голосовать как: X». Передаётся
    // as-is из projection, рантайм рендерит <select> участников над
    // секциями. VoteGroup потом читает ctx.viewState[stateKey]. Открытая
    // граница §23 — пока ограничен planning-доменом.
    voterSelector: projection.voterSelector || null,
  };

  const mainEntity = projection.mainEntity;
  if (!mainEntity) return slots;

  // Footer intents — явный список из projection.footerIntents.
  const footerIntentIds = new Set(projection.footerIntents || []);

  // Sub-intents, которые будут обработаны в секциях, не должны попадать
  // в основной toolbar. Собираем их id заранее.
  const subHandledIntents = new Set();
  for (const sub of projection.subCollections || []) {
    const section = buildSection(sub, INTENTS, ONTOLOGY, projection);
    slots.sections.push(section);
    if (section.addControl?.intentId) subHandledIntents.add(section.addControl.intentId);
    for (const it of section.itemIntents || []) {
      subHandledIntents.add(it.intentId);
    }
  }

  for (const [id, intent] of Object.entries(INTENTS)) {
    if (isUnsupportedInM2(id)) continue;
    if (subHandledIntents.has(id)) continue; // уже в секции
    if (!appliesToMainEntity(intent, mainEntity)) continue;
    if (needsCustomCapture(intent)) continue;
    if (needsEntityPicker(intent, projection)) continue;

    // Bulk/extended intent'ы — это collection-level операции (BulkWizard),
    // не per-item. Они бессмысленны в detail-виде одной сущности.
    if (intent.extended) continue;

    // Read-only intents без эффектов не применяются к detail
    const hasEffects = (intent.particles?.effects || []).length > 0;
    if (!hasEffects) continue;

    // Creator-интент не применяется к detail проекции чужой сущности
    const creates = normalizeCreates(intent.creates);
    if (creates && creates !== mainEntity) continue;

    // Intent, создающий mainEntity, не нужен на detail-виде существующей
    // сущности (создание — это catalog/fab/hero).
    if (creates === mainEntity) continue;

    const parameters = inferParameters(intent, ONTOLOGY).map(p => ({
      ...p,
      control: inferControlType(p, ONTOLOGY),
    })).map(p => enrichWithOptions(p, ONTOLOGY));

    // Footer: автор проекции пометил intent явно → рендер как inline-setter
    if (footerIntentIds.has(id)) {
      slots.footer.push({
        intentId: id,
        label: intent.name,
        icon: getIntentIcon(id, intent),
        conditions: intent.particles?.conditions || [],
        parameters,
      });
      continue;
    }

    const wrapped = wrapByConfirmation(intent, id, parameters, { projection });
    if (wrapped === null) continue;
    if (wrapped.type === "composerEntry") continue;

    const hasOverlay = wrapped.trigger && wrapped.overlay;
    const ownershipCond = ownershipConditionFor(intent, mainEntity, ONTOLOGY);

    // Phase-aware primary CTA: intent меняет {mainEntity}.status, не
    // destructive → большая primary-кнопка внизу body.
    // Destructive (cancel_poll с irreversibility: high) остаётся в toolbar
    // через confirmDialog overlay — пользователю не нужно отдельное
    // «heroic» место для разрушительных действий.
    if (isPhaseTransition(intent, mainEntity) && intent.irreversibility !== "high") {
      const conditions = intent.particles?.conditions || [];
      slots.primaryCTA.push({
        intentId: id,
        label: intent.name,
        icon: getIntentIcon(id, intent),
        conditions,
        parameters,
      });
      continue;
    }

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

  slots.toolbar = collapseToolbar(slots.toolbar);

  return slots;
}

/**
 * Свернуть toolbar: антагонистические пары объединяются, затем
 * организуется overflow с логическими секциями.
 *
 * UX-паттерн:
 *  - Видимые кнопки: только уникальные действия (не имеющие антагониста
 *    и с уникальной иконкой). Максимум 3.
 *  - Overflow: организован секциями. Антагонистические пары — рядом,
 *    одиночные — группируются по иконке.
 */
function collapseToolbar(toolbar) {
  if (toolbar.length <= 3) return toolbar;

  // 1. Собрать антагонистические пары
  const paired = new Set();
  const sections = []; // [{items: [...]}] для overflow
  const standalone = []; // кнопки без антагониста

  for (const btn of toolbar) {
    if (paired.has(btn.intentId)) continue;
    if (btn.antagonist) {
      const partner = toolbar.find(b => b.intentId === btn.antagonist && !paired.has(b.intentId));
      if (partner) {
        paired.add(btn.intentId);
        paired.add(partner.intentId);
        sections.push({ items: [btn, partner] });
        continue;
      }
    }
    if (!paired.has(btn.intentId)) {
      standalone.push(btn);
    }
  }

  // 2. Из standalone — видимые кнопки (уникальные иконки, макс. 3)
  const visible = [];
  const toOverflow = [];
  const seenIcons = new Set();
  for (const btn of standalone) {
    const icon = btn.icon || btn.intentId;
    if (visible.length < 3 && !seenIcons.has(icon)) {
      seenIcons.add(icon);
      visible.push(btn);
    } else {
      toOverflow.push(btn);
    }
  }

  // 3. Overflow: одиночные + антагонист-секции, без дубликатов с visible
  const visibleIds = new Set(visible.map(b => b.intentId));
  const dedupSection = (items) => items.filter(b => !visibleIds.has(b.intentId));

  if (toOverflow.length > 0) {
    sections.unshift({ items: toOverflow });
  }

  // Отфильтровать пустые секции и дубликаты
  const nonEmptySections = sections
    .map(s => ({ items: dedupSection(s.items) }))
    .filter(s => s.items.length > 0);

  if (nonEmptySections.length > 0) {
    const overflowChildren = [];
    for (let i = 0; i < nonEmptySections.length; i++) {
      if (i > 0) overflowChildren.push({ type: "divider" });
      overflowChildren.push(...nonEmptySections[i].items);
    }
    visible.push({ type: "overflow", children: overflowChildren });
  }

  return visible;
}

/**
 * Ownership-condition для detail: если intent меняет mainEntity и сущность
 * имеет ownerField в онтологии, возвращает JS-выражение для item.condition.
 * SlotRenderer применит его к toolbar'ной кнопке.
 *
 * Читает ontology.entities[mainEntity].ownerField — declarative, не hardcode.
 * Для User: ownerField отсутствует (id === viewer.id покрывается по default).
 * Для Booking: ownerField = "clientId" → "clientId === viewer.id".
 * Для Participant: ownerField = "userId" → "userId === viewer.id".
 */
function ownershipConditionFor(intent, mainEntity, ONTOLOGY) {
  const entityDef = ONTOLOGY?.entities?.[mainEntity];
  const ownerField = entityDef?.ownerField;

  // Для User backward-compat: id === viewer.id (нет ownerField в ontology)
  if (!ownerField && mainEntity !== "User") return null;

  const lower = mainEntity.toLowerCase();
  const effects = intent.particles?.effects || [];
  const mutatesMain = effects.some(e =>
    (e.α === "replace" || e.α === "remove") &&
    typeof e.target === "string" &&
    (e.target === lower || e.target.startsWith(lower + "."))
  );
  if (!mutatesMain) return null;

  return ownerField ? `${ownerField} === viewer.id` : "id === viewer.id";
}

function appliesToMainEntity(intent, mainEntity) {
  const intentEntities = (intent.particles?.entities || [])
    .map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
  return intentEntities.includes(mainEntity);
}

/**
 * Phase-transition intent: меняет {mainEntity}.status. Пример — open_poll,
 * close_poll, resolve_poll. Не включает destructive (cancel_*) — они
 * обрабатываются отдельно через confirmDialog.
 */
function isPhaseTransition(intent, mainEntity) {
  const lower = mainEntity.toLowerCase();
  const effects = intent.particles?.effects || [];
  return effects.some(e =>
    e.α === "replace" &&
    typeof e.target === "string" &&
    e.target === `${lower}.status`
  );
}

/**
 * Построение sub-collection секции.
 *
 * subDef = { collection, entity, foreignKey, title, addable, itemIntentIds? }
 *
 * Эвристика сборки:
 *  - addControl — первый найденный intent с normalizeCreates === subEntity
 *    и parentEntity в списке entities. Параметры — inferred из онтологии,
 *    foreignKey срезается (проставляется автоматически от target).
 *  - itemIntents — все intents, у которых subEntity в entities (но не creates
 *    sub-entity — это не «действие на item»). Автор может override'нуть
 *    через subDef.itemIntentIds.
 */
function buildSection(subDef, INTENTS, ONTOLOGY, parentProjection) {
  const {
    collection,
    entity: subEntity,
    foreignKey,
    title: rawTitle,
    label,
    addable = true,
    itemIntentIds,
  } = subDef;

  const parentEntity = parentProjection.mainEntity;

  // 1. Подходящий creator-intent для sub-entity (add_time_option / invite_participant)
  let addControl = null;
  if (addable) {
    for (const [id, intent] of Object.entries(INTENTS)) {
      if (isUnsupportedInM2(id)) continue;
      if (normalizeCreates(intent.creates) !== subEntity) continue;
      // Должна быть связь через parentEntity в decларации entities
      const entities = (intent.particles?.entities || [])
        .map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
      if (!entities.includes(parentEntity)) continue;

      const rawParams = inferParameters(intent, ONTOLOGY).map(p => ({
        ...p,
        control: inferControlType(p, ONTOLOGY),
      }));
      // Убираем foreignKey и системные поля — они проставятся автоматически
      const params = rawParams.filter(p =>
        p.name !== foreignKey && !SYSTEM_SUB_FIELDS.has(p.name)
      );

      addControl = {
        type: "subCollectionAdd",
        intentId: id,
        label: intent.name,
        icon: getIntentIcon(id, intent),
        parameters: params,
        foreignKey,
        // Условие фазы: если conditions содержит parent.status = ... —
        // addControl показывается только когда условие true. Рантайм
        // проверяет через evalIntentCondition.
        conditions: intent.particles?.conditions || [],
      };
      break; // первый найденный побеждает
    }
  }

  // 2. Per-item intents — действия на sub-entity
  const itemIntents = [];
  if (Array.isArray(itemIntentIds) && itemIntentIds.length > 0) {
    // Автор явно задал список
    for (const id of itemIntentIds) {
      const intent = INTENTS[id];
      if (!intent) continue;
      itemIntents.push(buildItemIntentSpec(id, intent));
    }
  } else {
    // Автоматический сбор: intent упоминает subEntity в entities и не создаёт
    // саму sub-entity (create-intenты уже в addControl).
    for (const [id, intent] of Object.entries(INTENTS)) {
      if (isUnsupportedInM2(id)) continue;
      if (addControl && addControl.intentId === id) continue;
      const creates = normalizeCreates(intent.creates);
      if (creates === subEntity) continue; // альтернативный creator, пропускаем
      const entities = (intent.particles?.entities || [])
        .map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
      if (!entities.includes(subEntity)) continue;
      // Должен иметь эффекты (read-only не считаем)
      if (!(intent.particles?.effects || []).length) continue;
      itemIntents.push(buildItemIntentSpec(id, intent));
    }
  }

  // 3. Item view — простая строка: главное поле + метаданные
  const itemView = buildSubItemView(subEntity, ONTOLOGY);

  // 4. Группировка voteGroup (Step D): взаимоисключающие creator-intents
  // на общей sub-entity с discriminator в creates схлопываются в одну
  // группу-выбор (зелёный/жёлтый/красный).
  const groupedIntents = collapseVoteGroups(itemIntents);

  const title = rawTitle || label || subEntity;

  // 5. Editable fields — поля sub-entity с write-правами (для inline-edit)
  const entityDef = ONTOLOGY?.entities?.[subEntity];
  let editableFields = [];
  if (entityDef?.fields && typeof entityDef.fields === "object" && !Array.isArray(entityDef.fields)) {
    editableFields = Object.entries(entityDef.fields)
      .filter(([name, f]) => f.write && name !== "id" && name !== foreignKey)
      .map(([name]) => name);
  }

  return {
    id: collection,
    title,
    source: collection,
    foreignKey,
    itemEntity: subEntity,
    itemView,
    itemIntents: groupedIntents,
    addControl,
    emptyLabel: `Пока пусто`,
    editableFields: editableFields.length > 0 ? editableFields : undefined,
  };
}

/**
 * collapseVoteGroups: ищет группы intents с общим нормализованным
 * `creates` (e.g. все три vote_yes/vote_no/vote_maybe имеют creates="Vote")
 * и discriminator в скобочном суффиксе. Схлопывает их в один spec типа
 * "voteGroup" с options-массивом.
 *
 * Одиночные intents и intents без discriminator-creates возвращаются как есть.
 */
function collapseVoteGroups(itemIntents) {
  const groups = new Map(); // normalizedCreates → {specs, baseConditions}
  const ungrouped = [];

  for (const spec of itemIntents) {
    const raw = spec.createsDiscriminator;
    if (typeof raw !== "string") {
      ungrouped.push(spec);
      continue;
    }
    const match = raw.match(/^(.+?)\s*\((.+)\)\s*$/);
    if (!match) {
      ungrouped.push(spec);
      continue;
    }
    const normalized = match[1].trim();
    const discriminator = match[2].trim();
    if (!groups.has(normalized)) groups.set(normalized, []);
    groups.get(normalized).push({ ...spec, discriminator });
  }

  const result = [...ungrouped];
  for (const [creates, specs] of groups.entries()) {
    if (specs.length < 2) {
      // Одиночный — не группируем
      result.push(...specs);
      continue;
    }
    // Conditions группы — пересечение (условие должно разрешать все варианты
    // одинаково; если разошлись — оставляем conditions пустыми, рантайм
    // проверит каждый option независимо).
    const firstConds = specs[0].conditions || [];
    const allSame = specs.every(s =>
      JSON.stringify(s.conditions || []) === JSON.stringify(firstConds)
    );
    result.push({
      type: "voteGroup",
      intentGroup: creates,
      conditions: allSame ? firstConds : [],
      options: specs.map(s => ({
        intentId: s.intentId,
        label: s.label,
        icon: s.icon,
        discriminator: s.discriminator,
        style: voteStyleFor(s.discriminator),
        conditions: allSame ? null : (s.conditions || []),
      })),
    });
  }
  return result;
}

/**
 * Цветовая схема для voteGroup-опций. UX-конвенция: зелёный = да,
 * жёлтый = возможно, красный = нет. Fallback — нейтральный.
 */
function voteStyleFor(discriminator) {
  const d = (discriminator || "").toLowerCase();
  if (["yes", "accept", "approve", "active"].includes(d)) {
    return { bg: "#10b981", bgHover: "#059669", color: "#fff", icon: "✓" };
  }
  if (["no", "decline", "reject", "cancelled"].includes(d)) {
    return { bg: "#ef4444", bgHover: "#dc2626", color: "#fff", icon: "✕" };
  }
  if (["maybe", "uncertain", "possible"].includes(d)) {
    return { bg: "#f59e0b", bgHover: "#d97706", color: "#fff", icon: "?" };
  }
  return { bg: "#6366f1", bgHover: "#4f46e5", color: "#fff", icon: null };
}

function buildItemIntentSpec(id, intent) {
  return {
    intentId: id,
    label: intent.name,
    icon: getIntentIcon(id, intent),
    conditions: intent.particles?.conditions || [],
    // Если creator под-коллекции имеет creates — нам он не нужен как
    // per-item; но discriminator в creates (Vote(yes)/Vote(no)) — полезен
    // для voteGroup (Step D).
    createsDiscriminator: typeof intent.creates === "string" ? intent.creates : null,
  };
}

/**
 * Item view для sub-entity — что рендерить как «главное» каждого элемента
 * коллекции. Эвристика:
 *   - TimeOption: «date startTime–endTime» (композитная строка)
 *   - Participant: name + email
 *   - иначе: первое non-system поле
 */
function buildSubItemView(subEntity, ONTOLOGY) {
  const entity = ONTOLOGY?.entities?.[subEntity];
  const fields = getEntityFields(entity || {});
  const fieldNames = fields.map(f => f.name);

  // Специализация для «временных» sub-entities
  if (fieldNames.includes("date") && fieldNames.includes("startTime")) {
    return {
      type: "text",
      template: "{date} {startTime}" + (fieldNames.includes("endTime") ? "–{endTime}" : ""),
      style: { fontWeight: 600, fontSize: 14 },
    };
  }

  if (fieldNames.includes("name")) {
    return { type: "text", bind: "name", style: { fontWeight: 600, fontSize: 14 } };
  }
  if (fieldNames.includes("title")) {
    return { type: "text", bind: "title", style: { fontWeight: 600, fontSize: 14 } };
  }
  // fallback: первое non-system поле
  const firstField = fieldNames.find(n => !SYSTEM_SUB_FIELDS.has(n));
  if (firstField) {
    return { type: "text", bind: firstField, style: { fontWeight: 600, fontSize: 14 } };
  }
  return { type: "text", bind: "id" };
}

function fieldToAtom(field) {
  const label = field.label || field.name;
  const t = field.type || "";

  if (t === "image" || t === "multiImage") {
    return { type: "image", bind: field.name, label };
  }
  if (t === "datetime" || t === "date") {
    return {
      type: "row", gap: 8, children: [
        { type: "text", content: label + ":", style: "secondary" },
        { type: "text", bind: field.name, format: "datetime" },
      ],
    };
  }
  if (t === "number") {
    return {
      type: "row", gap: 8, children: [
        { type: "text", content: label + ":", style: "secondary" },
        { type: "text", bind: field.name, format: "number" },
      ],
    };
  }
  if (t === "textarea") {
    return {
      type: "column", gap: 4, children: [
        { type: "text", content: label + ":", style: "secondary" },
        { type: "text", bind: field.name },
      ],
    };
  }
  if (t === "entityRef") {
    return {
      type: "row", gap: 8, children: [
        { type: "text", content: label + ":", style: "secondary" },
        { type: "text", bind: field.name, style: "dimmed" },
      ],
    };
  }
  return {
    type: "row", gap: 8, children: [
      { type: "text", content: label + ":", style: "secondary" },
      { type: "text", bind: field.name },
    ],
  };
}

function buildDetailBody(projection, ONTOLOGY, viewerRole = "self") {
  const mainEntity = projection.mainEntity;
  const entity = ONTOLOGY?.entities?.[mainEntity];
  const allFields = getEntityFields(entity || {});
  const fields = allFields.filter(f =>
    !SYSTEM_DETAIL_FIELDS.has(f.name) && canRead(f, viewerRole)
  );

  // Группируем поля по семантическим ролям
  const byRole = {};
  for (const field of fields) {
    const role = inferFieldRole(field.name, field);
    if (!byRole[role]) byRole[role] = [];
    byRole[role].push(field);
  }

  const children = [];

  // 1. Hero image
  const heroImageField = (byRole.heroImage || [])[0];
  if (heroImageField) {
    children.push({ type: "image", bind: heroImageField.name });
  }

  // 2. Title + description (или avatar + name + bio для User-like)
  const titleField = (byRole.title || [])[0];
  const descField = (byRole.description || [])[0];
  const avatarField = (byRole.heroImage || []).find(f => f.name === "avatar");

  if (avatarField && titleField) {
    // User-like: avatar рядом с именем
    const textParts = [{ type: "heading", bind: titleField.name, level: 2 }];
    if (descField) textParts.push({ type: "text", bind: descField.name, style: "secondary", hideEmpty: true });
    children.push({
      type: "row", gap: 16, align: "flex-start",
      children: [
        { type: "avatar", bind: "avatar", size: 80 },
        { type: "column", gap: 4, sx: { flex: 1 }, children: textParts },
      ],
    });
  } else {
    if (titleField) children.push({ type: "heading", bind: titleField.name, level: 1 });
    if (descField) children.push({ type: "text", bind: descField.name, style: "secondary", hideEmpty: true });
  }

  // 3. PriceBlock
  const priceFields = byRole.price || [];
  if (priceFields.length > 0) {
    const primaryOrder = ["currentPrice", "startPrice"];
    const sorted = [...priceFields].sort((a, b) => {
      const ai = primaryOrder.indexOf(a.name);
      const bi = primaryOrder.indexOf(b.name);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    children.push({
      type: "priceBlock",
      fields: sorted.map((f, i) => ({
        bind: f.name, label: f.label || f.name, primary: i === 0,
      })),
    });
  }

  // 4. Timer
  for (const f of byRole.timer || []) {
    children.push({ type: "timer", bind: f.name, label: f.label || f.name });
  }

  // 5. StatBar (metrics)
  const metricFields = byRole.metric || [];
  if (metricFields.length > 0) {
    children.push({
      type: "statBar",
      fields: metricFields.map(f => ({
        name: f.name, label: f.label || f.name, type: f.type,
      })),
    });
  }

  // 6. InfoSection: Доставка (location + shipping-info)
  const locationFields = byRole.location || [];
  const shippingInfoFields = (byRole.info || []).filter(f => /shipping/i.test(f.name));
  const deliveryFields = [...locationFields, ...shippingInfoFields];
  if (deliveryFields.length > 0) {
    children.push({
      type: "infoSection", title: "Доставка",
      fields: deliveryFields.map(f => ({
        bind: f.name, label: f.label || f.name,
        format: f.type === "number" ? "currency" : undefined,
      })),
    });
  }

  // 7. InfoSection: Характеристики (badge + остальные info)
  const badgeFields = byRole.badge || [];
  const otherInfoFields = (byRole.info || []).filter(f => !/shipping/i.test(f.name));
  const charFields = [...badgeFields, ...otherInfoFields];
  if (charFields.length > 0) {
    children.push({
      type: "infoSection", title: "Характеристики",
      fields: charFields.map(f => ({
        bind: f.name, label: f.label || f.name,
        format: f.type === "datetime" ? "datetime" : undefined,
      })),
    });
  }

  // 8. Refs
  const refFields = byRole.ref || [];
  if (refFields.length > 0) {
    children.push({
      type: "infoSection", title: "Связи",
      fields: refFields.map(f => ({ bind: f.name, label: f.label || f.name })),
    });
  }

  return { type: "column", gap: 16, children };
}
