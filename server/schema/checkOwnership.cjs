/**
 * checkOwnership — проверка, что viewer владеет target-сущностью
 * для write-intent'а.
 *
 * Выводится из ontology.entities[X].ownerField. Для write-intent'а
 * (замена или удаление существующей сущности) итерирует replace/remove
 * effects, для каждого owned entity находит в world соответствующий
 * инстанс через param-convention (`<entityCamelLower>Id`) и проверяет
 * `instance[ownerField] === viewer.id`.
 *
 * Creator intents (только add effects) — пропускаются, они сами устанавливают
 * ownerField = viewer.id при создании (см. buildBookingEffects).
 *
 * Returns { ok: boolean, reason?, entityName?, entityId? }.
 *
 * Это замыкает §23 open: «Synthetic write-ownership для agent write-intents».
 * Заявляется автоматически из ontology, не дублируется в каждом intent.
 */

/**
 * Нормализация target в entity name с учётом alias'ов (slot ↔ TimeSlot).
 * Возвращает PascalCase entity name, match'ится с ontology.entities ключом.
 */
function resolveEntityName(target, ontology) {
  if (!target || typeof target !== "string") return null;
  const base = target.split(".")[0];
  if (!ontology?.entities) return null;

  // Если base — уже lowercased entity name (например, "booking"), найти его
  const lowerBase = base.endsWith("s") ? base.slice(0, -1) : base;

  for (const entityName of Object.keys(ontology.entities)) {
    const entityLower = entityName.toLowerCase();
    if (entityLower === lowerBase) return entityName;

    // Last CamelCase segment matching (TimeSlot → "slot")
    const segments = entityName.match(/[A-Z][a-z]*/g) || [];
    if (segments.length > 1) {
      const lastSegment = segments[segments.length - 1].toLowerCase();
      if (lastSegment === lowerBase) return entityName;
    }
  }

  return null;
}

/**
 * Вычислить plural-форму коллекции для entity.
 *
 * Повторяет стратегию из filterWorld: пробует стандартный plural
 * (bookings/reviews) + last segment plural (TimeSlot → slots).
 */
function getCollectionName(entityName, world) {
  if (!entityName) return null;
  const standardPlural = entityName.toLowerCase() + "s";
  if (world[standardPlural]) return standardPlural;

  const segments = entityName.match(/[A-Z][a-z]*/g) || [];
  if (segments.length > 1) {
    const lastSegmentPlural = segments[segments.length - 1].toLowerCase() + "s";
    if (world[lastSegmentPlural]) return lastSegmentPlural;
  }

  return standardPlural;
}

/**
 * Имя параметра, содержащего id целевой сущности: <camelLower>Id.
 *   Booking → bookingId
 *   Review  → reviewId
 *   TimeSlot → timeSlotId  (но slot обычно приходит как slotId — см. last segment)
 */
function getIdParamKey(entityName) {
  if (!entityName) return null;
  const segments = entityName.match(/[A-Z][a-z]*/g) || [entityName];
  const lastSegment = segments[segments.length - 1];
  return lastSegment.charAt(0).toLowerCase() + lastSegment.slice(1) + "Id";
}

function checkOwnership(intent, params, viewer, ontology, world) {
  const effects = intent.particles?.effects || [];

  // Собираем уникальные owned entities, на которые intent делает write
  const checked = new Set();

  for (const eff of effects) {
    const alpha = eff.α || eff.alpha;
    if (alpha !== "replace" && alpha !== "remove") continue;

    const entityName = resolveEntityName(eff.target, ontology);
    if (!entityName) continue;
    if (checked.has(entityName)) continue;

    const entityDef = ontology.entities?.[entityName];
    if (!entityDef?.ownerField) continue;

    checked.add(entityName);

    // Находим target instance в world
    const idKey = getIdParamKey(entityName);
    const entityId = params?.[idKey];
    if (!entityId) continue;

    const collName = getCollectionName(entityName, world);
    const collection = world[collName] || [];
    const instance = collection.find(r => r?.id === entityId);
    if (!instance) continue; // buildEffects ниже поймает not-found

    const owner = instance[entityDef.ownerField];
    if (owner !== viewer.id) {
      return {
        ok: false,
        reason: `${entityName} ${entityId} принадлежит другому пользователю`,
        entityName,
        entityId
      };
    }
  }

  return { ok: true };
}

module.exports = { checkOwnership, resolveEntityName, getIdParamKey };
