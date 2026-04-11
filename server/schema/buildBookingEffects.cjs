/**
 * Серверный builder эффектов для agent-разрешённых booking-intent'ов.
 *
 * Зеркалит client-side src/domains/booking/domain.js::buildEffects, но
 * только для 7 intent'ов из roles.agent.canExecute. Принимает
 * (intentId, params, viewer, world), возвращает массив effect-объектов
 * в формате Φ или null если сборка невозможна.
 *
 * Viewer.id пишется в clientId/authorId для ownership-фильтра через
 * ownerField (см. filterWorld.cjs).
 */

const { v4: uuid } = require("uuid");

function ts() {
  return new Date().toLocaleTimeString("ru", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function makeEffect(intentId, props) {
  return {
    id: uuid(),
    intent_id: intentId,
    parent_id: null,
    status: "proposed",
    ttl: null,
    created_at: Date.now(),
    time: ts(),
    ...props
  };
}

function buildBookingEffects(intentId, params, viewer, world) {
  const now = Date.now();

  switch (intentId) {
    case "create_booking": {
      const specialist = (world.specialists || []).find(s => s.id === params.specialistId);
      const service = (world.services || []).find(s => s.id === params.serviceId);
      const slot = (world.slots || world.timeslots || []).find(s => s.id === params.slotId);
      if (!specialist || !service || !slot) return null;
      // Pre-check slot.status === "free" NOT here — server validator
      // отвергнет эффект через condition "slot.status = 'free'" и вернёт
      // 409 с failedCondition. Это демонстрирует proposed→rejected lifecycle.

      const bookingId = `book_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [
        makeEffect(intentId, {
          alpha: "add",
          target: "bookings",
          scope: "account",
          value: null,
          context: {
            id: bookingId,
            clientId: viewer.id,
            specialistId: specialist.id,
            serviceId: service.id,
            serviceName: service.name,
            slotId: slot.id,
            status: "confirmed",
            price: params.price ?? service.price,
            createdAt: now
          },
          desc: `📅 Запись создана: ${service.name} у ${specialist.name}`
        }),
        makeEffect(intentId, {
          alpha: "replace",
          target: "slots.status",
          scope: "shared",
          value: "booked",
          context: { id: slot.id },
          desc: `Slot ${slot.id} → booked`
        })
      ];
    }

    case "cancel_booking": {
      const booking = (world.bookings || []).find(b => b.id === params.bookingId);
      if (!booking) return null;
      if (booking.status !== "confirmed") return null;
      return [
        makeEffect(intentId, {
          alpha: "replace",
          target: "booking.status",
          scope: "account",
          value: "cancelled",
          context: { id: booking.id },
          desc: `✕ Бронь ${booking.id} отменена`
        }),
        makeEffect(intentId, {
          alpha: "replace",
          target: "slots.status",
          scope: "shared",
          value: "free",
          context: { id: booking.slotId },
          desc: `Slot ${booking.slotId} → free`
        })
      ];
    }

    case "leave_review": {
      const booking = (world.bookings || []).find(b => b.id === params.bookingId);
      if (!booking) return null;
      if (booking.status !== "completed") return null;

      const reviewId = `rev_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [makeEffect(intentId, {
        alpha: "add",
        target: "reviews",
        scope: "account",
        value: null,
        context: {
          id: reviewId,
          bookingId: booking.id,
          specialistId: booking.specialistId,
          serviceName: booking.serviceName,
          authorId: viewer.id,
          rating: params.rating,
          text: params.text || "",
          response: null,
          createdAt: now
        },
        desc: `⭐ Отзыв: ${params.rating} звёзд`
      })];
    }

    case "edit_review": {
      const review = (world.reviews || []).find(r => r.id === params.reviewId);
      if (!review) return null;
      if (review.authorId !== viewer.id) return null;
      const effects = [];
      if (params.rating != null) {
        effects.push(makeEffect(intentId, {
          alpha: "replace", target: "review.rating", scope: "account",
          value: params.rating, context: { id: review.id },
          desc: `✎ Оценка → ${params.rating}`
        }));
      }
      if (params.text != null) {
        effects.push(makeEffect(intentId, {
          alpha: "replace", target: "review.text", scope: "account",
          value: params.text, context: { id: review.id },
          desc: `✎ Текст отзыва обновлён`
        }));
      }
      return effects.length > 0 ? effects : null;
    }

    case "delete_review": {
      const review = (world.reviews || []).find(r => r.id === params.reviewId);
      if (!review) return null;
      if (review.authorId !== viewer.id) return null;
      return [makeEffect(intentId, {
        alpha: "remove", target: "reviews", scope: "account",
        value: null, context: { id: review.id },
        desc: `🗑 Отзыв удалён`
      })];
    }

    case "repeat_booking": {
      const source = (world.bookings || []).find(b => b.id === params.bookingId);
      if (!source) return null;
      // Repeat создаёт draft, но для агента drafts не существуют —
      // вместо этого это no-op с предупреждением. Агенту надо
      // использовать create_booking с явно указанным slotId.
      return null;
    }

    case "reschedule_booking": {
      const booking = (world.bookings || []).find(b => b.id === params.bookingId);
      if (!booking) return null;
      if (booking.status !== "confirmed") return null;
      const allSlots = world.slots || world.timeslots || [];
      const oldSlot = allSlots.find(s => s.id === booking.slotId);
      const newSlot = allSlots.find(s => s.id === params.newSlotId);
      if (!oldSlot || !newSlot) return null;
      if (newSlot.status !== "free") return null;
      return [
        makeEffect(intentId, {
          alpha: "replace", target: "slots.status", scope: "shared",
          value: "free", context: { id: oldSlot.id },
          desc: `Slot ${oldSlot.id} → free (reschedule)`
        }),
        makeEffect(intentId, {
          alpha: "replace", target: "booking.slotId", scope: "account",
          value: newSlot.id, context: { id: booking.id },
          desc: `Бронь ${booking.id} перенесена на ${newSlot.date}`
        }),
        makeEffect(intentId, {
          alpha: "replace", target: "slots.status", scope: "shared",
          value: "booked", context: { id: newSlot.id },
          desc: `Slot ${newSlot.id} → booked`
        })
      ];
    }

    default:
      return null;
  }
}

module.exports = { buildBookingEffects };
