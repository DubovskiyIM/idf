/**
 * Маппит имя поля на type агентского параметра.
 *
 * Server-oriented types (агент получает их в schema):
 *   entityRef | text | textarea | number | datetime | select | boolean
 *
 * Приоритет резолва:
 *   1. Foreign key (имя оканчивается на `Id`, но не `id`) → entityRef
 *   2. Типовые имена (date, startTime, endTime, scheduledAt) → datetime
 *   3. Числовые имена (price, rating, duration, count) → number
 *   4. Текстовые длинные (text, description, body, content, comment) → textarea
 *   5. Иначе → text
 */

const FK_PATTERN = /Id$/;
const DATETIME_FIELDS = new Set([
  "date", "time", "startTime", "endTime", "scheduledAt", "deadline", "createdAt", "updatedAt"
]);
const NUMBER_FIELDS = new Set([
  "price", "rating", "duration", "count", "amount", "quantity"
]);
const TEXTAREA_FIELDS = new Set([
  "text", "description", "body", "content", "comment", "bio", "response"
]);

function isForeignKey(name) {
  return FK_PATTERN.test(name) && name !== "id";
}

function inferControlType(paramName) {
  if (isForeignKey(paramName)) return "entityRef";
  if (DATETIME_FIELDS.has(paramName)) return "datetime";
  if (NUMBER_FIELDS.has(paramName)) return "number";
  if (TEXTAREA_FIELDS.has(paramName)) return "textarea";
  return "text";
}

module.exports = { inferControlType, isForeignKey };
