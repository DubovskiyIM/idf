/*
 * Кристаллизованная проекция: specialist_schedule
 * Домен: booking · Намерения: select_slot (TTL), block_slot, unblock_slot (⇌), reschedule_booking
 */

import { useState, useMemo } from "react";
import { getStyles } from "./theme.js";

export default function SpecialistScheduleProjection({ world, exec, drafts, theme = "light", variant = "clean" }) {
  const s = getStyles(theme, variant);
  const [selectedDate, setSelectedDate] = useState(null);
  const [rescheduleId, setRescheduleId] = useState(null);

  const dates = useMemo(() => {
    const all = [...new Set((world.slots || []).map(sl => sl.date))].sort();
    if (!selectedDate && all.length > 0) setSelectedDate(all[0]);
    return all;
  }, [world.slots]);

  const slotsForDate = useMemo(
    () => (world.slots || []).filter(sl => sl.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [world.slots, selectedDate]
  );

  const draft = (drafts || [])[0];
  const canSelect = draft && !draft.slotId;
  const confirmed = (world.bookings || []).filter(b => b.status === "confirmed");

  return (
    <div style={s.container}>
      <div style={{ display: "flex", alignItems: "center", gap: s.v.gap, marginBottom: s.v.gap }}>
        <h2 style={s.heading("h1")}>Расписание</h2>
        {draft && <span style={{ ...s.badge("draft") }}>выберите слот: {draft.serviceName}</span>}
        {rescheduleId && (
          <span style={{ ...s.badge("open") }}>
            перенос — выберите новый слот
            <button onClick={() => setRescheduleId(null)} style={{ background: "none", border: "none", color: s.t.danger, cursor: "pointer", marginLeft: 4 }}>×</button>
          </span>
        )}
        {!draft && !rescheduleId && confirmed.length > 0 && (
          <select onChange={e => { if (e.target.value) setRescheduleId(e.target.value); }} value=""
            style={{ fontSize: s.v.fontSize.tiny, padding: "3px 6px", borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, background: s.t.surface, color: s.t.textSecondary, fontFamily: s.v.font }}>
            <option value="">↔ Перенести...</option>
            {confirmed.map(b => <option key={b.id} value={b.id}>{b.serviceName} ({b.date})</option>)}
          </select>
        )}
      </div>

      {/* Даты */}
      <div style={{ display: "flex", gap: s.v.gap / 2, marginBottom: s.v.gap * 2, flexWrap: "wrap" }}>
        {dates.map(d => {
          const dt = new Date(d + "T00:00:00");
          const freeCount = (world.slots || []).filter(sl => sl.date === d && sl.status === "free").length;
          return (
            <button key={d} onClick={() => setSelectedDate(d)} style={{
              padding: `${s.v.padding / 2}px ${s.v.padding}px`, borderRadius: s.v.radius,
              border: selectedDate === d ? `2px solid ${s.t.accent}` : `1px solid ${s.t.border}`,
              background: selectedDate === d ? s.t.accentBg : s.t.surface,
              cursor: "pointer", fontFamily: s.v.font, color: s.t.text, textAlign: "center", minWidth: 60,
            }}>
              <div style={{ fontSize: s.v.fontSize.small }}>{dt.toLocaleDateString("ru", { weekday: "short" })}</div>
              <div style={{ fontSize: s.v.fontSize.h2, fontWeight: 700 }}>{dt.getDate()}</div>
              <div style={{ fontSize: s.v.fontSize.tiny, color: s.t.textMuted }}>{freeCount > 0 ? `${freeCount} св.` : "—"}</div>
            </button>
          );
        })}
      </div>

      {/* Слоты */}
      <div style={{ display: "flex", flexDirection: "column", gap: s.v.gap / 2 }}>
        {slotsForDate.map(slot => {
          const booking = (world.bookings || []).find(b => b.slotId === slot.id && b.status !== "cancelled");
          return (
            <div key={slot.id} style={{
              ...s.card, display: "flex", alignItems: "center", gap: s.v.gap,
              borderLeft: `3px solid ${s.statusColor(slot.status)}`,
              opacity: slot.status === "blocked" ? 0.5 : 1, padding: `${s.v.padding * 0.6}px ${s.v.padding}px`,
            }}>
              <span style={{ ...s.heading("h2"), minWidth: 100 }}>{slot.startTime}—{slot.endTime}</span>
              <span style={s.badge(slot.status)}>{slot.status}</span>
              {booking && <span style={s.text("small")}>{booking.serviceName}</span>}
              {slot.status === "held" && <span style={{ ...s.text("tiny"), color: s.t.warning }}>TTL 10м</span>}
              <div style={{ flex: 1 }} />
              {slot.status === "free" && canSelect && (
                <button onClick={() => exec("select_slot", { slotId: slot.id })} style={s.button("success")}>Выбрать</button>
              )}
              {slot.status === "free" && rescheduleId && (
                <button onClick={() => { exec("reschedule_booking", { id: rescheduleId, newSlotId: slot.id }); setRescheduleId(null); }}
                  style={s.button("accent")}>Перенести сюда</button>
              )}
              {slot.status === "free" && !draft && !rescheduleId && (
                <button onClick={() => exec("block_slot", { slotId: slot.id })} style={s.buttonOutline("muted")}>Блок.</button>
              )}
              {slot.status === "blocked" && (
                <button onClick={() => exec("unblock_slot", { slotId: slot.id })} style={s.buttonOutline("success")}>Разблок.</button>
              )}
            </div>
          );
        })}
        {slotsForDate.length === 0 && <div style={{ textAlign: "center", padding: 40, ...s.text() }}>Нет слотов</div>}
      </div>

      {/* Легенда */}
      <div style={{ display: "flex", gap: s.v.gap * 2, marginTop: s.v.gap, fontSize: s.v.fontSize.tiny }}>
        {["free", "held", "booked", "blocked"].map(st => (
          <span key={st} style={{ color: s.statusColor(st), display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.statusColor(st), display: "inline-block" }} /> {st}
          </span>
        ))}
      </div>
    </div>
  );
}
