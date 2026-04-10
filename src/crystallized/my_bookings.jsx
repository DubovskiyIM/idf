/*
 * Кристаллизованная проекция: my_bookings
 * Источник: PROJECTIONS.my_bookings
 * Свидетельства: specialist.name, service.name, slot.date, slot.startTime, status
 *
 * Намерения (6): cancel_booking (⇌ confirm), complete_booking, mark_no_show (⊕ complete),
 *                leave_review, reschedule_booking, bulk_cancel_day (extended)
 * Сущности: Booking (internal), Review (internal)
 * Кристаллизовано из 14 намерений · 5 сущностей
 */

import { useState, useMemo } from "react";

const STATUS_CONFIG = {
  confirmed: { color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", label: "Подтверждена" },
  completed: { color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", label: "Завершена" },
  cancelled: { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", label: "Отменена" },
  no_show: { color: "#f59e0b", bg: "#fffbeb", border: "#fed7aa", label: "Неявка" },
};

export default function MyBookingsProjection({ world, exec, effects }) {
  const [bulkDate, setBulkDate] = useState("");

  const bookings = useMemo(
    () => (world.bookings || []).sort((a, b) => b.createdAt - a.createdAt),
    [world.bookings]
  );
  const reviews = world.reviews || [];

  const confirmed = bookings.filter(b => b.status === "confirmed");
  const completed = bookings.filter(b => b.status === "completed");
  const cancelled = bookings.filter(b => b.status === "cancelled");
  const noShow = bookings.filter(b => b.status === "no_show");

  // Даты с confirmed-записями (для bulk_cancel_day)
  const confirmedDates = [...new Set(confirmed.map(b => b.date))].sort();

  const renderBooking = (booking) => {
    const sc = STATUS_CONFIG[booking.status] || STATUS_CONFIG.confirmed;
    const hasReview = reviews.some(r => r.bookingId === booking.id);

    return (
      <div key={booking.id} style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        background: sc.bg, borderRadius: 8, padding: "12px 16px",
        border: `1px solid ${sc.border}`, borderLeft: `3px solid ${sc.color}`,
        opacity: booking.status === "cancelled" ? 0.5 : 1,
      }}>
        <div style={{ flex: 1, minWidth: 150, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e",
            textDecoration: booking.status === "cancelled" ? "line-through" : "none" }}>
            {booking.serviceName}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
            {booking.date} в {booking.startTime} · {booking.price} ₽
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: sc.color, textTransform: "uppercase", minWidth: 90 }}>
          {sc.label}
        </span>

        {/* Намерения для confirmed: complete, mark_no_show, cancel */}
        {booking.status === "confirmed" && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button onClick={() => exec("complete_booking", { id: booking.id })}
              style={{ padding: "5px 10px", borderRadius: 5, border: "none", background: "#22c55e", color: "#fff", fontSize: 11, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
              Завершить
            </button>
            {/* mark_no_show ⊕ complete_booking — исключающая связь */}
            <button onClick={() => exec("mark_no_show", { id: booking.id })}
              style={{ padding: "5px 10px", borderRadius: 5, border: "1px solid #f59e0b", background: "#fff", color: "#f59e0b", fontSize: 11, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
              Неявка
            </button>
            <button onClick={() => exec("cancel_booking", { id: booking.id })}
              style={{ padding: "5px 10px", borderRadius: 5, border: "1px solid #ef4444", background: "#fff", color: "#ef4444", fontSize: 11, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
              Отменить
            </button>
          </div>
        )}

        {/* Намерение: leave_review — последовательная: complete ▷ leave_review */}
        {booking.status === "completed" && !hasReview && (
          <button onClick={() => {
            const rating = prompt("Оценка (1-5):", "5");
            if (rating) {
              const text = prompt("Комментарий (необязательно):", "");
              exec("leave_review", { bookingId: booking.id, rating: parseInt(rating), text: text || "" });
            }
          }}
            style={{ padding: "5px 10px", borderRadius: 5, border: "1px solid #f59e0b", background: "#fff", color: "#f59e0b", fontSize: 11, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
            ★ Оставить отзыв
          </button>
        )}
        {booking.status === "completed" && hasReview && (
          <span style={{ fontSize: 10, color: "#22c55e" }}>✓ отзыв оставлен</span>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "system-ui, sans-serif", margin: 0, color: "#1a1a2e" }}>
          Мои записи
          <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280", marginLeft: 8 }}>
            {confirmed.length} активных · {completed.length} завершённых
          </span>
        </h2>

        {/* Намерение: bulk_cancel_day — расширенное намерение */}
        {confirmedDates.length > 0 && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <select value={bulkDate} onChange={e => setBulkDate(e.target.value)}
              style={{ fontSize: 11, padding: "4px 8px", borderRadius: 4, border: "1px solid #d1d5db", fontFamily: "system-ui, sans-serif", color: "#6b7280" }}>
              <option value="">Массовая отмена...</option>
              {confirmedDates.map(d => {
                const count = confirmed.filter(b => b.date === d).length;
                return <option key={d} value={d}>{d} ({count} записей)</option>;
              })}
            </select>
            {bulkDate && (
              <button onClick={() => { exec("bulk_cancel_day", { date: bulkDate }); setBulkDate(""); }}
                style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "#ef4444", color: "#fff", fontSize: 11, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
                ⊗ Отменить все
              </button>
            )}
          </div>
        )}
      </div>

      {bookings.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>
          Нет записей. Выберите услугу в каталоге.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {confirmed.length > 0 && confirmed.map(renderBooking)}

          {completed.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 8 }}>Завершённые</div>
              {completed.map(renderBooking)}
            </>
          )}

          {noShow.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 8 }}>Неявки</div>
              {noShow.map(renderBooking)}
            </>
          )}

          {cancelled.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 8 }}>Отменённые</div>
              {cancelled.map(renderBooking)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
