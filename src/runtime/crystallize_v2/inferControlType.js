/**
 * §1.2 дизайна: выведение типа контрола из параметра.
 * Приоритет: явный type → анкеринг в онтологию → имя-эвристика → fallback "text".
 */

const PATTERNS = [
  // file types
  { re: /(^|_)(file|image|video|document|avatar|wallpaper)$/i, type: "file" },
  { re: /(^|_)(image|video|avatar|wallpaper)_/i, type: "file" },
  // datetime
  { re: /(^|_)(time|date|at|scheduled|deadline)$/i, type: "datetime" },
  { re: /(scheduled|deadline)_/i, type: "datetime" },
  // number
  { re: /(^|_)(count|interval|duration|size|quantity)$/i, type: "number" },
  // email, phone, url
  { re: /(^|_)email$/i, type: "email" },
  { re: /(^|_)phone$/i, type: "tel" },
  { re: /(^|_)(url|link)$/i, type: "url" },
  // textarea (длинный текст)
  { re: /^(description|content|rules|message|text)$/i, type: "textarea" },
  { re: /(^|_)(message|content|description|reason|rules)$/i, type: "textarea" },
  // text (короткий)
  { re: /(^|_)(name|title|query)$/i, type: "text" },
  { re: /^draft_text$/i, type: "text" },
  // picker types
  { re: /^sticker_id$/i, type: "assetPicker" },
  { re: /^gif_url$/i, type: "assetPicker" },
];

import { getEntityFields, mapOntologyTypeToControl } from "./ontologyHelpers.js";

/**
 * Обогатить параметр опциями из онтологии для enum/select-полей.
 * Вызывается после inferControlType. Мутирует param, добавляя options.
 */
export function enrichWithOptions(param, ONTOLOGY) {
  if (param.control !== "select" || param.options) return param;
  // Ищем enum-поле в онтологии
  const findField = (entityName) => {
    const entity = ONTOLOGY?.entities?.[entityName];
    if (!entity?.fields) return null;
    const fields = getEntityFields(entity);
    return fields.find(f => f.name === param.name);
  };

  const field = param.entity
    ? findField(param.entity)
    : Object.keys(ONTOLOGY?.entities || {}).reduce((found, e) => found || findField(e), null);

  if (field?.values) {
    const labels = field.valueLabels || {};
    param.options = field.values.map(v => ({ value: v, label: labels[v] || v }));
  } else if (field?.type === "enum" && param.entity) {
    // Fallback: statuses как options
    const entity = ONTOLOGY?.entities?.[param.entity];
    if (entity?.statuses) {
      param.options = entity.statuses.map(s => ({ value: s, label: s }));
    }
  }
  return param;
}

export function inferControlType(param, ONTOLOGY) {
  // 1. Явный type в параметре
  if (param.type) return param.type;

  // 2. Массив → multiSelect
  if (param.isArray) return "multiSelect";

  // 3. Приоритетный источник: анкеринг поля к онтологии (типизированные fields)
  if (param.entity && ONTOLOGY?.entities?.[param.entity]) {
    const entity = ONTOLOGY.entities[param.entity];
    const fields = getEntityFields(entity);
    const field = fields.find(f => f.name === param.name);
    if (field?.type) {
      // Специальный случай: status — это enum, даже если тип не объявлен явно
      if (Array.isArray(entity.statuses) && param.name === "status") return "select";
      return mapOntologyTypeToControl(field.type);
    }
    if (Array.isArray(entity.statuses) && param.name === "status") return "select";
  }

  // 3b. Без entity-привязки — поиск поля по имени во всех entities онтологии
  if (!param.entity && ONTOLOGY?.entities) {
    for (const entity of Object.values(ONTOLOGY.entities)) {
      const fields = getEntityFields(entity);
      const field = fields.find(f => f.name === (param.name || ""));
      if (field?.type) return mapOntologyTypeToControl(field.type);
    }
  }

  // 4. Имя-эвристика (fallback)
  const name = param.name || "";
  for (const { re, type } of PATTERNS) {
    if (re.test(name)) return type;
  }

  // 5. Fallback
  return "text";
}
