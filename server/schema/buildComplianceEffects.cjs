/**
 * Серверный builder эффектов для compliance-домена (SOX ICFR, 13-й тест).
 *
 * В MVP domain не имеет agent-роли, поэтому серверный builder — stub
 * (все intents возвращают null, routes/agent.js отвечает 400 на /exec).
 * Клиентский flow использует generic particles.effects handler (без
 * кастомных side-effects на сервере).
 *
 * Регистрируется в effectBuildersRegistry.cjs чтобы routes/agent.js
 * на compliance-домене возвращал consistent 404/400, а не падал на
 * "unknown domain".
 */

function buildComplianceEffects(_intentId, _params, _viewer, _world) {
  // Compliance в MVP — UI/preparer flow без agent-layer.
  // Write-intents идут через generic particles.effects handler прототипа.
  return null;
}

module.exports = { buildComplianceEffects };
