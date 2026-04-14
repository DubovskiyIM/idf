/**
 * Автогруппировка replace-интентов в синтетические entityForm проекции.
 *
 * §16 манифеста (производные проекции, v1.2 draft): кристаллизатор может
 * генерировать проекции, производные от декларированных, если множество
 * намерений образует логическую группу.
 *
 * Правило: для каждой detail-проекции с mainEntity X, если в INTENTS есть
 * ≥2 намерения с эффектами `replace X.field` на разные поля, генерируется
 * синтетическая edit-проекция `{detailId}_edit` с kind: "form", доступная
 * из detail через navigation edge `edit-action`.
 *
 * Форма собирает все поля X из онтологии (нормализованные через
 * getEntityFields), проверяет read/write по viewer-роли, сохранение идёт
 * через execBatch как atomic batch-эффект (α:"batch", §10, §11).
 */

import { getEntityFields, canRead, canWrite, inferFieldRole } from "./ontologyHelpers.js";

const SYSTEM_FIELDS = new Set([
  "id", "createdAt", "updatedAt", "deletedAt", "deletedFor",
]);

// Роль → секция формы (id + title + порядок сортировки)
const ROLE_TO_SECTION = {
  title:       { id: "main",     title: "Основное",       order: 0 },
  description: { id: "main",     title: "Основное",       order: 0 },
  heroImage:   { id: "media",    title: "Медиа",          order: 1 },
  price:       { id: "price",    title: "Цена",           order: 2 },
  badge:       { id: "attrs",    title: "Характеристики", order: 3 },
  metric:      { id: "attrs",    title: "Характеристики", order: 3 },
  info:        { id: "attrs",    title: "Характеристики", order: 3 },
  location:    { id: "shipping", title: "Доставка",       order: 4 },
  timer:       { id: "time",     title: "Время",          order: 5 },
  ref:         { id: "refs",     title: "Связи",          order: 6 },
};

function getSectionForField(fieldName, role) {
  if (/shipping/i.test(fieldName) && role !== "heroImage" && role !== "price") {
    return { id: "shipping", title: "Доставка", order: 4 };
  }
  return ROLE_TO_SECTION[role] || { id: "other", title: "Другое", order: 99 };
}

/**
 * Найти intents, чьи эффекты — replace X.field (без hardcoded значения).
 * Возвращает массив {intentId, field, intent} — один entry на каждое
 * покрываемое поле (один intent может покрывать несколько полей,
 * например update_profile с replace user.name + replace user.avatar).
 *
 * Intents с hardcoded `ef.value` (например delete_avatar с value:"")
 * — это preset-intents, не form-редакторы, пропускаем.
 */
export function findReplaceIntents(INTENTS, mainEntity) {
  const lower = mainEntity.toLowerCase();
  const result = [];

  for (const [id, intent] of Object.entries(INTENTS)) {
    const effects = intent.particles?.effects || [];
    for (const ef of effects) {
      if (ef.α !== "replace") continue;
      const target = ef.target || "";
      if (!target.startsWith(lower + ".")) continue;
      const field = target.split(".")[1];
      if (!field) continue;
      // Preset-intents (ef.value задан) — не form-редакторы
      if (ef.value !== undefined) continue;
      result.push({ intentId: id, field, intent });
      // NO break — один intent может покрывать несколько полей
    }
  }

  return result;
}

/**
 * Для каждой detail-проекции домена сгенерировать синтетическую edit-проекцию,
 * если replace-intent'ов достаточно для формы.
 * Возвращает объект новых проекций в формате PROJECTIONS (merge'ится с исходными).
 */
export function generateEditProjections(INTENTS, PROJECTIONS, ONTOLOGY) {
  const editProjections = {};

  for (const [projId, proj] of Object.entries(PROJECTIONS)) {
    if (proj.kind !== "detail") continue;
    const mainEntity = proj.mainEntity;
    if (!mainEntity) continue;

    // Если автор уже явно создал edit-проекцию — не перетираем
    const editProjId = projId + "_edit";
    if (PROJECTIONS[editProjId]) continue;

    const fieldEntries = findReplaceIntents(INTENTS, mainEntity);
    // Уникальные field'ы (два разных поля) — минимальный порог для формы.
    // Intent-ids могут повторяться (один intent на несколько полей).
    const uniqueFields = new Set(fieldEntries.map(e => e.field));
    if (uniqueFields.size < 2) continue;

    const uniqueIntentIds = [...new Set(fieldEntries.map(e => e.intentId))];

    editProjections[editProjId] = {
      name: (proj.name || projId) + ": редактирование",
      kind: "form",
      mainEntity,
      entities: [mainEntity],
      idParam: proj.idParam,
      routeEntities: [],
      sourceProjection: projId,
      editIntents: uniqueIntentIds,
    };
  }

  return editProjections;
}

/**
 * Построить спецификацию формы: массив полей с editable-флагом,
 * покрытие intent-ами и метаданными.
 *
 * @param {object} editProjection — синтетическая edit-проекция с editIntents
 * @param {object} INTENTS
 * @param {object} ONTOLOGY
 * @param {string} viewerRole — роль просматривающего (для canWrite/canRead)
 */
export function buildFormSpec(editProjection, INTENTS, ONTOLOGY, viewerRole = "self") {
  const mainEntity = editProjection.mainEntity;
  const entity = ONTOLOGY?.entities?.[mainEntity];
  const ontologyFields = getEntityFields(entity || {});

  // Карта field → intentId (какой intent изменяет это поле)
  const fieldCoverage = {};
  const editIntentIds = editProjection.editIntents || [];
  for (const intentId of editIntentIds) {
    const intent = INTENTS[intentId];
    if (!intent) continue;
    for (const ef of (intent.particles?.effects || [])) {
      if (ef.α !== "replace") continue;
      const field = ef.target?.split(".")[1];
      if (field) fieldCoverage[field] = intentId;
    }
  }

  // Собираем поля формы: системные пропускаем, невидимые для роли — тоже
  const fields = [];
  for (const f of ontologyFields) {
    if (SYSTEM_FIELDS.has(f.name)) continue;
    if (!canRead(f, viewerRole)) continue;

    const coveredBy = fieldCoverage[f.name];
    // Поле editable если: (1) есть покрывающий intent, (2) ontology-правила
    // разрешают запись для роли, (3) поле не read-only в онтологии.
    const writableByRole = canWrite(f, viewerRole);
    const editable = Boolean(coveredBy) && writableByRole;

    // Для enum-полей пробрасываем options из onto (values + valueLabels)
    let options = null;
    if (f.type === "enum" && Array.isArray(f.values)) {
      const labels = f.valueLabels || {};
      options = f.values.map(v => ({ value: v, label: labels[v] || v }));
    }

    fields.push({
      name: f.name,
      type: f.type || "text",
      editable,
      required: f.required || false,
      label: f.label || f.name,
      intentId: coveredBy || null,
      options,
    });
  }

  // Генерация секций по семантическим ролям
  const sectionMap = new Map();
  for (const f of fields) {
    if (!f.editable) continue;
    const role = inferFieldRole(f.name, { type: f.type });
    const sec = getSectionForField(f.name, role);
    if (!sectionMap.has(sec.id)) {
      sectionMap.set(sec.id, { id: sec.id, title: sec.title, order: sec.order, fields: [] });
    }
    sectionMap.get(sec.id).fields.push(f);
  }

  const sections = [...sectionMap.values()]
    .filter(s => s.fields.length > 0)
    .sort((a, b) => a.order - b.order)
    .map(({ id, title, fields: sFields }) => ({ id, title, fields: sFields }));

  return {
    mainEntity,
    fields,
    sections,
    editIntents: editIntentIds,
  };
}
