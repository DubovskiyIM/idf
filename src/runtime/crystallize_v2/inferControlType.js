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

export function inferControlType(param, ONTOLOGY) {
  // 1. Явный type в параметре
  if (param.type) return param.type;

  // 2. Массив → multiSelect
  if (param.isArray) return "multiSelect";

  // 3. Анкеринг к онтологии: если param.entity указан, и поле имеет statuses → select
  if (param.entity && ONTOLOGY?.entities?.[param.entity]) {
    const entity = ONTOLOGY.entities[param.entity];
    if (Array.isArray(entity.statuses) && param.name === "status") return "select";
    // В M5 сюда добавится разбор entity.fields как объектов с типами
  }

  // 4. Имя-эвристика
  const name = param.name || "";
  for (const { re, type } of PATTERNS) {
    if (re.test(name)) return type;
  }

  // 5. Fallback
  return "text";
}
