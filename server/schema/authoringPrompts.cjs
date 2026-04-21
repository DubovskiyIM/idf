/**
 * Prompt templates для Studio authoring flow.
 *
 * system.md + 7 per-state файлов в server/prompts/authoring/. Loader кеширует
 * чтение. buildMessages собирает Anthropic-совместимый `messages` array
 * с ephemeral prompt-caching для system-block'а.
 */

const fs = require("node:fs");
const path = require("node:path");

const PROMPT_DIR = path.resolve(__dirname, "../prompts/authoring");
const cache = new Map();

function __resetPromptCache() {
  cache.clear();
}

function loadPrompt(name) {
  if (cache.has(name)) return cache.get(name);
  const filePath = path.join(PROMPT_DIR, `${name}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`authoringPrompts.loadPrompt: unknown prompt "${name}" (looked at ${filePath})`);
  }
  const content = fs.readFileSync(filePath, "utf8");
  cache.set(name, content);
  return content;
}

/**
 * Собирает messages array для Claude API.
 *
 * Структура:
 *   [
 *     { role: "system", content: [
 *       { type: "text", text: <system.md>, cache_control: ephemeral },
 *       { type: "text", text: <spec snapshot + state instruction> }
 *     ] },
 *     ...history (last 6, user/assistant pairs),
 *     { role: "user", content: userText }
 *   ]
 *
 * Anthropic ephemeral cache работает на первый блок в content, поэтому
 * большой system-prompt вынесен в первый text-block (> 90% дискаунт при
 * повторных turn'ах одной сессии).
 */
function buildMessages({ state, spec, userText, history = [] }) {
  const system = loadPrompt("system");
  const stateSpecific = loadPrompt(state);

  const systemBlock = {
    role: "system",
    content: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text: `\n\n---\n\nТЕКУЩАЯ СПЕКА (snapshot):\n\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\`\n\n---\n\nИНСТРУКЦИЯ ДЛЯ СОСТОЯНИЯ "${state}":\n\n${stateSpecific}`,
      },
    ],
  };

  const recent = history.slice(-6);
  const historyMessages = [];
  for (const turn of recent) {
    historyMessages.push({ role: "user", content: turn.userText || "" });
    historyMessages.push({
      role: "assistant",
      content: typeof turn.llmResponse === "string"
        ? turn.llmResponse
        : JSON.stringify(turn.llmResponse || {}),
    });
  }

  return [
    systemBlock,
    ...historyMessages,
    { role: "user", content: userText },
  ];
}

module.exports = { loadPrompt, buildMessages, __resetPromptCache };
