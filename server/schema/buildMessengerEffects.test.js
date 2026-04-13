import { describe, it, expect } from "vitest";
import { buildMessengerEffects } from "./buildMessengerEffects.cjs";

const viewer = { id: "u1", name: "Alice" };

describe("buildMessengerEffects", () => {
  it("send_message — создаёт сообщение + обновляет lastMessageAt", () => {
    const ef = buildMessengerEffects("send_message", { content: "Привет!", conversationId: "c1" }, viewer, {});
    expect(ef).toHaveLength(2);
    expect(ef[0].alpha).toBe("add");
    expect(ef[0].context.senderId).toBe("u1");
    expect(ef[0].context.content).toBe("Привет!");
    expect(ef[1].alpha).toBe("replace");
    expect(ef[1].target).toBe("conversation.lastMessageAt");
  });

  it("send_message без content → null", () => {
    expect(buildMessengerEffects("send_message", { content: "", conversationId: "c1" }, viewer, {})).toBeNull();
  });

  it("create_direct_chat — создаёт беседу + 2 участника", () => {
    const world = { users: [{ id: "u2", name: "Bob" }] };
    const ef = buildMessengerEffects("create_direct_chat", { targetUserId: "u2" }, viewer, world);
    expect(ef).toHaveLength(3);
    expect(ef[0].context.type).toBe("direct");
    expect(ef[0].context.participantIds).toEqual(["u1", "u2"]);
  });

  it("create_direct_chat с самим собой → null", () => {
    expect(buildMessengerEffects("create_direct_chat", { targetUserId: "u1" }, viewer, {})).toBeNull();
  });

  it("create_group — создаёт группу + owner + members", () => {
    const ef = buildMessengerEffects("create_group", { title: "Тест", memberIds: ["u2", "u3"] }, viewer, {});
    expect(ef).toHaveLength(4); // conversation + owner + 2 members
    expect(ef[0].context.type).toBe("group");
    expect(ef[1].context.role).toBe("owner");
  });

  it("create_group без title → null", () => {
    expect(buildMessengerEffects("create_group", {}, viewer, {})).toBeNull();
  });

  it("add_contact", () => {
    const ef = buildMessengerEffects("add_contact", { contactId: "u2" }, viewer, {});
    expect(ef).toHaveLength(1);
    expect(ef[0].context.userId).toBe("u1");
    expect(ef[0].context.contactId).toBe("u2");
  });

  it("mark_as_read — обновляет lastReadAt", () => {
    const world = { participants: [{ id: "p1", conversationId: "c1", userId: "u1" }] };
    const ef = buildMessengerEffects("mark_as_read", { conversationId: "c1" }, viewer, world);
    expect(ef).toHaveLength(1);
    expect(ef[0].target).toBe("participant.lastReadAt");
  });

  it("mark_as_read без participant → null", () => {
    expect(buildMessengerEffects("mark_as_read", { conversationId: "c1" }, viewer, { participants: [] })).toBeNull();
  });

  it("unknown → null", () => {
    expect(buildMessengerEffects("unknown", {}, viewer, {})).toBeNull();
  });
});
