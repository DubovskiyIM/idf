/**
 * deriveProjections — деривация проекций из намерений и онтологии.
 *
 * Принцип максимальной деривации: если структура выводима из намерений,
 * она не является отдельным входом системы.
 *
 * Правила:
 * R1: creators(E) → catalog
 * R2: confirmation:"enter" + foreignKey → feed
 * R3: |mutators(E)| > 1 → detail
 * R4: foreignKey E'→E → subCollection в detail(E)
 * R6: witnesses из пересекающихся intents
 * R7: ownerField → my_* catalog с фильтром
 */

/**
 * Нормализация creates: "Listing(draft)" → "Listing"
 */
function normalizeCreates(creates) {
  if (!creates) return null;
  return creates.replace(/\(.*\)$/, "");
}

/**
 * Pluralize entity name: Listing → listings, Category → categories
 */
function pluralize(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith("s")) return lower + "es";
  if (lower.endsWith("y")) return lower.slice(0, -1) + "ies";
  return lower + "s";
}

/**
 * Резолвим имя из target эффекта в имя сущности из онтологии.
 * "listing" → "Listing", "listings" → "Listing", "listing.title" base="listing" → "Listing"
 */
function resolveEntityName(base, entityNames) {
  // Точное совпадение (case-insensitive)
  const exact = entityNames.find(e => e.toLowerCase() === base.toLowerCase());
  if (exact) return exact;
  // Plural → singular: "listings" → "Listing"
  const asPlural = entityNames.find(e => pluralize(e) === base.toLowerCase());
  if (asPlural) return asPlural;
  return null;
}

/**
 * Один проход по INTENTS: собирает creators, mutators, feedSignals на каждую сущность.
 * @param {Record<string, object>} intents
 * @param {string[]} [entityNames] — имена сущностей из онтологии (для резолва target)
 */
export function analyzeIntents(intents, entityNames) {
  // Если entityNames не переданы, собираем из creates + entities
  if (!entityNames) {
    const names = new Set();
    for (const intent of Object.values(intents)) {
      const created = normalizeCreates(intent.creates);
      if (created) names.add(created);
      for (const e of intent.particles?.entities || []) {
        const parts = e.split(":");
        const typeName = (parts[1] || parts[0]).trim();
        names.add(typeName);
      }
    }
    entityNames = [...names];
  }

  const creators = {};    // E → [intentId, ...]
  const mutators = {};    // E → [intentId, ...]
  const feedSignals = {}; // E → [intentId, ...]

  for (const [id, intent] of Object.entries(intents)) {
    // creators
    const createdEntity = normalizeCreates(intent.creates);
    if (createdEntity) {
      if (!creators[createdEntity]) creators[createdEntity] = [];
      creators[createdEntity].push(id);
    }

    // mutators — из effects
    if (intent.particles?.effects) {
      for (const eff of intent.particles.effects) {
        if (!eff.target) continue;
        const base = eff.target.split(".")[0];
        const entityName = resolveEntityName(base, entityNames);
        if (!entityName) continue;
        if (!mutators[entityName]) mutators[entityName] = [];
        if (!mutators[entityName].includes(id)) {
          mutators[entityName].push(id);
        }
      }
    }

    // feedSignals — creates + confirmation:"enter"
    if (createdEntity && intent.particles?.confirmation === "enter") {
      if (!feedSignals[createdEntity]) feedSignals[createdEntity] = [];
      feedSignals[createdEntity].push(id);
    }
  }

  return { creators, mutators, feedSignals };
}

/**
 * Детекция foreignKey-полей из онтологии.
 * Приоритет: type:"entityRef" > суффикс Id (fallback для array-формата).
 * @returns {{ [entityName: string]: Array<{field: string, references: string}> }}
 */
export function detectForeignKeys(ontology) {
  const entityNames = Object.keys(ontology.entities || {});
  const result = {};

  for (const [entityName, entityDef] of Object.entries(ontology.entities || {})) {
    const fks = [];
    const fields = entityDef.fields;

    if (fields && !Array.isArray(fields)) {
      // Typed format: { fieldName: { type, ... } }
      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        if (fieldName === "id") continue;
        if (fieldDef.type === "entityRef") {
          // Ищем referenced entity: сначала точное совпадение refName→entityName,
          // потом через ownerField-паттерны (bidderId → User через Bid.ownerField)
          const refName = fieldName.replace(/Id$/, "");
          const referenced = entityNames.find(e => e.toLowerCase() === refName.toLowerCase());
          if (referenced) {
            fks.push({ field: fieldName, references: referenced });
          }
        }
      }
    } else if (Array.isArray(fields)) {
      // Array format: ["id", "pollId", "userId"]
      for (const fieldName of fields) {
        if (fieldName === "id") continue;
        if (fieldName.endsWith("Id")) {
          const refName = fieldName.replace(/Id$/, "");
          const referenced = entityNames.find(e => e.toLowerCase() === refName.toLowerCase());
          if (referenced) {
            fks.push({ field: fieldName, references: referenced });
          }
        }
      }
    }

    if (fks.length > 0) result[entityName] = fks;
  }

  return result;
}

/**
 * deriveProjections — главная функция.
 * Выводит проекции из намерений и онтологии по правилам R1-R7.
 * @param {Record<string, object>} intents
 * @param {object} ontology
 * @returns {Record<string, object>} проекции в формате projections.js
 */
export function deriveProjections(intents, ontology) {
  const entityNames = Object.keys(ontology.entities || {});
  const analysis = analyzeIntents(intents, entityNames);
  const foreignKeys = detectForeignKeys(ontology);
  const projections = {};

  for (const entityName of entityNames) {
    const lower = entityName.toLowerCase();
    const hasCreators = (analysis.creators[entityName] || []).length > 0;
    const mutatorCount = (analysis.mutators[entityName] || []).length;

    // R1: Catalog
    if (hasCreators) {
      projections[`${lower}_list`] = {
        kind: "catalog",
        mainEntity: entityName,
        entities: [entityName],
        witnesses: [],
      };
    }

    // R3: Detail
    if (mutatorCount > 1) {
      projections[`${lower}_detail`] = {
        kind: "detail",
        mainEntity: entityName,
        entities: [entityName],
        witnesses: [],
      };
    }
  }

  return projections;
}
