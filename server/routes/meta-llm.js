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

/**
 * Per-request provider override — для sweep'а по моделям без рестарта server'а.
 * Принимает HTTP заголовок X-LLM-Provider-Model с Ollama model id (например
 * `qwen2.5:7b`). Если задан — создаёт fresh OllamaProvider для этого запроса
 * и подменяет в ctx. Default provider остаётся unchanged.
 *
 * Используется sweep-script'ом для прогона trajectory на разных моделях
 * последовательно. Без overhead'а перезапуска server'а.
 */
function perRequestProviderMiddleware(defaultProvider) {
  return (req, _res, next) => {
    const override = req.get("X-LLM-Provider-Model");
    if (typeof override === "string" && override.trim()) {
      req._providerOverride = new OllamaProvider({ model: override.trim() });
    }
    next();
  };
}

function makeMetaLlmRouter({ ingestEffect, broadcast }) {
  const sink = createHostEffectSink({ ingestEffect, broadcast });
  const defaultProvider = pickProvider();
  const router = require("express").Router();
  // Per-request provider switch для sweep'а.
  router.use(perRequestProviderMiddleware(defaultProvider));
  router.use((req, _res, next) => {
    const provider = req._providerOverride ?? defaultProvider;
    req._llmCtx = {
      sink,
      viewer: { role: "patternCurator", userId: "system" },
      config: { timeoutMs: 10 * 60 * 1000, provider },
    };
    next();
  });
  // createLlmBridgeRouter принимает фиксированный ctx; для per-request swap'а
  // мы создаём lazy router который пересоздаёт internal router'а при каждом
  // запросе на основе _llmCtx. Дёшево — bridge router stateless кроме SSE
  // subscribers, которые мы оставляем глобальными.
  let baseRouter = createLlmBridgeRouter({
    sink,
    viewer: { role: "patternCurator", userId: "system" },
    config: { timeoutMs: 10 * 60 * 1000, provider: defaultProvider },
  });
  router.use((req, res, next) => {
    if (req._providerOverride) {
      // Only re-create base router если есть override (rare path — sweep).
      const ctx = req._llmCtx;
      const overrideRouter = createLlmBridgeRouter(ctx);
      return overrideRouter(req, res, next);
    }
    return baseRouter(req, res, next);
  });
  return router;
}

module.exports = { makeMetaLlmRouter };
