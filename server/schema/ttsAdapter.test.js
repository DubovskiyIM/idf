import { describe, it, expect, vi, beforeEach } from "vitest";
import { synthesize, __resetCache } from "./ttsAdapter.cjs";

function mockResp({ ok = true, status = 200, body = new ArrayBuffer(128), contentType = "audio/mpeg", text = "" } = {}) {
  return {
    ok, status,
    arrayBuffer: async () => body,
    text: async () => text,
    headers: { get: (h) => (h.toLowerCase() === "content-type" ? contentType : null) },
  };
}

describe("ttsAdapter.synthesize", () => {
  beforeEach(() => { __resetCache(); });

  it("возвращает audio/mpeg buffer для короткой SSML-строки через OpenAI TTS", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResp({ body: new ArrayBuffer(256) }));
    const result = await synthesize("<speak>Hello world</speak>", {
      provider: "openai", apiKey: "test-key", fetchImpl,
    });
    expect(result.contentType).toBe("audio/mpeg");
    expect(Buffer.isBuffer(result.audio)).toBe(true);
    expect(result.audio.length).toBe(256);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toContain("openai.com");
    expect(opts.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(opts.body);
    expect(body.input).toBe("Hello world");
    expect(body.model).toMatch(/tts/);
  });

  it("кэширует повторный вызов по SHA256 от SSML", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResp());
    const ssml = "<speak>Same content</speak>";
    await synthesize(ssml, { provider: "openai", apiKey: "k", fetchImpl });
    await synthesize(ssml, { provider: "openai", apiKey: "k", fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("разные voice → разные cache-ключи", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResp());
    const ssml = "<speak>Same</speak>";
    await synthesize(ssml, { provider: "openai", apiKey: "k", voice: "alloy", fetchImpl });
    await synthesize(ssml, { provider: "openai", apiKey: "k", voice: "nova", fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("кидает ошибку при non-2xx от провайдера, не кэшируя", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(mockResp({ ok: false, status: 429, text: "rate limited" }))
      .mockResolvedValueOnce(mockResp());
    await expect(
      synthesize("<speak>x</speak>", { provider: "openai", apiKey: "k", fetchImpl })
    ).rejects.toThrow(/429/);
    const res = await synthesize("<speak>x</speak>", { provider: "openai", apiKey: "k", fetchImpl });
    expect(res.audio.length).toBe(128);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("требует apiKey — без него кидает", async () => {
    await expect(
      synthesize("<speak>x</speak>", { provider: "openai", fetchImpl: vi.fn() })
    ).rejects.toThrow(/apiKey/);
  });

  it("неизвестный provider — ошибка", async () => {
    await expect(
      synthesize("<speak>x</speak>", { provider: "elevenlabs", apiKey: "k", fetchImpl: vi.fn() })
    ).rejects.toThrow(/provider/);
  });

  it("strip'ит SSML теги перед отправкой в OpenAI (plain-text API)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResp());
    await synthesize(
      "<speak>Привет <break time=\"500ms\"/>мир<prosody rate=\"slow\">тихо</prosody></speak>",
      { provider: "openai", apiKey: "k", fetchImpl }
    );
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.input).toBe("Привет мир тихо");
    expect(body.input).not.toContain("<");
  });
});
