const db = require("./db.js");

// Динамический маппинг — обновляется через API /api/typemap
let SINGULAR_TO_PLURAL = { draft: "drafts" };

function updateTypeMap(ontology) {
  const map = { draft: "drafts" };
  if (ontology?.entities) {
    for (const entityName of Object.keys(ontology.entities)) {
      const singular = entityName.toLowerCase();
      const plural = singular.endsWith("s") ? singular + "es" : singular + "s";
      map[singular] = plural;
    }
  }
  SINGULAR_TO_PLURAL = map;
  return map;
}

// Инициализация: union всех известных доменов (fallback)
updateTypeMap({ entities: {
  Slot: {}, Booking: {}, Service: {}, Specialist: {}, Review: {},
  Poll: {}, Option: {}, Participant: {}, Vote: {}, Meeting: {},
  Workflow: {}, Node: {}, Edge: {}, Execution: {}, NodeResult: {}, NodeType: {},
}});

function foldWorld() {
  const effects = db.prepare(
    "SELECT * FROM effects WHERE status = 'confirmed' ORDER BY created_at ASC"
  ).all();

  const collections = {};

  function applyEf(ef, ctx, val) {
    if (ef.target.startsWith("drafts")) return;
    if (ef.scope === "presentation") return;

    if (ef.alpha === "batch") {
      const batchItems = val || [];
      for (const sub of batchItems) {
        const subCtx = sub.context || {};
        const subVal = sub.value != null ? sub.value : null;
        applyEf(sub, subCtx, subVal);
      }
      return;
    }

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

  for (const ef of effects) {
    const ctx = ef.context ? JSON.parse(ef.context) : {};
    const val = ef.value ? JSON.parse(ef.value) : null;
    applyEf(ef, ctx, val);
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

/**
 * Универсальный парсер условий.
 * Поддерживает: "entity.field = 'value'", "entity.field = true/false",
 *   "entity.field = null", "entity.field != 'value'",
 *   "entity.field IN ('a','b','c')"
 */
function evaluateCondition(condStr, entity) {
  if (!entity) return false;

  // "x.field = null"
  const matchNull = condStr.match(/^\w+\.(\w+)\s*=\s*null$/);
  if (matchNull) return entity[matchNull[1]] == null;

  // "x.field = true/false"
  const matchBool = condStr.match(/^\w+\.(\w+)\s*=\s*(true|false)$/);
  if (matchBool) return entity[matchBool[1]] === (matchBool[2] === "true");

  // "x.field = 'value'"
  const matchEq = condStr.match(/^\w+\.(\w+)\s*=\s*'([^']+)'$/);
  if (matchEq) return entity[matchEq[1]] === matchEq[2];

  // "x.field != 'value'"
  const matchNeq = condStr.match(/^\w+\.(\w+)\s*!=\s*'([^']+)'$/);
  if (matchNeq) return entity[matchNeq[1]] !== matchNeq[2];

  // "x.field IN ('a','b','c')"
  const matchIn = condStr.match(/^\w+\.(\w+)\s+IN\s+\(([^)]+)\)$/);
  if (matchIn) {
    const values = matchIn[2].split(",").map(v => v.trim().replace(/'/g, ""));
    return values.includes(entity[matchIn[1]]);
  }

  // Не распознано — пропускаем (не блокируем)
  return true;
}

// Обратная совместимость: старый формат CONDITIONS → evaluateCondition
const CONDITIONS = new Proxy({}, {
  get(_, condStr) {
    return (entity) => evaluateCondition(condStr, entity);
  }
});

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
  // booking new
  repeat_booking: [{ cond: "booking.status IN ('completed','cancelled','no_show')", entityIdField: "id" }],
  edit_review: [],
  cancel_client_booking: [{ cond: "booking.status = 'confirmed'", entityIdField: "id" }],
  respond_to_review: [{ cond: "review.response = null", entityIdField: "id" }],
  update_service: [],
  remove_service: [{ cond: "service.active = true", entityIdField: "id" }],
  // planning
  create_poll: [], add_time_option: [], invite_participant: [],
  open_poll: [{ cond: "poll.status = 'draft'", entityIdField: "id" }],
  vote_yes: [], vote_no: [], vote_maybe: [],
  close_poll: [{ cond: "poll.status = 'open'", entityIdField: "id" }],
  resolve_poll: [{ cond: "poll.status = 'closed'", entityIdField: "id" }],
  cancel_poll: [], cancel_meeting: [{ cond: "meeting.status = 'confirmed'", entityIdField: "id" }],
  decline_invitation: [{ cond: "participant.status = 'active'", entityIdField: "participantId" }],
  accept_invitation: [{ cond: "participant.status = 'invited'", entityIdField: "participantId" }],
  suggest_alternative: [], set_deadline: [], change_vote: [], send_reminder: [],
  // workflow
  create_workflow: [], add_node: [], remove_node: [], move_node: [],
  connect_nodes: [], disconnect_nodes: [], configure_node: [],
  save_workflow: [{ cond: "workflow.status = 'draft'", entityIdField: "id" }],
  execute_workflow: [{ cond: "workflow.status = 'saved'", entityIdField: "id" }],
  stop_execution: [{ cond: "execution.status = 'running'", entityIdField: "id" }],
  rename_node: [], delete_workflow: [], duplicate_workflow: [],
  add_custom_node_type: [], import_workflow: [],
  _seed: [], _sync: [], _executor: [],
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

module.exports = { validate, cascadeReject, foldWorld, updateTypeMap };
