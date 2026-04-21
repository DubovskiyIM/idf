import { describe, it, expect, vi } from "vitest";
import { callClaude, extractJson } from "./claudeClient.cjs";

describe("extractJson", () => {
  it("парсит raw JSON", () => {
    const out = extractJson(`{"userFacing":"ok","nextState":"entities"}`);
    expect(out.userFacing).toBe("ok");
  });

  it("парсит JSON внутри ```json ... ``` code-fence", () => {
    const out = extractJson("```json\n{\"userFacing\":\"ok\"}\n```");
    expect(out.userFacing).toBe("ok");
  });

  it("парсит JSON внутри безымянного ``` ... ``` fence", () => {
    const out = extractJson("```\n{\"userFacing\":\"ok\"}\n```");
    expect(out.userFacing).toBe("ok");
  });

  it("кидает на невалидный ответ", () => {
    expect(() => extractJson("нет никакого JSON тут")).toThrow(/parse JSON/);
  });

  it("кидает на пустую строку", () => {
    expect(() => extractJson("")).toThrow();
  });
});

describe("callClaude", () => {
  function makeMockClient(responseText) {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: responseText }],
        }),
      },
    };
  }

  it("отделяет system от messages и отдаёт parsed JSON", async () => {
    const client = makeMockClient(`{"userFacing":"ok","patch":{},"nextState":"entities"}`);
    const result = await callClaude({
      messages: [
        { role: "system", content: "SYS" },
        { role: "user", content: "U1" },
      ],
      client,
    });
    expect(result.userFacing).toBe("ok");
    expect(result.nextState).toBe("entities");
    const called = client.messages.create.mock.calls[0][0];
    expect(called.system).toBe("SYS");
    expect(called.messages).toEqual([{ role: "user", content: "U1" }]);
  });

  it("передаёт model override", async () => {
    const client = makeMockClient(`{"userFacing":"ok"}`);
    await callClaude({
      messages: [{ role: "user", content: "x" }],
      client,
      model: "claude-opus-4-7",
    });
    const called = client.messages.create.mock.calls[0][0];
    expect(called.model).toBe("claude-opus-4-7");
  });

  it("без client и без apiKey — кидает", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await expect(callClaude({ messages: [{ role: "user", content: "x" }] })).rejects.toThrow(/API_KEY/);
    } finally {
      if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it("парсит response без markdown wrapping", async () => {
    const client = makeMockClient(`{"userFacing":"raw","patch":{"a":1}}`);
    const result = await callClaude({
      messages: [{ role: "user", content: "x" }],
      client,
    });
    expect(result.patch).toEqual({ a: 1 });
  });

  it("array content в response — конкатенирует text-blocks", async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            { type: "text", text: "{\"userFacing\":\"" },
            { type: "text", text: "combined\"}" },
          ],
        }),
      },
    };
    const result = await callClaude({
      messages: [{ role: "user", content: "x" }],
      client,
    });
    expect(result.userFacing).toBe("combined");
  });
});
