/**
 * Mount-обёртка для @intent-driven/llm-bridge: превращает Express-router
 * с POST /synthesize-apply + POST /iterate + GET /runs/:runId/stream
 * в host-роут под /api/meta/llm. Host'овый EffectSink adapter обвязан
 * вокруг ingestEffect/broadcast.
 *
 * Provider switch (по приоритету):
 *   DEMO_LLM_MOCK=1   → MockClaudeProvider (canned, zero-cost, sanity check)
 *   OLLAMA_MODEL=...  → OllamaProvider (локальная LLM via Ollama API на
 *                       :11434; variance check эксперимента на other modal class).
 *                       Пример: OLLAMA_MODEL=deepseek-r1:8b npm run server
 *   иначе             → ClaudeCliProvider (subprocess к залогиненному CLI).
 *
 * Self-hosting fixed-point experiment запускался на claude-cli (Opus 4.7)
 * 4 раза. Run 5 на ollama (deepseek-r1:8b или другой) — variance check
 * для проверки universality findings'ов на другом модельном классе.
 *
 * Viewer role: "patternCurator" hardcoded для MVP. В следующей итерации —
 * extract из JWT через middleware.
 */
const { createLlmBridgeRouter } = require("@intent-driven/llm-bridge");
const { ClaudeCliProvider } = require("@intent-driven/llm-subprocess");
const { createHostEffectSink } = require("../effects-adapter.js");
const { MockClaudeProvider } = require("../mock-claude-provider.js");
const { OllamaProvider } = require("../ollama-provider.js");

function pickProvider() {
  if (process.env.DEMO_LLM_MOCK === "1") {
    console.log("  [meta-llm] DEMO_LLM_MOCK=1 — provider: MockClaudeProvider");
    return new MockClaudeProvider();
  }
  if (process.env.OLLAMA_MODEL) {
    const p = new OllamaProvider();
    console.log(`  [meta-llm] OLLAMA_MODEL=${process.env.OLLAMA_MODEL} — provider: ${p.name}`);
    return p;
  }
  return new ClaudeCliProvider();
}

function makeMetaLlmRouter({ ingestEffect, broadcast }) {
  const sink = createHostEffectSink({ ingestEffect, broadcast });
  const provider = pickProvider();
  return createLlmBridgeRouter({
    sink,
    viewer: { role: "patternCurator", userId: "system" },
    config: { timeoutMs: 5 * 60 * 1000, provider },
  });
}

module.exports = { makeMetaLlmRouter };
