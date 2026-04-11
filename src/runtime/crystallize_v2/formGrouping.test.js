import { describe, it, expect } from "vitest";
import { findReplaceIntents, generateEditProjections, buildFormSpec } from "./formGrouping.js";

const INTENTS = {
  set_name: {
    name: "Имя",
    particles: {
      entities: ["user: User"],
      witnesses: [],
      confirmation: "click",
      conditions: [],
      effects: [{ α: "replace", target: "user.name" }],
    },
  },
  set_avatar: {
    name: "Аватар",
    particles: {
      entities: ["user: User"],
      witnesses: [],
      confirmation: "file",
      conditions: [],
      effects: [{ α: "replace", target: "user.avatar" }],
    },
  },
  set_status: {
    name: "Статус",
    particles: {
      entities: ["user: User"],
      witnesses: [],
      confirmation: "click",
      conditions: [],
      effects: [{ α: "replace", target: "user.statusMessage" }],
    },
  },
  block_contact: {
    name: "Заблокировать",
    particles: {
      entities: ["contact: Contact"],
      witnesses: [],
      confirmation: "click",
      conditions: [],
      effects: [{ α: "replace", target: "contact.status" }],
    },
  },
  send_message: {
    name: "Отправить",
    particles: {
      entities: ["message: Message"],
      witnesses: [],
      confirmation: "enter",
      conditions: [],
      effects: [{ α: "add", target: "messages" }],
    },
    creates: "Message",
  },
};

const PROJECTIONS = {
  user_profile: {
    name: "Профиль",
    kind: "detail",
    entities: ["User"],
    mainEntity: "User",
    idParam: "userId",
  },
  chat_view: {
    name: "Чат",
    kind: "feed",
    entities: ["Message"],
    mainEntity: "Message",
  },
};

const ONTOLOGY = {
  entities: {
    User: {
      fields: {
        id: { type: "id" },
        email: { type: "email", read: ["self"], write: ["self"] },
        name: { type: "text", read: ["*"], write: ["self"], required: true },
        avatar: { type: "image", read: ["*"], write: ["self"] },
        statusMessage: { type: "textarea", read: ["*"], write: ["self"] },
      },
    },
    Contact: { fields: ["id", "status"] },
    Message: { fields: ["id", "content"] },
  },
};

describe("findReplaceIntents", () => {
  it("находит все replace-intents для User", () => {
    const r = findReplaceIntents(INTENTS, "User");
    const ids = r.map(e => e.intentId).sort();
    expect(ids).toEqual(["set_avatar", "set_name", "set_status"]);
  });

  it("не включает intents на другие сущности", () => {
    const r = findReplaceIntents(INTENTS, "User");
    const ids = r.map(e => e.intentId);
    expect(ids).not.toContain("block_contact");
    expect(ids).not.toContain("send_message");
  });

  it("возвращает поле для каждого intent", () => {
    const r = findReplaceIntents(INTENTS, "User");
    const byId = Object.fromEntries(r.map(e => [e.intentId, e.field]));
    expect(byId.set_name).toBe("name");
    expect(byId.set_avatar).toBe("avatar");
    expect(byId.set_status).toBe("statusMessage");
  });

  it("intent с add — не включается", () => {
    const r = findReplaceIntents(INTENTS, "Message");
    expect(r).toEqual([]);
  });
});

describe("generateEditProjections", () => {
  it("создаёт user_profile_edit для detail с ≥2 replace-intents", () => {
    const edits = generateEditProjections(INTENTS, PROJECTIONS, ONTOLOGY);
    expect(edits.user_profile_edit).toBeDefined();
    expect(edits.user_profile_edit.kind).toBe("form");
    expect(edits.user_profile_edit.mainEntity).toBe("User");
    expect(edits.user_profile_edit.idParam).toBe("userId");
    expect(edits.user_profile_edit.editIntents).toHaveLength(3);
  });

  it("sourceProjection указывает на detail", () => {
    const edits = generateEditProjections(INTENTS, PROJECTIONS, ONTOLOGY);
    expect(edits.user_profile_edit.sourceProjection).toBe("user_profile");
  });

  it("не создаёт при <2 intents", () => {
    const singleIntent = { set_only_name: INTENTS.set_name };
    const edits = generateEditProjections(singleIntent, PROJECTIONS, ONTOLOGY);
    expect(edits).toEqual({});
  });

  it("не перезаписывает явную edit-проекцию автора", () => {
    const projWithExplicitEdit = {
      ...PROJECTIONS,
      user_profile_edit: {
        name: "Custom edit",
        kind: "form",
        mainEntity: "User",
      },
    };
    const edits = generateEditProjections(INTENTS, projWithExplicitEdit, ONTOLOGY);
    expect(edits.user_profile_edit).toBeUndefined(); // не перегенерируется
  });

  it("не создаёт для feed/catalog (только detail)", () => {
    const edits = generateEditProjections(INTENTS, PROJECTIONS, ONTOLOGY);
    expect(edits.chat_view_edit).toBeUndefined();
  });
});

describe("buildFormSpec", () => {
  it("собирает поля с editable согласно ontology.write + covering intent", () => {
    const editProj = {
      mainEntity: "User",
      editIntents: ["set_name", "set_avatar", "set_status"],
    };
    const spec = buildFormSpec(editProj, INTENTS, ONTOLOGY, "self");
    const byName = Object.fromEntries(spec.fields.map(f => [f.name, f]));

    expect(byName.name.editable).toBe(true);
    expect(byName.name.intentId).toBe("set_name");
    expect(byName.avatar.editable).toBe(true);
    expect(byName.avatar.intentId).toBe("set_avatar");
    expect(byName.statusMessage.editable).toBe(true);
  });

  it("поле без покрывающего intent → read-only (editable:false)", () => {
    const editProj = { mainEntity: "User", editIntents: ["set_name"] };
    const spec = buildFormSpec(editProj, INTENTS, ONTOLOGY, "self");
    const avatar = spec.fields.find(f => f.name === "avatar");
    expect(avatar.editable).toBe(false);
  });

  it("роль contact не видит поля с read:[self]", () => {
    const editProj = {
      mainEntity: "User",
      editIntents: ["set_name", "set_avatar"],
    };
    const spec = buildFormSpec(editProj, INTENTS, ONTOLOGY, "contact");
    expect(spec.fields.find(f => f.name === "email")).toBeUndefined();
    // name — read:["*"], должен быть виден
    const nameField = spec.fields.find(f => f.name === "name");
    expect(nameField).toBeDefined();
    // Но не editable — write:[self], contact не может писать
    expect(nameField.editable).toBe(false);
  });

  it("системные поля (id) не попадают в форму", () => {
    const editProj = { mainEntity: "User", editIntents: ["set_name"] };
    const spec = buildFormSpec(editProj, INTENTS, ONTOLOGY, "self");
    expect(spec.fields.find(f => f.name === "id")).toBeUndefined();
  });

  it("required флаг пробрасывается из онтологии", () => {
    const editProj = { mainEntity: "User", editIntents: ["set_name"] };
    const spec = buildFormSpec(editProj, INTENTS, ONTOLOGY, "self");
    const nameField = spec.fields.find(f => f.name === "name");
    expect(nameField.required).toBe(true);
  });
});
