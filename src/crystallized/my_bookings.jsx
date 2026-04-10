/*
 * Кристаллизованная проекция: my_bookings
 * Домен: booking · 20 намерений · 5 сущностей
 * Намерения: cancel_booking (⇌), complete_booking, mark_no_show (⊕),
 *   leave_review, edit_review, delete_review, bulk_cancel_day (extended),
 *   repeat_booking, cancel_client_booking, respond_to_review
 * Слои: canonical, adaptive:mobile, adaptive:agent
 * Зрители: client (свои записи), specialist (все + управление)
 */

import { useState, useMemo } from "react";
import { getStyles, getViewerAccess } from "./theme.js";
import { ONTOLOGY } from "../domains/booking/ontology.js";

const STATUS_CONFIG = {
  confirmed: { label: "Подтверждена" }, completed: { label: "Завершена" },
  cancelled: { label: "Отменена" }, no_show: { label: "Неявка" },
};

export default function MyBookingsProjection({ world, exec, theme = "light", variant = "clean", viewer = "client", layer = "canonical", startInvestigation, commitInvestigation, cancelInvestigation, overlay }) {
  const s = getStyles(theme, variant);
  const access = getViewerAccess(ONTOLOGY, viewer);
  const [bulkDate, setBulkDate] = useState("");
  const isAgent = viewer === "agent" || layer === "adaptive:agent";

  const bookings = useMemo(() => (world.bookings || []).sort((a, b) => b.createdAt - a.createdAt), [world.bookings]);
  const reviews = world.reviews || [];
  const confirmed = bookings.filter(b => b.status === "confirmed");
  const completed = bookings.filter(b => b.status === "completed");
  const cancelled = bookings.filter(b => b.status === "cancelled");
  const noShow = bookings.filter(b => b.status === "no_show");
  const confirmedDates = [...new Set(confirmed.map(b => b.date))].sort();

  // Agent layer
  if (isAgent) {
    return (
      <div style={s.container}>
        <div style={{ display: "flex", alignItems: "center", gap: s.v.gap, marginBottom: s.v.gap }}>
          <h2 style={s.heading("h2")}>API: my_bookings</h2>
          <span style={s.badge("open")}>agent · {viewer}</span>
        </div>
        <pre style={{ ...s.card, fontSize: s.v.fontSize.tiny, fontFamily: "ui-monospace, monospace", overflow: "auto", maxHeight: 400, whiteSpace: "pre-wrap" }}>
          {JSON.stringify({ projection: "my_bookings", viewer, bookings: bookings.map(b => ({ id: b.id, status: b.status, date: b.date, startTime: b.startTime, price: b.price, ...(access.canExecute("cancel_client_booking") ? { serviceName: b.serviceName } : {}) })), reviews: reviews.map(r => ({ rating: r.rating, ...(access.canExecute("respond_to_review") ? { text: r.text, response: r.response } : {}) })) }, null, 2)}
        </pre>
      </div>
    );
  }

  const renderBooking = (b) => {
    const hasReview = reviews.some(r => r.bookingId === b.id);
    const review = reviews.find(r => r.bookingId === b.id);
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
        <span style={s.badge(b.status)}>{STATUS_CONFIG[b.status]?.label || b.status}</span>

        {b.status === "confirmed" && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {access.canExecute("complete_booking") && <button onClick={() => exec("complete_booking", { id: b.id })} style={s.button("success")}>Готово</button>}
            {access.canExecute("mark_no_show") && <button onClick={() => exec("mark_no_show", { id: b.id })} style={s.buttonOutline("warning")}>Неявка</button>}
            {access.canExecute("cancel_booking") && <button onClick={() => exec("cancel_booking", { id: b.id })} style={s.buttonOutline("danger")}>Отмена</button>}
            {access.canExecute("cancel_client_booking") && !access.canExecute("cancel_booking") && (
              <button onClick={() => exec("cancel_client_booking", { id: b.id })} style={s.buttonOutline("danger")}>Отмена (спец.)</button>
            )}
          </div>
        )}

        {b.status === "completed" && !hasReview && access.canExecute("leave_review") && (
          <button onClick={() => {
            const r = prompt("Оценка (1-5):", "5");
            if (r) { const t = prompt("Комментарий:", ""); exec("leave_review", { bookingId: b.id, rating: parseInt(r), text: t || "" }); }
          }} style={s.buttonOutline("warning")}>★ Отзыв</button>
        )}

        {b.status === "completed" && hasReview && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ ...s.text("tiny"), color: s.t.success }}>★{review.rating}</span>
            {access.canExecute("respond_to_review") && !review.response && (
              <button onClick={() => { const r = prompt("Ответ:", ""); if (r) exec("respond_to_review", { id: review.id, response: r }); }}
                style={s.buttonOutline("info")}>💬</button>
            )}
            {review.response && <span style={{ ...s.text("tiny"), color: s.t.info }}>💬 есть ответ</span>}
          </div>
        )}

        {(b.status === "completed" || b.status === "cancelled" || b.status === "no_show") && access.canExecute("repeat_booking") && (
          <button onClick={() => exec("repeat_booking", { id: b.id })} style={s.buttonOutline()}>🔄</button>
        )}
      </div>
    );
  };

  return (
    <div style={s.container}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: s.v.gap * 2 }}>
        <h2 style={s.heading("h1")}>
          Мои записи <span style={{ ...s.text("small"), marginLeft: 8, fontWeight: 400 }}>{confirmed.length} активных</span>
        </h2>
        {access.canExecute("bulk_cancel_day") && confirmedDates.length > 0 && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <select value={bulkDate} onChange={e => setBulkDate(e.target.value)}
              style={{ fontSize: s.v.fontSize.tiny, padding: "3px 6px", borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, background: s.t.surface, color: s.t.textSecondary }}>
              <option value="">Масс. отмена...</option>
              {confirmedDates.map(d => <option key={d} value={d}>{d} ({confirmed.filter(b => b.date === d).length})</option>)}
            </select>
            {bulkDate && <button onClick={() => { exec("bulk_cancel_day", { date: bulkDate }); setBulkDate(""); }} style={s.button("danger")}>⊗</button>}
          </div>
        )}
      </div>

      {bookings.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, ...s.text() }}>Нет записей</div>
      ) : (
        <>
          {confirmed.map(renderBooking)}
          {completed.length > 0 && <><div style={{ ...s.text("tiny"), textTransform: "uppercase", marginTop: s.v.gap }}>Завершённые</div>{completed.map(renderBooking)}</>}
          {noShow.length > 0 && <><div style={{ ...s.text("tiny"), textTransform: "uppercase", marginTop: s.v.gap }}>Неявки</div>{noShow.map(renderBooking)}</>}
          {cancelled.length > 0 && <><div style={{ ...s.text("tiny"), textTransform: "uppercase", marginTop: s.v.gap }}>Отменённые</div>{cancelled.map(renderBooking)}</>}
        </>
      )}
    </div>
  );
}
