import { useState } from "react";

/*
 * Кристаллизованная проекция: task_list
 * Источник: PROJECTIONS.task_list — query: "все задачи, сортировка по дате"
 * Свидетельства: title, status, createdAt
 *
 * Намерения, материализованные в этой проекции (10):
 *   add_task        — форма добавления (creates: Task)
 *   complete_task   — чекбокс (⇌ uncomplete_task)
 *   uncomplete_task — чекбокс (⇌ complete_task)
 *   delete_task     — кнопка × (irreversibility: high)
 *   edit_task       — двойной клик (phase: investigation)
 *   pin_task        — кнопка 📌 (⇌ unpin_task)
 *   unpin_task      — кнопка 📌 (⇌ pin_task)
 *   set_priority    — селектор приоритета (phase: investigation)
 *   duplicate_task  — кнопка ⧉ (creates: Task)
 *   archive_task    — кнопка 📦 (условие: completed, irreversibility: medium)
 */

const PRIORITY_COLORS = {
  high: { bg: "#fef2f2", border: "#fecaca", dot: "#ef4444", label: "Высокий" },
  medium: { bg: "#fffbeb", border: "#fed7aa", dot: "#f59e0b", label: "Средний" },
  low: { bg: "#f0fdf4", border: "#bbf7d0", dot: "#22c55e", label: "Низкий" },
};

export default function TaskListProjection({ world, exec, isApplicable, effects }) {
  const [input, setInput] = useState("");
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [priorityOpenId, setPriorityOpenId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  // Найти proposed-эффекты для сущности
  const proposedFor = (taskId) =>
    (effects || []).some(e => e.status === "proposed" && e.context?.id === taskId);

  const active = world.filter(t => t.status !== "archived");
  const archived = world.filter(t => t.status === "archived");

  // Закреплённые сверху, затем по дате — вытекает из pin_task + query
  const sorted = [...active].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <div>
      {/* Намерение: add_task — точка входа, creates: Task */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { exec("add_task", { title: input }); setInput(""); } }}
          placeholder="Новая задача..."
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "system-ui, sans-serif", outline: "none", background: "#fff" }} />
        <button onClick={() => { exec("add_task", { title: input }); setInput(""); }}
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 14, fontFamily: "system-ui, sans-serif", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
          + Добавить
        </button>
      </div>

      {/* Проекция: task_list — с применимыми намерениями на каждом элементе */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontFamily: "system-ui, sans-serif", fontSize: 14 }}>Нет задач. Добавьте первую.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map(task => {
            const done = task.status === "completed";
            const isEditing = editId === task.id;
            const pc = task.priority ? PRIORITY_COLORS[task.priority] : null;
            const isPriorityOpen = priorityOpenId === task.id;

            return (
              <div key={task.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: pc ? pc.bg : "#fff",
                borderRadius: 8, padding: "10px 14px",
                boxShadow: "0 1px 2px #0001",
                border: `1px solid ${pc ? pc.border : "#e5e7eb"}`,
                borderLeft: task.pinned ? "3px solid #ec4899" : undefined,
                transition: "all 0.15s",
                opacity: proposedFor(task.id) ? 0.6 : 1,
              }}>
                {/* Антагонист: complete ⇌ uncomplete */}
                <button onClick={() => exec(done ? "uncomplete_task" : "complete_task", { id: task.id })}
                  title={done ? "Вернуть в работу (⇌ антагонист)" : "Завершить"}
                  style={{ width: 22, height: 22, borderRadius: 6, border: done ? "2px solid #22c55e" : "2px solid #d1d5db", background: done ? "#22c55e" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", fontSize: 12, color: "#fff" }}>
                  {done ? "✓" : ""}
                </button>

                {/* Намерение: edit_task — phase: investigation (двойной клик) */}
                {isEditing ? (
                  <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { exec("edit_task", { id: task.id, newTitle: editVal }); setEditId(null); } if (e.key === "Escape") setEditId(null); }}
                    onBlur={() => { if (editVal.trim()) { exec("edit_task", { id: task.id, newTitle: editVal }); setEditId(null); } else setEditId(null); }}
                    style={{ flex: 1, padding: "4px 8px", borderRadius: 4, border: "1px solid #6366f1", fontSize: 14, fontFamily: "system-ui, sans-serif", outline: "none" }} />
                ) : (
                  <span onDoubleClick={() => { setEditId(task.id); setEditVal(task.title); }}
                    style={{ flex: 1, fontSize: 14, fontFamily: "system-ui, sans-serif", color: done ? "#9ca3af" : "#1a1a2e", textDecoration: done ? "line-through" : "none", cursor: "default", userSelect: "none" }}>
                    {task.title}
                  </span>
                )}

                {/* Свидетельство: приоритет (цветная точка) */}
                {pc && <span style={{ width: 8, height: 8, borderRadius: "50%", background: pc.dot, flexShrink: 0 }} title={`Приоритет: ${pc.label}`} />}

                {/* Намерение: set_priority — phase: investigation (селектор) */}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setPriorityOpenId(isPriorityOpen ? null : task.id)}
                    title="Установить приоритет"
                    style={{ background: "none", border: "none", cursor: "pointer", color: task.priority ? PRIORITY_COLORS[task.priority].dot : "#d1d5db", fontSize: 13, padding: "2px 4px", borderRadius: 4, lineHeight: 1 }}>
                    ⚡
                  </button>
                  {isPriorityOpen && (
                    <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 10, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, boxShadow: "0 4px 12px #0002", padding: 4, minWidth: 120 }}>
                      {[{ key: "high", label: "Высокий" }, { key: "medium", label: "Средний" }, { key: "low", label: "Низкий" }, { key: null, label: "Без приоритета" }].map(p => (
                        <button key={p.key || "none"} onClick={() => { exec("set_priority", { id: task.id, priority: p.key }); setPriorityOpenId(null); }}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", border: "none", background: task.priority === p.key ? "#f3f4f6" : "transparent", cursor: "pointer", fontSize: 12, fontFamily: "system-ui, sans-serif", borderRadius: 4, color: "#1a1a2e" }}>
                          {p.key && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLORS[p.key]?.dot, marginRight: 6, verticalAlign: "middle" }} />}
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Антагонист: pin_task ⇌ unpin_task */}
                <button onClick={() => exec(task.pinned ? "unpin_task" : "pin_task", { id: task.id })}
                  title={task.pinned ? "Открепить (⇌ антагонист)" : "Закрепить"}
                  style={{ background: "none", border: "none", cursor: "pointer", color: task.pinned ? "#ec4899" : "#d1d5db", fontSize: 13, padding: "2px 4px", borderRadius: 4, lineHeight: 1 }}>
                  📌
                </button>

                {/* Намерение: duplicate_task — creates: Task */}
                <button onClick={() => exec("duplicate_task", { id: task.id })}
                  title="Дублировать"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 13, padding: "2px 4px", borderRadius: 4, lineHeight: 1 }}
                  onMouseEnter={e => e.target.style.color = "#6366f1"} onMouseLeave={e => e.target.style.color = "#d1d5db"}>
                  ⧉
                </button>

                {/* Намерение: archive_task — условие: completed, irreversibility: medium */}
                {done && (
                  <button onClick={() => exec("archive_task", { id: task.id })}
                    title="Архивировать (необратимость: medium)"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 13, padding: "2px 4px", borderRadius: 4, lineHeight: 1 }}
                    onMouseEnter={e => e.target.style.color = "#8b5cf6"} onMouseLeave={e => e.target.style.color = "#d1d5db"}>
                    📦
                  </button>
                )}

                {/* Намерение: delete_task — irreversibility: high */}
                <button onClick={() => exec("delete_task", { id: task.id })}
                  title="Удалить (необратимость: high)"
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
        Двойной клик — редактировать · ⚡ приоритет · 📌 закрепить · ⧉ дублировать · 📦 архивировать
      </div>

      {/* Архивированные задачи — отдельная секция */}
      {archived.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button onClick={() => setShowArchived(!showArchived)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontFamily: "system-ui, sans-serif", color: "#8b5cf6", padding: 0 }}>
            {showArchived ? "▾" : "▸"} Архив ({archived.length})
          </button>
          {showArchived && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              {archived.map(task => (
                <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#f9fafb", borderRadius: 8, padding: "8px 14px", border: "1px solid #e5e7eb", opacity: 0.6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid #8b5cf6", background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, color: "#fff" }}>✓</span>
                  <span style={{ flex: 1, fontSize: 14, fontFamily: "system-ui, sans-serif", color: "#9ca3af", textDecoration: "line-through" }}>{task.title}</span>
                  <span style={{ fontSize: 10, color: "#8b5cf6" }}>📦 архив</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
