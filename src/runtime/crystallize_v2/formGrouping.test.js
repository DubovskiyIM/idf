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

describe("buildFormSpec sections", () => {
  const LISTING_ONTOLOGY = {
    entities: {
      Listing: {
        fields: {
          id: { type: "id" },
          title: { type: "text", read: ["*"], write: ["self"], required: true, label: "Название" },
          description: { type: "textarea", read: ["*"], write: ["self"], label: "Описание" },
          images: { type: "multiImage", read: ["*"], write: ["self"], label: "Фото" },
          startPrice: { type: "number", read: ["*"], write: ["self"], label: "Начальная цена" },
          buyNowPrice: { type: "number", read: ["*"], write: ["self"], label: "Купить сейчас" },
          condition: { type: "enum", read: ["*"], write: ["self"], label: "Состояние" },
          shippingFrom: { type: "text", read: ["*"], write: ["self"], label: "Откуда" },
          shippingCost: { type: "number", read: ["*"], write: ["self"], label: "Доставка" },
          auctionEnd: { type: "datetime", read: ["*"], write: ["self"], label: "Завершение" },
          bidCount: { type: "number", read: ["*"], label: "Ставок" },
        },
      },
    },
  };

  const LISTING_INTENTS = {
    edit_listing: {
      name: "Редактировать",
      particles: {
        entities: ["listing: Listing"],
        effects: [
          { α: "replace", target: "listing.title" },
          { α: "replace", target: "listing.description" },
        ],
        witnesses: [],
      },
    },
    set_buy_now: {
      name: "Купить сейчас",
      particles: {
        entities: ["listing: Listing"],
        effects: [{ α: "replace", target: "listing.buyNowPrice" }],
        witnesses: [],
      },
    },
    set_shipping: {
      name: "Доставка",
      particles: {
        entities: ["listing: Listing"],
        effects: [{ α: "replace", target: "listing.shippingCost" }],
        witnesses: [],
      },
    },
  };

  const editProj = {
    mainEntity: "Listing",
    editIntents: ["edit_listing", "set_buy_now", "set_shipping"],
  };

  it("генерирует sections", () => {
    const spec = buildFormSpec(editProj, LISTING_INTENTS, LISTING_ONTOLOGY, "self");
    expect(spec.sections).toBeDefined();
    expect(spec.sections.length).toBeGreaterThan(0);
    expect(spec.fields.length).toBeGreaterThan(0);
  });

  it("секция Основное содержит title и description", () => {
    const spec = buildFormSpec(editProj, LISTING_INTENTS, LISTING_ONTOLOGY, "self");
    const main = spec.sections.find(s => s.id === "main");
    expect(main).toBeDefined();
    expect(main.fields.map(f => f.name)).toContain("title");
    expect(main.fields.map(f => f.name)).toContain("description");
  });

  it("секция Цена содержит price-поля", () => {
    const spec = buildFormSpec(editProj, LISTING_INTENTS, LISTING_ONTOLOGY, "self");
    const price = spec.sections.find(s => s.id === "price");
    expect(price).toBeDefined();
    expect(price.fields.some(f => f.name === "buyNowPrice")).toBe(true);
  });

  it("read-only поля не в секциях", () => {
    const spec = buildFormSpec(editProj, LISTING_INTENTS, LISTING_ONTOLOGY, "self");
    const allFields = spec.sections.flatMap(s => s.fields);
    expect(allFields.find(f => f.name === "bidCount")).toBeUndefined();
  });

  it("секции без editable не создаются", () => {
    const spec = buildFormSpec(editProj, LISTING_INTENTS, LISTING_ONTOLOGY, "self");
    for (const s of spec.sections) {
      expect(s.fields.some(f => f.editable)).toBe(true);
    }
  });
});
