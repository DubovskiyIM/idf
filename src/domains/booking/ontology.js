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
      fields: ["id", "clientId", "specialistId", "serviceId", "serviceName", "slotId", "slotIds", "status", "price", "createdAt"],
      statuses: ["draft", "confirmed", "completed", "cancelled", "no_show"],
      ownerField: "clientId",
      type: "internal"
    },
    Review: {
      fields: ["id", "bookingId", "specialistId", "serviceName", "authorId", "rating", "text", "response", "createdAt"],
      ownerField: "authorId",
      type: "internal"
    }
  },
  predicates: {
    "slot_is_free": "slot.status = 'free'",
    "booking_is_confirmed": "booking.status = 'confirmed'",
    "booking_is_completed": "booking.status = 'completed'",
    "service_is_active": "service.active = true"
  },
  // Роли и доступ — раздел 5 манифеста (зависимость от зрителя)
  roles: {
    client: {
      label: "Клиент",
      canExecute: [
        "select_service", "select_slot", "confirm_booking", "cancel_booking",
        "abandon_draft", "leave_review", "edit_review", "delete_review",
        "repeat_booking", "reschedule_booking"
      ],
      visibleFields: {
        TimeSlot: ["id", "date", "startTime", "endTime", "status"],  // без имён
        Booking: ["id", "serviceId", "slotId", "status", "price", "createdAt"],  // только свои
        Review: ["id", "bookingId", "rating", "text", "response", "createdAt"],  // свои + ответы
      },
      // Клиент видит слоты как free/booked (не held/blocked деталей)
      statusMapping: { held: "booked", blocked: "booked" }
    },
    specialist: {
      label: "Специалист",
      canExecute: [
        "add_service", "update_service", "remove_service",
        "block_slot", "unblock_slot",
        "cancel_client_booking", "complete_booking", "mark_no_show",
        "respond_to_review", "bulk_cancel_day"
      ],
      visibleFields: {
        TimeSlot: ["id", "date", "startTime", "endTime", "status"],
        Booking: ["id", "clientId", "specialistId", "serviceId", "slotId", "status", "price", "createdAt", "serviceName"],
        Review: ["id", "bookingId", "rating", "text", "response", "createdAt", "serviceName"],
      },
      statusMapping: {}  // видит всё
    },
    agent: {
      label: "Агент (API)",
      canExecute: [
        "create_booking",
        "cancel_booking",
        "reschedule_booking",
        "repeat_booking",
        "leave_review",
        "edit_review",
        "delete_review"
      ],
      visibleFields: {
        Specialist: ["id", "name", "specialization"],
        Service:    ["id", "specialistId", "name", "duration", "price", "active"],
        TimeSlot:   ["id", "specialistId", "date", "startTime", "endTime", "status"],
        Booking:    ["id", "specialistId", "serviceId", "slotId", "status", "price", "createdAt"],
        Review:     ["id", "bookingId", "specialistId", "rating", "text", "response", "createdAt"]
      },
      statusMapping: { held: "booked", blocked: "unavailable" }
    }
  }
};
