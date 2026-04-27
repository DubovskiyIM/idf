/**
 * Mount-обёртка для @intent-driven/llm-bridge: превращает Express-router
 * с POST /synthesize-apply + GET /runs/:runId/stream в host-роут под
 * /api/meta/llm. Использует ClaudeCliProvider (subprocess к залогиненному
 * `claude` CLI) и host'овый EffectSink adapter.
 *
 * Viewer role: "patternCurator" hardcoded для MVP. В следующей итерации —
 * extract из JWT через middleware.
 */
const { createLlmBridgeRouter } = require("@intent-driven/llm-bridge");
const { ClaudeCliProvider } = require("@intent-driven/llm-subprocess");
const { createHostEffectSink } = require("../effects-adapter.js");

function makeMetaLlmRouter({ ingestEffect, broadcast }) {
  const sink = createHostEffectSink({ ingestEffect, broadcast });
  return createLlmBridgeRouter({
    sink,
    viewer: { role: "patternCurator", userId: "system" },
    config: {
      timeoutMs: 5 * 60 * 1000,
      provider: new ClaudeCliProvider(),
    },
  });
}

module.exports = { makeMetaLlmRouter };
