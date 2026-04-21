/**
 * TTS adapter — превращает SSML в playable audio для /api/voice/:domain/:projection?format=audio.
 *
 * MVP: единственный provider — OpenAI TTS (tts-1). Plain-text API, SSML
 * теги stripим перед отправкой (OpenAI не парсит SSML; для prosody/break
 * в MVP — fallback на plain).
 *
 * Cache: in-memory, ключ = sha256(provider|voice|ssml). TTL отсутствует —
 * процесс живёт до рестарта, для demo-среды достаточно.
 */

const crypto = require("node:crypto");

const cache = new Map();

function __resetCache() {
  cache.clear();
}

function cacheKey({ provider, voice, ssml }) {
  return crypto.createHash("sha256")
    .update(`${provider}|${voice}|${ssml}`)
    .digest("hex");
}

function stripSsml(ssml) {
  return ssml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function synthesizeOpenAI({ ssml, apiKey, voice, fetchImpl }) {
  const input = stripSsml(ssml);
  const resp = await fetchImpl("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice,
      input,
      response_format: "mp3",
    }),
  });
  if (!resp.ok) {
    const text = typeof resp.text === "function" ? await resp.text() : "";
    throw new Error(`TTS provider openai error ${resp.status}: ${text}`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  const contentType = (resp.headers && typeof resp.headers.get === "function"
    ? resp.headers.get("content-type")
    : null) || "audio/mpeg";
  return { contentType, audio: buf };
}

async function synthesize(ssml, opts = {}) {
  const {
    provider = "openai",
    apiKey,
    voice = "alloy",
    fetchImpl = (typeof fetch !== "undefined" ? fetch : null),
  } = opts;

  if (!apiKey) throw new Error("TTS: apiKey required");
  if (!fetchImpl) throw new Error("TTS: no fetch available; pass fetchImpl or run on Node 18+");

  const key = cacheKey({ provider, voice, ssml });
  if (cache.has(key)) return cache.get(key);

  let result;
  if (provider === "openai") {
    result = await synthesizeOpenAI({ ssml, apiKey, voice, fetchImpl });
  } else {
    throw new Error(`TTS: provider ${provider} not supported in MVP (only openai)`);
  }
  cache.set(key, result);
  return result;
}

module.exports = { synthesize, stripSsml, __resetCache };
