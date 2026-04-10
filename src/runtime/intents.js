export const INTENTS = {
  select_service: {
    name: "Выбрать услугу", particles: {
      entities: ["service: Service", "specialist: Specialist"],
      conditions: ["service.active = true"],
      effects: [{ α: "add", target: "drafts", σ: "session" }],
      witnesses: ["service.name", "service.duration", "service.price", "specialist.name"],
      confirmation: "click"
    }, antagonist: null, creates: "Booking(draft)"
  },
  select_slot: {
    name: "Выбрать слот", particles: {
      entities: ["slot: TimeSlot", "draft: Booking(draft)"],
      conditions: ["slot.status = 'free'"],
      effects: [{ α: "replace", target: "slot.status", value: "held", σ: "shared", ttl: 600000 }],
      witnesses: ["slot.date", "slot.startTime", "service.duration"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  confirm_booking: {
    name: "Подтвердить запись", particles: {
      entities: ["draft: Booking(draft)"],
      conditions: ["draft.slotId != null", "draft.serviceId != null"],
      effects: [
        { α: "add", target: "bookings", σ: "account" },
        { α: "replace", target: "slot.status", value: "booked", σ: "shared" }
      ],
      witnesses: ["service.name", "service.price", "slot.date", "slot.startTime", "specialist.name"],
      confirmation: "click"
    }, antagonist: "cancel_booking", creates: "Booking(confirmed)"
  },
  cancel_booking: {
    name: "Отменить запись", particles: {
      entities: ["booking: Booking"],
      conditions: ["booking.status = 'confirmed'"],
      effects: [
        { α: "replace", target: "booking.status", value: "cancelled", σ: "account" },
        { α: "replace", target: "slot.status", value: "free", σ: "shared" }
      ],
      witnesses: ["booking.serviceName", "booking.date", "booking.startTime"],
      confirmation: "click"
    }, antagonist: "confirm_booking", creates: null
  },
  abandon_draft: {
    name: "Отменить черновик", particles: {
      entities: ["draft: Booking(draft)"],
      conditions: [],
      effects: [{ α: "remove", target: "drafts", σ: "session" }],
      witnesses: ["draft.serviceName"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  complete_booking: {
    name: "Завершить приём", particles: {
      entities: ["booking: Booking"],
      conditions: ["booking.status = 'confirmed'", "booking.slot.endTime <= now"],
      effects: [{ α: "replace", target: "booking.status", value: "completed", σ: "account" }],
      witnesses: ["booking.serviceName", "booking.date"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  add_service: {
    name: "Добавить услугу", particles: {
      entities: ["service: Service"],
      conditions: [],
      effects: [{ α: "add", target: "services", σ: "account" }],
      witnesses: ["specialist.services.count"],
      confirmation: "click"
    }, antagonist: null, creates: "Service"
  },
  block_slot: {
    name: "Заблокировать слот", particles: {
      entities: ["slot: TimeSlot"],
      conditions: ["slot.status = 'free'"],
      effects: [{ α: "replace", target: "slot.status", value: "blocked", σ: "shared" }],
      witnesses: ["slot.date", "slot.startTime"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  unblock_slot: {
    name: "Разблокировать слот", particles: {
      entities: ["slot: TimeSlot"],
      conditions: ["slot.status = 'blocked'"],
      effects: [{ α: "replace", target: "slot.status", value: "free", σ: "shared" }],
      witnesses: ["slot.date", "slot.startTime"],
      confirmation: "click"
    }, antagonist: "block_slot", creates: null
  },
  reschedule_booking: {
    name: "Перенести запись", particles: {
      entities: ["booking: Booking", "new_slot: TimeSlot"],
      conditions: ["booking.status = 'confirmed'", "slot.status = 'free'"],
      effects: [
        { α: "replace", target: "booking.slotId", σ: "account" },
        { α: "replace", target: "slot.status", value: "free", σ: "shared" },
        { α: "replace", target: "slot.status", value: "booked", σ: "shared" }
      ],
      witnesses: ["booking.serviceName", "booking.date", "new_slot.date", "new_slot.startTime"],
      confirmation: "click"
    }, antagonist: null, creates: null, phase: "investigation"
  },
  mark_no_show: {
    name: "Отметить неявку", particles: {
      entities: ["booking: Booking"],
      conditions: ["booking.status = 'confirmed'"],
      effects: [{ α: "replace", target: "booking.status", value: "no_show", σ: "account" }],
      witnesses: ["booking.serviceName", "booking.date", "booking.startTime"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  leave_review: {
    name: "Оставить отзыв", particles: {
      entities: ["booking: Booking", "review: Review"],
      conditions: ["booking.status = 'completed'"],
      effects: [{ α: "add", target: "reviews", σ: "account" }],
      witnesses: ["booking.serviceName", "booking.date"],
      confirmation: "click"
    }, antagonist: null, creates: "Review"
  },
  delete_review: {
    name: "Удалить отзыв", particles: {
      entities: ["review: Review"],
      conditions: [],
      effects: [{ α: "remove", target: "reviews", σ: "account" }],
      witnesses: ["review.text"],
      confirmation: "click"
    }, antagonist: null, creates: null, irreversibility: "medium"
  },
  bulk_cancel_day: {
    name: "Отменить все записи на день", particles: {
      entities: ["booking: Booking[]"],
      conditions: ["booking.status = 'confirmed'"],
      effects: [
        { α: "replace", target: "booking.status", value: "cancelled", σ: "account" },
        { α: "replace", target: "slot.status", value: "free", σ: "shared" }
      ],
      witnesses: ["target_date", "bookings.count", "affected_clients"],
      confirmation: "click"
    }, antagonist: null, creates: null, extended: true
  }
};
