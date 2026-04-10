const db = require("./db.js");

// Свёртка confirmed-эффектов в мир (серверная копия fold)
function foldWorld() {
  const effects = db.prepare(
    "SELECT * FROM effects WHERE status = 'confirmed' ORDER BY created_at ASC"
  ).all();

  const entities = {};

  for (const ef of effects) {
    const ctx = ef.context ? JSON.parse(ef.context) : {};
    const val = ef.value ? JSON.parse(ef.value) : null;

    switch (ef.alpha) {
      case "add": {
        const entityId = ctx.id || ef.id;
        entities[entityId] = { ...ctx };
        break;
      }
      case "replace": {
        const entityId = ctx.id;
        if (entityId && entities[entityId]) {
          const field = ef.target.split(".").pop();
          entities[entityId] = { ...entities[entityId], [field]: val };
        }
        break;
      }
      case "remove": {
        const entityId = ctx.id;
        if (entityId) delete entities[entityId];
        break;
      }
    }
  }

  return Object.values(entities);
}

// Условия применимости
const CONDITIONS = {
  "task.status = 'pending'": (task) => task?.status === "pending",
  "task.status = 'completed'": (task) => task?.status === "completed",
  "task.pinned = false": (task) => task?.pinned === false,
  "task.pinned = true": (task) => task?.pinned === true,
};

const INTENT_CONDITIONS = {
  add_task: [],
  complete_task: ["task.status = 'pending'"],
  uncomplete_task: ["task.status = 'completed'"],
  delete_task: [],
  edit_task: [],
  pin_task: ["task.pinned = false"],
  unpin_task: ["task.pinned = true"],
  set_priority: [],
  duplicate_task: [],
  archive_task: ["task.status = 'completed'"],
};

function validate(effect) {
  const ctx = effect.context ? JSON.parse(effect.context) : {};

  // Проверка 1: причинная цепочка
  if (effect.parent_id) {
    const parent = db.prepare("SELECT status FROM effects WHERE id = ?").get(effect.parent_id);
    if (parent && parent.status === "rejected") {
      return { valid: false, reason: `Предок ${effect.parent_id} отвергнут` };
    }
  }

  // Проверка 2: условия применимости
  const conditions = INTENT_CONDITIONS[effect.intent_id] || [];
  if (conditions.length > 0 && ctx.id) {
    const world = foldWorld();
    const target = world.find(e => e.id === ctx.id);

    for (const cond of conditions) {
      const check = CONDITIONS[cond];
      if (check && !check(target)) {
        return { valid: false, reason: `Условие не выполнено: ${cond}` };
      }
    }
  }

  // Проверка 3: существование цели
  if ((effect.alpha === "replace" || effect.alpha === "remove") && ctx.id) {
    const world = foldWorld();
    const target = world.find(e => e.id === ctx.id);
    if (!target) {
      return { valid: false, reason: `Сущность ${ctx.id} не найдена в World(t)` };
    }
  }

  return { valid: true };
}

// Каскадный reject потомков
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
