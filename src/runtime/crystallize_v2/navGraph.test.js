import { describe, it, expect } from "vitest";
import { deriveNavGraph } from "./navGraph.js";

const PROJECTIONS = {
  conversation_list: {
    name: "Беседы",
    kind: "catalog",
    entities: ["Conversation"],
    mainEntity: "Conversation",
  },
  chat_view: {
    name: "Чат",
    kind: "feed",
    entities: ["Message", "Conversation"],
    mainEntity: "Message",
    idParam: "conversationId",
  },
  user_profile: {
    name: "Профиль",
    kind: "detail",
    entities: ["User"],
    mainEntity: "User",
    idParam: "userId",
  },
  contact_list: {
    name: "Контакты",
    kind: "catalog",
    entities: ["Contact", "User"],
    mainEntity: "Contact",
  },
};

describe("deriveNavGraph", () => {
  it("catalog Conversation → есть ребро в chat_view (который показывает Conversation)", () => {
    const graph = deriveNavGraph(PROJECTIONS);
    const edges = graph.edgesFrom("conversation_list");
    expect(edges.some(e => e.to === "chat_view" && e.kind === "item-click")).toBe(true);
  });

  it("catalog Contact → catalog показывает сущности User → есть ребро в user_profile", () => {
    const graph = deriveNavGraph(PROJECTIONS);
    const edges = graph.edgesFrom("contact_list");
    expect(edges.some(e => e.to === "user_profile" && e.kind === "item-click")).toBe(true);
  });

  it("detail user_profile — входящие рёбра от списков User", () => {
    const graph = deriveNavGraph(PROJECTIONS);
    const incoming = graph.edgesTo("user_profile");
    expect(incoming.some(e => e.from === "contact_list")).toBe(true);
  });

  it("edge содержит params для передачи item.id в целевую проекцию", () => {
    const graph = deriveNavGraph(PROJECTIONS);
    const edge = graph.edgesFrom("conversation_list").find(e => e.to === "chat_view");
    expect(edge.params).toBeDefined();
    // chat_view.idParam === "conversationId" — send_message handler
    // читает именно ctx.conversationId, так что navGraph даёт это имя.
    expect(edge.params.conversationId).toBe("item.id");
  });

  it("detail проекция без соответствующего catalog — нет входящих рёбер", () => {
    const graph = deriveNavGraph({
      orphan_detail: { kind: "detail", entities: ["Orphan"], mainEntity: "Orphan", idParam: "orphanId" },
    });
    expect(graph.edgesTo("orphan_detail")).toEqual([]);
  });
});
