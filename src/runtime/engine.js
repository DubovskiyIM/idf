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
    if (target === "slot.status" && intentId !== "select_slot" && intentId !== "block_slot") {
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
    case "_seed": return `seed: ${alpha} ${ctx.id || ""}`;
    default: return `${alpha} ${intentId}`;
  }
}

function signalForIntent(intentId) {
  switch (intentId) {
    case "confirm_booking": return { κ: "notification", desc: "Запись подтверждена" };
    case "cancel_booking": return { κ: "notification", desc: "Запись отменена" };
    case "complete_booking": return { κ: "notification", desc: "Приём завершён" };
    default: return null;
  }
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
      const slot = (world.slots || []).find(s => s.id === ctx.slotId);
      if (!slot || slot.status !== "free") return null;
      const draft = drafts[0];
      if (!draft) return null;

      effects.push({
        id: uuid(), intent_id: intentId, alpha: "replace", target: "slot.status",
        scope: "shared", value: "held",
        context: { id: slot.id, date: slot.date, startTime: slot.startTime },
        parent_id: null, status: "proposed", ttl: 600000, created_at: now,
        desc: describeEffect(intentId, "replace", { date: slot.date, startTime: slot.startTime }), time: ts(),
      });

      effects.push({
        id: uuid(), intent_id: intentId, alpha: "replace", target: "drafts.slotId",
        scope: "session", value: slot.id,
        context: { id: draft.id, slotId: slot.id },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: `📋 Черновик: слот ${slot.date} ${slot.startTime}`, time: ts(),
      });
      break;
    }
    case "confirm_booking": {
      const draft = drafts[0];
      if (!draft || !draft.slotId || !draft.serviceId) return null;
      const slot = (world.slots || []).find(s => s.id === draft.slotId);
      if (!slot) return null;

      const bookingId = `bk_${now}`;

      effects.push({
        id: uuid(), intent_id: intentId, alpha: "add", target: "bookings",
        scope: "account", value: null,
        context: { id: bookingId, specialistId: draft.specialistId, serviceId: draft.serviceId,
                   serviceName: draft.serviceName, slotId: draft.slotId, price: draft.price,
                   date: slot.date, startTime: slot.startTime,
                   status: "confirmed", createdAt: now },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: describeEffect(intentId, "add", { serviceName: draft.serviceName, date: slot.date, startTime: slot.startTime }), time: ts(),
      });

      effects.push({
        id: uuid(), intent_id: intentId, alpha: "replace", target: "slot.status",
        scope: "shared", value: "booked",
        context: { id: draft.slotId },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: `🔒 Слот забронирован`, time: ts(),
      });

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

      effects.push({
        id: uuid(), intent_id: intentId, alpha: "replace", target: "slot.status",
        scope: "shared", value: "free",
        context: { id: booking.slotId },
        parent_id: null, status: "proposed", ttl: null, created_at: now,
        desc: `🔓 Слот освобождён`, time: ts(),
      });
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

      if (draft.slotId) {
        effects.push({
          id: uuid(), intent_id: intentId, alpha: "replace", target: "slot.status",
          scope: "shared", value: "free",
          context: { id: draft.slotId },
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

    setEffects(prev => [...prev, ...built]);

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
