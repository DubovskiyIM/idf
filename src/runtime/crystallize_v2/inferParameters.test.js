import { describe, it, expect } from "vitest";
import { inferParameters } from "./inferParameters.js";

const ONTOLOGY = {
  entities: {
    Message: { fields: ["id", "conversationId", "senderId", "content", "createdAt", "status"] },
    User:    { fields: ["id", "name", "avatar", "status"] },
    Conversation: { fields: ["id", "type", "title", "createdAt"] },
  },
};

describe("inferParameters", () => {
  it("явный parameters-override побеждает", () => {
    const intent = {
      particles: { witnesses: ["draft_text"], confirmation: "enter" },
      parameters: [{ name: "text", type: "text", required: true }],
    };
    const params = inferParameters(intent, ONTOLOGY);
    expect(params).toEqual([{ name: "text", type: "text", required: true }]);
  });

  it("инференция из witness без точки → параметр", () => {
    const intent = {
      particles: {
        witnesses: ["conversation.title", "draft_text"],
        confirmation: "enter",
      },
    };
    const params = inferParameters(intent, ONTOLOGY);
    expect(params).toHaveLength(1);
    expect(params[0].name).toBe("draft_text");
  });

  it("точечные witnesses не становятся параметрами", () => {
    const intent = {
      particles: {
        witnesses: ["conversation.title", "message.content"],
        confirmation: "click",
      },
    };
    const params = inferParameters(intent, ONTOLOGY);
    expect(params).toEqual([]);
  });

  it("creates:X подтягивает поля сущности, вычитая системные", () => {
    const intent = {
      particles: {
        entities: ["message: Message"],
        witnesses: [],
        confirmation: "form",
        effects: [{ α: "add", target: "messages" }],
      },
      creates: "Message",
    };
    const params = inferParameters(intent, ONTOLOGY);
    const names = params.map(p => p.name);
    expect(names).toContain("content");
    expect(names).not.toContain("id");
    expect(names).not.toContain("createdAt");
    expect(names).not.toContain("senderId");
  });

  it("phase:investigation + точечный witness → editable параметр с default", () => {
    const intent = {
      particles: {
        witnesses: ["message.content"],
        confirmation: "click",
      },
      phase: "investigation",
    };
    const params = inferParameters(intent, ONTOLOGY);
    expect(params).toHaveLength(1);
    expect(params[0].name).toBe("content");
    expect(params[0].bind).toBe("message.content");
    expect(params[0].editable).toBe(true);
  });

  it("current_X → неявный параметр X", () => {
    const intent = {
      particles: { witnesses: ["current_theme"], confirmation: "click" },
    };
    const params = inferParameters(intent, ONTOLOGY);
    expect(params).toHaveLength(1);
    expect(params[0].name).toBe("theme");
  });

  it("результат-witnesses (results, translated_text) не параметры", () => {
    const intent = {
      particles: {
        witnesses: ["query", "results"],
        confirmation: "form",
      },
    };
    const params = inferParameters(intent, ONTOLOGY);
    const names = params.map(p => p.name);
    expect(names).toContain("query");
    expect(names).not.toContain("results");
  });
});
