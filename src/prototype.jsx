import { useState, useMemo } from "react";
import { INTENTS } from "./runtime/intents.js";
import { PROJECTIONS } from "./runtime/projections.js";
import { PARTICLE_COLORS, ALPHA_LABELS, LINK_COLORS, SLOT_STATUS_COLORS, BOOKING_STATUS_COLORS } from "./runtime/constants.js";
import { useEngine } from "./runtime/engine.js";

const crystallizedModules = import.meta.glob("./crystallized/*.jsx", { eager: true });

export default function App() {
  const { world, drafts, effects, signals, stats, links, exec, isApplicable } = useEngine();
  const [view, setView] = useState("catalog");
  const [selectedDate, setSelectedDate] = useState(null);
  const [tab, setTab] = useState("intents");
  const [mode, setMode] = useState("manual");

  const hasCrystallized = Object.keys(crystallizedModules).length > 0;
  const CServiceCatalog = crystallizedModules["./crystallized/service_catalog.jsx"]?.default;
  const CSchedule = crystallizedModules["./crystallized/specialist_schedule.jsx"]?.default;
  const CMyBookings = crystallizedModules["./crystallized/my_bookings.jsx"]?.default;

  // Даты для расписания
  const dates = useMemo(() => {
    const allDates = [...new Set((world.slots || []).map(s => s.date))].sort();
    if (!selectedDate && allDates.length > 0) setSelectedDate(allDates[0]);
    return allDates;
  }, [world.slots]);

  const slotsForDate = useMemo(
    () => (world.slots || []).filter(s => s.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [world.slots, selectedDate]
  );

  const draft = drafts[0] || null;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0c0e14", color: "#c9cdd4", fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', monospace", fontSize: 13, overflow: "hidden" }}>
      {/* HEADER */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #1e2230", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e5eb", letterSpacing: "0.02em" }}>Intent-Driven Frontend</span>
        <span style={{ fontSize: 11, color: "#f59e0b", background: "#f59e0b18", padding: "2px 8px", borderRadius: 4, border: "1px solid #f59e0b30" }}>prototype 0.3 · booking</span>
        {hasCrystallized && (
          <div style={{ display: "flex", background: "#1e2230", borderRadius: 6, padding: 2 }}>
            {["manual", "crystallized"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11,
                background: mode === m ? "#f59e0b" : "transparent",
                color: mode === m ? "#0c0e14" : "#6b7280",
                fontWeight: mode === m ? 600 : 400
              }}>
                {m === "manual" ? "Ручной" : "Кристаллизованный"}
              </button>
            ))}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          {Object.keys(INTENTS).length} намерений · {stats.slots_free} свободных · {stats.bookings_confirmed} записей · {stats.drafts} черновиков
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* LEFT: Definitions */}
        <div style={{ width: 340, borderRight: "1px solid #1e2230", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ display: "flex", borderBottom: "1px solid #1e2230" }}>
            {["intents", "algebra"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "8px 0", background: tab === t ? "#161923" : "transparent", color: tab === t ? "#e2e5eb" : "#6b7280", border: "none", cursor: "pointer", fontSize: 12, borderBottom: tab === t ? "2px solid #f59e0b" : "2px solid transparent" }}>
                {t === "intents" ? "Намерения" : "Алгебра"}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            {tab === "intents" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Определения намерений</div>
                {Object.entries(INTENTS).map(([id, intent]) => (
                  <div key={id} style={{ background: "#13151d", borderRadius: 6, padding: 10, border: "1px solid #1e2230" }}>
                    <div style={{ fontWeight: 600, color: "#e2e5eb", marginBottom: 6, fontSize: 12 }}>{intent.name} <span style={{ color: "#4b5068", fontWeight: 400 }}>({id})</span></div>
                    {Object.entries(intent.particles).map(([pName, pVal]) => {
                      const vals = Array.isArray(pVal) ? pVal : [pVal];
                      if (vals.length === 0 && pName !== "effects") return null;
                      return (
                        <div key={pName} style={{ marginBottom: 3, display: "flex", gap: 6, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 10, color: PARTICLE_COLORS[pName] || "#6b7280", minWidth: 75, flexShrink: 0, paddingTop: 1 }}>{pName}</span>
                          <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>
                            {pName === "effects" ? vals.map((e, i) => (
                              <span key={i} style={{ display: "inline-block", background: "#34d39915", color: "#34d399", padding: "1px 5px", borderRadius: 3, marginRight: 3, fontSize: 10 }}>{ALPHA_LABELS[e.α]} {e.target}{e.ttl ? ` (ttl:${e.ttl/1000}s)` : ""}</span>
                            )) : vals.map((v, i) => (
                              <span key={i}>{typeof v === "object" ? JSON.stringify(v) : v}{i < vals.length - 1 ? ", " : ""}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {intent.antagonist && <div style={{ marginTop: 4, fontSize: 10, color: "#f472b6" }}>⇌ {intent.antagonist}</div>}
                  </div>
                ))}
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 8, marginBottom: 4 }}>Проекции</div>
                {Object.entries(PROJECTIONS).map(([id, proj]) => (
                  <div key={id} style={{ background: "#13151d", borderRadius: 6, padding: 10, border: "1px solid #1e2230" }}>
                    <div style={{ fontWeight: 600, color: "#e2e5eb", marginBottom: 4, fontSize: 12 }}>{proj.name}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>Q: {proj.query}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Автовыведенные связи</div>
                {links.map((l, i) => (
                  <div key={i} style={{ background: "#13151d", borderRadius: 6, padding: 10, border: "1px solid #1e2230", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#e2e5eb" }}>{INTENTS[l.from]?.name}</span>
                    <span style={{ color: LINK_COLORS[l.type], fontWeight: 700, fontSize: 14 }}>{l.type}</span>
                    <span style={{ fontSize: 11, color: "#e2e5eb" }}>{INTENTS[l.to]?.name}</span>
                    <span style={{ fontSize: 10, color: "#6b7280", marginLeft: "auto" }}>{l.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Booking UI */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* View tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1e2230", background: "#10121a" }}>
            {[
              { id: "catalog", label: "Каталог" },
              { id: "schedule", label: "Расписание" },
              { id: "bookings", label: "Мои записи" },
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12,
                background: view === v.id ? "#161923" : "transparent",
                color: view === v.id ? "#e2e5eb" : "#6b7280",
                borderBottom: view === v.id ? "2px solid #f59e0b" : "2px solid transparent",
              }}>{v.label}</button>
            ))}
            {draft && (
              <button onClick={() => setView("draft")} style={{
                padding: "8px 16px", border: "none", cursor: "pointer", fontSize: 12,
                background: view === "draft" ? "#161923" : "transparent",
                color: "#f59e0b",
                borderBottom: view === "draft" ? "2px solid #f59e0b" : "2px solid transparent",
              }}>Черновик Δ</button>
            )}
          </div>

          <div style={{ flex: 1, overflow: "auto", background: "#fafafa", color: "#1a1a2e" }}>
            <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>

              {/* CRYSTALLIZED MODE */}
              {mode === "crystallized" && hasCrystallized ? (
                <>
                  {view === "catalog" && CServiceCatalog && <CServiceCatalog world={world} exec={exec} drafts={drafts} effects={effects} />}
                  {view === "schedule" && CSchedule && <CSchedule world={world} exec={exec} drafts={drafts} effects={effects} />}
                  {view === "bookings" && CMyBookings && <CMyBookings world={world} exec={exec} effects={effects} />}
                  {view === "draft" && draft && (
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "system-ui, sans-serif", marginBottom: 16, color: "#1a1a2e" }}>
                        Черновик Δ <span style={{ color: "#f59e0b", fontSize: 13 }}>(кристаллизованный)</span>
                      </h2>
                      <div style={{ background: "#fff", borderRadius: 8, padding: 20, border: "2px dashed #f59e0b", fontFamily: "system-ui, sans-serif" }}>
                        <div style={{ fontSize: 14, marginBottom: 8 }}><b>Услуга:</b> {draft.serviceName} ({draft.duration} мин)</div>
                        <div style={{ fontSize: 14, marginBottom: 8 }}><b>Цена:</b> {draft.price} ₽</div>
                        <div style={{ fontSize: 14, marginBottom: 16 }}>
                          <b>Слот:</b> {draft.slotId ? (() => { const s = (world.slots || []).find(s => s.id === draft.slotId); return s ? `${s.date} в ${s.startTime}` : draft.slotId; })() : <span style={{ color: "#f59e0b" }}>не выбран</span>}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => { exec("confirm_booking"); setView("bookings"); }} disabled={!draft.slotId}
                            style={{ padding: "10px 24px", borderRadius: 6, border: "none", background: draft.slotId ? "#6366f1" : "#d1d5db", color: "#fff", fontSize: 14, fontFamily: "system-ui, sans-serif", cursor: draft.slotId ? "pointer" : "default", fontWeight: 600 }}>
                            Подтвердить
                          </button>
                          <button onClick={() => { exec("abandon_draft"); setView("catalog"); }}
                            style={{ padding: "10px 24px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 14, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
                            Отменить
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
              <>

              {/* CATALOG */}
              {view === "catalog" && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "system-ui, sans-serif", marginBottom: 16, color: "#1a1a2e" }}>
                    {(world.specialists || [])[0]?.name || "Специалист"} — {(world.specialists || [])[0]?.specialization || ""}
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(world.services || []).filter(s => s.active).map(service => (
                      <div key={service.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 8, padding: "14px 16px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px #0001" }}>
                        <div style={{ flex: 1, fontFamily: "system-ui, sans-serif" }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{service.name}</div>
                          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{service.duration} мин</div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#6366f1", fontFamily: "system-ui, sans-serif", marginRight: 12 }}>{service.price} ₽</div>
                        <button onClick={() => { exec("select_service", { serviceId: service.id }); setView("schedule"); }}
                          disabled={!!draft}
                          style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: draft ? "#d1d5db" : "#6366f1", color: "#fff", fontSize: 13, fontFamily: "system-ui, sans-serif", cursor: draft ? "default" : "pointer", fontWeight: 600 }}>
                          Выбрать
                        </button>
                      </div>
                    ))}
                  </div>
                  {draft && <div style={{ marginTop: 12, fontSize: 12, color: "#f59e0b", fontFamily: "system-ui, sans-serif" }}>У вас есть незавершённый черновик. Завершите или отмените его.</div>}
                </div>
              )}

              {/* SCHEDULE */}
              {view === "schedule" && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "system-ui, sans-serif", marginBottom: 16, color: "#1a1a2e" }}>Расписание</h2>
                  {/* Date selector */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                    {dates.map(d => {
                      const dt = new Date(d + "T00:00:00");
                      const dayName = dt.toLocaleDateString("ru", { weekday: "short" });
                      const dayNum = dt.getDate();
                      return (
                        <button key={d} onClick={() => setSelectedDate(d)} style={{
                          padding: "6px 12px", borderRadius: 6, border: selectedDate === d ? "2px solid #6366f1" : "1px solid #e5e7eb",
                          background: selectedDate === d ? "#eef2ff" : "#fff", cursor: "pointer", fontSize: 12, fontFamily: "system-ui, sans-serif",
                          color: selectedDate === d ? "#6366f1" : "#1a1a2e", fontWeight: selectedDate === d ? 600 : 400,
                        }}>
                          {dayName} {dayNum}
                        </button>
                      );
                    })}
                  </div>
                  {/* Slots grid */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {slotsForDate.map(slot => (
                      <div key={slot.id} style={{
                        display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 8, padding: "10px 14px",
                        border: `1px solid ${SLOT_STATUS_COLORS[slot.status]}30`,
                        borderLeft: `3px solid ${SLOT_STATUS_COLORS[slot.status]}`,
                        opacity: slot.status === "blocked" ? 0.5 : 1,
                      }}>
                        <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "system-ui, sans-serif", color: "#1a1a2e", minWidth: 100 }}>
                          {slot.startTime} — {slot.endTime}
                        </span>
                        <span style={{ fontSize: 11, color: SLOT_STATUS_COLORS[slot.status], fontWeight: 600, textTransform: "uppercase", minWidth: 70 }}>
                          {slot.status}
                        </span>
                        <div style={{ flex: 1 }} />
                        {slot.status === "free" && draft && !draft.slotId && (
                          <button onClick={() => { exec("select_slot", { slotId: slot.id }); setView("draft"); }}
                            style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#22c55e", color: "#fff", fontSize: 12, fontFamily: "system-ui, sans-serif", cursor: "pointer", fontWeight: 600 }}>
                            Выбрать
                          </button>
                        )}
                        {slot.status === "free" && !draft && (
                          <button onClick={() => exec("block_slot", { slotId: slot.id })}
                            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 12, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
                            Блокировать
                          </button>
                        )}
                        {slot.status === "held" && (
                          <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "system-ui, sans-serif" }}>удержан (TTL 10м)</span>
                        )}
                      </div>
                    ))}
                    {slotsForDate.length === 0 && (
                      <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>Нет слотов на эту дату</div>
                    )}
                  </div>
                </div>
              )}

              {/* BOOKINGS */}
              {view === "bookings" && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "system-ui, sans-serif", marginBottom: 16, color: "#1a1a2e" }}>Мои записи</h2>
                  {(world.bookings || []).length === 0 ? (
                    <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>Нет записей</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(world.bookings || []).sort((a, b) => b.createdAt - a.createdAt).map(booking => (
                        <div key={booking.id} style={{
                          display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 8, padding: "12px 16px",
                          border: "1px solid #e5e7eb", borderLeft: `3px solid ${BOOKING_STATUS_COLORS[booking.status]}`,
                          opacity: booking.status === "cancelled" ? 0.5 : 1,
                        }}>
                          <div style={{ flex: 1, fontFamily: "system-ui, sans-serif" }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>{booking.serviceName}</div>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>{booking.date} в {booking.startTime} · {booking.price} ₽</div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: BOOKING_STATUS_COLORS[booking.status], textTransform: "uppercase" }}>
                            {booking.status}
                          </span>
                          {booking.status === "confirmed" && (
                            <>
                              <button onClick={() => exec("complete_booking", { id: booking.id })}
                                style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "#22c55e", color: "#fff", fontSize: 12, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
                                Завершить
                              </button>
                              <button onClick={() => exec("cancel_booking", { id: booking.id })}
                                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ef4444", background: "#fff", color: "#ef4444", fontSize: 12, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
                                Отменить
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* DRAFT */}
              {view === "draft" && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "system-ui, sans-serif", marginBottom: 16, color: "#1a1a2e" }}>
                    Черновик бронирования <span style={{ color: "#f59e0b", fontSize: 14 }}>Δ</span>
                  </h2>
                  {draft ? (
                    <div style={{ background: "#fff", borderRadius: 8, padding: 20, border: "2px dashed #f59e0b", fontFamily: "system-ui, sans-serif" }}>
                      <div style={{ fontSize: 14, marginBottom: 8 }}><b>Услуга:</b> {draft.serviceName} ({draft.duration} мин)</div>
                      <div style={{ fontSize: 14, marginBottom: 8 }}><b>Цена:</b> {draft.price} ₽</div>
                      <div style={{ fontSize: 14, marginBottom: 16 }}>
                        <b>Слот:</b> {draft.slotId ? (
                          (() => {
                            const slot = (world.slots || []).find(s => s.id === draft.slotId);
                            return slot ? `${slot.date} в ${slot.startTime}` : draft.slotId;
                          })()
                        ) : (
                          <span style={{ color: "#f59e0b" }}>не выбран — <button onClick={() => setView("schedule")} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", textDecoration: "underline", fontSize: 14, fontFamily: "system-ui, sans-serif", padding: 0 }}>выбрать в расписании</button></span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { exec("confirm_booking"); setView("bookings"); }}
                          disabled={!draft.slotId}
                          style={{ padding: "10px 24px", borderRadius: 6, border: "none", background: draft.slotId ? "#6366f1" : "#d1d5db", color: "#fff", fontSize: 14, fontFamily: "system-ui, sans-serif", cursor: draft.slotId ? "pointer" : "default", fontWeight: 600 }}>
                          Подтвердить запись
                        </button>
                        <button onClick={() => { exec("abandon_draft"); setView("catalog"); }}
                          style={{ padding: "10px 24px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 14, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
                          Отменить
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>
                      Нет активного черновика. <button onClick={() => setView("catalog")} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", textDecoration: "underline", fontSize: 14, fontFamily: "system-ui, sans-serif" }}>Выбрать услугу</button>
                    </div>
                  )}
                </div>
              )}

              </>
              )}

            </div>
          </div>
        </div>

        {/* RIGHT: Effect stream */}
        <div style={{ width: 300, borderLeft: "1px solid #1e2230", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #1e2230", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Поток эффектов Φ</span>
            <span style={{ fontSize: 10, color: "#4b5068" }}>{effects.filter(e => e.intent_id !== "_seed").length} эффектов</span>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
            {effects.filter(e => e.intent_id !== "_seed").length === 0 ? (
              <div style={{ padding: 16, color: "#4b5068", fontSize: 11, textAlign: "center" }}>Пусто. Выполните намерение.</div>
            ) : [...effects].filter(e => e.intent_id !== "_seed").reverse().map(e => {
              const statusColors = { proposed: "#f59e0b", confirmed: "#22c55e", rejected: "#ef4444" };
              const statusLabels = { proposed: "● proposed", confirmed: "● confirmed", rejected: "● rejected" };
              return (
                <div key={e.id} style={{
                  padding: "6px 8px", marginBottom: 4, borderRadius: 4, fontSize: 11,
                  background: e.status === "rejected" ? "#1a0f0f" : "#13151d",
                  border: `1px solid ${e.context?.foreign ? "#60a5fa30" : e.status === "proposed" ? "#f59e0b30" : e.status === "rejected" ? "#ef444430" : "#1e2230"}`,
                  opacity: e.status === "rejected" ? 0.6 : 1,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ color: { add: "#34d399", replace: "#60a5fa", remove: "#f87171" }[e.alpha] || "#9ca3af" }}>
                      {e.alpha}
                    </span>
                    <span style={{ color: statusColors[e.status], fontSize: 10 }}>
                      {statusLabels[e.status]}
                    </span>
                  </div>
                  <div style={{ color: e.status === "rejected" ? "#ef4444" : "#c9cdd4", textDecoration: e.status === "rejected" ? "line-through" : "none" }}>
                    {e.desc}
                  </div>
                  {e.reason && <div style={{ color: "#ef4444", fontSize: 10, marginTop: 2 }}>причина: {e.reason}</div>}
                  {e.ttl && e.status === "confirmed" && <div style={{ color: "#f59e0b", fontSize: 10, marginTop: 2 }}>TTL: {e.ttl/1000}s</div>}
                  {e.context?.foreign && <div style={{ color: "#60a5fa", fontSize: 10, marginTop: 2 }}>🌐 foreign: {e.context.foreign}</div>}
                  <div style={{ color: "#4b5068", fontSize: 10, marginTop: 2 }}>ε: {e.intent_id} · {e.time}</div>
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: "1px solid #1e2230" }}>
            <div style={{ padding: "8px 12px", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Сигналы Σ</div>
            <div style={{ maxHeight: 120, overflow: "auto", padding: "0 8px 8px" }}>
              {signals.length === 0 ? (
                <div style={{ padding: 8, color: "#4b5068", fontSize: 11, textAlign: "center" }}>Нет сигналов</div>
              ) : signals.map(s => (
                <div key={s.id} style={{
                  padding: "4px 8px", marginBottom: 3, borderRadius: 4, fontSize: 10,
                  background: s.κ === "drift" ? "#1a0f0f" : "#1a0e20",
                  border: s.κ === "drift" ? "1px solid #ef444430" : "1px solid #2d1a3e",
                }}>
                  <span style={{ color: s.κ === "drift" ? "#ef4444" : "#a78bfa" }}>{s.κ === "drift" ? "⚠ ДРЕЙФ" : s.κ}</span>
                  <span style={{ color: s.κ === "drift" ? "#ef4444" : "#7c6f9b", marginLeft: 6 }}>{s.desc}</span>
                  <span style={{ color: "#4b3d66", marginLeft: 6 }}>{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
