/**
 * Домен: Бронирование услуг
 * Экспортирует всё доменоспецифичное в одном файле.
 */
import { v4 as uuid } from "uuid";

export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";

export const DOMAIN_ID = "booking";
export const DOMAIN_NAME = "Бронирование";

const ts = () => new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 2 });

function findConsecutiveSlots(slots, startSlotId, slotsNeeded) {
  const startSlot = slots.find(s => s.id === startSlotId);
  if (!startSlot) return null;
  const daySlots = slots.filter(s => s.date === startSlot.date).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const startIdx = daySlots.findIndex(s => s.id === startSlotId);
  if (startIdx === -1) return null;
  const result = [];
  for (let i = 0; i < slotsNeeded; i++) {
    const slot = daySlots[startIdx + i];
    if (!slot || slot.status !== "free") return null;
    result.push(slot);
  }
  return result;
}

export function describeEffect(intentId, alpha, ctx, target) {
  if (target) {
    if (target.startsWith("drafts")) return `📋 Черновик: ${alpha} ${ctx.serviceName || ctx.slotId || ctx.id || ""}`;
    if (target === "slot.status" && !["select_slot", "block_slot", "unblock_slot"].includes(intentId)) {
      return `🔄 Слот ${ctx.id}: → ${ctx.status || alpha}`;
    }
  }
  switch (intentId) {
    case "select_service": return `📋 Выбрана услуга: ${ctx.serviceName || ctx.name || ctx.id}`;
    case "select_slot": return `🕐 Слот удержан: ${ctx.date || "?"} ${ctx.startTime || "?"} (TTL 10м)`;
    case "confirm_booking": return `✓ Запись подтверждена: ${ctx.serviceName || ""} ${ctx.date || ""} ${ctx.startTime || ""}`.trim();
    case "cancel_booking": return `✕ Запись отменена: ${ctx.serviceName || ctx.id}`;
    case "abandon_draft": return `↩ Черновик отменён`;
    case "complete_booking": return `✓ Приём завершён: ${ctx.serviceName || ctx.id}`;
    case "add_service": return `+ Услуга: ${ctx.name} (${ctx.price}₽)`;
    case "block_slot": return `🔒 Слот заблокирован: ${ctx.date} ${ctx.startTime}`;
    case "unblock_slot": return `🔓 Слот разблокирован: ${ctx.date} ${ctx.startTime}`;
    case "reschedule_booking": return `↔ Перенесена: ${ctx.serviceName || ""} → ${ctx.newDate || ""} ${ctx.newStartTime || ""}`.trim();
    case "mark_no_show": return `⊘ Неявка: ${ctx.serviceName || ctx.id}`;
    case "leave_review": return `★ Отзыв: ${ctx.serviceName || ""} (${ctx.rating}/5)`;
    case "delete_review": return `✕ Отзыв удалён: ${ctx.id}`;
    case "bulk_cancel_day": return `⊗ Массовая отмена: ${ctx.date} (${ctx.count || "?"} записей)`;
    case "repeat_booking": return `🔄 Повтор: ${ctx.serviceName || ctx.id}`;
    case "edit_review": return `✎ Отзыв изменён`;
    case "cancel_client_booking": return `✕ Отмена специалистом: ${ctx.serviceName || ctx.id}`;
    case "respond_to_review": return `💬 Ответ на отзыв`;
    case "update_service": return `💰 Услуга обновлена: ${ctx.name || ctx.id}`;
    case "remove_service": return `🚫 Услуга убрана: ${ctx.name || ctx.id}`;
    case "_seed": return `seed: ${alpha} ${ctx.id || ""}`;
    default: return `${alpha} ${intentId}`;
  }
}

export function signalForIntent(intentId) {
  switch (intentId) {
    case "confirm_booking": return { κ: "notification", desc: "Запись подтверждена" };
    case "cancel_booking": return { κ: "notification", desc: "Запись отменена" };
    case "complete_booking": return { κ: "notification", desc: "Приём завершён" };
    case "mark_no_show": return { κ: "notification", desc: "Неявка зафиксирована" };
    case "leave_review": return { κ: "notification", desc: "Отзыв опубликован" };
    case "bulk_cancel_day": return { κ: "notification", desc: "Массовая отмена выполнена" };
    case "cancel_client_booking": return { κ: "notification", desc: "Запись клиента отменена специалистом" };
    default: return null;
  }
}

export function buildEffects(intentId, ctx, world, drafts) {
  const now = Date.now();
  const effects = [];
  const ef = (props) => effects.push({ id: uuid(), intent_id: intentId, parent_id: null, status: "proposed", ttl: null, created_at: now, time: ts(), ...props });

  switch (intentId) {
    case "select_service": {
      const service = (world.services || []).find(s => s.id === ctx.serviceId);
      if (!service || !service.active) return null;
      ef({ alpha: "add", target: "drafts", scope: "session", value: null,
        context: { id: `draft_${now}`, serviceId: service.id, serviceName: service.name, specialistId: service.specialistId, price: service.price, duration: service.duration, slotId: null, status: "draft", createdAt: now },
        desc: describeEffect(intentId, "add", { serviceName: service.name }) });
      break;
    }
    case "select_slot": {
      const draft = drafts[0]; if (!draft) return null;
      const slotsNeeded = Math.ceil((draft.duration || 60) / 60);
      const slots = findConsecutiveSlots(world.slots || [], ctx.slotId, slotsNeeded);
      if (!slots) return null;
      for (const s of slots) ef({ alpha: "replace", target: "slot.status", scope: "shared", value: "held", ttl: 600000, context: { id: s.id, date: s.date, startTime: s.startTime }, desc: describeEffect(intentId, "replace", { date: s.date, startTime: s.startTime }) });
      ef({ alpha: "replace", target: "drafts.slotId", scope: "session", value: slots[0].id, context: { id: draft.id, slotId: slots[0].id, slotIds: slots.map(s => s.id) }, desc: `📋 Черновик: ${slots.length} слотов` });
      break;
    }
    case "confirm_booking": {
      const draft = drafts[0]; if (!draft || !draft.slotId || !draft.serviceId) return null;
      const slot = (world.slots || []).find(s => s.id === draft.slotId); if (!slot) return null;
      const slotIds = draft.slotIds || [draft.slotId];
      ef({ alpha: "add", target: "bookings", scope: "account", value: null,
        context: { id: `bk_${now}`, specialistId: draft.specialistId, serviceId: draft.serviceId, serviceName: draft.serviceName, slotId: draft.slotId, slotIds, price: draft.price, date: slot.date, startTime: slot.startTime, status: "confirmed", createdAt: now },
        desc: describeEffect(intentId, "add", { serviceName: draft.serviceName, date: slot.date, startTime: slot.startTime }) });
      for (const sId of slotIds) ef({ alpha: "replace", target: "slot.status", scope: "shared", value: "booked", context: { id: sId }, desc: `🔒 Слот забронирован` });
      ef({ alpha: "remove", target: "drafts", scope: "session", value: null, context: { id: draft.id }, desc: `📋 Черновик промотирован` });
      break;
    }
    case "cancel_booking": {
      const booking = (world.bookings || []).find(b => b.id === ctx.id); if (!booking || booking.status !== "confirmed") return null;
      ef({ alpha: "replace", target: "booking.status", scope: "account", value: "cancelled", context: { id: booking.id, serviceName: booking.serviceName }, desc: describeEffect(intentId, "replace", { serviceName: booking.serviceName }) });
      for (const sId of (booking.slotIds || [booking.slotId])) ef({ alpha: "replace", target: "slot.status", scope: "shared", value: "free", context: { id: sId }, desc: `🔓 Слот освобождён` });
      break;
    }
    case "abandon_draft": {
      const draft = drafts[0]; if (!draft) return null;
      ef({ alpha: "remove", target: "drafts", scope: "session", value: null, context: { id: draft.id, serviceName: draft.serviceName }, desc: describeEffect(intentId, "remove", {}) });
      for (const sId of (draft.slotIds || (draft.slotId ? [draft.slotId] : []))) ef({ alpha: "replace", target: "slot.status", scope: "shared", value: "free", context: { id: sId }, desc: `🔓 Слот освобождён` });
      break;
    }
    case "complete_booking": {
      const booking = (world.bookings || []).find(b => b.id === ctx.id); if (!booking || booking.status !== "confirmed") return null;
      ef({ alpha: "replace", target: "booking.status", scope: "account", value: "completed", context: { id: booking.id, serviceName: booking.serviceName }, desc: describeEffect(intentId, "replace", { serviceName: booking.serviceName }) });
      break;
    }
    case "add_service": {
      if (!ctx.name?.trim() || !ctx.price || !ctx.duration) return null;
      ef({ alpha: "add", target: "services", scope: "account", value: null,
        context: { id: `svc_${now}`, specialistId: ctx.specialistId || "sp_anna", name: ctx.name.trim(), duration: ctx.duration, price: ctx.price, active: true },
        desc: describeEffect(intentId, "add", { name: ctx.name, price: ctx.price }) });
      break;
    }
    case "block_slot": {
      const slot = (world.slots || []).find(s => s.id === ctx.slotId); if (!slot || slot.status !== "free") return null;
      ef({ alpha: "replace", target: "slot.status", scope: "shared", value: "blocked", context: { id: slot.id, date: slot.date, startTime: slot.startTime }, desc: describeEffect(intentId, "replace", { date: slot.date, startTime: slot.startTime }) });
      break;
    }
    case "unblock_slot": {
      const slot = (world.slots || []).find(s => s.id === ctx.slotId); if (!slot || slot.status !== "blocked") return null;
      ef({ alpha: "replace", target: "slot.status", scope: "shared", value: "free", context: { id: slot.id, date: slot.date, startTime: slot.startTime }, desc: describeEffect(intentId, "replace", { date: slot.date, startTime: slot.startTime }) });
      break;
    }
    case "reschedule_booking": {
      const booking = (world.bookings || []).find(b => b.id === ctx.id); if (!booking || booking.status !== "confirmed") return null;
      const service = (world.services || []).find(s => s.id === booking.serviceId);
      const newSlots = findConsecutiveSlots(world.slots || [], ctx.newSlotId, Math.ceil((service?.duration || 60) / 60)); if (!newSlots) return null;
      const newSlotIds = newSlots.map(s => s.id);
      ef({ alpha: "replace", target: "booking.slotId", scope: "account", value: newSlots[0].id, context: { id: booking.id, serviceName: booking.serviceName, slotIds: newSlotIds, newDate: newSlots[0].date, newStartTime: newSlots[0].startTime }, desc: describeEffect(intentId, "replace", { serviceName: booking.serviceName, newDate: newSlots[0].date, newStartTime: newSlots[0].startTime }) });
      ef({ alpha: "replace", target: "booking.date", scope: "account", value: newSlots[0].date, context: { id: booking.id }, desc: `📋 Бронь: дата → ${newSlots[0].date}` });
      ef({ alpha: "replace", target: "booking.startTime", scope: "account", value: newSlots[0].startTime, context: { id: booking.id }, desc: `📋 Бронь: время → ${newSlots[0].startTime}` });
      for (const sId of (booking.slotIds || [booking.slotId])) ef({ alpha: "replace", target: "slot.status", scope: "shared", value: "free", context: { id: sId }, desc: `🔓 Старый слот` });
      for (const s of newSlots) ef({ alpha: "replace", target: "slot.status", scope: "shared", value: "booked", context: { id: s.id }, desc: `🔒 Новый: ${s.date} ${s.startTime}` });
      break;
    }
    case "mark_no_show": {
      const booking = (world.bookings || []).find(b => b.id === ctx.id); if (!booking || booking.status !== "confirmed") return null;
      ef({ alpha: "replace", target: "booking.status", scope: "account", value: "no_show", context: { id: booking.id, serviceName: booking.serviceName }, desc: describeEffect(intentId, "replace", { serviceName: booking.serviceName }) });
      break;
    }
    case "leave_review": {
      const booking = (world.bookings || []).find(b => b.id === ctx.bookingId); if (!booking || booking.status !== "completed") return null;
      ef({ alpha: "add", target: "reviews", scope: "account", value: null,
        context: { id: `rev_${now}`, bookingId: booking.id, specialistId: booking.specialistId, serviceName: booking.serviceName, authorId: ctx.clientId || "self", rating: ctx.rating || 5, text: ctx.text || "", createdAt: now },
        desc: describeEffect(intentId, "add", { serviceName: booking.serviceName, rating: ctx.rating || 5 }) });
      break;
    }
    case "delete_review": {
      const review = (world.reviews || []).find(r => r.id === ctx.id); if (!review) return null;
      ef({ alpha: "remove", target: "reviews", scope: "account", value: null, context: { id: review.id }, desc: describeEffect(intentId, "remove", { id: review.id }) });
      break;
    }
    case "bulk_cancel_day": {
      const dayBookings = (world.bookings || []).filter(b => b.status === "confirmed" && b.date === ctx.date); if (dayBookings.length === 0) return null;
      for (const b of dayBookings) {
        ef({ alpha: "replace", target: "booking.status", scope: "account", value: "cancelled", context: { id: b.id, serviceName: b.serviceName }, desc: `✕ Отмена: ${b.serviceName}` });
        ef({ alpha: "replace", target: "slot.status", scope: "shared", value: "free", context: { id: b.slotId }, desc: `🔓 Слот освобождён` });
      }
      break;
    }
    case "repeat_booking": {
      const booking = (world.bookings || []).find(b => b.id === ctx.id);
      if (!booking || booking.status === "confirmed" || booking.status === "draft") return null;
      const service = (world.services || []).find(s => s.id === booking.serviceId);
      if (!service) return null;
      ef({ alpha: "add", target: "drafts", scope: "session", value: null,
        context: { id: `draft_${now}`, serviceId: service.id, serviceName: service.name, specialistId: service.specialistId, price: service.price, duration: service.duration, slotId: null, status: "draft", createdAt: now },
        desc: `🔄 Повтор: ${service.name}` });
      break;
    }
    case "edit_review": {
      const review = (world.reviews || []).find(r => r.id === ctx.id);
      if (!review) return null;
      if (ctx.rating) ef({ alpha: "replace", target: "review.rating", scope: "account", value: ctx.rating, context: { id: review.id }, desc: `★ Оценка → ${ctx.rating}` });
      if (ctx.text !== undefined) ef({ alpha: "replace", target: "review.text", scope: "account", value: ctx.text, context: { id: review.id }, desc: `✎ Текст обновлён` });
      break;
    }
    case "cancel_client_booking": {
      const booking = (world.bookings || []).find(b => b.id === ctx.id);
      if (!booking || booking.status !== "confirmed") return null;
      ef({ alpha: "replace", target: "booking.status", scope: "account", value: "cancelled",
        context: { id: booking.id, serviceName: booking.serviceName }, desc: `✕ Отмена специалистом: ${booking.serviceName}` });
      for (const sId of (booking.slotIds || [booking.slotId])) {
        ef({ alpha: "replace", target: "slot.status", scope: "shared", value: "free", context: { id: sId }, desc: `🔓 Слот` });
      }
      break;
    }
    case "respond_to_review": {
      const review = (world.reviews || []).find(r => r.id === ctx.id);
      if (!review || review.response) return null;
      if (!ctx.response?.trim()) return null;
      ef({ alpha: "replace", target: "review.response", scope: "account", value: ctx.response.trim(),
        context: { id: review.id }, desc: `💬 Ответ на отзыв` });
      break;
    }
    case "update_service": {
      const service = (world.services || []).find(s => s.id === ctx.id);
      if (!service) return null;
      if (ctx.price !== undefined) ef({ alpha: "replace", target: "service.price", scope: "account", value: ctx.price, context: { id: service.id }, desc: `💰 ${service.name}: цена → ${ctx.price}₽` });
      if (ctx.duration !== undefined) ef({ alpha: "replace", target: "service.duration", scope: "account", value: ctx.duration, context: { id: service.id }, desc: `⏱ ${service.name}: ${ctx.duration} мин` });
      break;
    }
    case "remove_service": {
      const service = (world.services || []).find(s => s.id === ctx.id);
      if (!service || !service.active) return null;
      const activeBookings = (world.bookings || []).filter(b => b.serviceId === service.id && b.status === "confirmed");
      if (activeBookings.length > 0) return null;
      ef({ alpha: "replace", target: "service.active", scope: "account", value: false,
        context: { id: service.id, name: service.name }, desc: `🚫 Услуга убрана: ${service.name}` });
      break;
    }
    case "create_booking": {
      const specialist = (world.specialists || []).find(s => s.id === ctx.specialistId);
      const service = (world.services || []).find(s => s.id === ctx.serviceId);
      const slot = (world.timeslots || []).find(s => s.id === ctx.slotId);
      if (!specialist || !service || !slot) return null;
      if (slot.status !== "free") return null;

      const bookingId = `book_${now}_${Math.random().toString(36).slice(2, 6)}`;
      ef({
        alpha: "add", target: "bookings", scope: "account", value: null,
        context: {
          id: bookingId,
          clientId: ctx.clientId || "self",
          specialistId: specialist.id,
          serviceId: service.id,
          serviceName: service.name,
          slotId: slot.id,
          status: "confirmed",
          price: ctx.price ?? service.price,
          createdAt: now
        },
        desc: `📅 Запись создана: ${service.name} у ${specialist.name}`
      });
      ef({
        alpha: "replace", target: "slot.status", scope: "shared", value: "booked",
        context: { id: slot.id },
        desc: `Slot ${slot.id} → booked`
      });
      break;
    }
    default: return null;
  }
  return effects.length > 0 ? effects : null;
}

// Seed-данные для бронирования
export function getSeedEffects() {
  const now = Date.now();
  const effects = [];
  const add = (target, context) => effects.push({
    id: uuid(), intent_id: "_seed", alpha: "add", target, value: null,
    scope: target === "slots" ? "shared" : "account",
    parent_id: null, status: "confirmed", ttl: null,
    context, created_at: now, resolved_at: now
  });

  add("specialists", { id: "sp_anna", name: "Анна Иванова", specialization: "Парикмахер" });
  add("services", { id: "svc_cut", specialistId: "sp_anna", name: "Стрижка", duration: 60, price: 2000, active: true });
  add("services", { id: "svc_color", specialistId: "sp_anna", name: "Окрашивание", duration: 120, price: 5000, active: true });
  add("services", { id: "svc_style", specialistId: "sp_anna", name: "Укладка", duration: 30, price: 1500, active: true });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let d = 0; d < 7; d++) {
    const date = new Date(today.getTime() + d * 86400000);
    const dow = date.getDay();
    if (dow === 0) continue;
    const hours = dow === 6 ? [10, 11, 12] : [10, 11, 12, 14, 15, 16, 17];
    const dateStr = date.toISOString().slice(0, 10);
    for (const h of hours) {
      add("slots", { id: `slot_${dateStr}_${h}`, specialistId: "sp_anna", date: dateStr,
        startTime: `${String(h).padStart(2, "0")}:00`, endTime: `${String(h + 1).padStart(2, "0")}:00`, status: "free" });
    }
  }

  return effects;
}
