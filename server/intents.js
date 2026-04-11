/**
 * Реестр намерений в памяти сервера + универсальная валидация условий.
 *
 * Раньше server/validator.js хранил hardcoded `INTENT_CONDITIONS` — ручной
 * список условий для ~40 интентов. Мессенджер (100 интентов) в этом списке
 * отсутствовал, и его эффекты проходили серверную валидацию без проверки
 * условий — любой клиент мог, например, отредактировать чужое сообщение
 * через прямой POST /api/effects в обход условия `message.senderId = me.id`.
 *
 * Теперь клиент при монтировании домена POST'ит свои INTENTS на /api/intents,
 * сервер держит их в памяти и валидирует условия единообразно.
 */

const REGISTRY = {};

/**
 * Зарегистрировать намерения домена. Вызывается из POST /api/intents.
 */
function registerIntents(intents) {
  if (!intents || typeof intents !== "object") return 0;
  let count = 0;
  for (const [id, intent] of Object.entries(intents)) {
    REGISTRY[id] = intent;
    count++;
  }
  return count;
}

function getIntent(id) {
  return REGISTRY[id];
}

/**
 * Проверка одного условия формата "entity.field <op> <value>".
 * Поддерживает: =, !=, IN, null, true/false, строковые литералы, me.id.
 */
function evalIntentCondition(condStr, entity, ctx) {
  if (!entity) return false;
  const c = condStr.trim();

  // "x.field = null"
  const mNull = c.match(/^\w+\.(\w+)\s*=\s*null$/);
  if (mNull) return entity[mNull[1]] == null;

  // "x.field = true|false"
  const mBool = c.match(/^\w+\.(\w+)\s*=\s*(true|false)$/);
  if (mBool) return entity[mBool[1]] === (mBool[2] === "true");

  // "x.field = me.id" — сравнение с идентификатором текущего пользователя
  const mMeId = c.match(/^\w+\.(\w+)\s*=\s*me\.id$/);
  if (mMeId) {
    const userId = ctx.userId || ctx.senderId;
    return entity[mMeId[1]] === userId;
  }

  // "x.field = 'value'"
  const mEq = c.match(/^\w+\.(\w+)\s*=\s*'([^']+)'$/);
  if (mEq) return entity[mEq[1]] === mEq[2];

  // "x.field != 'value'"
  const mNeq = c.match(/^\w+\.(\w+)\s*!=\s*'([^']+)'$/);
  if (mNeq) return entity[mNeq[1]] !== mNeq[2];

  // "x.field IN ('a','b','c')"
  const mIn = c.match(/^\w+\.(\w+)\s+IN\s+\(([^)]+)\)$/i);
  if (mIn) {
    const values = mIn[2].split(",").map(v => v.trim().replace(/'/g, ""));
    return values.includes(entity[mIn[1]]);
  }

  // Неизвестный формат — не блокируем
  return true;
}

/**
 * Извлечь тип сущности из строки условия: "message.senderId = me.id" → "message".
 */
function conditionEntityType(condStr) {
  const m = condStr.match(/^(\w+)\./);
  return m ? m[1] : null;
}

/**
 * Грубая плюрализация для поиска коллекции в world.
 */
function pluralize(word) {
  if (!word) return word;
  if (word.endsWith("y")) return word.slice(0, -1) + "ies";
  if (word.endsWith("s")) return word + "es";
  return word + "s";
}

/**
 * Найти сущность в world по id, обходя все коллекции.
 */
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
 *
 * @param {Object} effect — {intent_id, target, context (parsed)}
 * @param {Object} world — свёрнутый мир
 * @returns {valid, reason}
 */
function validateIntentConditions(effect, world) {
  const intent = REGISTRY[effect.intent_id];
  if (!intent) return { valid: true }; // неизвестный интент — не блокируем (backward compat)

  const conditions = intent.particles?.conditions || [];
  if (conditions.length === 0) return { valid: true };

  const ctx = effect.context || {};
  // Тип сущности из target эффекта: "message.content" → "message"
  const effectEntityType = effect.target?.split(".")[0] || "";
  // Канонический singular (если target уже plural "messages" → "message")
  const effectEntitySingular = effectEntityType.endsWith("s")
    ? effectEntityType.slice(0, -1)
    : effectEntityType;

  for (const cond of conditions) {
    const condEntityType = conditionEntityType(cond);
    if (!condEntityType) continue;

    // Условие применимо к этому эффекту только если типы сущностей совпадают.
    // Одно намерение может породить несколько эффектов на разные сущности,
    // каждое условие проверяется только против «своего».
    const matches =
      condEntityType === effectEntityType ||
      condEntityType === effectEntitySingular;
    if (!matches) continue;

    // Находим сущность, которую модифицирует эффект, через ctx.id в world.
    const entityId = ctx.id;
    if (!entityId) continue; // нет id — нечего проверять

    const entity = findEntityInWorld(world, entityId);
    if (!entity) {
      // Если эффект — add, сущности ещё нет (нормально).
      // Если replace/remove и сущности нет — общая проверка существования
      // сделает свой reject; здесь пропускаем.
      continue;
    }

    if (!evalIntentCondition(cond, entity, ctx)) {
      return { valid: false, reason: `Условие не выполнено: ${cond}` };
    }
  }

  return { valid: true };
}

module.exports = {
  registerIntents,
  getIntent,
  validateIntentConditions,
  evalIntentCondition,
  _registry: REGISTRY, // для отладки
};
