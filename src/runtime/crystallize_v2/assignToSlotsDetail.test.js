import { describe, it, expect } from "vitest";
import { assignToSlotsDetail } from "./assignToSlotsDetail.js";

const INTENTS = {
  update_profile: {
    name: "Обновить профиль",
    particles: {
      entities: ["user: User"],
      witnesses: ["user.name", "user.avatar"],
      confirmation: "form",
      conditions: [],
      effects: [{ α: "replace", target: "user.name" }],
    },
    parameters: [{ name: "name", type: "text", required: true }],
  },
  // delete_account в реальном мессенджере в UNSUPPORTED_INTENTS_M2 —
  // используем синтетический intent для теста irreversibility.
  reset_profile: {
    name: "Сбросить профиль",
    particles: {
      entities: ["user: User"],
      witnesses: ["user.name"],
      confirmation: "form",
      conditions: [],
      effects: [{ α: "replace", target: "user.name" }],
    },
    irreversibility: "high",
    parameters: [{ name: "confirm", type: "text", required: true }],
  },
  block_contact: {
    name: "Заблокировать",
    particles: {
      entities: ["contact: Contact"],
      witnesses: [],
      confirmation: "click",
      conditions: ["contact.status = 'accepted'"],
      effects: [{ α: "replace", target: "contact.status" }],
    },
  },
};

const userProfile = {
  name: "Профиль",
  kind: "detail",
  entities: ["User"],
  mainEntity: "User",
  idParam: "userId",
};

const ONTOLOGY = {
  entities: {
    User: { fields: ["id", "email", "name", "avatar", "status"] },
    Contact: { fields: ["id", "status"] },
  },
};

describe("assignToSlotsDetail", () => {
  it("body — column с полями главной сущности", () => {
    const slots = assignToSlotsDetail(INTENTS, userProfile, ONTOLOGY);
    expect(slots.body.type).toBe("column");
    const binds = extractBinds(slots.body);
    expect(binds).toContain("name");
    expect(binds).toContain("email");
    expect(binds).toContain("avatar");
    expect(binds).not.toContain("id");
  });

  it("intent с form → toolbar + overlay", () => {
    const slots = assignToSlotsDetail(INTENTS, userProfile, ONTOLOGY);
    const updateTrigger = slots.toolbar.find(t => t.intentId === "update_profile");
    expect(updateTrigger).toBeDefined();
    expect(slots.overlay.some(o => o.intentId === "update_profile")).toBe(true);
  });

  it("irreversibility:high → overlay confirmDialog", () => {
    const slots = assignToSlotsDetail(INTENTS, userProfile, ONTOLOGY);
    const del = slots.overlay.find(o => o.triggerIntentId === "reset_profile");
    expect(del).toBeDefined();
    expect(del.type).toBe("confirmDialog");
  });

  it("не включает intents другой сущности", () => {
    const slots = assignToSlotsDetail(INTENTS, userProfile, ONTOLOGY);
    expect(slots.toolbar.some(t => t.intentId === "block_contact")).toBe(false);
  });

  it("нет composer, пустой fab", () => {
    const slots = assignToSlotsDetail(INTENTS, userProfile, ONTOLOGY);
    expect(slots.composer).toBeUndefined();
    expect(slots.fab).toEqual([]);
  });
});

function extractBinds(node) {
  const binds = [];
  const walk = (n) => {
    if (!n) return;
    if (n.bind) binds.push(n.bind);
    if (n.children) n.children.forEach(walk);
    if (n.item) walk(n.item);
  };
  walk(node);
  return binds;
}
