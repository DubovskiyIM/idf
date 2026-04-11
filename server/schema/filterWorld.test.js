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

  it("применяет statusMapping к timeslots", () => {
    const result = filterWorldForRole(rawWorld, ontology, "agent", viewer);
    const byId = Object.fromEntries(result.timeslots.map(s => [s.id, s]));
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
