import { describe, it, expect } from "vitest";
import { assignToSlotsCatalog } from "./assignToSlotsCatalog.js";

const INTENTS = {
  create_direct_chat: {
    name: "Личный чат",
    particles: {
      entities: ["conversation: Conversation", "user: User"],
      witnesses: [],
      confirmation: "click",
      conditions: [],
      effects: [{ α: "add", target: "conversations" }],
    },
    creates: "Conversation",
  },
  create_group: {
    name: "Групповой чат",
    particles: {
      entities: ["conversation: Conversation"],
      witnesses: [],
      confirmation: "form",
      conditions: [],
      effects: [{ α: "add", target: "conversations" }],
    },
    creates: "Conversation",
    parameters: [{ name: "title", type: "text", required: true }],
  },
  delete_conversation: {
    name: "Удалить беседу",
    particles: {
      entities: ["conversation: Conversation"],
      witnesses: ["conversation.title"],
      confirmation: "click",
      conditions: [],
      effects: [{ α: "replace", target: "conversation.deletedFor" }],
    },
    irreversibility: "high",
  },
  search_conversations: {
    name: "Поиск",
    particles: {
      entities: [],
      witnesses: ["query", "results"],
      confirmation: "form",
      conditions: [],
      effects: [],
    },
    parameters: [{ name: "query", type: "text", required: true }],
  },
};

const conversationList = {
  name: "Беседы",
  kind: "catalog",
  entities: ["Conversation", "Participant"],
  mainEntity: "Conversation",
};

const ONTOLOGY = {
  entities: {
    Conversation: { fields: ["id", "title", "createdAt"] },
    Participant: { fields: ["id", "muted"] },
    User: { fields: ["id", "name"] },
  },
};

describe("assignToSlotsCatalog", () => {
  it("creates главной сущности с параметрами (create_group) → fab", () => {
    const slots = assignToSlotsCatalog(INTENTS, conversationList, ONTOLOGY);
    const fabIds = slots.fab.map(s => s.trigger?.intentId || s.intentId);
    expect(fabIds).toContain("create_group");
  });

  it("creator без параметров (create_direct_chat) пропускается", () => {
    const slots = assignToSlotsCatalog(INTENTS, conversationList, ONTOLOGY);
    const fabIds = slots.fab.map(s => s.trigger?.intentId || s.intentId);
    expect(fabIds).not.toContain("create_direct_chat");
    const toolbarIds = slots.toolbar.map(s => s.intentId);
    expect(toolbarIds).not.toContain("create_direct_chat");
  });

  it("per-item intent с irreversibility → item.intents с overlay", () => {
    const slots = assignToSlotsCatalog(INTENTS, conversationList, ONTOLOGY);
    expect(slots.body.item).toBeDefined();
    const del = slots.body.item.intents.find(i => i.intentId === "delete_conversation");
    expect(del).toBeDefined();
    expect(del.opens).toBe("overlay");
  });

  it("projection-level utility (search) → toolbar + overlay formModal", () => {
    const slots = assignToSlotsCatalog(INTENTS, conversationList, ONTOLOGY);
    const searchTrigger = slots.toolbar.find(t => t.intentId === "search_conversations");
    expect(searchTrigger).toBeDefined();
    expect(slots.overlay.some(o => o.intentId === "search_conversations")).toBe(true);
  });

  it("body — list с source, соответствующим главной сущности", () => {
    const slots = assignToSlotsCatalog(INTENTS, conversationList, ONTOLOGY);
    expect(slots.body.type).toBe("list");
    expect(slots.body.source).toBe("conversations");
  });

  it("нет composer (только feed имеет composer)", () => {
    const slots = assignToSlotsCatalog(INTENTS, conversationList, ONTOLOGY);
    expect(slots.composer).toBeUndefined();
  });

  it("возвращает все слоты", () => {
    const slots = assignToSlotsCatalog(INTENTS, conversationList, ONTOLOGY);
    expect(slots).toHaveProperty("header");
    expect(slots).toHaveProperty("toolbar");
    expect(slots).toHaveProperty("body");
    expect(slots).toHaveProperty("context");
    expect(slots).toHaveProperty("fab");
    expect(slots).toHaveProperty("overlay");
  });
});
