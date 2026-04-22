// server/schema/buildGravitinoEffects.cjs
/**
 * Gravitino — чистый generic-path. Все эффекты конструируются из
 * intent.particles.effects через generic handler в validator.js
 * (как у compliance, invest и большинства invest-intents).
 *
 * Возврат `null` = "у меня нет custom веток, используй generic".
 */
function buildGravitinoEffects(_intentId, _params, _viewer, _world) {
  return null;
}

module.exports = { buildGravitinoEffects };
