import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { v4 as uuid } from "uuid";
import { INTENTS } from "./intents.js";
import { deriveLinks } from "./links.js";
import { fold, filterByStatus } from "./fold.js";

const ts = () => {
  const d = new Date();
  return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 2 });
};

// Описания эффектов для лога
function describeEffect(intentId, alpha, ctx) {
  switch (intentId) {
    case "add_task": return `+ "${ctx.title}"`;
    case "complete_task": return `✓ "${ctx.title || ctx.id}" → completed`;
    case "uncomplete_task": return `↩ "${ctx.title || ctx.id}" → pending`;
    case "delete_task": return `✕ "${ctx.title || ctx.id}"`;
    case "edit_task": return `✎ "${ctx.title || ctx.id}" → "${ctx.newTitle}"`;
    case "pin_task": return `📌 "${ctx.title || ctx.id}" закреплена`;
    case "unpin_task": return `📌 "${ctx.title || ctx.id}" откреплена`;
    case "set_priority": return `⚡ "${ctx.title || ctx.id}" → приоритет ${ctx.priority}`;
    case "duplicate_task": return `⧉ "${ctx.title || ctx.id}" → дубликат`;
    case "archive_task": return `📦 "${ctx.title || ctx.id}" → архив`;
    default: return `${alpha} ${intentId}`;
  }
}

// Какой сигнал эмитировать при confirmed
function signalForIntent(intentId) {
  switch (intentId) {
    case "add_task": return { κ: "analytics", desc: "task_created" };
    case "duplicate_task": return { κ: "analytics", desc: "task_duplicated" };
    case "delete_task": return { κ: "notification", desc: "Задача удалена" };
    case "archive_task": return { κ: "notification", desc: "Задача архивирована" };
    default: return null;
  }
}

// Построить объект эффекта из намерения
function buildEffect(intentId, ctx, world) {
  const intent = INTENTS[intentId];
  if (!intent) return null;

  const ef = intent.particles.effects[0];
  const id = uuid();
  const now = Date.now();

  const effect = {
    id,
    intent_id: intentId,
    alpha: ef.α,
    target: ef.target,
    scope: ef.σ || "account",
    parent_id: null,
    status: "proposed",
    ttl: null,
    created_at: now,
    resolved_at: null,
    desc: describeEffect(intentId, ef.α, ctx),
    time: ts(),
  };

  switch (intentId) {
    case "add_task": {
      if (!ctx.title?.trim()) return null;
      const taskId = `t_${now}`;
      effect.value = null;
      effect.context = { id: taskId, title: ctx.title.trim(), status: "pending", priority: null, pinned: false, createdAt: now };
      break;
    }
    case "complete_task": {
      const t = world.find(x => x.id === ctx.id);
      if (!t || t.status !== "pending") return null;
      effect.value = "completed";
      effect.context = { id: ctx.id, title: t.title };
      break;
    }
    case "uncomplete_task": {
      const t = world.find(x => x.id === ctx.id);
      if (!t || t.status !== "completed") return null;
      effect.value = "pending";
      effect.context = { id: ctx.id, title: t.title };
      break;
    }
    case "delete_task": {
      const t = world.find(x => x.id === ctx.id);
      if (!t) return null;
      effect.context = { id: ctx.id, title: t.title };
      effect.value = null;
      break;
    }
    case "edit_task": {
      const t = world.find(x => x.id === ctx.id);
      if (!t || !ctx.newTitle?.trim()) return null;
      effect.value = ctx.newTitle.trim();
      effect.context = { id: ctx.id, title: t.title, newTitle: ctx.newTitle.trim() };
      break;
    }
    case "pin_task": {
      const t = world.find(x => x.id === ctx.id);
      if (!t || t.pinned) return null;
      effect.value = true;
      effect.context = { id: ctx.id, title: t.title };
      break;
    }
    case "unpin_task": {
      const t = world.find(x => x.id === ctx.id);
      if (!t || !t.pinned) return null;
      effect.value = false;
      effect.context = { id: ctx.id, title: t.title };
      break;
    }
    case "set_priority": {
      const t = world.find(x => x.id === ctx.id);
      if (!t) return null;
      effect.value = ctx.priority;
      effect.context = { id: ctx.id, title: t.title, priority: ctx.priority };
      break;
    }
    case "duplicate_task": {
      const t = world.find(x => x.id === ctx.id);
      if (!t) return null;
      const dupId = `t_${now}`;
      effect.value = null;
      effect.context = { id: dupId, title: `${t.title} (копия)`, status: "pending", priority: t.priority || null, pinned: false, createdAt: now };
      break;
    }
    case "archive_task": {
      const t = world.find(x => x.id === ctx.id);
      if (!t || t.status !== "completed") return null;
      effect.value = "archived";
      effect.context = { id: ctx.id, title: t.title };
      break;
    }
    default:
      return null;
  }

  return effect;
}

export function useEngine() {
  const [effects, setEffects] = useState([]);
  const [signals, setSignals] = useState([]);
  const signalsRef = useRef(signals);
  signalsRef.current = signals;

  // Загрузить эффекты с сервера при монтировании
  useEffect(() => {
    fetch("/api/effects")
      .then(r => r.json())
      .then(data => {
        // Добавить desc и time к загруженным эффектам
        setEffects(data.map(ef => ({
          ...ef,
          desc: ef.desc || describeEffect(ef.intent_id, ef.alpha, ef.context || {}),
          time: ef.time || new Date(ef.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        })));
      })
      .catch(() => {}); // сервер недоступен — работаем локально
  }, []);

  // SSE-подписка
  useEffect(() => {
    const es = new EventSource("/api/effects/stream");

    es.addEventListener("effect:confirmed", (e) => {
      const { id } = JSON.parse(e.data);
      setEffects(prev => {
        const updated = prev.map(ef =>
          ef.id === id ? { ...ef, status: "confirmed", resolved_at: Date.now() } : ef
        );
        // Эмитировать сигнал при confirmed
        const ef = updated.find(x => x.id === id);
        if (ef) {
          const sig = signalForIntent(ef.intent_id);
          if (sig) {
            setSignals(p => [{ id: uuid(), κ: sig.κ, desc: sig.desc, time: ts(), effectId: id }, ...p].slice(0, 20));
          }
        }
        return updated;
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

    es.onerror = () => {};

    return () => es.close();
  }, []);

  // Два мира: оптимистичный и канонический
  const worldOptimistic = useMemo(
    () => fold(filterByStatus(effects, "confirmed", "proposed")),
    [effects]
  );
  const worldConfirmed = useMemo(
    () => fold(filterByStatus(effects, "confirmed")),
    [effects]
  );

  const stats = useMemo(() => ({
    total: worldOptimistic.length,
    pending: worldOptimistic.filter(t => t.status === "pending").length,
    completed: worldOptimistic.filter(t => t.status === "completed").length,
  }), [worldOptimistic]);

  const links = useMemo(deriveLinks, []);

  const exec = useCallback((intentId, ctx = {}) => {
    const effect = buildEffect(intentId, ctx, worldOptimistic);
    if (!effect) return;

    // Оптимистично добавляем в локальный Φ
    setEffects(prev => [...prev, effect]);

    // Отправляем на сервер
    fetch("/api/effects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(effect),
    }).catch(() => {
      // Сервер недоступен — подтверждаем локально
      setEffects(prev => prev.map(ef =>
        ef.id === effect.id ? { ...ef, status: "confirmed", resolved_at: Date.now() } : ef
      ));
      const sig = signalForIntent(intentId);
      if (sig) {
        setSignals(p => [{ id: uuid(), κ: sig.κ, desc: sig.desc, time: ts(), effectId: effect.id }, ...p].slice(0, 20));
      }
    });
  }, [worldOptimistic]);

  const isApplicable = useCallback((intentId, ctx) => {
    const i = INTENTS[intentId];
    if (!i) return false;
    for (const c of i.particles.conditions) {
      if (c === "task.status = 'pending'" && ctx.task?.status !== "pending") return false;
      if (c === "task.status = 'completed'" && ctx.task?.status !== "completed") return false;
      if (c === "task.pinned = false" && ctx.task?.pinned !== false) return false;
      if (c === "task.pinned = true" && ctx.task?.pinned !== true) return false;
    }
    return true;
  }, []);

  return {
    world: worldOptimistic,
    worldConfirmed,
    effects,
    signals,
    stats,
    links,
    exec,
    isApplicable,
  };
}
