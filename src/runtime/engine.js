import { useState, useMemo, useCallback } from "react";
import { INTENTS } from "./intents.js";
import { deriveLinks } from "./links.js";

let eid = 0;
const ts = () => {
  const d = new Date();
  return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 2 });
};

export function useEngine() {
  const [tasks, setTasks] = useState([
    { id: "t1", title: "Прочитать манифест v0.3", status: "pending", priority: null, pinned: false, createdAt: Date.now() - 3600000 },
    { id: "t2", title: "Определить домен прототипа", status: "completed", priority: null, pinned: false, createdAt: Date.now() - 7200000 }
  ]);
  const [log, setLog] = useState([]);
  const [signals, setSignals] = useState([]);

  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    completed: tasks.filter(t => t.status === "completed").length
  }), [tasks]);

  const links = useMemo(deriveLinks, []);

  const pushLog = useCallback((intentId, α, desc) => {
    setLog(p => [{ id: ++eid, intentId, α, desc, time: ts(), status: "confirmed" }, ...p].slice(0, 40));
  }, []);

  const pushSignal = useCallback((κ, desc) => {
    setSignals(p => [{ id: ++eid, κ, desc, time: ts() }, ...p].slice(0, 20));
  }, []);

  const exec = useCallback((intentId, ctx = {}) => {
    switch (intentId) {
      case "add_task": {
        if (!ctx.title?.trim()) return;
        const t = { id: `t_${Date.now()}`, title: ctx.title.trim(), status: "pending", priority: null, pinned: false, createdAt: Date.now() };
        setTasks(p => [t, ...p]);
        pushLog(intentId, "add", `+ "${t.title}"`);
        pushSignal("analytics", "task_created");
        break;
      }
      case "complete_task": {
        const t = tasks.find(x => x.id === ctx.id);
        if (!t || t.status !== "pending") return;
        setTasks(p => p.map(x => x.id === ctx.id ? { ...x, status: "completed" } : x));
        pushLog(intentId, "replace", `✓ "${t.title}" → completed`);
        break;
      }
      case "uncomplete_task": {
        const t = tasks.find(x => x.id === ctx.id);
        if (!t || t.status !== "completed") return;
        setTasks(p => p.map(x => x.id === ctx.id ? { ...x, status: "pending" } : x));
        pushLog(intentId, "replace", `↩ "${t.title}" → pending`);
        break;
      }
      case "delete_task": {
        const t = tasks.find(x => x.id === ctx.id);
        if (!t) return;
        setTasks(p => p.filter(x => x.id !== ctx.id));
        pushLog(intentId, "remove", `✕ "${t.title}"`);
        pushSignal("notification", `Задача "${t.title}" удалена`);
        break;
      }
      case "edit_task": {
        const t = tasks.find(x => x.id === ctx.id);
        if (!t || !ctx.newTitle?.trim()) return;
        setTasks(p => p.map(x => x.id === ctx.id ? { ...x, title: ctx.newTitle.trim() } : x));
        pushLog(intentId, "replace", `✎ "${t.title}" → "${ctx.newTitle.trim()}"`);
        break;
      }
      case "pin_task": {
        const t = tasks.find(x => x.id === ctx.id);
        if (!t || t.pinned) return;
        setTasks(p => p.map(x => x.id === ctx.id ? { ...x, pinned: true } : x));
        pushLog(intentId, "replace", `📌 "${t.title}" закреплена`);
        break;
      }
      case "unpin_task": {
        const t = tasks.find(x => x.id === ctx.id);
        if (!t || !t.pinned) return;
        setTasks(p => p.map(x => x.id === ctx.id ? { ...x, pinned: false } : x));
        pushLog(intentId, "replace", `📌 "${t.title}" откреплена`);
        break;
      }
      case "set_priority": {
        const t = tasks.find(x => x.id === ctx.id);
        if (!t || !ctx.priority) return;
        setTasks(p => p.map(x => x.id === ctx.id ? { ...x, priority: ctx.priority } : x));
        pushLog(intentId, "replace", `⚡ "${t.title}" → приоритет ${ctx.priority}`);
        break;
      }
      case "duplicate_task": {
        const t = tasks.find(x => x.id === ctx.id);
        if (!t) return;
        const dup = { id: `t_${Date.now()}`, title: `${t.title} (копия)`, status: "pending", priority: t.priority || null, pinned: false, createdAt: Date.now() };
        setTasks(p => [dup, ...p]);
        pushLog(intentId, "add", `⧉ "${t.title}" → дубликат`);
        pushSignal("analytics", "task_duplicated");
        break;
      }
      case "archive_task": {
        const t = tasks.find(x => x.id === ctx.id);
        if (!t || t.status !== "completed") return;
        setTasks(p => p.map(x => x.id === ctx.id ? { ...x, status: "archived" } : x));
        pushLog(intentId, "replace", `📦 "${t.title}" → архив`);
        pushSignal("notification", `Задача "${t.title}" архивирована`);
        break;
      }
    }
  }, [tasks, pushLog, pushSignal]);

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

  return { tasks, log, signals, stats, links, exec, isApplicable };
}
