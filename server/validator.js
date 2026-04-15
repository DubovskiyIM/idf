const db = require("./db.js");
const { validateIntentConditions } = require("./intents.js");
const { causalSort } = require("./causalSort.cjs");

// Динамический маппинг singular→plural — обновляется через API /api/typemap
let SINGULAR_TO_PLURAL = { draft: "drafts" };

function updateTypeMap(ontology) {
  const map = { draft: "drafts" };
  if (ontology?.entities) {
    for (const entityName of Object.keys(ontology.entities)) {
      // Ключ lookup — lowercase (регистронезависимый), значение — camelCase plural.
      // "ScheduledTimer" → ключ "scheduledtimer", значение "scheduledTimers"
      const singular = entityName.toLowerCase();
      // camelCase base: первая буква строчная, остальное как в оригинале
      const camelBase = entityName.charAt(0).toLowerCase() + entityName.slice(1);
      const plural = camelBase.endsWith("s") ? camelBase + "es"
        : camelBase.endsWith("y") ? camelBase.slice(0, -1) + "ies"
        : camelBase + "s";
      map[singular] = plural;
    }
  }
  SINGULAR_TO_PLURAL = { ...SINGULAR_TO_PLURAL, ...map };
  return map;
}

// Инициализация: union всех известных доменов (fallback, пока клиенты не
// прислали свои ontology).
updateTypeMap({ entities: {
  Slot: {}, Booking: {}, Service: {}, Specialist: {}, Review: {},
  Poll: {}, Option: {}, Participant: {}, Vote: {}, Meeting: {},
  Workflow: {}, Node: {}, Edge: {}, Execution: {}, NodeResult: {}, NodeType: {},
  User: {}, Contact: {}, Conversation: {}, Message: {},
}});

function foldWorld() {
  // SQL-уровень: получаем confirmed-эффекты в грубом chronological-порядке,
  // потом докручиваем причинный порядок через causalSort (parent_id → child).
  // Это реализация §10 манифеста: sort≺(Φ_confirmed ↓ t).
  const rawEffects = db.prepare(
    "SELECT * FROM effects WHERE status = 'confirmed' ORDER BY created_at ASC"
  ).all();
  const effects = causalSort(rawEffects);

  const collections = {};
  // Users теперь приходят из Φ через _user_register эффекты (auth.js dual-write).
  // Seed auth_users удалён — §5 «мир = свёртка Φ».

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
    // Lookup регистронезависимый: ключи SINGULAR_TO_PLURAL — в нижнем регистре
    const collType = SINGULAR_TO_PLURAL[base.toLowerCase()] || base;
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
          const segments = ef.target.split(".");
          if (segments.length > 1) {
            // Target вида "Entity.field" — обновляем конкретное поле через val
            const field = segments.pop();
            collections[collType][entityId] = { ...collections[collType][entityId], [field]: val };
          } else {
            // Target вида "Entity" — мержим весь ctx (без id) поверх записи
            const { id: _id, ...patch } = ctx;
            collections[collType][entityId] = { ...collections[collType][entityId], ...patch };
          }
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
 * Валидация эффекта.
 *
 * 1. Если предок отвергнут — reject.
 * 2. α:"batch" — рекурсивная валидация каждого под-эффекта. Если любой
 *    под-эффект невалиден, весь batch отвергается (принцип all-or-nothing,
 *    соответствует §11 манифеста — таблица композиции batch).
 * 3. Универсальная проверка условий namerenija из реестра (intents.js).
 * 4. Для replace/remove — проверка что сущность существует в World(t).
 */
function validate(effect) {
  const ctx = effect.context ? JSON.parse(effect.context) : {};

  // 1. Каскадный reject от отвергнутого предка
  if (effect.parent_id) {
    const parent = db.prepare("SELECT status FROM effects WHERE id = ?").get(effect.parent_id);
    if (parent && parent.status === "rejected") {
      return { valid: false, reason: `Предок ${effect.parent_id} отвергнут` };
    }
  }

  // 2. α:"batch" — рекурсивная валидация
  if (effect.alpha === "batch") {
    const value = effect.value ? JSON.parse(effect.value) : null;
    if (!Array.isArray(value)) {
      return { valid: false, reason: "batch effect.value должен быть массивом под-эффектов" };
    }
    for (let i = 0; i < value.length; i++) {
      const sub = value[i];
      // Нормализуем под-эффект в формат, ожидаемый validate
      const subEffect = {
        id: sub.id || `${effect.id}_sub_${i}`,
        intent_id: sub.intent_id || effect.intent_id,
        alpha: sub.alpha,
        target: sub.target,
        value: sub.value != null ? JSON.stringify(sub.value) : null,
        scope: sub.scope || effect.scope,
        parent_id: null, // sub-эффекты batch не имеют parent_id (сам batch — их «родитель»)
        context: sub.context ? JSON.stringify(sub.context) : null,
        created_at: effect.created_at,
      };
      const r = validate(subEffect);
      if (!r.valid) {
        return { valid: false, reason: `batch sub-effect #${i} (${sub.target}): ${r.reason}` };
      }
    }
    return { valid: true };
  }

  // 3. Условия намерения — универсально через реестр.
  // Пропускаем для черновиков и системных эффектов.
  if (!effect.target.startsWith("drafts") && !effect.intent_id.startsWith("_")) {
    const world = foldWorld();
    const effectForCheck = { ...effect, context: ctx };
    const condResult = validateIntentConditions(effectForCheck, world);
    if (!condResult.valid) return condResult;
  }

  // 4. Для replace/remove — сущность должна существовать
  // Системные intent'ы scheduler'а (schedule_timer/revoke_timer) пропускаем:
  // они могут прийти до регистрации typeMap или в race-окне с fold'ом.
  // Зомбирование предотвращается самим ingestEffect'ом через Φ-append.
  if (
    (effect.alpha === "replace" || effect.alpha === "remove") &&
    ctx.id &&
    !effect.target.startsWith("drafts") &&
    effect.intent_id !== "schedule_timer" &&
    effect.intent_id !== "revoke_timer"
  ) {
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

// ──────────────────────────────────────────────────────────────
// Глобальные инварианты (§14, v1.6.1).
// checkInvariantsForDomain — read-only проверка world(t) против
// ontology.invariants домена. Используется в effects-route (async)
// для rollback через cascadeReject + SSE и в agent-route (sync)
// для 409-ответа перед response.
// ──────────────────────────────────────────────────────────────
const { checkInvariants } = require("./schema/invariantChecker.cjs");
const { getOntology } = require("./ontologyRegistry.cjs");

function checkInvariantsForDomain(domain) {
  const ontology = getOntology(domain);
  if (!ontology || !Array.isArray(ontology.invariants) || ontology.invariants.length === 0) {
    return { ok: true, violations: [] };
  }
  const world = foldWorld();
  return checkInvariants(world, ontology);
}

module.exports = { validate, cascadeReject, foldWorld, updateTypeMap, checkInvariantsForDomain };
