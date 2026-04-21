/**
 * Claude client — тонкая обёртка над @anthropic-ai/sdk для Studio authoring flow.
 *
 * Возвращает parsed JSON (LLM всегда отвечает JSON'ом по инструкции в system
 * prompt'е). Если Claude завернул ответ в markdown code-fence — извлекает.
 *
 * Для тестов: опционально принимает `client` (mock Anthropic SDK).
 */

const DEFAULT_MODEL = process.env.IDF_AUTHORING_MODEL || "claude-sonnet-4-5-20250929";
const DEFAULT_MAX_TOKENS = 2048;

function extractJson(text) {
  if (!text || typeof text !== "string") {
    throw new Error("claudeClient: empty or non-string response");
  }
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      return JSON.parse(fenceMatch[1].trim());
    }
    throw new Error(`claudeClient: could not parse JSON from response — starts with: ${trimmed.slice(0, 100)}`);
  }
}

function splitMessages(messages) {
  // Anthropic API требует system отдельно от messages; извлекаем его.
  const systemMsgs = messages.filter(m => m.role === "system");
  const chat = messages.filter(m => m.role !== "system");
  const system = systemMsgs.length === 0
    ? undefined
    : systemMsgs.length === 1
      ? systemMsgs[0].content
      : systemMsgs.map(m => m.content); // несколько system → array
  return { system, chat };
}

async function callClaude({ messages, model = DEFAULT_MODEL, maxTokens = DEFAULT_MAX_TOKENS, client, apiKey }) {
  if (!client && !apiKey) apiKey = process.env.ANTHROPIC_API_KEY;
  if (!client && !apiKey) {
    throw new Error("claudeClient: ANTHROPIC_API_KEY required (or pass client=)");
  }

  const sdkClient = client || (() => {
    const Anthropic = require("@anthropic-ai/sdk").default || require("@anthropic-ai/sdk");
    return new Anthropic({ apiKey });
  })();

  const { system, chat } = splitMessages(messages);

  const response = await sdkClient.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: chat,
  });

  const text = Array.isArray(response.content)
    ? response.content.filter(b => b.type === "text").map(b => b.text).join("")
    : response.content || "";

  return extractJson(text);
}

module.exports = { callClaude, extractJson, DEFAULT_MODEL };
