/*
 * Кристаллизованная проекция: my_bookings
 * Источник: PROJECTIONS.my_bookings — query: "все записи текущего клиента, будущие и прошлые"
 * Свидетельства: specialist.name, service.name, slot.date, slot.startTime, status
 *
 * Намерения, материализованные в этой проекции:
 *   cancel_booking    — кнопка «Отменить» (⇌ антагонист confirm_booking, условие: confirmed)
 *   complete_booking  — кнопка «Завершить» (условие: confirmed + slot.endTime <= now)
 *
 * Онтология:
 *   Booking — internal: id, specialistId, serviceId, slotId, status {draft, confirmed, completed, cancelled}
 */

import { useMemo } from "react";

const STATUS_CONFIG = {
  confirmed: { color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", label: "Подтверждена" },
  completed: { color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", label: "Завершена" },
  cancelled: { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", label: "Отменена" },
};

export default function MyBookingsProjection({ world, exec, effects }) {
  const bookings = useMemo(
    () => (world.bookings || []).sort((a, b) => b.createdAt - a.createdAt),
    [world.bookings]
  );

  const confirmed = bookings.filter(b => b.status === "confirmed");
  const completed = bookings.filter(b => b.status === "completed");
  const cancelled = bookings.filter(b => b.status === "cancelled");

  // Proposed-бронирования (оптимистичные)
  const proposedIds = new Set(
    (effects || []).filter(e => e.status === "proposed" && e.target === "bookings").map(e => e.context?.id)
  );

  const renderBooking = (booking) => {
    const sc = STATUS_CONFIG[booking.status] || STATUS_CONFIG.confirmed;
    const isProposed = proposedIds.has(booking.id);
    return (
      <div key={booking.id} style={{
        display: "flex", alignItems: "center", gap: 12,
        background: sc.bg, borderRadius: 8, padding: "14px 16px",
        border: `1px solid ${sc.border}`, borderLeft: `3px solid ${sc.color}`,
        opacity: booking.status === "cancelled" ? 0.5 : isProposed ? 0.6 : 1,
        transition: "all 0.15s",
      }}>
        <div style={{ flex: 1, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e",
            textDecoration: booking.status === "cancelled" ? "line-through" : "none" }}>
            {booking.serviceName}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
            {booking.date} в {booking.startTime} · {booking.price} ₽
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: sc.color, textTransform: "uppercase", minWidth: 100, textAlign: "center" }}>
          {sc.label}
        </span>

        {/* Намерение: complete_booking — условие: confirmed + slot.endTime <= now */}
        {booking.status === "confirmed" && (
          <button onClick={() => exec("complete_booking", { id: booking.id })}
            style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#22c55e", color: "#fff", fontSize: 12, fontFamily: "system-ui, sans-serif", cursor: "pointer", fontWeight: 600 }}>
            Завершить
          </button>
        )}

        {/* Намерение: cancel_booking — ⇌ антагонист confirm_booking */}
        {booking.status === "confirmed" && (
          <button onClick={() => exec("cancel_booking", { id: booking.id })}
            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #ef4444", background: "#fff", color: "#ef4444", fontSize: 12, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
            Отменить
          </button>
        )}
      </div>
    );
  };

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "system-ui, sans-serif", marginBottom: 16, color: "#1a1a2e" }}>
        Мои записи
        <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280", marginLeft: 8 }}>
          {confirmed.length} активных · {completed.length} завершённых
        </span>
      </h2>

      {bookings.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>
          Нет записей. Выберите услугу в каталоге.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Подтверждённые — наверху */}
          {confirmed.map(renderBooking)}
          {/* Завершённые */}
          {completed.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 8 }}>Завершённые</div>
              {completed.map(renderBooking)}
            </>
          )}
          {/* Отменённые */}
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
