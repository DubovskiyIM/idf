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
  it("creates главной сущности с одним текстовым параметром (create_group) → hero", () => {
    // M4 Step A: простые creator-интенты с одним text-параметром
    // перехватываются heroCreate control-архетипом и становятся
    // inline-создателем над списком, а не fab+formModal.
    const slots = assignToSlotsCatalog(INTENTS, conversationList, ONTOLOGY);
    const heroIds = (slots.hero || []).map(s => s.intentId);
    expect(heroIds).toContain("create_group");
    const hero = slots.hero.find(s => s.intentId === "create_group");
    expect(hero.type).toBe("heroCreate");
    expect(hero.paramName).toBe("title");
  });

  it("creator без параметров с extra entity (create_direct_chat) → customCapture entityPicker в fab", () => {
    // M3.5b: create_direct_chat creates Conversation + entity User
    // (вне route scope conversation_list). customCapture.entityPicker
    // перехватывает такие intents и кладёт их в fab с trigger+overlay.
    const slots = assignToSlotsCatalog(INTENTS, conversationList, ONTOLOGY);
    const fabIds = slots.fab.map(s => s.trigger?.intentId || s.intentId);
    expect(fabIds).toContain("create_direct_chat");
    const overlayTypes = slots.overlay.map(o => o.type);
    expect(overlayTypes).toContain("customCapture");
    const picker = slots.overlay.find(o => o.widgetId === "entityPicker");
    expect(picker).toBeDefined();
    expect(picker.targetEntity).toBe("User");
    expect(picker.targetCollection).toBe("users");
    expect(picker.targetAlias).toBe("user");
  });

  it("per-item intent с irreversibility → item.intents с overlay", () => {
    const slots = assignToSlotsCatalog(INTENTS, conversationList, ONTOLOGY);
    expect(slots.body.item).toBeDefined();
    const del = slots.body.item.intents.find(i => i.intentId === "delete_conversation");
    expect(del).toBeDefined();
    expect(del.opens).toBe("overlay");
  });

  it("search-утилита (query+results) → inlineSearch в toolbar", () => {
    const slots = assignToSlotsCatalog(INTENTS, conversationList, ONTOLOGY);
    const searchCtrl = slots.toolbar.find(t => t.intentId === "search_conversations");
    expect(searchCtrl).toBeDefined();
    expect(searchCtrl.type).toBe("inlineSearch");
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
