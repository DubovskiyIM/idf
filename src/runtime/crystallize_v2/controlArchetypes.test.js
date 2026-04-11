import { describe, it, expect } from "vitest";
import { selectArchetype } from "./controlArchetypes.js";

const intent = (conf, extra = {}) => ({
  name: "Test",
  particles: { confirmation: conf, witnesses: [], conditions: [], effects: [] },
  ...extra,
});

describe("selectArchetype", () => {
  it("confirmation:auto → auto", () => {
    const a = selectArchetype(intent("auto"), "x");
    expect(a.id).toBe("auto");
    expect(a.build()).toBeNull();
  });

  it("confirmation:enter → composerEntry", () => {
    const a = selectArchetype(intent("enter"), "send");
    expect(a.id).toBe("composerEntry");
    const w = a.build(intent("enter"), "send", [{ name: "text", control: "text" }]);
    expect(w.type).toBe("composerEntry");
    expect(w.primaryParameter).toBe("text");
  });

  it("confirmation:form → formModal", () => {
    const a = selectArchetype(intent("form"), "search");
    expect(a.id).toBe("formModal");
    const w = a.build(intent("form"), "search", [{ name: "query" }]);
    expect(w.trigger).toBeDefined();
    expect(w.overlay.type).toBe("formModal");
  });

  it("irreversibility:high побеждает confirmation", () => {
    const a = selectArchetype(intent("click", { irreversibility: "high" }), "delete");
    expect(a.id).toBe("confirmDialog");
    const w = a.build(intent("click", { irreversibility: "high" }), "delete", []);
    expect(w.overlay.type).toBe("confirmDialog");
    expect(w.overlay.confirmBy.type).toBe("typeText");
  });

  it("irreversibility:medium → confirmDialog с button", () => {
    const a = selectArchetype(intent("click", { irreversibility: "medium" }), "delete_contact");
    const w = a.build(intent("click", { irreversibility: "medium" }), "delete_contact", []);
    expect(w.overlay.type).toBe("confirmDialog");
    expect(w.overlay.confirmBy.type).toBe("button");
  });

  it("confirmation:click без параметров → plain button", () => {
    const a = selectArchetype(intent("click"), "mute");
    expect(a.id).toBe("clickForm");
    const wrapped = a.build(intent("click"), "mute", []);
    expect(wrapped.type).toBe("intentButton");
    expect(wrapped.opens).toBeUndefined();
  });

  it("confirmation:click с параметрами → formModal overlay", () => {
    const i = intent("click", { phase: "investigation" });
    const a = selectArchetype(i, "edit");
    const wrapped = a.build(i, "edit", [{ name: "content", control: "text" }]);
    expect(wrapped.trigger).toBeDefined();
    expect(wrapped.trigger.opens).toBe("overlay");
    expect(wrapped.overlay.type).toBe("formModal");
    expect(wrapped.overlay.parameters).toHaveLength(1);
  });

  it("confirmation:file → filePicker", () => {
    const a = selectArchetype(intent("file"), "set_avatar");
    expect(a.id).toBe("filePicker");
    const wrapped = a.build(intent("file"), "set_avatar", []);
    expect(wrapped.filePicker).toBe(true);
  });

  it("explicit intent.control побеждает эвристику", () => {
    const i = intent("click", { control: "filePicker" });
    const a = selectArchetype(i, "x");
    expect(a.id).toBe("filePicker");
  });

  it("неизвестный explicit control → null", () => {
    const i = intent("click", { control: "nonExistent" });
    const a = selectArchetype(i, "x");
    expect(a).toBeNull();
  });

  it("intent с icon='📝' override иконки", () => {
    const a = selectArchetype(intent("click", { icon: "📝" }), "edit");
    const wrapped = a.build(intent("click", { icon: "📝" }), "edit", []);
    expect(wrapped.icon).toBe("📝");
  });

  it("antagonist прокидывается в wrapper", () => {
    const i = intent("click", { antagonist: "unmute" });
    const a = selectArchetype(i, "mute");
    const wrapped = a.build(i, "mute", []);
    expect(wrapped.antagonist).toBe("unmute");
  });

  it("search-intent (witnesses query+results, no entities) → inlineSearch", () => {
    const i = {
      name: "Поиск",
      particles: {
        entities: [],
        witnesses: ["query", "results"],
        confirmation: "form",
        conditions: [],
        effects: [],
      },
      parameters: [{ name: "query", type: "text", placeholder: "Поиск…" }],
    };
    const a = selectArchetype(i, "search_messages");
    expect(a.id).toBe("inlineSearch");
    const w = a.build(i, "search_messages", [{ name: "query", control: "text" }]);
    expect(w.type).toBe("inlineSearch");
    expect(w.paramName).toBe("query");
    expect(w.icon).toBe("🔍");
    expect(w.placeholder).toBe("Поиск…");
  });

  it("intent без query witness → не inlineSearch", () => {
    const i = {
      name: "Отправить",
      particles: {
        entities: ["message: Message"],
        witnesses: ["draft_text"],
        confirmation: "enter",
        conditions: [],
        effects: [{ α: "add", target: "messages" }],
      },
    };
    const a = selectArchetype(i, "send_message");
    expect(a.id).not.toBe("inlineSearch");
    expect(a.id).toBe("composerEntry");
  });
});
