import { useMemo } from "react";

/*
 * Кристаллизованная проекция: task_stats
 * Источник: PROJECTIONS.task_stats — query: "количество по статусам"
 * Свидетельства: pending.count, completed.count
 * Расширено под 10 намерений: добавлены archived, pinned, priority
 */
export default function TaskStatsProjection({ world }) {
  const stats = useMemo(() => {
    const active = world.filter(t => t.status !== "archived");
    return {
      total: active.length,
      pending: world.filter(t => t.status === "pending").length,
      completed: world.filter(t => t.status === "completed").length,
      archived: world.filter(t => t.status === "archived").length,
      pinned: world.filter(t => t.pinned && t.status !== "archived").length,
      withPriority: world.filter(t => t.priority && t.status !== "archived").length,
    };
  }, [world]);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        {[
          { label: "Активных", val: stats.total, color: "#6366f1" },
          { label: "В работе", val: stats.pending, color: "#f59e0b" },
          { label: "Готово", val: stats.completed, color: "#22c55e" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: "#fff", borderRadius: 8, padding: "12px 16px", boxShadow: "0 1px 3px #0001", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "system-ui, sans-serif" }}>{s.val}</div>
            <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "system-ui, sans-serif" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { label: "В архиве", val: stats.archived, color: "#8b5cf6" },
          { label: "Закреплено", val: stats.pinned, color: "#ec4899" },
          { label: "С приоритетом", val: stats.withPriority, color: "#ef4444" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: "#fff", borderRadius: 8, padding: "8px 12px", boxShadow: "0 1px 3px #0001", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color, fontFamily: "system-ui, sans-serif" }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "system-ui, sans-serif" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
