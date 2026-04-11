/**
 * Серверный порт src/runtime/crystallize_v2/inferParameters.js.
 *
 * Выводит список параметров для agent-schema из:
 *   1. intent.parameters (если явно задан автором)
 *   2. witnesses (не-точечные — это параметры, точечные — preview)
 *   3. creates:X — поля entity из ontology (foreign keys → entityRef,
 *                  system fields исключены)
 *
 * Возвращает shape, пригодный для agent-schema:
 *   { name, type, required, entity?, description? }
 */

const { inferControlType, isForeignKey } = require("./inferControlType.cjs");

const SYSTEM_FIELDS = new Set([
  "id", "createdAt", "created_at", "updatedAt", "updated_at",
  "createdBy", "senderId", "authorId", "ownerId", "userId", "clientId",
  "status", "deletedAt", "deletedFor"
]);

const RESULT_WITNESSES = new Set([
  "results", "translated_text", "selected_count", "available_reactions",
  "read_by", "delivered_to", "invite_url"
]);

function normalizeCreates(creates) {
  if (typeof creates !== "string") return null;
  return creates.replace(/\s*\(.*\)\s*$/, "").trim();
}

/**
 * Для поля-foreign-key "specialistId" находит entity в ontology:
 * "Specialist". Использует camelCase-сопоставление: strip'ит "Id" и
 * ищет PascalCase-ключ.
 */
function resolveFKEntity(fieldName, ontology) {
  if (!isForeignKey(fieldName)) return null;
  const base = fieldName.slice(0, -2); // "specialistId" → "specialist"
  // Сопоставляем без учёта регистра первой буквы
  const pascal = base.charAt(0).toUpperCase() + base.slice(1);
  if (ontology?.entities?.[pascal]) return pascal;
  // Особые case'ы: slotId → TimeSlot
  if (base === "slot" && ontology?.entities?.TimeSlot) return "TimeSlot";
  return null;
}

function makeParameter(name, ontology, required = true) {
  const type = inferControlType(name);
  const param = { name, type, required };
  if (type === "entityRef") {
    const entity = resolveFKEntity(name, ontology);
    if (entity) param.entity = entity;
  }
  return param;
}

function inferParameters(intent, ontology) {
  // 1. Явный parameters — победитель
  if (Array.isArray(intent.parameters) && intent.parameters.length > 0) {
    return intent.parameters;
  }

  const witnesses = intent.particles?.witnesses || [];
  const creates = intent.creates;
  const params = [];
  const seen = new Set();

  // 2. Witnesses без точки — это параметры
  for (const w of witnesses) {
    if (RESULT_WITNESSES.has(w)) continue;
    if (w.includes(".")) continue; // dot = preview, не параметр
    const name = w.startsWith("current_") ? w.replace(/^current_/, "") : w;
    if (seen.has(name)) continue;
    seen.add(name);
    params.push(makeParameter(name, ontology));
  }

  // 3. creates:X — поля entity
  const createsNorm = normalizeCreates(creates);
  if (createsNorm && ontology?.entities?.[createsNorm]) {
    const entity = ontology.entities[createsNorm];
    const fields = Array.isArray(entity.fields)
      ? entity.fields
      : Object.keys(entity.fields || {});
    for (const field of fields) {
      if (SYSTEM_FIELDS.has(field)) continue;
      // Foreign keys НЕ исключаем из agent-параметров — агент их передаёт.
      // (В отличие от клиентского inferParameters, где fk skip'ятся,
      // потому что рантайм их берёт из routeParams.)
      if (seen.has(field)) continue;
      seen.add(field);
      params.push(makeParameter(field, ontology));
    }
  }

  return params;
}

module.exports = { inferParameters };
