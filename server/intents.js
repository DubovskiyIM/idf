/**
 * Реестр намерений в памяти сервера — domain-scoped.
 *
 * REGISTRY[domain][id] = intent. Session C рефакторинг (2026-04-12)
 * из flat REGISTRY[id] в двухуровневую структуру, чтобы избежать
 * cross-domain contamination в computeAlgebra.
 *
 * Backward compat: getIntent(id) без domain ищет fallback'ом по всем
 * доменам — это нужно для server/validator.js, который знает только
 * intent_id из эффекта и не знает домен.
 */

const REGISTRY = {}; // { [domain]: { [id]: intent } }

/**
 * Зарегистрировать намерения домена. Вызывается из POST /api/intents?domain=X.
 */
function registerIntents(intents, domain) {
  if (!domain) throw new Error("registerIntents requires domain parameter");
  if (!intents || typeof intents !== "object") return 0;
  if (!REGISTRY[domain]) REGISTRY[domain] = {};
  let count = 0;
  for (const [id, intent] of Object.entries(intents)) {
    REGISTRY[domain][id] = intent;
    count++;
  }
  return count;
}

/**
 * Получить intent по id. Если domain передан — ищет в конкретном домене.
 * Если нет — fallback search по всем (для validator.js).
 */
function getIntent(id, domain) {
  if (domain) {
    return REGISTRY[domain]?.[id] || null;
  }
  // Fallback: search across all domains
  for (const domainIntents of Object.values(REGISTRY)) {
    if (domainIntents[id]) return domainIntents[id];
  }
  return null;
}

/**
 * Все intents конкретного домена (для computeAlgebra).
 */
function getDomainIntents(domain) {
  return REGISTRY[domain] ? { ...REGISTRY[domain] } : {};
}

function compareOp(actual, op, expected) {
  switch (op) {
    case "=": return actual === expected;
    case "!=": return actual !== expected;
    case ">=": return actual >= expected;
    case ">": return actual > expected;
    case "<=": return actual <= expected;
    case "<": return actual < expected;
    default: return false;
  }
}

/**
 * Проверка одного условия формата "entity.field <op> <value>"
 * или агрегатного предиката count()/ratio().
 * Поддерживает: =, !=, IN, null, true/false, строковые литералы, me.id.
 * Агрегаты: count(collection, fk=target.id) <cmp> N, ratio(...) <cmp> N.
 */
function evalIntentCondition(condStr, entity, ctx, world) {
  if (!entity) return false;
  const c = condStr.trim();

  const mNull = c.match(/^\w+\.(\w+)\s*=\s*null$/);
  if (mNull) return entity[mNull[1]] == null;

  const mBool = c.match(/^\w+\.(\w+)\s*=\s*(true|false)$/);
  if (mBool) return entity[mBool[1]] === (mBool[2] === "true");

  const mMeId = c.match(/^\w+\.(\w+)\s*=\s*me\.id$/);
  if (mMeId) {
    const userId = ctx.userId || ctx.senderId;
    return entity[mMeId[1]] === userId;
  }

  const mEq = c.match(/^\w+\.(\w+)\s*=\s*'([^']+)'$/);
  if (mEq) return entity[mEq[1]] === mEq[2];

  const mNeq = c.match(/^\w+\.(\w+)\s*!=\s*'([^']+)'$/);
  if (mNeq) return entity[mNeq[1]] !== mNeq[2];

  const mIn = c.match(/^\w+\.(\w+)\s+IN\s+\(([^)]+)\)$/i);
  if (mIn) {
    const values = mIn[2].split(",").map(v => v.trim().replace(/'/g, ""));
    return values.includes(entity[mIn[1]]);
  }

  // count(collection, foreignKey=target.id) <cmp> N
  const mCount = c.match(/^count\((\w+),\s*(\w+)=target\.id\)\s*(=|!=|>=|>|<=|<)\s*(\d+(?:\.\d+)?)$/);
  if (mCount) {
    if (!world) return true;
    const targetId = entity?.id;
    if (!targetId) return true;
    const [, collection, fkField, op, threshold] = mCount;
    const items = (world[collection] || []).filter(item => item[fkField] === targetId);
    return compareOp(items.length, op, parseFloat(threshold));
  }

  // ratio(collection.distinctField, totalCollection, foreignKey=target.id) <cmp> N
  const mRatio = c.match(/^ratio\((\w+)\.(\w+),\s*(\w+),\s*(\w+)=target\.id\)\s*(=|!=|>=|>|<=|<)\s*(\d+(?:\.\d+)?)$/);
  if (mRatio) {
    if (!world) return true;
    const targetId = entity?.id;
    if (!targetId) return true;
    const [, collection, distinctField, totalCollection, fkField, op, threshold] = mRatio;
    const filtered = (world[collection] || []).filter(item => item[fkField] === targetId);
    const distinct = new Set(filtered.map(item => item[distinctField])).size;
    const total = (world[totalCollection] || []).filter(item => item[fkField] === targetId).length;
    const ratio = total > 0 ? distinct / total : 0;
    return compareOp(ratio, op, parseFloat(threshold));
  }

  return true;
}

function conditionEntityType(condStr) {
  const m = condStr.match(/^(\w+)\./);
  return m ? m[1] : null;
}

function isAggregateCondition(condStr) {
  return /^(count|ratio)\(/.test(condStr.trim());
}

function findEntityInWorld(world, entityId) {
  if (!entityId) return null;
  for (const collection of Object.values(world)) {
    if (!Array.isArray(collection)) continue;
    const found = collection.find(e => e.id === entityId);
    if (found) return found;
  }
  return null;
}

/**
 * Универсальная валидация условий намерения против текущего world.
 * getIntent без domain — fallback search (validator не знает домен).
 */
function validateIntentConditions(effect, world) {
  const intent = getIntent(effect.intent_id);
  if (!intent) return { valid: true };

  const conditions = intent.particles?.conditions || [];
  if (conditions.length === 0) return { valid: true };

  const ctx = effect.context || {};
  const effectEntityType = effect.target?.split(".")[0] || "";
  const effectEntitySingular = effectEntityType.endsWith("s")
    ? effectEntityType.slice(0, -1)
    : effectEntityType;

  for (const cond of conditions) {
    const condEntityType = conditionEntityType(cond);

    // Агрегатные условия (нет entity-префикса) — вычисляем против world
    if (!condEntityType) {
      if (isAggregateCondition(cond)) {
        const entityId = ctx.id;
        const entity = entityId ? findEntityInWorld(world, entityId) : { id: entityId };
        if (!evalIntentCondition(cond, entity, ctx, world)) {
          return { valid: false, reason: `Условие не выполнено: ${cond}` };
        }
      }
      continue;
    }

    // Скалярные условия — существующая логика
    const matches =
      condEntityType === effectEntityType ||
      condEntityType === effectEntitySingular;
    if (!matches) continue;

    const entityId = ctx.id;
    if (!entityId) continue;

    const entity = findEntityInWorld(world, entityId);
    if (!entity) continue;

    if (!evalIntentCondition(cond, entity, ctx, world)) {
      return { valid: false, reason: `Условие не выполнено: ${cond}` };
    }
  }

  return { valid: true };
}

function getDomainByIntentId(intentId) {
  for (const [domain, intents] of Object.entries(REGISTRY)) {
    if (intents[intentId]) return domain;
  }
  return null;
}

module.exports = {
  registerIntents,
  getIntent,
  getDomainIntents,
  getDomainByIntentId,
  validateIntentConditions,
  evalIntentCondition,
  _registry: REGISTRY,
};
