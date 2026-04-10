/*
 * Кристаллизованная проекция: specialist_schedule
 * Источник: PROJECTIONS.specialist_schedule — query: "слоты специалиста на выбранную неделю со статусами"
 * Свидетельства: date, startTime, endTime, status
 *
 * Намерения, материализованные в этой проекции:
 *   select_slot  — кнопка «Выбрать» на свободных слотах (TTL: held 10 мин)
 *   block_slot   — кнопка «Блокировать» (специалист/админ)
 *
 * Онтология:
 *   TimeSlot — mirror: id, specialistId, date, startTime, endTime, status {free, held, booked, blocked}
 */

import { useState, useMemo } from "react";

const STATUS_COLORS = {
  free: { bg: "#f0fdf4", border: "#bbf7d0", text: "#22c55e", label: "свободен" },
  held: { bg: "#fffbeb", border: "#fed7aa", text: "#f59e0b", label: "удержан" },
  booked: { bg: "#eef2ff", border: "#c7d2fe", text: "#6366f1", label: "забронирован" },
  blocked: { bg: "#f3f4f6", border: "#d1d5db", text: "#6b7280", label: "заблокирован" },
};

export default function SpecialistScheduleProjection({ world, exec, drafts, effects }) {
  const [selectedDate, setSelectedDate] = useState(null);

  const dates = useMemo(() => {
    const all = [...new Set((world.slots || []).map(s => s.date))].sort();
    if (!selectedDate && all.length > 0) setSelectedDate(all[0]);
    return all;
  }, [world.slots]);

  const slotsForDate = useMemo(
    () => (world.slots || []).filter(s => s.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [world.slots, selectedDate]
  );

  const draft = (drafts || [])[0];
  const canSelectSlot = draft && !draft.slotId;

  // Слоты с pending proposed-эффектом
  const proposedSlotIds = new Set(
    (effects || []).filter(e => e.status === "proposed" && e.target === "slot.status").map(e => e.context?.id)
  );

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "system-ui, sans-serif", marginBottom: 16, color: "#1a1a2e" }}>
        Расписание
        {draft && <span style={{ fontSize: 13, fontWeight: 400, color: "#f59e0b", marginLeft: 8 }}>
          выберите слот для: {draft.serviceName} ({draft.duration} мин)
        </span>}
      </h2>

      {/* Переключатель дат */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {dates.map(d => {
          const dt = new Date(d + "T00:00:00");
          const dayName = dt.toLocaleDateString("ru", { weekday: "short" });
          const dayNum = dt.getDate();
          const month = dt.toLocaleDateString("ru", { month: "short" });
          const slotsCount = (world.slots || []).filter(s => s.date === d && s.status === "free").length;
          return (
            <button key={d} onClick={() => setSelectedDate(d)} style={{
              padding: "8px 14px", borderRadius: 8,
              border: selectedDate === d ? "2px solid #6366f1" : "1px solid #e5e7eb",
              background: selectedDate === d ? "#eef2ff" : "#fff",
              cursor: "pointer", fontSize: 12, fontFamily: "system-ui, sans-serif",
              color: selectedDate === d ? "#6366f1" : "#1a1a2e",
              fontWeight: selectedDate === d ? 600 : 400, textAlign: "center", minWidth: 70,
            }}>
              <div>{dayName}</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{dayNum}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>{slotsCount > 0 ? `${slotsCount} своб.` : "нет"}</div>
            </button>
          );
        })}
      </div>

      {/* Сетка слотов */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {slotsForDate.map(slot => {
          const sc = STATUS_COLORS[slot.status] || STATUS_COLORS.free;
          const isProposed = proposedSlotIds.has(slot.id);
          return (
            <div key={slot.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              background: sc.bg, borderRadius: 8, padding: "10px 14px",
              border: `1px solid ${sc.border}`,
              borderLeft: `3px solid ${sc.text}`,
              opacity: slot.status === "blocked" ? 0.5 : isProposed ? 0.6 : 1,
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "system-ui, sans-serif", color: "#1a1a2e", minWidth: 110 }}>
                {slot.startTime} — {slot.endTime}
              </span>
              <span style={{ fontSize: 11, color: sc.text, fontWeight: 600, textTransform: "uppercase", minWidth: 100 }}>
                {sc.label}
              </span>
              {/* TTL индикатор */}
              {slot.status === "held" && (
                <span style={{ fontSize: 10, color: "#f59e0b", fontFamily: "system-ui, sans-serif" }}>
                  TTL 10 мин
                </span>
              )}
              <div style={{ flex: 1 }} />
              {/* Намерение: select_slot — TTL hold */}
              {slot.status === "free" && canSelectSlot && (
                <button onClick={() => exec("select_slot", { slotId: slot.id })}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#22c55e", color: "#fff", fontSize: 12, fontFamily: "system-ui, sans-serif", cursor: "pointer", fontWeight: 600 }}>
                  Выбрать
                </button>
              )}
              {/* Намерение: block_slot — управление расписанием */}
              {slot.status === "free" && !draft && (
                <button onClick={() => exec("block_slot", { slotId: slot.id })}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 12, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
                  Блокировать
                </button>
              )}
            </div>
          );
        })}
        {slotsForDate.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>
            Нет слотов на эту дату
          </div>
        )}
      </div>

      {/* Легенда */}
      <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
        {Object.entries(STATUS_COLORS).map(([status, sc]) => (
          <span key={status} style={{ color: sc.text }}>● {sc.label}</span>
        ))}
      </div>
    </div>
  );
}
