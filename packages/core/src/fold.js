/**
 * @idf/core — fold: World(t) = fold(⊕, ∅, sort≺(Φ_confirmed ↓ t))
 *
 * Pure functions for computing world state from an effect stream.
 */

import { causalSort } from "./causalSort.js";

function getCollectionType(target, typeMap) {
  const base = target.split(".")[0];
  return typeMap[base] || base;
}

/**
 * fold(effects, typeMap) → world
 *
 * Computes world state by applying confirmed effects in causal order.
 * @param {object[]} effects — confirmed effects
 * @param {Record<string, string>} [typeMap] — singular→plural mapping
 * @returns {Record<string, object[]>} world — collections of entities
 */
export function fold(effects, typeMap = {}) {
  const collections = {};
  const sorted = causalSort(effects);

  function applyEffect(ef) {
    if (ef.target.startsWith("drafts")) return;
    if (ef.scope === "presentation") return;

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
 * Apply presentation effects (Π) on top of a world copy.
 * Does not mutate the original world.
 */
export function applyPresentation(world, effects, typeMap = {}) {
  const result = {};
  for (const [key, arr] of Object.entries(world)) {
    result[key] = arr.map(e => ({ ...e }));
  }

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
 * Fold only draft effects (Δ stream).
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
 * Filter effects by status.
 * @param {object[]} effects
 * @param {...string} statuses
 * @returns {object[]}
 */
export function filterByStatus(effects, ...statuses) {
  return effects.filter(e => statuses.includes(e.status));
}
