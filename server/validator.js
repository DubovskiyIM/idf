const db = require("./db.js");

const SINGULAR_TO_PLURAL = {
  slot: "slots", booking: "bookings", service: "services",
  specialist: "specialists", review: "reviews"
};

function foldWorld() {
  const effects = db.prepare(
    "SELECT * FROM effects WHERE status = 'confirmed' ORDER BY created_at ASC"
  ).all();

  const collections = {};

  for (const ef of effects) {
    if (ef.target.startsWith("drafts")) continue;
    const ctx = ef.context ? JSON.parse(ef.context) : {};
    const val = ef.value ? JSON.parse(ef.value) : null;
    const base = ef.target.split(".")[0];
    const collType = SINGULAR_TO_PLURAL[base] || base;

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
          collections[collType][entityId] = { ...collections[collType][entityId], [field]: val };
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

function findEntity(world, entityId) {
  for (const collection of Object.values(world)) {
    if (!Array.isArray(collection)) continue;
    const found = collection.find(e => e.id === entityId);
    if (found) return found;
  }
  return null;
}

const CONDITIONS = {
  "service.active = true": (e) => e?.active === true,
  "slot.status = 'free'": (e) => e?.status === "free",
  "slot.status = 'blocked'": (e) => e?.status === "blocked",
  "booking.status = 'confirmed'": (e) => e?.status === "confirmed",
  "booking.status = 'completed'": (e) => e?.status === "completed",
};

// Условия с указанием какое поле контекста содержит ID целевой сущности
const INTENT_CONDITIONS = {
  select_service: [{ cond: "service.active = true", entityIdField: "serviceId" }],
  select_slot: [{ cond: "slot.status = 'free'", entityIdField: "id" }],
  confirm_booking: [],
  cancel_booking: [{ cond: "booking.status = 'confirmed'", entityIdField: "id" }],
  abandon_draft: [],
  complete_booking: [{ cond: "booking.status = 'confirmed'", entityIdField: "id" }],
  add_service: [],
  block_slot: [{ cond: "slot.status = 'free'", entityIdField: "id" }],
  unblock_slot: [{ cond: "slot.status = 'blocked'", entityIdField: "id" }],
  reschedule_booking: [{ cond: "booking.status = 'confirmed'", entityIdField: "id" }],
  mark_no_show: [{ cond: "booking.status = 'confirmed'", entityIdField: "id" }],
  leave_review: [{ cond: "booking.status = 'completed'", entityIdField: "bookingId" }],
  delete_review: [],
  bulk_cancel_day: [{ cond: "booking.status = 'confirmed'", entityIdField: "id" }],
  _seed: [],
  _sync: [],
};

function validate(effect) {
  const ctx = effect.context ? JSON.parse(effect.context) : {};

  if (effect.parent_id) {
    const parent = db.prepare("SELECT status FROM effects WHERE id = ?").get(effect.parent_id);
    if (parent && parent.status === "rejected") {
      return { valid: false, reason: `Предок ${effect.parent_id} отвергнут` };
    }
  }

  // Проверяем условия только если target эффекта соответствует типу сущности в условии.
  // Одно намерение может порождать несколько эффектов (booking + slot),
  // условия применяются только к «своему» эффекту.
  if (!effect.target.startsWith("drafts")) {
    const conditions = INTENT_CONDITIONS[effect.intent_id] || [];
    if (conditions.length > 0) {
      const world = foldWorld();
      const effectEntityType = effect.target.split(".")[0]; // "booking", "slot", etc.

      for (const entry of conditions) {
        // Условие "booking.status = 'confirmed'" применимо только к эффектам на booking.*
        const condEntityType = entry.cond.split(".")[0]; // "booking", "slot", "service"
        if (condEntityType !== effectEntityType) continue;

        const entityId = ctx[entry.entityIdField];
        if (!entityId) continue;
        const target = findEntity(world, entityId);
        const check = CONDITIONS[entry.cond];
        if (check && !check(target)) {
          return { valid: false, reason: `Условие не выполнено: ${entry.cond}` };
        }
      }
    }
  }

  if ((effect.alpha === "replace" || effect.alpha === "remove") && ctx.id && !effect.target.startsWith("drafts")) {
    const world = foldWorld();
    const target = findEntity(world, ctx.id);
    if (!target) {
      return { valid: false, reason: `Сущность ${ctx.id} не найдена в World(t)` };
    }
  }

  return { valid: true };
}

function cascadeReject(effectId) {
  const now = Date.now();
  const children = db.prepare(
    "SELECT id FROM effects WHERE parent_id = ? AND status != 'rejected'"
  ).all(effectId);

  const allCascaded = [];
  for (const child of children) {
    db.prepare(
      "UPDATE effects SET status = 'rejected', resolved_at = ? WHERE id = ?"
    ).run(now, child.id);
    allCascaded.push(child.id);
    allCascaded.push(...cascadeReject(child.id));
  }

  return allCascaded;
}

module.exports = { validate, cascadeReject, foldWorld };
