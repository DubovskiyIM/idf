/**
 * Mount-обёртка для @intent-driven/llm-bridge: превращает Express-router
 * с POST /synthesize-apply + GET /runs/:runId/stream в host-роут под
 * /api/meta/llm. Использует ClaudeCliProvider (subprocess к залогиненному
 * `claude` CLI) и host'овый EffectSink adapter.
 *
 * Provider switch:
 *   DEMO_LLM_MOCK=1 → MockClaudeProvider (canned synthesized-applies, без
 *                     внешних вызовов; используется в demo-tenant'е).
 *   иначе          → ClaudeCliProvider (subprocess к залогиненному CLI).
 *
 * Viewer role: "patternCurator" hardcoded для MVP. В следующей итерации —
 * extract из JWT через middleware.
 */
const { createLlmBridgeRouter } = require("@intent-driven/llm-bridge");
const { ClaudeCliProvider } = require("@intent-driven/llm-subprocess");
const { createHostEffectSink } = require("../effects-adapter.js");
const { MockClaudeProvider } = require("../mock-claude-provider.js");

function makeMetaLlmRouter({ ingestEffect, broadcast }) {
  const sink = createHostEffectSink({ ingestEffect, broadcast });
  const provider =
    process.env.DEMO_LLM_MOCK === "1"
      ? new MockClaudeProvider()
      : new ClaudeCliProvider();
  if (process.env.DEMO_LLM_MOCK === "1") {
    console.log("  [meta-llm] DEMO_LLM_MOCK=1 — provider: MockClaudeProvider");
  }
  return createLlmBridgeRouter({
    sink,
    viewer: { role: "patternCurator", userId: "system" },
    config: { timeoutMs: 5 * 60 * 1000, provider },
  });
}

module.exports = { makeMetaLlmRouter };
