/**
 * MockClaudeProvider — canned LLM-responder для demo-tenant'а.
 *
 * Заменяет ClaudeCliProvider когда `DEMO_LLM_MOCK=1`. Реальный Claude CLI
 * под HN-front-page трафик жжёт токены непредсказуемо; mock даёт
 * детерминированный SSE-стрим + валидный SynthesizedApplySchema-output
 * без внешних вызовов.
 *
 * Контракт совпадает с @intent-driven/llm-subprocess::ClaudeCliProvider:
 *   provider.run(prompt, { signal, onProgress, systemPrompt?, maxTurns? })
 *     → Promise<{ text: string, usage?: { inputTokens, outputTokens } }>
 *
 * Поведение:
 *   - 4 progress tick'а, ~600мс между, total ~2.5с
 *   - on(progress) emits { type: "token", text: "..." } чтобы UI видел стрим
 *   - text — валидный JSON по форме SynthesizedApplySchema
 *   - signal.aborted → throws AbortError
 *
 * Выбор canned response по candidate name в prompt'е (regex). Несовпадение
 * → generic fallback.
 */

const CANNED = {
  // Дефолтный fallback, совпадает с любым запросом
  default: {
    rationale:
      "Паттерн применяет subCollections derivation на детальной проекции, " +
      "когда у entity есть child-entities с FK обратно на main. " +
      "Подходит для CRUD-доменов с hub-style hierarchy.",
    structure: {
      slot: "subCollections",
      apply:
        "function apply(slots, context) {\n" +
        "  const { ontology, projection, entity } = context;\n" +
        "  const children = findChildEntities(ontology, entity);\n" +
        "  if (children.length === 0) return slots;\n" +
        "  return {\n" +
        "    ...slots,\n" +
        "    subCollections: children.map(c => ({\n" +
        "      projectionId: `${c}_list`,\n" +
        "      foreignKey: foreignKeyFor(ontology, c, entity),\n" +
        "      entity: c,\n" +
        "    })),\n" +
        "  };\n" +
        "}",
    },
    falsification: {
      shouldMatch: ["sales/listing_detail", "freelance/task_detail"],
      shouldNotMatch: ["sales/listing_list", "messenger/conversation_feed"],
    },
  },
  // Hub-absorption pattern (specific candidate)
  "hub-absorption": {
    rationale:
      "Если parent-detail имеет ≥2 child-сущностей с FK на parent — " +
      "child-каталоги абсорбируются как subCollections, child из nav " +
      "удаляются. Снимает «много flat tabs» в CRUD-доменах.",
    structure: {
      slot: "hubSections",
      condition: "children.length >= 2 && allChildrenHaveBackFK(children)",
      apply:
        "function apply(slots, context) {\n" +
        "  const hub = context.entity;\n" +
        "  const absorbed = context.children.filter(c => hasBackFK(c, hub));\n" +
        "  if (absorbed.length < 2) return slots;\n" +
        "  return { ...slots, hubSections: absorbed.map(toSection) };\n" +
        "}",
    },
    falsification: {
      shouldMatch: ["sales/user_detail (Listing+Bid+Order)"],
      shouldNotMatch: ["booking/specialist_detail (single child)"],
    },
  },
};

const PROGRESS_DELAY_MS = 600;
const PROGRESS_STEPS = ["analyzing trigger", "matching falsification", "drafting structure", "validating apply"];

class MockClaudeProvider {
  async run(prompt, { signal, onProgress } = {}) {
    // Выбор canned по prompt
    const m = String(prompt || "").match(/candidate[:\s"]+([a-z][a-z0-9-]+)/i);
    const key = m && CANNED[m[1]] ? m[1] : "default";
    const canned = CANNED[key];

    // Stream progress
    for (const step of PROGRESS_STEPS) {
      if (signal?.aborted) throw new Error("AbortError");
      await sleep(PROGRESS_DELAY_MS);
      onProgress?.({ type: "token", text: `· ${step}\n` });
    }

    if (signal?.aborted) throw new Error("AbortError");

    const text = JSON.stringify(canned, null, 2);
    return {
      text,
      usage: {
        inputTokens: estimateTokens(prompt),
        outputTokens: estimateTokens(text),
      },
    };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function estimateTokens(s) {
  return Math.ceil(String(s || "").length / 4);
}

module.exports = { MockClaudeProvider, CANNED };
