/**
 * Фильтрация folded world для конкретной роли.
 *
 * Три прохода в одном циклу по entities ontology:
 *   1. row-filter: сначала role.scope[entity] (many-to-many через via-коллекцию),
 *      иначе entity.ownerField (single-field owner).
 *   2. field-filter через role.visibleFields[entity] (скрываем clientId и т.п.)
 *   3. status-mapping через role.statusMapping (held → booked)
 *
 * Коллекция, для которой в role.visibleFields нет записи, не возвращается
 * в output вовсе.
 *
 * Many-to-many через role.scope (§17, §26.1 закрытый):
 *   roles.advisor.scope.Portfolio = {
 *     via: "assignments",         // имя коллекции-моста
 *     viewerField: "advisorId",   // поле моста, матчится против viewer.id
 *     joinField: "clientId",      // поле моста, даёт set разрешённых id
 *     localField: "userId",       // поле target entity, матчится с joinField
 *     statusField: "status",      // опц. — фильтр активности
 *     statusAllowed: ["active"],  // опц. — только такие статусы моста
 *   }
 *
 * Семантика: advisor видит Portfolio row'ы, где
 *   row.localField ∈ { m[joinField] | m ∈ world[via], m[viewerField] === viewer.id,
 *                                      (opt) m[statusField] ∈ statusAllowed }
 */

function pluralize(word) {
  if (!word) return word;
  if (word.endsWith("y")) return word.slice(0, -1) + "ies";
  if (word.endsWith("s")) return word + "es";
  return word + "s";
}

/**
 * Найти коллекцию в rawWorld для entity, пробуя несколько plural-форм:
 *   1. Стандартный plural lowercase (TimeSlot → timeslots)
 *   2. Last-CamelCase сегмент + s (TimeSlot → slots) — покрывает
 *      booking-домен, где коллекция исторически называется `slots`
 *
 * Возвращает { outputName, rows }:
 *   - outputName — всегда стандартный plural (первый candidate), чтобы
 *     агент видел predictable namespace по entity-name. Агент не должен
 *     знать про исторические alias'ы коллекций.
 *   - rows — данные из первой matching коллекции (или []).
 */
function findCollection(rawWorld, entityName) {
  const standardPlural = pluralize(entityName.toLowerCase());
  const candidates = [standardPlural];
  // TimeSlot → последний segment "Slot" → "slots"
  const segments = entityName.match(/[A-Z][a-z]*/g) || [];
  if (segments.length > 1) {
    candidates.push(pluralize(segments[segments.length - 1].toLowerCase()));
  }
  for (const cand of candidates) {
    if (Array.isArray(rawWorld[cand])) {
      return { outputName: standardPlural, rows: rawWorld[cand] };
    }
  }
  return { outputName: standardPlural, rows: [] };
}

/**
 * Вычисляет set разрешённых localField-значений через via-коллекцию.
 * Кэширует результат по (viewer.id, via) — один viewer обычно имеет
 * одну связку.
 */
function resolveAllowedIds(rawWorld, scope, viewer) {
  if (!scope?.via || !scope.viewerField || !scope.joinField) return null;
  const bridge = rawWorld[scope.via];
  if (!Array.isArray(bridge)) return new Set();

  const allowedStatuses = Array.isArray(scope.statusAllowed) && scope.statusAllowed.length > 0
    ? new Set(scope.statusAllowed)
    : null;

  const ids = new Set();
  for (const m of bridge) {
    if (m[scope.viewerField] !== viewer.id) continue;
    if (allowedStatuses && scope.statusField && !allowedStatuses.has(m[scope.statusField])) continue;
    const joinVal = m[scope.joinField];
    if (joinVal != null) ids.add(joinVal);
  }
  return ids;
}

function filterWorldForRole(rawWorld, ontology, roleName, viewer) {
  const role = ontology?.roles?.[roleName];
  if (!role) throw new Error(`Role "${roleName}" не найдена в ontology`);

  const visibleFields = role.visibleFields || {};
  const statusMapping = role.statusMapping || {};
  const scopes = role.scope || {};
  const filtered = {};

  for (const [entityName, entityDef] of Object.entries(ontology.entities || {})) {
    const allowed = visibleFields[entityName];
    if (!allowed) continue; // коллекция не видна этой роли

    const { outputName, rows } = findCollection(rawWorld, entityName);

    // 1) Row-filter: приоритет role.scope > entity.kind:"reference" >
    //    entity.ownerField > (no filter).
    // resolveAllowedIds вызывается per-entity, потому что scope может отличаться
    // по statusAllowed/statusField (Portfolio/Goal требуют status=active, User — нет).
    let owned;
    const scope = scopes[entityName];
    if (scope && scope.via) {
      const allowedIds = resolveAllowedIds(rawWorld, scope, viewer);
      const localField = scope.localField || entityDef.ownerField;
      if (!localField) {
        // Декларация нечитаема — защитно возвращаем пустой набор.
        owned = [];
      } else {
        owned = rows.filter(r => allowedIds.has(r[localField]));
      }
    } else if (entityDef.kind === "reference") {
      // Reference-data: shared справочник (Asset, Category, Currency...).
      // ownership не применяется — все видят все строки. Role.visibleFields
      // всё равно контролирует какие поля выдавать. §26.5 закрытие.
      owned = rows;
    } else if (entityDef.ownerField) {
      owned = rows.filter(r => r[entityDef.ownerField] === viewer.id);
    } else {
      owned = rows;
    }

    const projected = owned.map(row => {
      const out = {};
      for (const field of allowed) {
        let val = row[field];
        if (field === "status" && statusMapping[val]) {
          val = statusMapping[val];
        }
        if (val !== undefined) out[field] = val;
      }
      return out;
    });

    filtered[outputName] = projected;
  }

  return filtered;
}

module.exports = { filterWorldForRole };
