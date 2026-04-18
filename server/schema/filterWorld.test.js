import { describe, it, expect } from "vitest";
import { filterWorldForRole } from "./filterWorld.cjs";

const ontology = {
  entities: {
    Specialist: { fields: ["id", "name"], type: "internal" },
    Service:    { fields: ["id", "name", "price"], type: "internal" },
    TimeSlot:   {
      fields: ["id", "date", "status"],
      statuses: ["free", "held", "booked", "blocked"],
      type: "mirror"
    },
    Booking: {
      fields: ["id", "clientId", "specialistId", "status", "price"],
      type: "internal",
      ownerField: "clientId"
    },
    Review: {
      fields: ["id", "authorId", "bookingId", "rating", "text"],
      type: "internal",
      ownerField: "authorId"
    },
  },
  roles: {
    agent: {
      visibleFields: {
        Specialist: ["id", "name"],
        Service:    ["id", "name", "price"],
        TimeSlot:   ["id", "date", "status"],
        Booking:    ["id", "specialistId", "status", "price"],  // clientId скрыт
        Review:     ["id", "bookingId", "rating", "text"],       // authorId скрыт
      },
      statusMapping: { held: "booked", blocked: "unavailable" }
    }
  }
};

const viewer = { id: "user_me" };

const rawWorld = {
  specialists: [{ id: "spec_a", name: "Аня" }],
  services: [{ id: "svc_1", name: "Стрижка", price: 2000 }],
  timeslots: [
    { id: "slot_1", date: "2026-04-16", status: "free" },
    { id: "slot_2", date: "2026-04-16", status: "held" },
    { id: "slot_3", date: "2026-04-16", status: "blocked" },
  ],
  bookings: [
    { id: "book_mine", clientId: "user_me", specialistId: "spec_a", status: "confirmed", price: 2000 },
    { id: "book_theirs", clientId: "user_other", specialistId: "spec_a", status: "confirmed", price: 2000 }
  ],
  reviews: [
    { id: "rev_mine", authorId: "user_me", bookingId: "book_mine", rating: 5, text: "ок" },
    { id: "rev_theirs", authorId: "user_other", bookingId: "book_theirs", rating: 3, text: "хмм" }
  ],
  // коллекция, не объявленная в visibleFields agent'а
  drafts: [{ id: "draft_1", some: "data" }]
};

describe("filterWorldForRole", () => {
  it("применяет row-filter по ownerField для bookings", () => {
    const result = filterWorldForRole(rawWorld, ontology, "agent", viewer);
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0].id).toBe("book_mine");
  });

  it("применяет row-filter по ownerField для reviews", () => {
    const result = filterWorldForRole(rawWorld, ontology, "agent", viewer);
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].id).toBe("rev_mine");
  });

  it("удаляет скрытые поля из bookings", () => {
    const result = filterWorldForRole(rawWorld, ontology, "agent", viewer);
    expect(result.bookings[0].clientId).toBeUndefined();
    expect(result.bookings[0].specialistId).toBe("spec_a");
  });

  it("удаляет скрытые поля из reviews", () => {
    const result = filterWorldForRole(rawWorld, ontology, "agent", viewer);
    expect(result.reviews[0].authorId).toBeUndefined();
    expect(result.reviews[0].bookingId).toBe("book_mine");
  });

  it("применяет statusMapping к timeSlots (camelCase output)", () => {
    const result = filterWorldForRole(rawWorld, ontology, "agent", viewer);
    const byId = Object.fromEntries(result.timeSlots.map(s => [s.id, s]));
    expect(byId.slot_1.status).toBe("free");        // без изменений
    expect(byId.slot_2.status).toBe("booked");      // held → booked
    expect(byId.slot_3.status).toBe("unavailable"); // blocked → unavailable
  });

  it("пропускает коллекции без visibleFields для роли", () => {
    const result = filterWorldForRole(rawWorld, ontology, "agent", viewer);
    expect(result.drafts).toBeUndefined();
  });

  it("возвращает специалистов целиком (нет ownerField)", () => {
    const result = filterWorldForRole(rawWorld, ontology, "agent", viewer);
    expect(result.specialists).toHaveLength(1);
    expect(result.specialists[0]).toEqual({ id: "spec_a", name: "Аня" });
  });

  it("возвращает пустой массив если коллекция отсутствует в world", () => {
    const empty = { specialists: [], services: [], timeslots: [], bookings: [], reviews: [] };
    const result = filterWorldForRole(empty, ontology, "agent", viewer);
    expect(result.bookings).toEqual([]);
  });

  it("бросает осмысленную ошибку если роль не существует", () => {
    expect(() => filterWorldForRole(rawWorld, ontology, "unknown", viewer))
      .toThrow(/unknown/);
  });
});

// ───────────────────────────────────────────────────────────────────
// Many-to-many ownership через role.scope (§17, закрытие §26.1)
// ───────────────────────────────────────────────────────────────────

describe("filterWorldForRole — many-to-many через role.scope", () => {
  // Fintech-сценарий: advisor ↔ clients через Assignment-коллекцию.
  const m2mOntology = {
    entities: {
      User: { type: "internal" },
      Portfolio: {
        type: "internal",
        // ownerField принадлежит investor'у (его собственный портфель)
        ownerField: "userId",
      },
      Goal: { type: "internal", ownerField: "userId" },
      Assignment: {
        type: "internal",
        // Связующая коллекция: advisor владеет assignment-записью
        ownerField: "advisorId",
      },
    },
    roles: {
      investor: {
        // Классический single-owner: investor видит только свои портфели
        visibleFields: {
          Portfolio: ["id", "name", "userId"],
          Goal: ["id", "name", "userId"],
        },
      },
      advisor: {
        // m2m: видит assignments, где он advisor, и — через них — portfolios/goals
        // клиентов. scope заменяет ownerField для Portfolio/Goal.
        visibleFields: {
          Assignment: ["id", "clientId", "status"],
          Portfolio: ["id", "name", "userId"],
          Goal: ["id", "name", "userId"],
          User: ["id", "name"],
        },
        scope: {
          Portfolio: {
            via: "assignments", viewerField: "advisorId",
            joinField: "clientId", localField: "userId",
            statusField: "status", statusAllowed: ["active"],
          },
          Goal: {
            via: "assignments", viewerField: "advisorId",
            joinField: "clientId", localField: "userId",
            statusField: "status", statusAllowed: ["active"],
          },
          User: {
            via: "assignments", viewerField: "advisorId",
            joinField: "clientId", localField: "id",
          },
        },
      },
    },
  };

  const m2mWorld = {
    users: [
      { id: "advisor_alice", name: "Alice (advisor)" },
      { id: "client_anna", name: "Анна" },
      { id: "client_boris", name: "Борис" },
      { id: "client_elena", name: "Елена (бывшая)" },
      { id: "stranger_x", name: "Незнакомец" },
    ],
    portfolios: [
      { id: "pf_anna_1", userId: "client_anna", name: "Анна-1" },
      { id: "pf_anna_2", userId: "client_anna", name: "Анна-2" },
      { id: "pf_boris_1", userId: "client_boris", name: "Борис-1" },
      { id: "pf_elena_1", userId: "client_elena", name: "Елена-1" },
      { id: "pf_stranger_1", userId: "stranger_x", name: "Чужой" },
    ],
    goals: [
      { id: "g_anna", userId: "client_anna", name: "Квартира" },
      { id: "g_elena", userId: "client_elena", name: "Машина" },
      { id: "g_stranger", userId: "stranger_x", name: "Чужая цель" },
    ],
    assignments: [
      { id: "asg_1", advisorId: "advisor_alice", clientId: "client_anna", status: "active" },
      { id: "asg_2", advisorId: "advisor_alice", clientId: "client_boris", status: "active" },
      { id: "asg_3", advisorId: "advisor_alice", clientId: "client_elena", status: "ended" },
      { id: "asg_4", advisorId: "advisor_bob", clientId: "client_anna", status: "active" }, // чужой advisor
    ],
  };

  const advisor = { id: "advisor_alice" };

  it("advisor видит только портфели своих активных клиентов", () => {
    const out = filterWorldForRole(m2mWorld, m2mOntology, "advisor", advisor);
    const ids = out.portfolios.map(p => p.id).sort();
    expect(ids).toEqual(["pf_anna_1", "pf_anna_2", "pf_boris_1"]);
    // Елена — ended assignment → скрыта
    expect(ids).not.toContain("pf_elena_1");
    // Незнакомец — без assignment → скрыт
    expect(ids).not.toContain("pf_stranger_1");
  });

  it("advisor видит только цели активных клиентов", () => {
    const out = filterWorldForRole(m2mWorld, m2mOntology, "advisor", advisor);
    const ids = out.goals.map(g => g.id).sort();
    expect(ids).toEqual(["g_anna"]);
  });

  it("advisor видит своих клиентов-user'ов (scope без statusAllowed = все assignments, включая ended)", () => {
    // scope.User НЕ объявляет statusAllowed → включаются все связи.
    // Это осознанный trade-off: history клиентов остаётся видна,
    // даже если активная работа завершена. Portfolio/Goal наоборот
    // скрывают ended — деньги не трогаем после завершения работы.
    const out = filterWorldForRole(m2mWorld, m2mOntology, "advisor", advisor);
    const names = out.users.map(u => u.name).sort();
    expect(names).toEqual(["Анна", "Борис", "Елена (бывшая)"]);
  });

  it("scope с statusAllowed скрывает ended-клиентов в users тоже", () => {
    const strictOntology = {
      ...m2mOntology,
      roles: {
        ...m2mOntology.roles,
        advisor: {
          ...m2mOntology.roles.advisor,
          scope: {
            ...m2mOntology.roles.advisor.scope,
            User: {
              via: "assignments", viewerField: "advisorId",
              joinField: "clientId", localField: "id",
              statusField: "status", statusAllowed: ["active"],
            },
          },
        },
      },
    };
    const out = filterWorldForRole(m2mWorld, strictOntology, "advisor", advisor);
    const names = out.users.map(u => u.name).sort();
    expect(names).toEqual(["Анна", "Борис"]);
  });

  it("advisor видит свои assignment-записи через стандартный ownerField", () => {
    const out = filterWorldForRole(m2mWorld, m2mOntology, "advisor", advisor);
    expect(out.assignments).toHaveLength(3);
    expect(out.assignments.every(a => a.id !== "asg_4")).toBe(true);
  });

  it("чужой advisor видит только своих клиентов (изолирован)", () => {
    const out = filterWorldForRole(m2mWorld, m2mOntology, "advisor", { id: "advisor_bob" });
    // У Боба только asg_4 → client_anna → 2 её portfolio
    expect(out.portfolios.map(p => p.id).sort()).toEqual(["pf_anna_1", "pf_anna_2"]);
  });

  it("advisor без активных клиентов видит пустоту (statusAllowed='active' отсекает)", () => {
    const loneWorld = {
      ...m2mWorld,
      assignments: [
        { id: "asg_x", advisorId: "advisor_alice", clientId: "client_anna", status: "ended" },
      ],
    };
    const out = filterWorldForRole(loneWorld, m2mOntology, "advisor", advisor);
    expect(out.portfolios).toEqual([]);
    expect(out.goals).toEqual([]);
  });

  it("отсутствие via-коллекции в world → пустой набор, не throw", () => {
    const emptyWorld = { ...m2mWorld, assignments: undefined };
    const out = filterWorldForRole(emptyWorld, m2mOntology, "advisor", advisor);
    expect(out.portfolios).toEqual([]);
    expect(out.goals).toEqual([]);
  });

  it("investor-роль использует ownerField как раньше (scope не ломает backcompat)", () => {
    const anna = { id: "client_anna" };
    const out = filterWorldForRole(m2mWorld, m2mOntology, "investor", anna);
    expect(out.portfolios.map(p => p.id).sort()).toEqual(["pf_anna_1", "pf_anna_2"]);
    expect(out.goals.map(g => g.id)).toEqual(["g_anna"]);
  });

  // ───────────────────────────────────────────────────────────
  // §26.5: entity.kind === "reference" → shared, ownership не применяется
  // ───────────────────────────────────────────────────────────
  it("reference-entity shared между всеми (ownership игнорируется)", () => {
    const refOntology = {
      entities: {
        Asset: {
          kind: "reference",
          ownerField: "creatorId", // есть, но должен игнорироваться для reference
        },
        Portfolio: { ownerField: "userId" },
      },
      roles: {
        trader: {
          visibleFields: {
            Asset: ["id", "ticker", "name"],
            Portfolio: ["id", "name", "userId"],
          },
        },
      },
    };
    const refWorld = {
      assets: [
        { id: "a1", ticker: "SBER", name: "Сбер", creatorId: "admin" },
        { id: "a2", ticker: "GAZP", name: "Газпром", creatorId: "admin" },
      ],
      portfolios: [
        { id: "pf1", userId: "alice", name: "Alice portfolio" },
        { id: "pf2", userId: "bob", name: "Bob portfolio" },
      ],
    };
    const alice = { id: "alice" };
    const out = filterWorldForRole(refWorld, refOntology, "trader", alice);
    // Assets: оба видны (reference), несмотря на creatorId !== alice
    expect(out.assets.map(a => a.ticker).sort()).toEqual(["GAZP", "SBER"]);
    // Portfolio: только своё (ownerField применяется)
    expect(out.portfolios).toHaveLength(1);
    expect(out.portfolios[0].id).toBe("pf1");
  });

  it("reference-entity без visibleFields всё равно не отдаётся (visibility !== ownership)", () => {
    const refOntology = {
      entities: { Asset: { kind: "reference" } },
      roles: { trader: { visibleFields: {} } }, // Asset не объявлен
    };
    const out = filterWorldForRole(
      { assets: [{ id: "a1", ticker: "X" }] },
      refOntology, "trader", { id: "u1" }
    );
    expect(out.assets).toBeUndefined();
  });

  it("scope с неверным localField — defensive empty, не throw", () => {
    const brokenOntology = {
      entities: {
        Portfolio: { type: "internal" }, // нет ownerField
      },
      roles: {
        weird: {
          visibleFields: { Portfolio: ["id"] },
          scope: {
            Portfolio: { via: "assignments", viewerField: "advisorId", joinField: "clientId" },
            // нет localField, нет entity.ownerField → fallback пустой
          },
        },
      },
    };
    const out = filterWorldForRole(m2mWorld, brokenOntology, "weird", advisor);
    expect(out.portfolios).toEqual([]);
  });
});
