export const ONTOLOGY = {
  entities: {
    ServiceCategory: {
      fields: {
        id: { type: "id" },
        name: { type: "text", read: ["*"], label: "Категория" },
        icon: { type: "text", read: ["*"], label: "Иконка" },
        parentId: { type: "entityRef", label: "Родитель" },
        sortOrder: { type: "number" },
      },
      type: "internal"
    },
    Specialist: {
      fields: ["id", "name", "specialization"],
      type: "internal"
    },
    Service: {
      fields: {
        id: { type: "id" },
        specialistId: { type: "entityRef" },
        categoryId: { type: "entityRef", read: ["*"], label: "Категория" },
        name: { type: "text", read: ["*"], write: ["self"], required: true, label: "Название" },
        duration: { type: "number", read: ["*"], write: ["self"], label: "Длительность" },
        price: { type: "number", read: ["*"], write: ["self"], label: "Цена" },
        active: { type: "boolean", read: ["*"], label: "Активна" },
      },
      type: "internal"
    },
    TimeSlot: {
      fields: ["id", "specialistId", "date", "startTime", "endTime", "status"],
      statuses: ["free", "held", "booked", "blocked"],
      type: "mirror"
    },
    Booking: {
      fields: {
        id: { type: "id" },
        clientId: { type: "entityRef" },
        specialistId: { type: "entityRef" },
        serviceId: { type: "entityRef" },
        serviceName: { type: "text", read: ["*"], label: "Услуга" },
        slotId: { type: "entityRef" },
        slotIds: { type: "text" },
        status: { type: "enum", read: ["*"], label: "Статус" },
        price: { type: "number", read: ["*"], label: "Цена" },
        date: { type: "text", read: ["*"], label: "Дата" },
        startTime: { type: "text", read: ["*"], label: "Начало" },
        createdAt: { type: "datetime", read: ["*"], label: "Создано" },
      },
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
      base: "owner", // §5 base role taxonomy
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
      base: "owner",
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
      base: "agent",
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
