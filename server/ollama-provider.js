/**
 * OllamaProvider — local LLM provider via Ollama HTTP API.
 *
 * Зачем: variance check для self-hosting fixed-point эксперимента.
 * Все 4 prior runs запускались на claude-cli (Opus 4.7). Чтобы проверить
 * universality findings'ов — нужен другой класс модели. Локальная Ollama
 * даёт zero-cost replication на меньших моделях (deepseek-r1:8b,
 * qwen2.5:7b, etc).
 *
 * Контракт совпадает с ClaudeCliProvider:
 *   provider.run(prompt, { signal, onProgress, systemPrompt?, maxTurns? })
 *     → Promise<{ text: string, usage?: { inputTokens, outputTokens } }>
 *
 * Конфигурация через env:
 *   OLLAMA_HOST  (default http://localhost:11434)
 *   OLLAMA_MODEL (default deepseek-r1:latest)
 *
 * Особенности:
 *   - DeepSeek-R1 reasoning model emits <think>...</think> trace
 *     before actual JSON. Provider strips эти теги перед return —
 *     иначе bridge JSON.parse падает на reasoning prose, и каждая
 *     итерация = invalid_output. Strip aware: только если match'ится.
 *   - Если в response несколько JSON blocks или JSON вложен в prose,
 *     extract first {...} balanced block. Это soft compatibility shim;
 *     если model не выдаёт JSON вообще — let bridge handle as
 *     invalid_output (это валидный finding для experiment'а).
 */

class OllamaProvider {
  constructor({ host, model } = {}) {
    this.host = host ?? process.env.OLLAMA_HOST ?? "http://localhost:11434";
    this.model = model ?? process.env.OLLAMA_MODEL ?? "deepseek-r1:latest";
    this.name = `ollama:${this.model}`;
  }

  async run(prompt, opts = {}) {
    const { signal, onProgress, systemPrompt } = opts;
    if (signal?.aborted) {
      const err = new Error("Aborted by signal");
      err.name = "AbortError";
      throw err;
    }
    onProgress?.({ kind: "partial", text: `· ollama call (${this.model})\n`, cumulativeTokens: 0 });

    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const res = await fetch(`${this.host}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: {
          // temp 0 для maximum determinism / replication
          temperature: 0,
        },
      }),
      signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    const rawText = String(data?.message?.content ?? "");

    onProgress?.({
      kind: "partial",
      text: "· response received\n",
      cumulativeTokens: data?.eval_count ?? 0,
    });

    const text = extractJsonFromReasoningResponse(rawText);

    return {
      text,
      usage: {
        // Ollama metric: prompt_eval_count = input, eval_count = output
        inputTokens: data?.prompt_eval_count ?? 0,
        outputTokens: data?.eval_count ?? 0,
      },
    };
  }
}

/**
 * Strips reasoning trace `<think>...</think>` (и аналогичные форматы)
 * перед JSON. Если в результате видим первый balanced {...} block —
 * возвращаем его. Иначе возвращаем text как есть, и пусть bridge
 * решает (вероятно invalid_output).
 */
function extractJsonFromReasoningResponse(raw) {
  // Strip <think>...</think> (DeepSeek-R1 / Qwen3 thinking format).
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // Some models pre-pend "Final answer:", "JSON:", etc.
  cleaned = cleaned.replace(/^(?:final answer|answer|json|output)\s*[:\-]\s*/i, "").trim();

  // Strip markdown code fences if present.
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  // Find first balanced {...} block. Простая bracket-matching импл.
  const start = cleaned.indexOf("{");
  if (start === -1) return cleaned; // no JSON — let bridge handle
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return cleaned.slice(start, i + 1);
      }
    }
  }
  return cleaned;
}

module.exports = { OllamaProvider, extractJsonFromReasoningResponse };
