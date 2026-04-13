/** @typedef {import('../types/idf.d.ts').Effect} Effect */
/** @typedef {import('../types/idf.d.ts').Ontology} Ontology */
/** @typedef {import('../types/idf.d.ts').World} World */

import { causalSort } from "./causalSort.js";

/**
 * Построить маппинг singular→plural из онтологии.
 * @param {Ontology} [ontology]
 * @returns {Record<string, string>}
 */
export function buildTypeMap(ontology) {
  const map = { draft: "drafts" };
  if (ontology?.entities) {
    for (const entityName of Object.keys(ontology.entities)) {
      const singular = entityName.toLowerCase();
      const plural = singular.endsWith("s") ? singular + "es"
        : singular.endsWith("y") ? singular.slice(0, -1) + "ies"
        : singular + "s";
      map[singular] = plural;
    }
  }
  return map;
}

function getCollectionType(target, typeMap) {
  const base = target.split(".")[0];
  return typeMap[base] || base;
}

/**
 * fold(effects, typeMap) → world (объект по типам сущностей)
 *
 * По манифесту: World(t) = fold(⊕, ∅, sort≺(Φ_confirmed ↓ t))
 *
 * Эффекты сортируются причинно (parent_id → child) перед применением.
 * @param {Effect[]} effects
 * @param {Record<string, string>} [typeMap]
 * @returns {World}
 */
export function fold(effects, typeMap = {}) {
  const collections = {};
  const sorted = causalSort(effects);

  function applyEffect(ef) {
    if (ef.target.startsWith("drafts")) return;
    if (ef.scope === "presentation") return;

    // Batch: разворачиваем массив под-эффектов
    if (ef.alpha === "batch" && Array.isArray(ef.value)) {
      for (const sub of ef.value) applyEffect(sub);
      return;
    }

    const ctx = ef.context || {};
    const val = ef.value;
    const collType = getCollectionType(ef.target, typeMap);

    if (!collections[collType]) collections[collType] = {};

    switch (ef.alpha) {
      case "add": {
        const entityId = ctx.id || ef.id;
        collections[collType][entityId] = { ...ctx };
        break;
      }
      case "replace": {
        // Upsert: если сущности ещё нет в Φ (например, auth-users не
        // сидируются через add), создаём partial entity из {id, field}.
        // V2UI merge'ит такие partials с base из currentUser так, что
        // folded поля побеждают — см. V2UI.worldWithRoute.
        const entityId = ctx.id;
        if (entityId) {
          const field = ef.target.split(".").pop();
          const existing = collections[collType][entityId] || { id: entityId };
          collections[collType][entityId] = { ...existing, [field]: val };
        }
        break;
      }
      case "remove": {
        const entityId = ctx.id;
        if (entityId) delete collections[collType][entityId];
        break;
      }
    }
  }

  for (const ef of sorted) applyEffect(ef);

  const world = {};
  for (const [type, entities] of Object.entries(collections)) {
    world[type] = Object.values(entities);
  }
  return world;
}

/**
 * Применить косметические эффекты (Π) поверх world.
 * Мутирует копию world — обновляет визуальные свойства (x, y, порядок и т.д.)
 */
export function applyPresentation(world, effects, typeMap = {}) {
  // Глубокая копия world
  const result = {};
  for (const [key, arr] of Object.entries(world)) {
    result[key] = arr.map(e => ({ ...e }));
  }

  // Применить presentation-эффекты
  for (const ef of effects) {
    if (ef.scope !== "presentation") continue;
    const ctx = ef.context || {};
    const val = ef.value;
    const collType = getCollectionType(ef.target, typeMap);

    if (ef.alpha === "replace" && ctx.id && result[collType]) {
      const entity = result[collType].find(e => e.id === ctx.id);
      if (entity) {
        const field = ef.target.split(".").pop();
        entity[field] = val;
      }
    }
  }

  return result;
}

/**
 * Свернуть только черновики Δ.
 */
export function foldDrafts(effects) {
  const drafts = {};
  for (const ef of effects) {
    if (!ef.target.startsWith("drafts")) continue;
    const ctx = ef.context || {};

    switch (ef.alpha) {
      case "add": {
        const entityId = ctx.id || ef.id;
        drafts[entityId] = { ...ctx, _effectId: ef.id };
        break;
      }
      case "replace": {
        const entityId = ctx.id;
        if (entityId && drafts[entityId]) {
          const field = ef.target.split(".").pop();
          if (field !== "drafts") {
            drafts[entityId] = { ...drafts[entityId], [field]: ef.value };
          }
        }
        break;
      }
      case "remove": {
        const entityId = ctx.id;
        if (entityId) delete drafts[entityId];
        break;
      }
    }
  }
  return Object.values(drafts);
}

/**
 * Отфильтровать эффекты по статусам.
 */
/**
 * @param {Effect[]} effects
 * @param {...string} statuses
 * @returns {Effect[]}
 */
export function filterByStatus(effects, ...statuses) {
  return effects.filter(e => statuses.includes(e.status));
}
