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

/**
 * Проверка одного условия формата "entity.field <op> <value>".
 * Поддерживает: =, !=, IN, null, true/false, строковые литералы, me.id.
 */
function evalIntentCondition(condStr, entity, ctx) {
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

  return true;
}

function conditionEntityType(condStr) {
  const m = condStr.match(/^(\w+)\./);
  return m ? m[1] : null;
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
    if (!condEntityType) continue;

    const matches =
      condEntityType === effectEntityType ||
      condEntityType === effectEntitySingular;
    if (!matches) continue;

    const entityId = ctx.id;
    if (!entityId) continue;

    const entity = findEntityInWorld(world, entityId);
    if (!entity) continue;

    if (!evalIntentCondition(cond, entity, ctx)) {
      return { valid: false, reason: `Условие не выполнено: ${cond}` };
    }
  }

  return { valid: true };
}

module.exports = {
  registerIntents,
  getIntent,
  getDomainIntents,
  validateIntentConditions,
  evalIntentCondition,
  _registry: REGISTRY,
};
