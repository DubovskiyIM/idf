import { describe, it, expect } from "vitest";
import { buildBookingEffects } from "./buildBookingEffects.cjs";

const world = {
  specialists: [{ id: "spec_a", name: "Аня", specialization: "Парикмахер" }],
  services: [{ id: "svc_1", specialistId: "spec_a", name: "Стрижка", price: 2000, duration: 45, active: true }],
  timeslots: [
    { id: "slot_free",   specialistId: "spec_a", date: "2026-04-16", startTime: "13:00", endTime: "14:00", status: "free" },
    { id: "slot_booked", specialistId: "spec_a", date: "2026-04-16", startTime: "14:00", endTime: "15:00", status: "booked" }
  ],
  bookings: [
    { id: "book_mine", clientId: "user_me", specialistId: "spec_a", serviceId: "svc_1", slotId: "slot_booked", status: "confirmed", price: 2000 },
    { id: "book_theirs", clientId: "user_other", status: "confirmed" }
  ],
  reviews: []
};

const viewer = { id: "user_me" };

describe("buildBookingEffects :: create_booking", () => {
  it("строит два эффекта для валидных params", () => {
    const effects = buildBookingEffects("create_booking", {
      serviceId: "svc_1",
      specialistId: "spec_a",
      slotId: "slot_free",
      price: 2000
    }, viewer, world);

    expect(effects).toHaveLength(2);
    const [addBooking, replaceSlot] = effects;

    expect(addBooking.alpha).toBe("add");
    expect(addBooking.target).toBe("bookings");
    expect(addBooking.context.clientId).toBe("user_me");
    expect(addBooking.context.serviceId).toBe("svc_1");
    expect(addBooking.context.slotId).toBe("slot_free");
    expect(addBooking.context.status).toBe("confirmed");

    expect(replaceSlot.alpha).toBe("replace");
    expect(replaceSlot.target).toBe("slot.status");
    expect(replaceSlot.value).toBe("booked");
    expect(replaceSlot.context.id).toBe("slot_free");
  });

  it("возвращает null если slot не свободен", () => {
    const effects = buildBookingEffects("create_booking", {
      serviceId: "svc_1",
      specialistId: "spec_a",
      slotId: "slot_booked",
      price: 2000
    }, viewer, world);
    expect(effects).toBeNull();
  });

  it("возвращает null если slot не существует", () => {
    const effects = buildBookingEffects("create_booking", {
      serviceId: "svc_1",
      specialistId: "spec_a",
      slotId: "slot_fake",
      price: 2000
    }, viewer, world);
    expect(effects).toBeNull();
  });

  it("возвращает null если specialist не существует", () => {
    const effects = buildBookingEffects("create_booking", {
      serviceId: "svc_1",
      specialistId: "spec_fake",
      slotId: "slot_free",
      price: 2000
    }, viewer, world);
    expect(effects).toBeNull();
  });
});

describe("buildBookingEffects :: cancel_booking", () => {
  it("строит два эффекта для своей брони", () => {
    const effects = buildBookingEffects("cancel_booking", {
      bookingId: "book_mine"
    }, viewer, world);

    expect(effects).toHaveLength(2);
    expect(effects[0].alpha).toBe("replace");
    expect(effects[0].target).toBe("booking.status");
    expect(effects[0].value).toBe("cancelled");
    expect(effects[0].context.id).toBe("book_mine");

    expect(effects[1].alpha).toBe("replace");
    expect(effects[1].target).toBe("slot.status");
    expect(effects[1].value).toBe("free");
    expect(effects[1].context.id).toBe("slot_booked");
  });

  it("возвращает null для несуществующей брони", () => {
    const effects = buildBookingEffects("cancel_booking", {
      bookingId: "book_fake"
    }, viewer, world);
    expect(effects).toBeNull();
  });
});

describe("buildBookingEffects :: leave_review", () => {
  const completedBooking = {
    id: "book_done",
    clientId: "user_me",
    specialistId: "spec_a",
    serviceId: "svc_1",
    serviceName: "Стрижка",
    status: "completed"
  };
  const worldWithCompleted = {
    ...world,
    bookings: [...world.bookings, completedBooking]
  };

  it("строит add-эффект с authorId = viewer.id", () => {
    const effects = buildBookingEffects("leave_review", {
      bookingId: "book_done",
      rating: 5,
      text: "Отлично"
    }, viewer, worldWithCompleted);

    expect(effects).toHaveLength(1);
    expect(effects[0].alpha).toBe("add");
    expect(effects[0].target).toBe("reviews");
    expect(effects[0].context.authorId).toBe("user_me");
    expect(effects[0].context.bookingId).toBe("book_done");
    expect(effects[0].context.rating).toBe(5);
    expect(effects[0].context.text).toBe("Отлично");
  });

  it("возвращает null для несуществующей брони", () => {
    const effects = buildBookingEffects("leave_review", {
      bookingId: "book_fake",
      rating: 5,
      text: "..."
    }, viewer, worldWithCompleted);
    expect(effects).toBeNull();
  });
});

describe("buildBookingEffects :: unknown intent", () => {
  it("возвращает null для неизвестного intent'а", () => {
    const effects = buildBookingEffects("unknown_intent", {}, viewer, world);
    expect(effects).toBeNull();
  });
});
