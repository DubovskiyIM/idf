/**
 * Bootstrap @intent-driven/engine в host'е с feature flag USE_ENGINE_PKG.
 *
 * Использование (в server/index.js или route initialization):
 *   const engine = require("./enginePkg.js");
 *   if (engine.isEnabled()) await engine.initEngine(currentDomain);
 *   engine.setBroadcast(broadcast);
 *
 * В POST /api/effects handler'е:
 *   if (engine.isEnabled()) {
 *     const result = await engine.getEngine().submit(req.body, { viewer: req.user });
 *     return res.json(result);
 *   }
 *   // fallback to legacy path
 */

const { createEngine } = require("@intent-driven/engine");
const { createSqlitePersistence } = require("./enginePersistenceAdapter.js");

let _engine = null;
let _broadcast = () => {};

function setBroadcast(fn) {
  _broadcast = fn;
}

async function initEngine(domain) {
  const persistence = createSqlitePersistence();
  _engine = createEngine({
    domain,
    persistence,
    clock: () => Date.now(),
    logger: console,
    callbacks: {
      onEffectConfirmed(effect) {
        _broadcast("effect:confirmed", { id: effect.id });
      },
      onEffectRejected(effect, { reason, cascaded }) {
        _broadcast("effect:rejected", { id: effect.id, reason, cascaded });
      },
      onTimerFired(timer) {
        if (process.env.DEBUG === "1") console.log(`[engine] timer fired: ${timer.id}`);
      },
    },
  });
  await _engine.hydrate();
  return _engine;
}

function getEngine() {
  if (!_engine) throw new Error("engine not initialized — call initEngine() first");
  return _engine;
}

function isEnabled() {
  return process.env.USE_ENGINE_PKG === "1";
}

module.exports = { initEngine, getEngine, setBroadcast, isEnabled };
