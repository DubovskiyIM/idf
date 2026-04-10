export const ONTOLOGY = {
  entities: {
    Specialist: {
      fields: ["id", "name", "specialization"],
      type: "internal"
    },
    Service: {
      fields: ["id", "specialistId", "name", "duration", "price", "active"],
      type: "internal"
    },
    TimeSlot: {
      fields: ["id", "specialistId", "date", "startTime", "endTime", "status"],
      statuses: ["free", "held", "booked", "blocked"],
      type: "mirror"
    },
    Booking: {
      fields: ["id", "clientId", "specialistId", "serviceId", "slotId", "status", "price", "createdAt"],
      statuses: ["draft", "confirmed", "completed", "cancelled"],
      type: "internal"
    }
  },
  predicates: {
    "slot_is_free": "slot.status = 'free'",
    "booking_is_confirmed": "booking.status = 'confirmed'",
    "booking_is_completed": "booking.status = 'completed'",
    "service_is_active": "service.active = true"
  }
};
