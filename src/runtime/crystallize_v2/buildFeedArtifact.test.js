import { describe, it, expect } from "vitest";
import { crystallizeV2 } from "./index.js";

const INTENTS = {
  send_message: {
    name: "Отправить",
    particles: {
      entities: ["message: Message", "conversation: Conversation"],
      witnesses: ["conversation.title", "draft_text"],
      confirmation: "enter",
      conditions: [],
      effects: [{ α: "add", target: "messages" }],
    },
    creates: "Message",
  },
  edit_message: {
    name: "Редактировать",
    particles: {
      entities: ["message: Message"],
      witnesses: ["message.content"],
      confirmation: "click",
      conditions: ["message.senderId = me.id"],
      effects: [{ α: "replace", target: "message.content" }],
    },
    phase: "investigation",
  },
  delete_message: {
    name: "Удалить",
    particles: {
      entities: ["message: Message"],
      witnesses: ["message.content"],
      confirmation: "click",
      conditions: ["message.senderId = me.id"],
      effects: [{ α: "replace", target: "message.deletedFor" }],
    },
  },
  search_messages: {
    name: "Поиск",
    particles: {
      entities: [],
      witnesses: ["query", "results"],
      confirmation: "form",
      conditions: [],
      effects: [],
    },
  },
  clear_history: {
    name: "Очистить историю",
    particles: {
      entities: ["conversation: Conversation"],
      witnesses: ["conversation.title", "messages.count"],
      confirmation: "click",
      conditions: [],
      effects: [{ α: "replace", target: "conversation.clearedAt" }],
    },
    irreversibility: "high",
  },
};

const PROJECTIONS = {
  chat_view: {
    name: "Чат",
    kind: "feed",
    query: "сообщения беседы",
    witnesses: ["content", "sender.name"],
    entities: ["Message", "Conversation", "Participant"],
    mainEntity: "Message",
  },
};

const ONTOLOGY = {
  entities: {
    Message: { fields: ["id", "conversationId", "senderId", "content", "createdAt"] },
    Conversation: { fields: ["id", "title"] },
    Participant: { fields: ["id", "muted"] },
  },
};

describe("crystallizeV2 — chat_view feed", () => {
  it("строит валидный артефакт для chat_view", () => {
    const artifacts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, "messenger");
    expect(artifacts.chat_view).toBeDefined();
    expect(artifacts.chat_view.archetype).toBe("feed");
    expect(artifacts.chat_view.version).toBe(2);
  });

  it("composer указывает на send_message", () => {
    const a = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY).chat_view;
    expect(a.slots.composer?.primaryIntent).toBe("send_message");
  });

  it("search_messages → toolbar + formModal в overlay", () => {
    const a = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY).chat_view;
    const searchTrigger = a.slots.toolbar.find(t => t.intentId === "search_messages");
    expect(searchTrigger).toBeDefined();
    expect(a.slots.overlay.some(o => o.type === "formModal" && o.intentId === "search_messages")).toBe(true);
  });

  it("clear_history → toolbar + confirmDialog с irreversibility:high", () => {
    const a = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY).chat_view;
    const overlay = a.slots.overlay.find(o => o.triggerIntentId === "clear_history");
    expect(overlay).toBeDefined();
    expect(overlay.type).toBe("confirmDialog");
    expect(overlay.irreversibility).toBe("high");
  });

  it("delete_message → body.item.intents", () => {
    const a = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY).chat_view;
    expect(a.slots.body.item.intents.some(i => i.intentId === "delete_message")).toBe(true);
  });

  it("inputsHash детерминирован", () => {
    const a1 = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY).chat_view;
    const a2 = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY).chat_view;
    expect(a1.inputsHash).toBe(a2.inputsHash);
  });
});
