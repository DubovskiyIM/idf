import { describe, it, expect } from "vitest";
import { analyzeIntents, detectForeignKeys, deriveProjections } from "./deriveProjections.js";
import { mergeProjections } from "./mergeProjections.js";

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

describe("deriveProjections", () => {
  const ONTOLOGY = {
    entities: {
      Listing: {
        fields: {
          id: { type: "id" },
          title: { type: "text", read: ["*"], write: ["self"] },
          sellerId: { type: "entityRef", read: ["*"] },
        },
        ownerField: "sellerId",
      },
      User: {
        fields: { id: { type: "id" }, name: { type: "text" } },
      },
    },
  };

  describe("R1: catalog", () => {
    it("generates catalog for entity with creators", () => {
      const INTENTS = {
        create_listing: {
          name: "Создать",
          creates: "Listing(draft)",
          particles: {
            entities: ["listing: Listing"],
            conditions: [],
            effects: [{ α: "add", target: "listings" }],
            witnesses: ["title"],
            confirmation: "click",
          },
        },
      };
      const result = deriveProjections(INTENTS, ONTOLOGY);
      expect(result.listing_list).toBeDefined();
      expect(result.listing_list.kind).toBe("catalog");
      expect(result.listing_list.mainEntity).toBe("Listing");
      expect(result.listing_list.entities).toEqual(["Listing"]);
    });

    it("no catalog if no creators", () => {
      const INTENTS = {
        edit_title: {
          name: "Изменить",
          particles: {
            entities: ["listing: Listing"],
            conditions: [],
            effects: [{ α: "replace", target: "listing.title" }],
            witnesses: [],
            confirmation: "click",
          },
        },
      };
      const result = deriveProjections(INTENTS, ONTOLOGY);
      expect(result.listing_list).toBeUndefined();
    });
  });

  describe("R3: detail", () => {
    it("generates detail for entity with >1 mutators", () => {
      const INTENTS = {
        create_listing: {
          name: "Создать",
          creates: "Listing(draft)",
          particles: {
            entities: ["listing: Listing"],
            conditions: [],
            effects: [{ α: "add", target: "listings" }],
            witnesses: [],
            confirmation: "click",
          },
        },
        edit_title: {
          name: "Изменить",
          particles: {
            entities: ["listing: Listing"],
            conditions: [],
            effects: [{ α: "replace", target: "listing.title" }],
            witnesses: [],
            confirmation: "click",
          },
        },
      };
      const result = deriveProjections(INTENTS, ONTOLOGY);
      expect(result.listing_detail).toBeDefined();
      expect(result.listing_detail.kind).toBe("detail");
      expect(result.listing_detail.mainEntity).toBe("Listing");
    });

    it("no detail if only 1 mutator", () => {
      const INTENTS = {
        create_listing: {
          name: "Создать",
          creates: "Listing",
          particles: {
            entities: ["listing: Listing"],
            conditions: [],
            effects: [{ α: "add", target: "listings" }],
            witnesses: [],
            confirmation: "click",
          },
        },
      };
      const result = deriveProjections(INTENTS, ONTOLOGY);
      expect(result.listing_detail).toBeUndefined();
    });
  });

  describe("R2: feed override", () => {
    it("overrides catalog → feed when confirmation:enter + foreignKey", () => {
      const ONT = {
        entities: {
          Conversation: { fields: { id: { type: "id" } } },
          Message: {
            fields: {
              id: { type: "id" },
              conversationId: { type: "entityRef", read: ["*"] },
              text: { type: "text" },
            },
          },
        },
      };
      const INTENTS = {
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
        edit_message: {
          name: "Редактировать",
          particles: {
            entities: ["message: Message"],
            conditions: [],
            effects: [{ α: "replace", target: "message.text" }],
            witnesses: [],
            confirmation: "click",
          },
        },
      };
      const result = deriveProjections(INTENTS, ONT);
      expect(result.message_list.kind).toBe("feed");
      expect(result.message_list.idParam).toBe("conversationId");
    });

    it("stays catalog when confirmation:enter but no foreignKey", () => {
      const ONT = {
        entities: {
          Note: { fields: { id: { type: "id" }, text: { type: "text" } } },
        },
      };
      const INTENTS = {
        create_note: {
          name: "Создать",
          creates: "Note",
          particles: {
            entities: ["note: Note"],
            conditions: [],
            effects: [{ α: "add", target: "notes" }],
            witnesses: [],
            confirmation: "enter",
          },
        },
      };
      const result = deriveProjections(INTENTS, ONT);
      expect(result.note_list.kind).toBe("catalog");
    });
  });

  describe("R4: subCollections", () => {
    it("adds subCollections from foreignKey relationships", () => {
      const ONT = {
        entities: {
          Listing: { fields: { id: { type: "id" }, title: { type: "text" } } },
          Bid: {
            fields: {
              id: { type: "id" },
              listingId: { type: "entityRef", read: ["*"] },
              amount: { type: "number" },
            },
          },
        },
      };
      const INTENTS = {
        create_listing: {
          name: "Создать",
          creates: "Listing",
          particles: {
            entities: ["listing: Listing"],
            conditions: [],
            effects: [{ α: "add", target: "listings" }],
            witnesses: [],
            confirmation: "click",
          },
        },
        place_bid: {
          name: "Ставка",
          creates: "Bid",
          particles: {
            entities: ["bid: Bid", "listing: Listing"],
            conditions: [],
            effects: [{ α: "add", target: "bids" }],
            witnesses: [],
            confirmation: "click",
          },
        },
        edit_listing: {
          name: "Изменить",
          particles: {
            entities: ["listing: Listing"],
            conditions: [],
            effects: [{ α: "replace", target: "listing.title" }],
            witnesses: [],
            confirmation: "click",
          },
        },
      };
      const result = deriveProjections(INTENTS, ONT);
      expect(result.listing_detail).toBeDefined();
      expect(result.listing_detail.subCollections).toEqual([
        { collection: "bids", entity: "Bid", foreignKey: "listingId", addable: true },
      ]);
    });

    it("addable:false when no creators for sub-entity", () => {
      const ONT = {
        entities: {
          Order: { fields: { id: { type: "id" } } },
          Review: {
            fields: { id: { type: "id" }, orderId: { type: "entityRef" } },
          },
        },
      };
      const INTENTS = {
        create_order: {
          name: "Создать",
          creates: "Order",
          particles: {
            entities: ["order: Order"],
            conditions: [],
            effects: [{ α: "add", target: "orders" }],
            witnesses: [],
            confirmation: "click",
          },
        },
        fulfill_order: {
          name: "Выполнить",
          particles: {
            entities: ["order: Order"],
            conditions: [],
            effects: [{ α: "replace", target: "order.status" }],
            witnesses: [],
            confirmation: "click",
          },
        },
      };
      const result = deriveProjections(INTENTS, ONT);
      expect(result.order_detail.subCollections).toEqual([
        { collection: "reviews", entity: "Review", foreignKey: "orderId", addable: false },
      ]);
    });
  });

  describe("R6: witnesses", () => {
    it("collects witnesses from intents referencing the entity", () => {
      const ONT = {
        entities: {
          Listing: { fields: { id: { type: "id" } } },
        },
      };
      const INTENTS = {
        create_listing: {
          name: "Создать",
          creates: "Listing",
          particles: {
            entities: ["listing: Listing"],
            conditions: [],
            effects: [{ α: "add", target: "listings" }],
            witnesses: ["title", "startPrice"],
            confirmation: "click",
          },
        },
        publish: {
          name: "Опубликовать",
          particles: {
            entities: ["listing: Listing"],
            conditions: [],
            effects: [{ α: "replace", target: "listing.status" }],
            witnesses: ["title", "images", "auctionEnd"],
            confirmation: "click",
          },
        },
      };
      const result = deriveProjections(INTENTS, ONT);
      const witnesses = result.listing_detail.witnesses.sort();
      expect(witnesses).toEqual(["auctionEnd", "images", "startPrice", "title"]);
    });
  });

  describe("R7: owner-filtered catalog", () => {
    it("generates my_* catalog when ownerField is set", () => {
      const ONT = {
        entities: {
          Listing: {
            fields: { id: { type: "id" }, sellerId: { type: "entityRef" } },
            ownerField: "sellerId",
          },
        },
      };
      const INTENTS = {
        create_listing: {
          name: "Создать",
          creates: "Listing",
          particles: {
            entities: ["listing: Listing"],
            conditions: [],
            effects: [{ α: "add", target: "listings" }],
            witnesses: ["title"],
            confirmation: "click",
          },
        },
      };
      const result = deriveProjections(INTENTS, ONT);
      expect(result.my_listing_list).toBeDefined();
      expect(result.my_listing_list.kind).toBe("catalog");
      expect(result.my_listing_list.filter).toEqual({
        field: "sellerId", op: "=", value: "me.id",
      });
    });

    it("no my_* if no ownerField", () => {
      const ONT = {
        entities: {
          User: { fields: { id: { type: "id" } } },
        },
      };
      const INTENTS = {
        create_user: {
          name: "Создать",
          creates: "User",
          particles: {
            entities: ["user: User"],
            conditions: [],
            effects: [{ α: "add", target: "users" }],
            witnesses: [],
            confirmation: "click",
          },
        },
      };
      const result = deriveProjections(INTENTS, ONT);
      expect(result.my_user_list).toBeUndefined();
    });
  });
});

describe("mergeProjections", () => {
  it("authored field overrides derived field", () => {
    const derived = {
      listing_list: { kind: "catalog", mainEntity: "Listing", witnesses: ["title"] },
    };
    const authored = { listing_list: { layout: "grid" } };
    const result = mergeProjections(derived, authored);
    expect(result.listing_list.kind).toBe("catalog");
    expect(result.listing_list.layout).toBe("grid");
  });

  it("authored subCollections replaces derived entirely", () => {
    const derived = {
      listing_detail: {
        kind: "detail",
        subCollections: [
          { entity: "Bid", foreignKey: "listingId", addable: true },
          { entity: "Review", foreignKey: "listingId", addable: false },
        ],
      },
    };
    const authored = {
      listing_detail: {
        subCollections: [{ entity: "Bid", foreignKey: "listingId", addable: true, sort: "-amount" }],
      },
    };
    const result = mergeProjections(derived, authored);
    expect(result.listing_detail.subCollections).toHaveLength(1);
    expect(result.listing_detail.subCollections[0].sort).toBe("-amount");
  });

  it("authored false deletes derived projection", () => {
    const derived = {
      listing_list: { kind: "catalog" },
      bid_list: { kind: "catalog" },
    };
    const authored = { bid_list: false };
    const result = mergeProjections(derived, authored);
    expect(result.listing_list).toBeDefined();
    expect(result.bid_list).toBeUndefined();
  });

  it("authored adds new projection not in derived", () => {
    const derived = { listing_list: { kind: "catalog" } };
    const authored = {
      meshok_home: { kind: "dashboard", widgets: [{ projection: "listing_list" }] },
    };
    const result = mergeProjections(derived, authored);
    expect(result.meshok_home.kind).toBe("dashboard");
    expect(result.listing_list).toBeDefined();
  });

  it("empty authored → derived unchanged", () => {
    const derived = { a: { kind: "catalog" }, b: { kind: "detail" } };
    const result = mergeProjections(derived, {});
    expect(result).toEqual(derived);
  });

  it("full authored override → backward compat", () => {
    const derived = { a: { kind: "catalog", witnesses: ["x"] } };
    const authored = { a: { kind: "catalog", mainEntity: "A", witnesses: ["y"], layout: "grid" } };
    const result = mergeProjections(derived, authored);
    expect(result.a.witnesses).toEqual(["y"]);
    expect(result.a.layout).toBe("grid");
  });
});
