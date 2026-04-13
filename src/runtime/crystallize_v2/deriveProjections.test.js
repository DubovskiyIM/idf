import { describe, it, expect } from "vitest";
import { analyzeIntents, detectForeignKeys } from "./deriveProjections.js";

describe("analyzeIntents", () => {
  const INTENTS = {
    create_listing: {
      name: "Создать лот",
      creates: "Listing(draft)",
      particles: {
        entities: ["listing: Listing"],
        conditions: [],
        effects: [{ α: "add", target: "listings" }],
        witnesses: ["title", "startPrice"],
        confirmation: "click",
      },
    },
    edit_title: {
      name: "Изменить название",
      particles: {
        entities: ["listing: Listing"],
        conditions: ["listing.status = 'draft'"],
        effects: [{ α: "replace", target: "listing.title" }],
        witnesses: ["title"],
        confirmation: "click",
      },
    },
    publish_listing: {
      name: "Опубликовать",
      particles: {
        entities: ["listing: Listing"],
        conditions: ["listing.status = 'draft'", "listing.sellerId = me.id"],
        effects: [{ α: "replace", target: "listing.status", value: "active" }],
        witnesses: [],
        confirmation: "click",
      },
    },
    send_message: {
      name: "Отправить",
      creates: "Message",
      particles: {
        entities: ["message: Message", "conversation: Conversation"],
        conditions: [],
        effects: [{ α: "add", target: "messages" }],
        witnesses: [],
        confirmation: "enter",
      },
    },
  };

  it("собирает creators по сущности", () => {
    const a = analyzeIntents(INTENTS);
    expect(a.creators.Listing).toEqual(["create_listing"]);
    expect(a.creators.Message).toEqual(["send_message"]);
  });

  it("нормализует creates: Listing(draft) → Listing", () => {
    const a = analyzeIntents(INTENTS);
    expect(a.creators.Listing).toBeDefined();
    expect(a.creators["Listing(draft)"]).toBeUndefined();
  });

  it("собирает mutators по сущности", () => {
    const a = analyzeIntents(INTENTS);
    expect(a.mutators.Listing.sort()).toEqual(
      ["create_listing", "edit_title", "publish_listing"]
    );
  });

  it("собирает feedSignals", () => {
    const a = analyzeIntents(INTENTS);
    expect(a.feedSignals.Message).toEqual(["send_message"]);
    expect(a.feedSignals.Listing).toBeUndefined();
  });
});

describe("detectForeignKeys", () => {
  it("находит entityRef-поля в typed ontology", () => {
    const ontology = {
      entities: {
        Listing: { fields: { id: { type: "id" } } },
        Bid: {
          fields: {
            id: { type: "id" },
            listingId: { type: "entityRef", read: ["*"] },
            bidderId: { type: "entityRef", read: ["*"] },
          },
        },
        User: { fields: { id: { type: "id" } } },
      },
    };
    const fks = detectForeignKeys(ontology);
    // listingId → Listing (точное совпадение)
    expect(fks.Bid).toEqual(
      expect.arrayContaining([
        { field: "listingId", references: "Listing" },
      ])
    );
    // bidderId → "bidder" не совпадает с "User" — не деривируется по эвристике
    // Это честная граница: для таких случаев нужно явное ref в онтологии
    expect(fks.Bid).toHaveLength(1);
  });

  it("fallback: суффикс Id в array-формате полей", () => {
    const ontology = {
      entities: {
        Poll: { fields: ["id", "organizerId", "title", "status"] },
        Participant: { fields: ["id", "pollId", "userId", "name"] },
        User: { fields: ["id", "name", "email"] },
      },
    };
    const fks = detectForeignKeys(ontology);
    expect(fks.Participant).toEqual(
      expect.arrayContaining([
        { field: "pollId", references: "Poll" },
        { field: "userId", references: "User" },
      ])
    );
  });

  it("не считает поле id за foreignKey", () => {
    const ontology = {
      entities: { User: { fields: { id: { type: "id" } } } },
    };
    const fks = detectForeignKeys(ontology);
    expect(fks.User || []).toEqual([]);
  });
});
