const SINGULAR_TO_PLURAL = {
  slot: "slots", booking: "bookings", service: "services",
  specialist: "specialists", review: "reviews", draft: "drafts",
  poll: "polls", option: "options", participant: "participants",
  vote: "votes", meeting: "meetings"
};

function getCollectionType(target) {
  const base = target.split(".")[0];
  return SINGULAR_TO_PLURAL[base] || base;
}

/**
 * fold(effects) → world (объект по типам сущностей)
 *
 * По манифесту: World(t) = fold(⊕, ∅, sort≺(Φ_confirmed ↓ t))
 * target определяет тип: "slots" → world.slots, "slot.status" → world.slots
 * Эффекты с target "drafts" или "drafts.*" игнорируются (это Δ).
 *
 * @param {Array} effects — эффекты для свёртки (порядок по created_at)
 * @returns {Object} — { specialists: [], services: [], slots: [], bookings: [] }
 */
export function fold(effects) {
  const collections = {};

  for (const ef of effects) {
    if (ef.target.startsWith("drafts")) continue;

    const ctx = ef.context || {};
    const val = ef.value;
    const collType = getCollectionType(ef.target);

    if (!collections[collType]) collections[collType] = {};

    switch (ef.alpha) {
      case "add": {
        const entityId = ctx.id || ef.id;
        collections[collType][entityId] = { ...ctx };
        break;
      }
      case "replace": {
        const entityId = ctx.id;
        if (entityId && collections[collType][entityId]) {
          const field = ef.target.split(".").pop();
          collections[collType][entityId] = {
            ...collections[collType][entityId],
            [field]: val
          };
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

  const world = {};
  for (const [type, entities] of Object.entries(collections)) {
    world[type] = Object.values(entities);
  }
  return world;
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
export function filterByStatus(effects, ...statuses) {
  return effects.filter(e => statuses.includes(e.status));
}
