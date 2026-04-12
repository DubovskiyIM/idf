/**
 * Утилиты работы с полями онтологии.
 *
 * Поле может быть в двух форматах:
 *  1. Строка — legacy: `fields: ["id", "name", "avatar"]`
 *  2. Объект — новый: `fields: { name: { type: "text", read: [...], write: [...] } }`
 *
 * normalizeField делает формат единообразным. getEntityFields возвращает
 * массив нормализованных полей — кристаллизатор и detail-body работают
 * только с массивом.
 *
 * canWrite / canRead проверяют доступ поля для роли зрителя (§5 манифеста:
 * зависимость от зрителя).
 */

/**
 * Нормализует поле в объектный формат `{ name, type, read?, write?, required? }`.
 * Если поле — строка, тип выводится из имени эвристически.
 */
export function normalizeField(fieldDef, fieldName) {
  if (typeof fieldDef === "string") {
    return { name: fieldDef, type: inferTypeFromName(fieldDef) };
  }
  return { name: fieldName || fieldDef.name, ...fieldDef };
}

/**
 * Вернуть массив нормализованных полей сущности.
 * Поддерживает оба формата fields (массив строк или объект).
 */
export function getEntityFields(entity) {
  if (!entity?.fields) return [];
  if (Array.isArray(entity.fields)) {
    return entity.fields.map(f => normalizeField(f));
  }
  // Объектный формат: fields: { name: {...}, email: {...} }
  return Object.entries(entity.fields).map(([name, def]) => normalizeField(def, name));
}

/**
 * Может ли роль записывать в поле.
 * Нет field.write → нет права записи по умолчанию.
 * field.write === ["*"] → все роли могут писать.
 * field.write включает роль → может.
 */
export function canWrite(field, role) {
  if (!field?.write || field.write.length === 0) return false;
  if (field.write.includes("*")) return true;
  return field.write.includes(role);
}

/**
 * Может ли роль читать поле.
 * Нет field.read → поле публично по умолчанию.
 * field.read === ["*"] → все.
 * field.read включает роль → может.
 */
export function canRead(field, role) {
  if (!field?.read || field.read.length === 0) return true;
  if (field.read.includes("*")) return true;
  return field.read.includes(role);
}

/**
 * Эвристика типа из имени поля (для обратной совместимости со старым
 * форматом onтологии, где поля были массивом строк).
 */
function inferTypeFromName(name) {
  // id: "id", "userId", "user_id", "senderId", ...
  if (/^id$|_id$|Id$/.test(name)) return "id";
  // datetime: exact "date"/"time", *At, *Date, *Time, _at/_date/_time
  // Без последнего условия "startTime"/"endTime" нормализуются в text,
  // а не в datetime — и DateInput адаптера не срабатывает.
  if (/^(date|time)$|_at$|_time$|_date$|At$|Date$|Time$/.test(name)) return "datetime";
  if (/_url$|_link$|^url$|Url$/.test(name)) return "url";
  if (/_email$|^email$|Email$/.test(name)) return "email";
  if (/_phone$|^phone$|Phone$/.test(name)) return "tel";
  if (/avatar|image|photo|wallpaper/i.test(name)) return "image";
  if (/^(content|description|bio|statusMessage|rules|welcomeMessage)$/.test(name)) return "textarea";
  return "text";
}

/**
 * Маппинг ontology-типа на тип контрола параметр-формы.
 * Используется в inferControlType для приоритетного вывода типа.
 */
export function mapOntologyTypeToControl(ontologyType) {
  const map = {
    text: "text",
    textarea: "textarea",
    email: "email",
    tel: "tel",
    url: "url",
    number: "number",
    datetime: "datetime",
    date: "datetime",
    image: "file",
    multiImage: "multiImage",
    file: "file",
    enum: "select",
    id: "text", // id обычно не редактируется через форму
  };
  return map[ontologyType] || "text";
}
