import { useState, useMemo } from "react";

const SLOT_STATUS_COLORS = { free: "#22c55e", held: "#f59e0b", booked: "#6366f1", blocked: "#6b7280" };
const BOOKING_STATUS_COLORS = { draft: "#f59e0b", confirmed: "#6366f1", completed: "#22c55e", cancelled: "#ef4444", no_show: "#f59e0b" };

export default function BookingUI({ world, worldForIntent, drafts, exec, overlay, overlayEntityIds, startInvestigation, commitInvestigation, cancelInvestigation }) {
  const [view, setView] = useState("catalog");
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

  const draft = drafts[0] || null;
  const specialist = (world.specialists || [])[0];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Nav */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { id: "catalog", label: "Каталог" },
          { id: "schedule", label: "Расписание" },
          { id: "bookings", label: "Записи" },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            style={{ padding: "6px 14px", borderRadius: 6, border: view === v.id ? "2px solid #6366f1" : "1px solid #d1d5db", background: view === v.id ? "#eef2ff" : "#fff", color: "#1a1a2e", fontSize: 12, cursor: "pointer" }}>
            {v.label}
          </button>
        ))}
        {draft && (
          <button onClick={() => setView("draft")}
            style={{ padding: "6px 14px", borderRadius: 6, border: "2px dashed #f59e0b", background: view === "draft" ? "#fffbeb" : "#fff", color: "#f59e0b", fontSize: 12, cursor: "pointer" }}>
            Черновик Δ
          </button>
        )}
      </div>

      {/* Catalog */}
      {view === "catalog" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px", color: "#1a1a2e" }}>
            {specialist?.name || "Специалист"} — {specialist?.specialization || ""}
          </h2>
          {(world.services || []).filter(s => s.active).map(service => (
            <div key={service.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 8, padding: "12px 16px", border: "1px solid #e5e7eb", marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{service.name}</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>{service.duration} мин</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#6366f1", marginRight: 12 }}>{service.price} ₽</div>
              <button onClick={() => { exec("select_service", { serviceId: service.id }); setView("schedule"); }}
                disabled={!!draft}
                style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: draft ? "#d1d5db" : "#6366f1", color: "#fff", fontSize: 13, cursor: draft ? "default" : "pointer", fontWeight: 600 }}>
                Выбрать
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Schedule */}
      {view === "schedule" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px", color: "#1a1a2e" }}>Расписание</h2>
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {dates.map(d => {
              const dt = new Date(d + "T00:00:00");
              return (
                <button key={d} onClick={() => setSelectedDate(d)}
                  style={{ padding: "6px 12px", borderRadius: 6, border: selectedDate === d ? "2px solid #6366f1" : "1px solid #e5e7eb", background: selectedDate === d ? "#eef2ff" : "#fff", cursor: "pointer", fontSize: 12, color: "#1a1a2e", minWidth: 60, textAlign: "center" }}>
                  <div>{dt.toLocaleDateString("ru", { weekday: "short" })}</div>
                  <div style={{ fontWeight: 700 }}>{dt.getDate()}</div>
                </button>
              );
            })}
          </div>
          {slotsForDate.map(slot => (
            <div key={slot.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 8, padding: "8px 14px", border: "1px solid #e5e7eb", borderLeft: `3px solid ${SLOT_STATUS_COLORS[slot.status]}`, marginBottom: 4, opacity: slot.status === "blocked" ? 0.5 : 1 }}>
              <span style={{ fontSize: 14, fontWeight: 600, minWidth: 100 }}>{slot.startTime}—{slot.endTime}</span>
              <span style={{ fontSize: 10, color: SLOT_STATUS_COLORS[slot.status], fontWeight: 600, textTransform: "uppercase", minWidth: 80 }}>{slot.status}</span>
              <div style={{ flex: 1 }} />
              {slot.status === "free" && draft && !draft.slotId && (
                <button onClick={() => { exec("select_slot", { slotId: slot.id }); setView("draft"); }}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#22c55e", color: "#fff", fontSize: 11, cursor: "pointer" }}>Выбрать</button>
              )}
              {slot.status === "free" && !draft && (
                <button onClick={() => exec("block_slot", { slotId: slot.id })}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 11, cursor: "pointer" }}>Блок.</button>
              )}
              {slot.status === "blocked" && (
                <button onClick={() => exec("unblock_slot", { slotId: slot.id })}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #22c55e", background: "#fff", color: "#22c55e", fontSize: 11, cursor: "pointer" }}>Разблок.</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bookings */}
      {view === "bookings" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px", color: "#1a1a2e" }}>Мои записи</h2>
          {(world.bookings || []).length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Нет записей</div>
          ) : (world.bookings || []).sort((a, b) => b.createdAt - a.createdAt).map(b => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid #e5e7eb", borderLeft: `3px solid ${BOOKING_STATUS_COLORS[b.status]}`, marginBottom: 6, opacity: b.status === "cancelled" ? 0.5 : 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{b.serviceName}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{b.date} {b.startTime} · {b.price}₽</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: BOOKING_STATUS_COLORS[b.status], textTransform: "uppercase" }}>{b.status}</span>
              {b.status === "confirmed" && <>
                <button onClick={() => exec("complete_booking", { id: b.id })} style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "#22c55e", color: "#fff", fontSize: 10, cursor: "pointer" }}>Готово</button>
                <button onClick={() => exec("mark_no_show", { id: b.id })} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #f59e0b", background: "#fff", color: "#f59e0b", fontSize: 10, cursor: "pointer" }}>Неявка</button>
                <button onClick={() => exec("cancel_booking", { id: b.id })} style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #ef4444", background: "#fff", color: "#ef4444", fontSize: 10, cursor: "pointer" }}>Отмена</button>
              </>}
              {b.status === "completed" && !(world.reviews || []).some(r => r.bookingId === b.id) && (
                <button onClick={() => { const r = prompt("Оценка (1-5):", "5"); if (r) exec("leave_review", { bookingId: b.id, rating: parseInt(r) }); }}
                  style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #f59e0b", background: "#fff", color: "#f59e0b", fontSize: 10, cursor: "pointer" }}>★</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Draft */}
      {view === "draft" && draft && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px", color: "#1a1a2e" }}>
            Черновик Δ {overlay && <span style={{ fontSize: 13, color: "#8b5cf6" }}>→ Overlay(I) preview</span>}
          </h2>
          <div style={{ background: "#fff", borderRadius: 8, padding: 20, border: overlay ? "2px solid #8b5cf6" : "2px dashed #f59e0b" }}>
            <div style={{ marginBottom: 8 }}><b>Услуга:</b> {draft.serviceName} ({draft.duration} мин) · {draft.price} ₽</div>
            <div style={{ marginBottom: 8 }}>
              <b>Слот:</b> {draft.slotId ? (() => { const s = (world.slots || []).find(s => s.id === draft.slotId); return s ? `${s.date} ${s.startTime}` : draft.slotId; })() : <span style={{ color: "#f59e0b" }}>не выбран — <button onClick={() => setView("schedule")} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", textDecoration: "underline" }}>выбрать</button></span>}
            </div>

            {/* Overlay(I) — предпросмотр результата */}
            {overlay && (
              <div style={{ marginBottom: 12, padding: 12, background: "#f5f3ff", borderRadius: 8, border: "1px solid #c4b5fd" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#8b5cf6", marginBottom: 6 }}>Предпросмотр (Overlay):</div>
                <div style={{ fontSize: 12, color: "#1a1a2e" }}>
                  {overlay.effects.map((ef, i) => (
                    <div key={i} style={{ marginBottom: 2 }}>
                      <span style={{ color: { add: "#22c55e", replace: "#6366f1", remove: "#ef4444" }[ef.alpha] || "#6b7280" }}>{ef.alpha}</span>
                      {" "}{ef.desc}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 6 }}>
                  World(t) ⊕ Overlay(I) — {overlay.effects.length} эффектов будут применены
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              {!overlay && draft.slotId && (
                <button onClick={() => startInvestigation("confirm_booking", {})}
                  style={{ padding: "10px 24px", borderRadius: 6, border: "2px solid #8b5cf6", background: "#f5f3ff", color: "#8b5cf6", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                  👁 Предпросмотр
                </button>
              )}
              {overlay && (
                <button onClick={() => { commitInvestigation(); setView("bookings"); }}
                  style={{ padding: "10px 24px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                  ✓ Подтвердить
                </button>
              )}
              {overlay && (
                <button onClick={cancelInvestigation}
                  style={{ padding: "10px 24px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 14, cursor: "pointer" }}>
                  Отмена overlay
                </button>
              )}
              {!overlay && (
                <button onClick={() => { exec("confirm_booking"); setView("bookings"); }} disabled={!draft.slotId}
                  style={{ padding: "10px 24px", borderRadius: 6, border: "none", background: draft.slotId ? "#6366f1" : "#d1d5db", color: "#fff", fontSize: 14, cursor: draft.slotId ? "pointer" : "default", fontWeight: 600 }}>
                  Подтвердить (без preview)
                </button>
              )}
              <button onClick={() => { cancelInvestigation(); exec("abandon_draft"); setView("catalog"); }}
                style={{ padding: "10px 24px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 14, cursor: "pointer" }}>Отменить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
