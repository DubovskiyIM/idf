/*
 * Кристаллизованная проекция: my_bookings
 * Домен: booking · Намерения: cancel_booking (⇌), complete_booking, mark_no_show (⊕),
 *   leave_review, bulk_cancel_day (extended)
 */

import { useState, useMemo } from "react";
import { getStyles } from "./theme.js";

export default function MyBookingsProjection({ world, exec, theme = "light", variant = "clean" }) {
  const s = getStyles(theme, variant);
  const [bulkDate, setBulkDate] = useState("");

  const bookings = useMemo(() => (world.bookings || []).sort((a, b) => b.createdAt - a.createdAt), [world.bookings]);
  const reviews = world.reviews || [];

  const confirmed = bookings.filter(b => b.status === "confirmed");
  const completed = bookings.filter(b => b.status === "completed");
  const cancelled = bookings.filter(b => b.status === "cancelled");
  const noShow = bookings.filter(b => b.status === "no_show");
  const confirmedDates = [...new Set(confirmed.map(b => b.date))].sort();

  const renderBooking = (b) => {
    const hasReview = reviews.some(r => r.bookingId === b.id);
    return (
      <div key={b.id} style={{
        ...s.card, display: "flex", alignItems: "center", gap: s.v.gap, flexWrap: "wrap",
        borderLeft: `3px solid ${s.statusColor(b.status)}`,
        opacity: b.status === "cancelled" ? 0.5 : 1, marginBottom: s.v.gap / 2,
        padding: `${s.v.padding * 0.7}px ${s.v.padding}px`,
      }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ ...s.heading("h2"), textDecoration: b.status === "cancelled" ? "line-through" : "none" }}>{b.serviceName}</div>
          <div style={s.text("small")}>{b.date} {b.startTime} · {b.price}₽</div>
        </div>
        <span style={s.badge(b.status)}>{b.status}</span>

        {b.status === "confirmed" && (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => exec("complete_booking", { id: b.id })} style={s.button("success")}>Готово</button>
            <button onClick={() => exec("mark_no_show", { id: b.id })} style={s.buttonOutline("warning")}>Неявка</button>
            <button onClick={() => exec("cancel_booking", { id: b.id })} style={s.buttonOutline("danger")}>Отмена</button>
          </div>
        )}
        {b.status === "completed" && !hasReview && (
          <button onClick={() => {
            const r = prompt("Оценка (1-5):", "5");
            if (r) { const t = prompt("Комментарий:", ""); exec("leave_review", { bookingId: b.id, rating: parseInt(r), text: t || "" }); }
          }} style={s.buttonOutline("warning")}>★ Отзыв</button>
        )}
        {b.status === "completed" && hasReview && <span style={{ ...s.text("tiny"), color: s.t.success }}>✓ отзыв</span>}
      </div>
    );
  };

  return (
    <div style={s.container}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: s.v.gap * 2 }}>
        <h2 style={s.heading("h1")}>
          Мои записи
          <span style={{ ...s.text("small"), marginLeft: 8, fontWeight: 400 }}>{confirmed.length} активных · {completed.length} завершённых</span>
        </h2>
        {confirmedDates.length > 0 && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <select value={bulkDate} onChange={e => setBulkDate(e.target.value)}
              style={{ fontSize: s.v.fontSize.tiny, padding: "3px 6px", borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, background: s.t.surface, color: s.t.textSecondary, fontFamily: s.v.font }}>
              <option value="">Масс. отмена...</option>
              {confirmedDates.map(d => <option key={d} value={d}>{d} ({confirmed.filter(b => b.date === d).length})</option>)}
            </select>
            {bulkDate && <button onClick={() => { exec("bulk_cancel_day", { date: bulkDate }); setBulkDate(""); }} style={s.button("danger")}>⊗ Отменить все</button>}
          </div>
        )}
      </div>

      {bookings.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, ...s.text() }}>Нет записей</div>
      ) : (
        <>
          {confirmed.length > 0 && confirmed.map(renderBooking)}
          {completed.length > 0 && (
            <>
              <div style={{ ...s.text("tiny"), textTransform: "uppercase", letterSpacing: "0.05em", marginTop: s.v.gap }}>Завершённые</div>
              {completed.map(renderBooking)}
            </>
          )}
          {noShow.length > 0 && (
            <>
              <div style={{ ...s.text("tiny"), textTransform: "uppercase", letterSpacing: "0.05em", marginTop: s.v.gap }}>Неявки</div>
              {noShow.map(renderBooking)}
            </>
          )}
          {cancelled.length > 0 && (
            <>
              <div style={{ ...s.text("tiny"), textTransform: "uppercase", letterSpacing: "0.05em", marginTop: s.v.gap }}>Отменённые</div>
              {cancelled.map(renderBooking)}
            </>
          )}
        </>
      )}
    </div>
  );
}
