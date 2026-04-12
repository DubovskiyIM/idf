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
 * Семантическая роль поля. Выводится из имени + типа из онтологии.
 * Используется карточкой (GridCard cardSpec), формой (секции),
 * и detail body (priceBlock, infoSection, timer).
 *
 * Правила применяются сверху вниз — первое совпадение побеждает.
 */
export function inferFieldRole(fieldName, fieldDef) {
  const name = fieldName || "";
  const type = fieldDef?.type || "";

  // title
  if (name === "title" || name === "name") return "title";

  // description
  if (type === "textarea" && /^(description|bio|content)$/.test(name)) return "description";

  // heroImage
  if (type === "image" || type === "multiImage") return "heroImage";

  // price — number + имя содержит price/cost/amount
  if (type === "number" && /price|cost|amount/i.test(name)) return "price";

  // timer — datetime + имя содержит end/deadline/expir
  if ((type === "datetime" || type === "date") && /end|deadline|expir/i.test(name)) return "timer";

  // location — имя содержит location/from/city (но не number — те уже price)
  if (/^(location|city)$|from$/i.test(name) && type !== "number") return "location";

  // badge — enum или status/condition
  if (type === "enum" || /^(status|condition)$/.test(name)) return "badge";

  // ref — entityRef
  if (type === "entityRef") return "ref";

  // metric — number (не price, не shipping cost — те уже покрыты выше)
  if (type === "number") return "metric";

  // info — всё остальное
  return "info";
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
