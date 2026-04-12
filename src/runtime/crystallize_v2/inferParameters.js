/**
 * §1.1 дизайна: извлечение параметров намерения из witnesses/parameters/creates.
 * Возвращает Parameter[] — список того, что нужно собрать у пользователя.
 */

// Системные поля, которые не должны собираться у пользователя при creates:X
const SYSTEM_FIELDS = new Set([
  "id", "createdAt", "created_at", "updatedAt", "updated_at",
  "createdBy", "senderId", "authorId", "ownerId", "userId",
  "status", "deletedAt", "deletedFor",
]);

// Foreign key поля: заканчиваются на "Id" (не сам "id"). Это ссылки
// на родительские сущности (pollId, conversationId, specialistId) — их
// проставляет рантайм из routeParams/target, пользователь их не вводит.
function isForeignKey(fieldName) {
  return /Id$/.test(fieldName) && fieldName !== "id";
}

// Witnesses, которые являются результатами выполнения, не входом
const RESULT_WITNESSES = new Set([
  "results", "translated_text", "selected_count", "available_reactions",
  "read_by", "delivered_to", "invite_url",
]);

export function inferParameters(intent, ONTOLOGY) {
  // 1. Явный parameters → победитель (даже пустой массив — автор
  // сознательно подавляет inference для click-action intents вроде
  // create_direct_chat, где params auto-filled buildEffects'ом)
  if (Array.isArray(intent.parameters)) {
    return intent.parameters;
  }

  const witnesses = intent.particles?.witnesses || [];
  const phase = intent.phase;
  const creates = intent.creates;

  const params = [];

  // 2. Витнессы
  for (const w of witnesses) {
    if (RESULT_WITNESSES.has(w)) continue;

    if (w.includes(".")) {
      // Точечный: read-only preview, если не investigation
      if (phase === "investigation") {
        const field = w.split(".").pop();
        params.push({ name: field, bind: w, editable: true, inferredFrom: "phase-investigation" });
      }
      // Иначе — preview, не параметр
      continue;
    }

    // Без точки — либо current_X, либо прямой параметр
    if (w.startsWith("current_")) {
      params.push({ name: w.replace(/^current_/, ""), inferredFrom: "current-selector" });
    } else {
      params.push({ name: w, inferredFrom: "direct-witness" });
    }
  }

  // 3. creates:X — поля сущности (если не уже собраны из witnesses).
  // Normalize creates чтобы сработало для booking "Booking(draft)".
  const createsNorm = typeof creates === "string" ? creates.replace(/\s*\(.*\)\s*$/, "").trim() : creates;
  if (createsNorm && ONTOLOGY?.entities?.[createsNorm]) {
    const entity = ONTOLOGY.entities[createsNorm];
    // Поддержка обоих форматов: массив строк (legacy) или объект {name: {...}}
    const fields = Array.isArray(entity.fields)
      ? entity.fields
      : Object.keys(entity.fields || {});
    const existingNames = new Set(params.map(p => p.name));
    for (const field of fields) {
      if (SYSTEM_FIELDS.has(field)) continue;
      if (isForeignKey(field)) continue; // pollId, conversationId — проставляет рантайм
      if (existingNames.has(field)) continue;
      params.push({ name: field, inferredFrom: "creates-entity", entity: createsNorm });
    }
  }

  return params;
}
