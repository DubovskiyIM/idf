import { useState, useMemo, useCallback } from "react";

const INTENTS = {
  add_task: {
    name: "Добавить задачу", particles: {
      entities: ["task: Task"], conditions: [],
      effects: [{ α: "add", target: "tasks", σ: "account" }],
      witnesses: ["tasks.count"], confirmation: "click"
    }, antagonist: null, creates: "Task"
  },
  complete_task: {
    name: "Завершить задачу", particles: {
      entities: ["task: Task"], conditions: ["task.status = 'pending'"],
      effects: [{ α: "replace", target: "task.status", value: "completed", σ: "account" }],
      witnesses: ["task.title"], confirmation: "click"
    }, antagonist: "uncomplete_task", creates: null
  },
  uncomplete_task: {
    name: "Вернуть в работу", particles: {
      entities: ["task: Task"], conditions: ["task.status = 'completed'"],
      effects: [{ α: "replace", target: "task.status", value: "pending", σ: "account" }],
      witnesses: ["task.title"], confirmation: "click"
    }, antagonist: "complete_task", creates: null
  },
  delete_task: {
    name: "Удалить задачу", particles: {
      entities: ["task: Task"], conditions: [],
      effects: [{ α: "remove", target: "tasks", σ: "account" }],
      witnesses: ["task.title"], confirmation: "click"
    }, antagonist: null, creates: null, irreversibility: "high"
  },
  edit_task: {
    name: "Переименовать", particles: {
      entities: ["task: Task"], conditions: [],
      effects: [{ α: "replace", target: "task.title", σ: "account" }],
      witnesses: ["task.title (текущее)"], confirmation: "click"
    }, antagonist: null, creates: null, phase: "investigation"
  }
};

const PROJECTIONS = {
  task_list: { name: "Список задач", query: "все задачи, сортировка по дате", witnesses: ["title", "status", "createdAt"] },
  task_stats: { name: "Статистика", query: "количество по статусам", witnesses: ["pending.count", "completed.count"] }
};

function deriveLinks() {
  const links = [];
  const ids = Object.keys(INTENTS);
  for (const id of ids) {
    const i = INTENTS[id];
    if (i.antagonist) links.push({ type: "⇌", from: id, to: i.antagonist, label: "антагонист" });
    if (i.creates) {
      for (const id2 of ids) {
        if (id2 !== id && INTENTS[id2].particles.conditions.length > 0)
          links.push({ type: "▷", from: id, to: id2, label: "последоват." });
      }
    }
  }
  const seen = new Set();
  return links.filter(l => { const k = [l.from, l.to, l.type].sort().join("|"); if (seen.has(k)) return false; seen.add(k); return true; });
}

let eid = 0;
const ts = () => { const d = new Date(); return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 2 }); };

const PARTICLE_COLORS = { entities: "#60a5fa", conditions: "#f59e0b", effects: "#34d399", witnesses: "#a78bfa", confirmation: "#f472b6" };
const ALPHA_LABELS = { add: "add", replace: "replace", remove: "remove" };
const LINK_COLORS = { "⇌": "#f472b6", "▷": "#60a5fa" };

export default function App() {
  const [tasks, setTasks] = useState([
    { id: "t1", title: "Прочитать манифест v0.3", status: "pending", createdAt: Date.now() - 3600000 },
    { id: "t2", title: "Определить домен прототипа", status: "completed", createdAt: Date.now() - 7200000 }
  ]);
  const [log, setLog] = useState([]);
  const [signals, setSignals] = useState([]);
  const [input, setInput] = useState("");
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [tab, setTab] = useState("intents");

  const stats = useMemo(() => ({ total: tasks.length, pending: tasks.filter(t => t.status === "pending").length, completed: tasks.filter(t => t.status === "completed").length }), [tasks]);
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
        const t = { id: `t_${Date.now()}`, title: ctx.title.trim(), status: "pending", createdAt: Date.now() };
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
        setEditId(null);
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
    }
    return true;
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0c0e14", color: "#c9cdd4", fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', monospace", fontSize: 13, overflow: "hidden" }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #1e2230", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e5eb", letterSpacing: "0.02em" }}>Intent-Driven Frontend</span>
        <span style={{ fontSize: 11, color: "#f59e0b", background: "#f59e0b18", padding: "2px 8px", borderRadius: 4, border: "1px solid #f59e0b30" }}>prototype 0.1</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "#6b7280" }}>{Object.keys(INTENTS).length} намерений · {Object.keys(PROJECTIONS).length} проекции · {links.length} связей</span>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* LEFT: Source panel */}
        <div style={{ width: 340, borderRight: "1px solid #1e2230", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ display: "flex", borderBottom: "1px solid #1e2230" }}>
            {["intents", "algebra"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "8px 0", background: tab === t ? "#161923" : "transparent", color: tab === t ? "#e2e5eb" : "#6b7280", border: "none", cursor: "pointer", fontSize: 12, borderBottom: tab === t ? "2px solid #f59e0b" : "2px solid transparent" }}>
                {t === "intents" ? "Намерения" : "Алгебра"}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            {tab === "intents" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Определения намерений</div>
                {Object.entries(INTENTS).map(([id, intent]) => (
                  <div key={id} style={{ background: "#13151d", borderRadius: 6, padding: 10, border: "1px solid #1e2230" }}>
                    <div style={{ fontWeight: 600, color: "#e2e5eb", marginBottom: 6, fontSize: 12 }}>{intent.name} <span style={{ color: "#4b5068", fontWeight: 400 }}>({id})</span></div>
                    {Object.entries(intent.particles).map(([pName, pVal]) => {
                      const vals = Array.isArray(pVal) ? pVal : [pVal];
                      if (vals.length === 0 && pName !== "effects") return null;
                      return (
                        <div key={pName} style={{ marginBottom: 3, display: "flex", gap: 6, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 10, color: PARTICLE_COLORS[pName] || "#6b7280", minWidth: 75, flexShrink: 0, paddingTop: 1 }}>{pName}</span>
                          <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>
                            {pName === "effects" ? vals.map((e, i) => (
                              <span key={i} style={{ display: "inline-block", background: "#34d39915", color: "#34d399", padding: "1px 5px", borderRadius: 3, marginRight: 3, fontSize: 10 }}>{ALPHA_LABELS[e.α]} {e.target}</span>
                            )) : vals.map((v, i) => (
                              <span key={i}>{typeof v === "object" ? JSON.stringify(v) : v}{i < vals.length - 1 ? ", " : ""}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {intent.antagonist && <div style={{ marginTop: 4, fontSize: 10, color: "#f472b6" }}>⇌ {intent.antagonist}</div>}
                  </div>
                ))}
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 8, marginBottom: 4 }}>Проекции</div>
                {Object.entries(PROJECTIONS).map(([id, proj]) => (
                  <div key={id} style={{ background: "#13151d", borderRadius: 6, padding: 10, border: "1px solid #1e2230" }}>
                    <div style={{ fontWeight: 600, color: "#e2e5eb", marginBottom: 4, fontSize: 12 }}>{proj.name}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Q: {proj.query}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Автовыведенные связи</div>
                {links.map((l, i) => (
                  <div key={i} style={{ background: "#13151d", borderRadius: 6, padding: 10, border: "1px solid #1e2230", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#e2e5eb" }}>{INTENTS[l.from]?.name}</span>
                    <span style={{ color: LINK_COLORS[l.type], fontWeight: 700, fontSize: 14 }}>{l.type}</span>
                    <span style={{ fontSize: 11, color: "#e2e5eb" }}>{INTENTS[l.to]?.name}</span>
                    <span style={{ fontSize: 10, color: "#6b7280", marginLeft: "auto" }}>{l.label}</span>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8, lineHeight: 1.5 }}>
                  Связи выведены из пересечения частиц. Антагонисты определяют кнопки отмены. Последовательные связи — граф доступности.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Crystallized app */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ padding: "8px 16px", borderBottom: "1px solid #1e2230", display: "flex", alignItems: "center", gap: 8, background: "#10121a" }}>
            <span style={{ fontSize: 10, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.1em" }}>кристаллизованный UI</span>
            <span style={{ fontSize: 10, color: "#4b5068" }}>— выведен из {Object.keys(INTENTS).length} намерений, ни один компонент не написан вручную</span>
          </div>
          <div style={{ flex: 1, overflow: "auto", background: "#fafafa", color: "#1a1a2e" }}>
            <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
              {/* Projection: task_stats */}
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Всего", val: stats.total, color: "#6366f1" },
                  { label: "В работе", val: stats.pending, color: "#f59e0b" },
                  { label: "Готово", val: stats.completed, color: "#22c55e" }
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, background: "#fff", borderRadius: 8, padding: "12px 16px", boxShadow: "0 1px 3px #0001", border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "system-ui, sans-serif" }}>{s.val}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "system-ui, sans-serif" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Intent: add_task (entry point — creates entity) */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { exec("add_task", { title: input }); setInput(""); } }}
                  placeholder="Новая задача..." style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "system-ui, sans-serif", outline: "none", background: "#fff" }} />
                <button onClick={() => { exec("add_task", { title: input }); setInput(""); }}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 14, fontFamily: "system-ui, sans-serif", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                  + Добавить
                </button>
              </div>

              {/* Projection: task_list — with applicable intents per item */}
              {tasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontFamily: "system-ui, sans-serif", fontSize: 14 }}>Нет задач. Добавьте первую.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {tasks.sort((a, b) => b.createdAt - a.createdAt).map(task => {
                    const done = task.status === "completed";
                    const canComplete = isApplicable("complete_task", { task });
                    const canUncomplete = isApplicable("uncomplete_task", { task });
                    const isEditing = editId === task.id;
                    return (
                      <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 8, padding: "10px 14px", boxShadow: "0 1px 2px #0001", border: "1px solid #e5e7eb", transition: "all 0.15s" }}>
                        {/* Antagonist pair: complete ⇌ uncomplete — auto-derived */}
                        <button onClick={() => exec(done ? "uncomplete_task" : "complete_task", { id: task.id })}
                          title={done ? "Вернуть в работу (⇌ антагонист)" : "Завершить"}
                          style={{ width: 22, height: 22, borderRadius: 6, border: done ? "2px solid #22c55e" : "2px solid #d1d5db", background: done ? "#22c55e" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", fontSize: 12, color: "#fff" }}>
                          {done ? "✓" : ""}
                        </button>

                        {isEditing ? (
                          <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") exec("edit_task", { id: task.id, newTitle: editVal }); if (e.key === "Escape") setEditId(null); }}
                            onBlur={() => { if (editVal.trim()) exec("edit_task", { id: task.id, newTitle: editVal }); else setEditId(null); }}
                            style={{ flex: 1, padding: "4px 8px", borderRadius: 4, border: "1px solid #6366f1", fontSize: 14, fontFamily: "system-ui, sans-serif", outline: "none" }} />
                        ) : (
                          <span onDoubleClick={() => { setEditId(task.id); setEditVal(task.title); }}
                            style={{ flex: 1, fontSize: 14, fontFamily: "system-ui, sans-serif", color: done ? "#9ca3af" : "#1a1a2e", textDecoration: done ? "line-through" : "none", cursor: "default", userSelect: "none" }}>
                            {task.title}
                          </span>
                        )}

                        {/* Intent: delete_task — always applicable */}
                        <button onClick={() => exec("delete_task", { id: task.id })}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 16, padding: "2px 4px", borderRadius: 4, lineHeight: 1 }}
                          onMouseEnter={e => e.target.style.color = "#ef4444"} onMouseLeave={e => e.target.style.color = "#d1d5db"}>
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ marginTop: 16, fontSize: 11, color: "#9ca3af", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
                Двойной клик — редактировать · Чекбокс — завершить/вернуть (⇌ антагонист)
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Effect stream */}
        <div style={{ width: 300, borderLeft: "1px solid #1e2230", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #1e2230", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Поток эффектов Φ</div>
          <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {log.length === 0 ? (
              <div style={{ padding: 16, color: "#4b5068", fontSize: 11, textAlign: "center" }}>Пусто. Выполните намерение.</div>
            ) : log.map(e => (
              <div key={e.id} style={{ padding: "6px 8px", marginBottom: 4, borderRadius: 4, background: "#13151d", border: "1px solid #1e2230", fontSize: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ color: { add: "#34d399", replace: "#60a5fa", remove: "#f87171" }[e.α] || "#9ca3af" }}>
                    {e.α}
                  </span>
                  <span style={{ color: "#22c55e", fontSize: 10 }}>● confirmed</span>
                </div>
                <div style={{ color: "#c9cdd4" }}>{e.desc}</div>
                <div style={{ color: "#4b5068", fontSize: 10, marginTop: 2 }}>ε: {e.intentId} · {e.time}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #1e2230" }}>
            <div style={{ padding: "8px 12px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Сигналы Σ</div>
            <div style={{ maxHeight: 120, overflow: "auto", padding: "0 8px 8px" }}>
              {signals.length === 0 ? (
                <div style={{ padding: 8, color: "#4b5068", fontSize: 11, textAlign: "center" }}>Нет сигналов</div>
              ) : signals.map(s => (
                <div key={s.id} style={{ padding: "4px 8px", marginBottom: 3, borderRadius: 4, background: "#1a0e20", border: "1px solid #2d1a3e", fontSize: 10 }}>
                  <span style={{ color: "#a78bfa" }}>{s.κ}</span>
                  <span style={{ color: "#7c6f9b", marginLeft: 6 }}>{s.desc}</span>
                  <span style={{ color: "#4b3d66", marginLeft: 6 }}>{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
