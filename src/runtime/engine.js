import { useState, useMemo, useCallback, useEffect } from "react";
import { v4 as uuid } from "uuid";
import { INTENTS } from "./intents.js";
import { deriveLinks } from "./links.js";
import { fold, foldDrafts, filterByStatus } from "./fold.js";

const ts = () => {
  const d = new Date();
  return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 2 });
};

function describeEffect(intentId, alpha, ctx, target) {
  // Вторичные эффекты описываются по target, а не по intent_id
  if (target) {
    if (target.startsWith("drafts")) return `📋 Черновик: ${alpha} ${ctx.serviceName || ctx.slotId || ctx.id || ""}`;
    if (target === "slot.status" && intentId !== "select_slot" && intentId !== "block_slot" && intentId !== "unblock_slot") {
      const val = ctx.status || "";
      return `🔄 Слот ${ctx.id}: → ${val || alpha}`;
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
    case "_seed": return `seed: ${alpha} ${ctx.id || ""}`;
    default: return `${alpha} ${intentId}`;
  }
}

function signalForIntent(intentId) {
  switch (intentId) {
    case "confirm_booking": return { κ: "notification", desc: "Запись подтверждена" };
    case "cancel_booking": return { κ: "notification", desc: "Запись отменена" };
    case "complete_booking": return { κ: "notification", desc: "Приём завершён" };
    case "mark_no_show": return { κ: "notification", desc: "Неявка зафиксирована" };
    case "leave_review": return { κ: "notification", desc: "Отзыв опубликован" };
    case "bulk_cancel_day": return { κ: "notification", desc: "Массовая отмена выполнена" };
    default: return null;
  }
}

/**
 * Найти последовательные свободные слоты, начиная с указанного.
 * Возвращает массив слотов или null если не хватает.
 */
function findConsecutiveSlots(slots, startSlotId, slotsNeeded) {
  const startSlot = slots.find(s => s.id === startSlotId);
  if (!startSlot) return null;

  // Все слоты этого дня, отсортированные по времени
  const daySlots = slots
    .filter(s => s.date === startSlot.date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

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

function buildEffects(intentId, ctx, world, drafts) {
  const now = Date.now();
  const effects = [];

  switch (intentId) {
    case "select_service": {
      const service = (world.services || []).find(s => s.id === ctx.serviceId);
      if (!service || !service.active) return null;
      const draftId = `draft_${now}`;
      effects.push({
        id: uuid(), intent_id: intentId, alpha: "add", target: "drafts",
        scope: "session", value: null,
        context: { id: draftId, serviceId: service.id, serviceName: service.name,
                   specialistId: service.specialistId, price: service.price,
                   duration: service.duration, slotId: null, status: "draft", createdAt: now },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: describeEffect(intentId, "add", { serviceName: service.name }), time: ts(),
      });
      break;
    }
    case "select_slot": {
      const draft = drafts[0];
      if (!draft) return null;
      const slotsNeeded = Math.ceil((draft.duration || 60) / 60);
      const consecutiveSlots = findConsecutiveSlots(world.slots || [], ctx.slotId, slotsNeeded);
      if (!consecutiveSlots) return null;

      // Удержать все нужные слоты с TTL
      for (const slot of consecutiveSlots) {
        effects.push({
          id: uuid(), intent_id: intentId, alpha: "replace", target: "slot.status",
          scope: "shared", value: "held",
          context: { id: slot.id, date: slot.date, startTime: slot.startTime },
          parent_id: null, status: "proposed", ttl: 600000, created_at: now,
          desc: describeEffect(intentId, "replace", { date: slot.date, startTime: slot.startTime }), time: ts(),
        });
      }

      // Обновить черновик с массивом slotIds
      const slotIds = consecutiveSlots.map(s => s.id);
      effects.push({
        id: uuid(), intent_id: intentId, alpha: "replace", target: "drafts.slotId",
        scope: "session", value: slotIds[0],
        context: { id: draft.id, slotId: slotIds[0], slotIds },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: `📋 Черновик: ${consecutiveSlots.length} слотов с ${consecutiveSlots[0].date} ${consecutiveSlots[0].startTime}`, time: ts(),
      });
      break;
    }
    case "confirm_booking": {
      const draft = drafts[0];
      if (!draft || !draft.slotId || !draft.serviceId) return null;
      const slot = (world.slots || []).find(s => s.id === draft.slotId);
      if (!slot) return null;

      // slotIds: массив всех занятых слотов (из draft context или один slotId)
      const slotIds = draft.slotIds || [draft.slotId];
      const bookingId = `bk_${now}`;

      effects.push({
        id: uuid(), intent_id: intentId, alpha: "add", target: "bookings",
        scope: "account", value: null,
        context: { id: bookingId, specialistId: draft.specialistId, serviceId: draft.serviceId,
                   serviceName: draft.serviceName, slotId: draft.slotId, slotIds,
                   price: draft.price, date: slot.date, startTime: slot.startTime,
                   status: "confirmed", createdAt: now },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: describeEffect(intentId, "add", { serviceName: draft.serviceName, date: slot.date, startTime: slot.startTime }), time: ts(),
      });

      // Забронировать все слоты
      for (const sId of slotIds) {
        effects.push({
          id: uuid(), intent_id: intentId, alpha: "replace", target: "slot.status",
          scope: "shared", value: "booked",
          context: { id: sId },
          parent_id: null, status: "proposed", ttl: null, created_at: now,
          desc: `🔒 Слот забронирован`, time: ts(),
        });
      }

      effects.push({
        id: uuid(), intent_id: intentId, alpha: "remove", target: "drafts",
        scope: "session", value: null,
        context: { id: draft.id },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: `📋 Черновик промотирован`, time: ts(),
      });
      break;
    }
    case "cancel_booking": {
      const booking = (world.bookings || []).find(b => b.id === ctx.id);
      if (!booking || booking.status !== "confirmed") return null;

      effects.push({
        id: uuid(), intent_id: intentId, alpha: "replace", target: "booking.status",
        scope: "account", value: "cancelled",
        context: { id: booking.id, serviceName: booking.serviceName },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: describeEffect(intentId, "replace", { serviceName: booking.serviceName }), time: ts(),
      });

      // Освободить все занятые слоты
      const slotIds = booking.slotIds || [booking.slotId];
      for (const sId of slotIds) {
        effects.push({
          id: uuid(), intent_id: intentId, alpha: "replace", target: "slot.status",
          scope: "shared", value: "free",
          context: { id: sId },
          parent_id: null, status: "proposed", ttl: null, created_at: now,
          desc: `🔓 Слот освобождён`, time: ts(),
        });
      }
      break;
    }
    case "abandon_draft": {
      const draft = drafts[0];
      if (!draft) return null;

      effects.push({
        id: uuid(), intent_id: intentId, alpha: "remove", target: "drafts",
        scope: "session", value: null,
        context: { id: draft.id, serviceName: draft.serviceName },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: describeEffect(intentId, "remove", {}), time: ts(),
      });

      // Освободить все удержанные слоты
      const slotIds = draft.slotIds || (draft.slotId ? [draft.slotId] : []);
      for (const sId of slotIds) {
        effects.push({
          id: uuid(), intent_id: intentId, alpha: "replace", target: "slot.status",
          scope: "shared", value: "free",
          context: { id: sId },
          parent_id: null, status: "proposed", ttl: null, created_at: now,
          desc: `🔓 Слот освобождён`, time: ts(),
        });
      }
      break;
    }
    case "complete_booking": {
      const booking = (world.bookings || []).find(b => b.id === ctx.id);
      if (!booking || booking.status !== "confirmed") return null;

      effects.push({
        id: uuid(), intent_id: intentId, alpha: "replace", target: "booking.status",
        scope: "account", value: "completed",
        context: { id: booking.id, serviceName: booking.serviceName },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: describeEffect(intentId, "replace", { serviceName: booking.serviceName }), time: ts(),
      });
      break;
    }
    case "add_service": {
      if (!ctx.name?.trim() || !ctx.price || !ctx.duration) return null;
      const serviceId = `svc_${now}`;
      effects.push({
        id: uuid(), intent_id: intentId, alpha: "add", target: "services",
        scope: "account", value: null,
        context: { id: serviceId, specialistId: ctx.specialistId || "sp_anna",
                   name: ctx.name.trim(), duration: ctx.duration, price: ctx.price, active: true },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: describeEffect(intentId, "add", { name: ctx.name, price: ctx.price }), time: ts(),
      });
      break;
    }
    case "block_slot": {
      const slot = (world.slots || []).find(s => s.id === ctx.slotId);
      if (!slot || slot.status !== "free") return null;
      effects.push({
        id: uuid(), intent_id: intentId, alpha: "replace", target: "slot.status",
        scope: "shared", value: "blocked",
        context: { id: slot.id, date: slot.date, startTime: slot.startTime },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: describeEffect(intentId, "replace", { date: slot.date, startTime: slot.startTime }), time: ts(),
      });
      break;
    }
    case "unblock_slot": {
      const slot = (world.slots || []).find(s => s.id === ctx.slotId);
      if (!slot || slot.status !== "blocked") return null;
      effects.push({
        id: uuid(), intent_id: intentId, alpha: "replace", target: "slot.status",
        scope: "shared", value: "free",
        context: { id: slot.id, date: slot.date, startTime: slot.startTime },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: describeEffect(intentId, "replace", { date: slot.date, startTime: slot.startTime }), time: ts(),
      });
      break;
    }
    case "reschedule_booking": {
      const booking = (world.bookings || []).find(b => b.id === ctx.id);
      if (!booking || booking.status !== "confirmed") return null;

      // Определить сколько слотов нужно по услуге
      const service = (world.services || []).find(s => s.id === booking.serviceId);
      const slotsNeeded = Math.ceil((service?.duration || 60) / 60);
      const newSlots = findConsecutiveSlots(world.slots || [], ctx.newSlotId, slotsNeeded);
      if (!newSlots) return null;

      const newSlotIds = newSlots.map(s => s.id);

      // Обновить slotId и slotIds бронирования
      effects.push({
        id: uuid(), intent_id: intentId, alpha: "replace", target: "booking.slotId",
        scope: "account", value: newSlots[0].id,
        context: { id: booking.id, serviceName: booking.serviceName, slotIds: newSlotIds, newDate: newSlots[0].date, newStartTime: newSlots[0].startTime },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: describeEffect(intentId, "replace", { serviceName: booking.serviceName, newDate: newSlots[0].date, newStartTime: newSlots[0].startTime }), time: ts(),
      });
      effects.push({
        id: uuid(), intent_id: intentId, alpha: "replace", target: "booking.date",
        scope: "account", value: newSlots[0].date,
        context: { id: booking.id },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: `📋 Бронь: дата → ${newSlots[0].date}`, time: ts(),
      });
      effects.push({
        id: uuid(), intent_id: intentId, alpha: "replace", target: "booking.startTime",
        scope: "account", value: newSlots[0].startTime,
        context: { id: booking.id },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: `📋 Бронь: время → ${newSlots[0].startTime}`, time: ts(),
      });

      // Освободить старые слоты
      const oldSlotIds = booking.slotIds || [booking.slotId];
      for (const sId of oldSlotIds) {
        effects.push({
          id: uuid(), intent_id: intentId, alpha: "replace", target: "slot.status",
          scope: "shared", value: "free",
          context: { id: sId },
          parent_id: null, status: "proposed", ttl: null, created_at: now,
          desc: `🔓 Старый слот освобождён`, time: ts(),
        });
      }

      // Забронировать новые слоты
      for (const slot of newSlots) {
        effects.push({
          id: uuid(), intent_id: intentId, alpha: "replace", target: "slot.status",
          scope: "shared", value: "booked",
          context: { id: slot.id },
          parent_id: null, status: "proposed", ttl: null, created_at: now,
          desc: `🔒 Новый слот: ${slot.date} ${slot.startTime}`, time: ts(),
        });
      }
      break;
    }
    case "mark_no_show": {
      const booking = (world.bookings || []).find(b => b.id === ctx.id);
      if (!booking || booking.status !== "confirmed") return null;
      effects.push({
        id: uuid(), intent_id: intentId, alpha: "replace", target: "booking.status",
        scope: "account", value: "no_show",
        context: { id: booking.id, serviceName: booking.serviceName, date: booking.date, startTime: booking.startTime },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: describeEffect(intentId, "replace", { serviceName: booking.serviceName }), time: ts(),
      });
      break;
    }
    case "leave_review": {
      const booking = (world.bookings || []).find(b => b.id === ctx.bookingId);
      if (!booking || booking.status !== "completed") return null;
      const reviewId = `rev_${now}`;
      effects.push({
        id: uuid(), intent_id: intentId, alpha: "add", target: "reviews",
        scope: "account", value: null,
        context: { id: reviewId, bookingId: booking.id, specialistId: booking.specialistId,
                   serviceName: booking.serviceName, rating: ctx.rating || 5, text: ctx.text || "", createdAt: now },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: describeEffect(intentId, "add", { serviceName: booking.serviceName, rating: ctx.rating || 5 }), time: ts(),
      });
      break;
    }
    case "delete_review": {
      const review = (world.reviews || []).find(r => r.id === ctx.id);
      if (!review) return null;
      effects.push({
        id: uuid(), intent_id: intentId, alpha: "remove", target: "reviews",
        scope: "account", value: null,
        context: { id: review.id },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: describeEffect(intentId, "remove", { id: review.id }), time: ts(),
      });
      break;
    }
    case "bulk_cancel_day": {
      const dayBookings = (world.bookings || []).filter(b =>
        b.status === "confirmed" && b.date === ctx.date
      );
      if (dayBookings.length === 0) return null;
      for (const booking of dayBookings) {
        effects.push({
          id: uuid(), intent_id: intentId, alpha: "replace", target: "booking.status",
          scope: "account", value: "cancelled",
          context: { id: booking.id, serviceName: booking.serviceName },
          parent_id: null, status: "proposed", ttl: null, created_at: now,
          desc: `✕ Отмена: ${booking.serviceName}`, time: ts(),
        });
        effects.push({
          id: uuid(), intent_id: intentId, alpha: "replace", target: "slot.status",
          scope: "shared", value: "free",
          context: { id: booking.slotId },
          parent_id: null, status: "proposed", ttl: null, created_at: now,
          desc: `🔓 Слот освобождён`, time: ts(),
        });
      }
      break;
    }
    default:
      return null;
  }

  return effects.length > 0 ? effects : null;
}

export function useEngine() {
  const [effects, setEffects] = useState([]);
  const [signals, setSignals] = useState([]);

  const reloadEffects = useCallback(() => {
    fetch("/api/effects")
      .then(r => r.json())
      .then(data => {
        setEffects(data.map(ef => ({
          ...ef,
          desc: ef.desc || describeEffect(ef.intent_id, ef.alpha, ef.context || {}, ef.target),
          time: ef.time || new Date(ef.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/effects")
      .then(r => r.json())
      .then(data => {
        setEffects(data.map(ef => ({
          ...ef,
          desc: ef.desc || describeEffect(ef.intent_id, ef.alpha, ef.context || {}, ef.target),
          time: ef.time || new Date(ef.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/effects/stream");

    es.addEventListener("effect:confirmed", (e) => {
      const { id } = JSON.parse(e.data);
      setEffects(prev => {
        const exists = prev.find(ef => ef.id === id);
        if (exists) {
          const updated = prev.map(ef =>
            ef.id === id ? { ...ef, status: "confirmed", resolved_at: Date.now() } : ef
          );
          const ef = updated.find(x => x.id === id);
          if (ef) {
            const sig = signalForIntent(ef.intent_id);
            if (sig) {
              setSignals(p => [{ id: uuid(), κ: sig.κ, desc: sig.desc, time: ts(), effectId: id }, ...p].slice(0, 20));
            }
          }
          return updated;
        }
        return prev;
      });

      // Если эффект неизвестен (foreign/sync) — перезагрузить все с сервера
      setEffects(prev => {
        if (prev.find(ef => ef.id === id)) return prev; // уже знаем
        // Запланировать перезагрузку вне state updater
        reloadEffects();
        return prev;
      });
    });

    es.addEventListener("effect:rejected", (e) => {
      const { id, reason, cascaded } = JSON.parse(e.data);
      setEffects(prev => {
        let updated = prev.map(ef =>
          ef.id === id ? { ...ef, status: "rejected", resolved_at: Date.now(), reason } : ef
        );
        if (cascaded?.length) {
          updated = updated.map(ef =>
            cascaded.includes(ef.id) ? { ...ef, status: "rejected", resolved_at: Date.now(), reason: `Каскад: предок ${id}` } : ef
          );
        }
        return updated;
      });
    });

    es.addEventListener("effects:reset", () => {
      setEffects([]);
      setSignals([]);
    });

    es.addEventListener("signal:drift", (e) => {
      const { description, time } = JSON.parse(e.data);
      setSignals(p => [{ id: uuid(), κ: "drift", desc: description, time: new Date(time).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }, ...p].slice(0, 20));
    });

    es.onerror = () => {};
    return () => es.close();
  }, []);

  const activeEffects = useMemo(
    () => filterByStatus(effects, "confirmed", "proposed"),
    [effects]
  );

  const world = useMemo(() => fold(activeEffects), [activeEffects]);
  const drafts = useMemo(() => foldDrafts(activeEffects), [activeEffects]);

  const stats = useMemo(() => ({
    slots_free: (world.slots || []).filter(s => s.status === "free").length,
    slots_held: (world.slots || []).filter(s => s.status === "held").length,
    slots_booked: (world.slots || []).filter(s => s.status === "booked").length,
    bookings_confirmed: (world.bookings || []).filter(b => b.status === "confirmed").length,
    bookings_completed: (world.bookings || []).filter(b => b.status === "completed").length,
    drafts: drafts.length,
  }), [world, drafts]);

  const links = useMemo(deriveLinks, []);

  const exec = useCallback((intentId, ctx = {}) => {
    const built = buildEffects(intentId, ctx, world, drafts);
    if (!built) return;

    // Связать эффекты причинно:
    // 1. Внутри одного вызова: цепочка parent_id
    for (let i = 1; i < built.length; i++) {
      built[i].parent_id = built[i - 1].id;
    }
    // 2. Между вызовами: найти последний эффект предыдущего шага
    setEffects(prev => {
      const lastUserEffect = [...prev].reverse().find(e =>
        e.intent_id !== "_seed" && e.intent_id !== "_sync" && e.status !== "rejected"
      );
      if (lastUserEffect && built[0].parent_id === null) {
        built[0].parent_id = lastUserEffect.id;
      }
      return [...prev, ...built];
    });

    for (const effect of built) {
      fetch("/api/effects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(effect),
      }).catch(() => {
        setEffects(prev => prev.map(ef =>
          ef.id === effect.id ? { ...ef, status: "confirmed", resolved_at: Date.now() } : ef
        ));
      });
    }
  }, [world, drafts]);

  const isApplicable = useCallback((intentId, ctx) => {
    const i = INTENTS[intentId];
    if (!i) return false;
    for (const c of i.particles.conditions) {
      if (c === "service.active = true" && ctx.entity?.active !== true) return false;
      if (c === "slot.status = 'free'" && ctx.entity?.status !== "free") return false;
      if (c === "booking.status = 'confirmed'" && ctx.entity?.status !== "confirmed") return false;
    }
    return true;
  }, []);

  return { world, drafts, effects, signals, stats, links, exec, isApplicable };
}
