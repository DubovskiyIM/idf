import { describe, it, expect } from "vitest";
import { checkOwnership } from "./checkOwnership.cjs";

const ontology = {
  entities: {
    Specialist: { fields: ["id", "name"] },
    Service: { fields: ["id", "name"] },
    TimeSlot: { fields: ["id", "status"] },
    Booking: {
      fields: ["id", "clientId", "specialistId", "status"],
      ownerField: "clientId"
    },
    Review: {
      fields: ["id", "bookingId", "authorId", "rating", "text"],
      ownerField: "authorId"
    }
  }
};

const viewer = { id: "user_me" };

const world = {
  specialists: [{ id: "spec_a", name: "Аня" }],
  services: [{ id: "svc_1", name: "Стрижка" }],
  timeslots: [{ id: "slot_1", status: "booked" }],
  bookings: [
    { id: "book_mine", clientId: "user_me", status: "confirmed" },
    { id: "book_theirs", clientId: "user_other", status: "confirmed" }
  ],
  reviews: [
    { id: "rev_mine", authorId: "user_me", bookingId: "book_mine", rating: 5 },
    { id: "rev_theirs", authorId: "user_other", bookingId: "book_theirs", rating: 3 }
  ]
};

describe("checkOwnership", () => {
  it("creator intent (только add effects) → ok без проверки", () => {
    const intent = {
      name: "Leave review",
      particles: {
        effects: [{ α: "add", target: "reviews" }]
      }
    };
    const result = checkOwnership(intent, { bookingId: "book_theirs" }, viewer, ontology, world);
    expect(result.ok).toBe(true);
  });

  it("cancel своей брони → ok", () => {
    const intent = {
      name: "Cancel",
      particles: {
        effects: [
          { α: "replace", target: "booking.status", value: "cancelled" },
          { α: "replace", target: "slot.status", value: "free" }
        ]
      }
    };
    const result = checkOwnership(intent, { bookingId: "book_mine" }, viewer, ontology, world);
    expect(result.ok).toBe(true);
  });

  it("cancel чужой брони → denied с указанием entity", () => {
    const intent = {
      name: "Cancel",
      particles: {
        effects: [
          { α: "replace", target: "booking.status", value: "cancelled" },
          { α: "replace", target: "slot.status", value: "free" }
        ]
      }
    };
    const result = checkOwnership(intent, { bookingId: "book_theirs" }, viewer, ontology, world);
    expect(result.ok).toBe(false);
    expect(result.entityName).toBe("Booking");
    expect(result.entityId).toBe("book_theirs");
    expect(result.reason).toMatch(/Booking/);
  });

  it("edit_review своего отзыва → ok", () => {
    const intent = {
      name: "Edit",
      particles: {
        effects: [
          { α: "replace", target: "review.rating", value: 4 }
        ]
      }
    };
    const result = checkOwnership(intent, { reviewId: "rev_mine" }, viewer, ontology, world);
    expect(result.ok).toBe(true);
  });

  it("delete_review чужого отзыва → denied", () => {
    const intent = {
      name: "Delete",
      particles: {
        effects: [{ α: "remove", target: "reviews" }]
      }
    };
    const result = checkOwnership(intent, { reviewId: "rev_theirs" }, viewer, ontology, world);
    expect(result.ok).toBe(false);
    expect(result.entityName).toBe("Review");
  });

  it("replace на entity без ownerField (например, slot) → ok (не трогаем)", () => {
    const intent = {
      name: "Block slot",
      particles: {
        effects: [{ α: "replace", target: "slot.status", value: "blocked" }]
      }
    };
    const result = checkOwnership(intent, { slotId: "slot_1" }, viewer, ontology, world);
    expect(result.ok).toBe(true);
  });

  it("несуществующая entity в world → ok (buildEffects ниже поймает)", () => {
    const intent = {
      name: "Cancel",
      particles: {
        effects: [{ α: "replace", target: "booking.status", value: "cancelled" }]
      }
    };
    const result = checkOwnership(intent, { bookingId: "nonexistent" }, viewer, ontology, world);
    // checkOwnership не нашёл entity → пропускает, buildEffects вернёт null
    expect(result.ok).toBe(true);
  });

  it("multi-owned intent (cancel_booking касается Booking и Slot) — проверяет Booking", () => {
    const intent = {
      name: "Cancel",
      particles: {
        effects: [
          { α: "replace", target: "booking.status", value: "cancelled" },
          { α: "replace", target: "slot.status", value: "free" }
        ]
      }
    };
    // Пытаемся отменить чужую — должно denied на Booking, slot игнорируется
    const result = checkOwnership(intent, { bookingId: "book_theirs" }, viewer, ontology, world);
    expect(result.ok).toBe(false);
    expect(result.entityName).toBe("Booking");
  });
});
