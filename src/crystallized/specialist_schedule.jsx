/*
 * Кристаллизованная проекция: specialist_schedule
 * Источник: PROJECTIONS.specialist_schedule
 * Свидетельства: date, startTime, endTime, status
 *
 * Намерения (4): select_slot (TTL), block_slot, unblock_slot (⇌), reschedule_booking (target)
 * Сущности: TimeSlot (mirror), Booking (internal)
 * Кристаллизовано из 14 намерений · 5 сущностей
 */

import { useState, useMemo } from "react";

const STATUS_CONFIG = {
  free: { bg: "#f0fdf4", border: "#bbf7d0", text: "#22c55e", label: "свободен" },
  held: { bg: "#fffbeb", border: "#fed7aa", text: "#f59e0b", label: "удержан" },
  booked: { bg: "#eef2ff", border: "#c7d2fe", text: "#6366f1", label: "забронирован" },
  blocked: { bg: "#f3f4f6", border: "#d1d5db", text: "#6b7280", label: "заблокирован" },
};

export default function SpecialistScheduleProjection({ world, exec, drafts, effects }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [rescheduleBookingId, setRescheduleBookingId] = useState(null);

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

  // Бронирования для переноса
  const confirmedBookings = (world.bookings || []).filter(b => b.status === "confirmed");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "system-ui, sans-serif", margin: 0, color: "#1a1a2e" }}>
          Расписание
        </h2>
        {draft && (
          <span style={{ fontSize: 12, color: "#f59e0b", fontFamily: "system-ui, sans-serif" }}>
            выберите слот для: {draft.serviceName} ({draft.duration} мин)
          </span>
        )}
        {rescheduleBookingId && (
          <span style={{ fontSize: 12, color: "#8b5cf6", fontFamily: "system-ui, sans-serif" }}>
            выберите новый слот для переноса
            <button onClick={() => setRescheduleBookingId(null)}
              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", marginLeft: 6, fontSize: 12 }}>отмена</button>
          </span>
        )}
        {!draft && !rescheduleBookingId && confirmedBookings.length > 0 && (
          <select onChange={e => { if (e.target.value) setRescheduleBookingId(e.target.value); }}
            value="" style={{ fontSize: 11, padding: "4px 8px", borderRadius: 4, border: "1px solid #d1d5db", color: "#6b7280", fontFamily: "system-ui, sans-serif" }}>
            <option value="">↔ Перенести запись...</option>
            {confirmedBookings.map(b => (
              <option key={b.id} value={b.id}>{b.serviceName} ({b.date} {b.startTime})</option>
            ))}
          </select>
        )}
      </div>

      {/* Переключатель дат */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {dates.map(d => {
          const dt = new Date(d + "T00:00:00");
          const dayName = dt.toLocaleDateString("ru", { weekday: "short" });
          const dayNum = dt.getDate();
          const freeCount = (world.slots || []).filter(s => s.date === d && s.status === "free").length;
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
              <div style={{ fontSize: 10, color: "#6b7280" }}>{freeCount > 0 ? `${freeCount} своб.` : "нет"}</div>
            </button>
          );
        })}
      </div>

      {/* Сетка слотов */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {slotsForDate.map(slot => {
          const sc = STATUS_CONFIG[slot.status] || STATUS_CONFIG.free;
          // Найти бронирование для этого слота
          const booking = (world.bookings || []).find(b => b.slotId === slot.id && b.status !== "cancelled");

          return (
            <div key={slot.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              background: sc.bg, borderRadius: 8, padding: "10px 14px",
              border: `1px solid ${sc.border}`, borderLeft: `3px solid ${sc.text}`,
              opacity: slot.status === "blocked" ? 0.6 : 1,
            }}>
              <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "system-ui, sans-serif", color: "#1a1a2e", minWidth: 110 }}>
                {slot.startTime} — {slot.endTime}
              </span>
              <span style={{ fontSize: 11, color: sc.text, fontWeight: 600, textTransform: "uppercase", minWidth: 100 }}>
                {sc.label}
              </span>
              {/* Инфо о бронировании */}
              {booking && (
                <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "system-ui, sans-serif" }}>
                  {booking.serviceName}
                </span>
              )}
              {slot.status === "held" && (
                <span style={{ fontSize: 10, color: "#f59e0b", fontFamily: "system-ui, sans-serif" }}>TTL 10м</span>
              )}
              <div style={{ flex: 1 }} />

              {/* Намерение: select_slot — выбор для нового бронирования */}
              {slot.status === "free" && canSelectSlot && (
                <button onClick={() => exec("select_slot", { slotId: slot.id })}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#22c55e", color: "#fff", fontSize: 12, fontFamily: "system-ui, sans-serif", cursor: "pointer", fontWeight: 600 }}>
                  Выбрать
                </button>
              )}
              {/* Намерение: reschedule_booking — выбор нового слота для переноса */}
              {slot.status === "free" && rescheduleBookingId && (
                <button onClick={() => { exec("reschedule_booking", { id: rescheduleBookingId, newSlotId: slot.id }); setRescheduleBookingId(null); }}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#8b5cf6", color: "#fff", fontSize: 12, fontFamily: "system-ui, sans-serif", cursor: "pointer", fontWeight: 600 }}>
                  Перенести сюда
                </button>
              )}
              {/* Намерение: block_slot */}
              {slot.status === "free" && !draft && !rescheduleBookingId && (
                <button onClick={() => exec("block_slot", { slotId: slot.id })}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 12, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
                  Блокировать
                </button>
              )}
              {/* Намерение: unblock_slot — ⇌ антагонист block_slot */}
              {slot.status === "blocked" && (
                <button onClick={() => exec("unblock_slot", { slotId: slot.id })}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #22c55e", background: "#fff", color: "#22c55e", fontSize: 12, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
                  Разблокировать
                </button>
              )}
            </div>
          );
        })}
        {slotsForDate.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>Нет слотов</div>
        )}
      </div>

      {/* Легенда */}
      <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
        {Object.entries(STATUS_CONFIG).map(([status, sc]) => (
          <span key={status} style={{ color: sc.text }}>● {sc.label}</span>
        ))}
      </div>
    </div>
  );
}
