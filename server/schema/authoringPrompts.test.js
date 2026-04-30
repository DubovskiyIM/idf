import { describe, it, expect } from "vitest";
import { loadPrompt, buildMessages, __resetPromptCache } from "./authoringPrompts.cjs";

describe("authoringPrompts.loadPrompt", () => {
  it("system.md возвращает непустую строку с IDF-контекстом", () => {
    __resetPromptCache();
    const text = loadPrompt("system");
    expect(text.length).toBeGreaterThan(500);
    expect(text).toMatch(/IDF|userFacing|patch|nextState/);
  });

  it("все 7 state-prompt'ов загружаются", () => {
    const states = ["empty", "kickoff", "entities", "intents", "roles", "ontology_detail", "preview"];
    for (const s of states) {
      expect(loadPrompt(s).length).toBeGreaterThan(50);
    }
  });

  it("кэширует повторный вызов", () => {
    __resetPromptCache();
    const a = loadPrompt("system");
    const b = loadPrompt("system");
    expect(a).toBe(b); // same string ref expected with cache
  });

  it("неизвестный prompt-name кидает explicit error", () => {
    expect(() => loadPrompt("nonexistent-state")).toThrow(/nonexistent/);
  });
});

describe("authoringPrompts.buildMessages", () => {
  it("возвращает массив с system + user ролями", () => {
    const msgs = buildMessages({
      state: "entities",
      spec: { meta: { id: "test" }, INTENTS: {}, ONTOLOGY: { entities: {}, roles: {} } },
      userText: "добавь Client",
    });
    expect(Array.isArray(msgs)).toBe(true);
    expect(msgs.length).toBeGreaterThanOrEqual(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs.at(-1).role).toBe("user");
    expect(msgs.at(-1).content).toContain("добавь Client");
  });

  it("system-message содержит IDF-контекст + state-specific prompt", () => {
    const msgs = buildMessages({
      state: "intents",
      spec: { meta: { id: "x" } },
      userText: "x",
    });
    const sys = msgs[0];
    const allContent = JSON.stringify(sys.content);
    expect(allContent).toMatch(/IDF|userFacing/);
    expect(allContent).toMatch(/intents|действия|intent/i);
  });

  it("markирует system-блок как cacheable для Anthropic prompt caching", () => {
    const msgs = buildMessages({
      state: "entities",
      spec: { meta: { id: "x" } },
      userText: "x",
    });
    const sys = msgs[0];
    // Проверяем что контент содержит cache_control marker где-то
    const hasCache = Array.isArray(sys.content)
      && sys.content.some(block => block.cache_control?.type === "ephemeral");
    expect(hasCache).toBe(true);
  });

  it("передаёт текущий spec-snapshot в prompt", () => {
    const msgs = buildMessages({
      state: "entities",
      spec: { meta: { id: "retro", description: "Retro tool" }, INTENTS: {}, ONTOLOGY: { entities: {} } },
      userText: "x",
    });
    const sysContent = JSON.stringify(msgs[0].content);
    expect(sysContent).toMatch(/retro/);
    expect(sysContent).toMatch(/Retro tool/);
  });

  it("включает последние N turn'ов history'а между system и последним user", () => {
    const history = [
      { userText: "первый", llmResponse: { userFacing: "ok1", patch: {}, nextState: "kickoff" } },
      { userText: "второй", llmResponse: { userFacing: "ok2", patch: {}, nextState: "entities" } },
    ];
    const msgs = buildMessages({
      state: "entities",
      spec: { meta: { id: "x" } },
      userText: "третий",
      history,
    });
    // Между первым (system) и последним (user=третий) — turns: user/assistant pairs
    const roles = msgs.map(m => m.role);
    expect(roles.filter(r => r === "user").length).toBeGreaterThanOrEqual(2);
    expect(roles.filter(r => r === "assistant").length).toBeGreaterThanOrEqual(1);
    const joinedContent = msgs.map(m => typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n");
    expect(joinedContent).toContain("первый");
    expect(joinedContent).toContain("третий");
  });

  it("обрезает history длиннее 6 turn'ов (keeps last 6)", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      userText: `turn-${i}`,
      llmResponse: { userFacing: "ok", patch: {}, nextState: "entities" },
    }));
    const msgs = buildMessages({
      state: "entities",
      spec: { meta: { id: "x" } },
      userText: "latest",
      history,
    });
    const joined = msgs.map(m => typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n");
    expect(joined).not.toContain("turn-0");
    expect(joined).not.toContain("turn-1");
    expect(joined).toContain("turn-9");
  });

  it("если передан attachments[], добавляет document content-block перед текстом юзера", () => {
    const msgs = buildMessages({
      state: "entities",
      spec: { meta: { id: "demo" }, INTENTS: {}, ONTOLOGY: { entities: {}, roles: {}, invariants: [] }, PROJECTIONS: {} },
      userText: "Импортируй ресурсы из этой спецификации",
      history: [],
      attachments: [{ fileId: "file_abc", mediaType: "application/yaml", name: "petstore.yaml" }],
    });
    const lastMsg = msgs[msgs.length - 1];
    expect(lastMsg.role).toBe("user");
    expect(Array.isArray(lastMsg.content)).toBe(true);
    const docBlock = lastMsg.content.find((b) => b.type === "document");
    expect(docBlock).toBeDefined();
    expect(docBlock.source.type).toBe("file");
    expect(docBlock.source.file_id).toBe("file_abc");
    const textBlock = lastMsg.content.find((b) => b.type === "text");
    expect(textBlock).toBeDefined();
    expect(textBlock.text).toMatch(/Импортируй/);
  });

  it("если attachments не передан, content юзера — обычная строка", () => {
    const msgs = buildMessages({
      state: "entities", spec: { meta: {}, INTENTS: {}, ONTOLOGY: { entities: {}, roles: {}, invariants: [] }, PROJECTIONS: {} },
      userText: "hi", history: [],
    });
    const last = msgs[msgs.length - 1];
    expect(typeof last.content).toBe("string");
  });
});
