import { describe, it, expect } from "vitest";
import { assignToSlots } from "./assignToSlots.js";

const INTENTS = {
  send_message: {
    name: "Отправить сообщение",
    particles: {
      entities: ["message: Message", "conversation: Conversation"],
      witnesses: ["conversation.title", "draft_text"],
      confirmation: "enter",
      conditions: [],
      effects: [{ α: "add", target: "messages" }],
    },
    creates: "Message",
  },
  delete_message: {
    name: "Удалить сообщение",
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
  mute_conversation: {
    name: "Заглушить",
    particles: {
      entities: ["participant: Participant"],
      witnesses: [],
      confirmation: "click",
      conditions: [],
      effects: [{ α: "replace", target: "participant.muted" }],
    },
    antagonist: "unmute_conversation",
  },
  unmute_conversation: {
    name: "Включить звук",
    particles: {
      entities: ["participant: Participant"],
      witnesses: [],
      confirmation: "click",
      conditions: ["participant.muted = true"],
      effects: [{ α: "replace", target: "participant.muted" }],
    },
    antagonist: "mute_conversation",
  },
};

const chatViewProjection = {
  name: "Чат",
  kind: "feed",
  witnesses: ["content", "sender.name", "createdAt"],
  entities: ["Message", "Conversation", "Participant"],
  mainEntity: "Message",
};

const ONTOLOGY = {
  entities: {
    Message: { fields: ["id", "content", "senderId"] },
    Conversation: { fields: ["id", "title"] },
    Participant: { fields: ["id", "userId", "muted"] },
  },
};

describe("assignToSlots (feed)", () => {
  it("send_message с confirmation:enter + creates:Message → composer", () => {
    const slots = assignToSlots(INTENTS, chatViewProjection, ONTOLOGY);
    expect(slots.composer).toBeDefined();
    expect(slots.composer.primaryIntent).toBe("send_message");
  });

  it("search_messages (form, projection-level) → toolbar + formModal в overlay", () => {
    const slots = assignToSlots(INTENTS, chatViewProjection, ONTOLOGY);
    const toolbarTriggers = slots.toolbar.filter(c => c.intentId === "search_messages");
    expect(toolbarTriggers).toHaveLength(1);
    expect(toolbarTriggers[0].opens).toBe("overlay");
    const overlayEntry = slots.overlay.find(o => o.triggerIntentId === "search_messages" || o.intentId === "search_messages");
    expect(overlayEntry).toBeDefined();
    expect(overlayEntry.type).toBe("formModal");
  });

  it("clear_history с irreversibility:high → toolbar trigger + confirmDialog overlay", () => {
    const slots = assignToSlots(INTENTS, chatViewProjection, ONTOLOGY);
    const overlayEntry = slots.overlay.find(o => o.triggerIntentId === "clear_history");
    expect(overlayEntry).toBeDefined();
    expect(overlayEntry.type).toBe("confirmDialog");
    expect(overlayEntry.irreversibility).toBe("high");
  });

  it("delete_message (per-item click) → body.item.intents", () => {
    const slots = assignToSlots(INTENTS, chatViewProjection, ONTOLOGY);
    expect(slots.body.item).toBeDefined();
    expect(slots.body.item.intents).toContain("delete_message");
  });

  it("mute/unmute антагонисты → один toggle в header", () => {
    const slots = assignToSlots(INTENTS, chatViewProjection, ONTOLOGY);
    const toggles = [...(slots.header || []), ...(slots.toolbar || [])].filter(c => c.type === "toggle");
    expect(toggles).toHaveLength(1);
    expect(toggles[0].intents).toEqual(
      expect.arrayContaining(["mute_conversation", "unmute_conversation"])
    );
  });

  it("возвращает все шесть слотов + composer", () => {
    const slots = assignToSlots(INTENTS, chatViewProjection, ONTOLOGY);
    expect(slots).toHaveProperty("header");
    expect(slots).toHaveProperty("toolbar");
    expect(slots).toHaveProperty("body");
    expect(slots).toHaveProperty("context");
    expect(slots).toHaveProperty("fab");
    expect(slots).toHaveProperty("overlay");
    expect(slots).toHaveProperty("composer");
  });
});
