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
  const effects = intent.particles?.effects || [];
  const phase = intent.phase;
  const creates = intent.creates;

  // Собрать множество полей, покрытых эффектами intent'а.
  // Только они являются настоящими входными параметрами (то, что меняется).
  const effectFields = new Set();
  for (const ef of effects) {
    if (ef.α === "replace" && typeof ef.target === "string" && ef.target.includes(".")) {
      effectFields.add(ef.target.split(".").pop());
    }
  }

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

    // Без точки — либо current_X, либо прямой параметр.
    // Но только если поле покрыто эффектом intent'а (иначе это
    // информационный witness, не входной параметр).
    if (w.startsWith("current_")) {
      params.push({ name: w.replace(/^current_/, ""), inferredFrom: "current-selector" });
    } else if (effectFields.has(w) || effects.length === 0 || creates) {
      // Поле покрыто эффектом → входной параметр.
      // Или intent без эффектов (search) / creator → все witnesses = параметры.
      params.push({ name: w, inferredFrom: "direct-witness" });
    }
    // Иначе — informational witness, пропускаем
  }

  // 3. creates:X — поля сущности (если не уже собраны из witnesses).
  // Normalize creates чтобы сработало для booking "Booking(draft)".
  const createsNorm = typeof creates === "string" ? creates.replace(/\s*\(.*\)\s*$/, "").trim() : creates;
  if (createsNorm && ONTOLOGY?.entities?.[createsNorm]) {
    const entity = ONTOLOGY.entities[createsNorm];
    // Поддержка обоих форматов: массив строк (legacy) или объект {name: {...}}
    const fieldsRaw = Array.isArray(entity.fields)
      ? entity.fields.map(f => ({ name: f }))
      : Object.entries(entity.fields || {}).map(([n, def]) => ({ name: n, ...def }));
    const existingNames = new Set(params.map(p => p.name));
    for (const field of fieldsRaw) {
      if (SYSTEM_FIELDS.has(field.name)) continue;
      if (isForeignKey(field.name)) continue;
      if (existingNames.has(field.name)) continue;
      // Поля без write-доступа — computed/read-only (bidCount, viewCount),
      // не собираются при создании.
      if (field.write && !field.write.includes("*") && !field.write.includes("self")) continue;
      if (field.read && !field.write) continue; // read-only поле
      params.push({ name: field.name, inferredFrom: "creates-entity", entity: createsNorm });
    }
  }

  return params;
}
