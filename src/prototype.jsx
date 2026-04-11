import { useState, useCallback, useEffect } from "react";
import { useEngine } from "./runtime/engine.js";
import { PARTICLE_COLORS, ALPHA_LABELS, LINK_COLORS } from "./runtime/constants.js";
import CausalityGraph from "./components/CausalityGraph.jsx";
import OntologyInspector from "./components/OntologyInspector.jsx";
import IntegrityGraph from "./components/IntegrityGraph.jsx";
import ArtifactView from "./components/ArtifactView.jsx";

// Домены
import * as bookingDomain from "./domains/booking/domain.js";
import * as planningDomain from "./domains/planning/domain.js";
import * as workflowDomain from "./domains/workflow/domain.js";
import * as messengerDomain from "./domains/messenger/domain.js";

// Manual UI
import BookingUI from "./domains/booking/ManualUI.jsx";
import PlanningUI from "./domains/planning/ManualUI.jsx";
import WorkflowUI from "./domains/workflow/ManualUI.jsx";
import MessengerUI from "./domains/messenger/ManualUI.jsx";

// Кристаллизованные проекции
import PollOverview from "./crystallized/poll_overview.jsx";
import VotingMatrix from "./crystallized/voting_matrix.jsx";
import { getStyles } from "./crystallized/theme.js";
import WorkflowCanvas from "./crystallized/workflow_canvas.jsx";
import MessengerChat from "./crystallized/messenger_chat.jsx";
import ServiceCatalog from "./crystallized/service_catalog.jsx";
import SpecialistSchedule from "./crystallized/specialist_schedule.jsx";
import MyBookings from "./crystallized/my_bookings.jsx";

const DOMAINS = {
  booking: { ...bookingDomain, UI: BookingUI },
  planning: { ...planningDomain, UI: PlanningUI },
  workflow: { ...workflowDomain, UI: WorkflowUI },
  messenger: { ...messengerDomain, UI: MessengerUI },
};

export default function App() {
  const [domainId, setDomainId] = useState(() => localStorage.getItem("idf_domain") || "booking");
  const [topView, setTopView] = useState(null); // null | "graph" | "ontology"
  const [tab, setTab] = useState("intents");
  const [bookingView, setBookingView] = useState("catalog"); // catalog | schedule | bookings | draft
  const [mode, setMode] = useState(() => localStorage.getItem("idf_mode") || "manual");
  const [theme, setTheme] = useState(() => localStorage.getItem("idf_theme") || "light");
  const [variant, setVariant] = useState(() => localStorage.getItem("idf_variant") || "clean");
  const [viewer, setViewer] = useState(() => localStorage.getItem("idf_viewer") || "client");
  const [layer, setLayer] = useState(() => localStorage.getItem("idf_layer") || "canonical");

  const setAndSaveMode = (v) => { setMode(v); localStorage.setItem("idf_mode", v); };
  const setAndSaveTheme = (v) => { setTheme(v); localStorage.setItem("idf_theme", v); };
  const setAndSaveVariant = (v) => { setVariant(v); localStorage.setItem("idf_variant", v); };
  const setAndSaveViewer = (v) => { setViewer(v); localStorage.setItem("idf_viewer", v); };
  const setAndSaveLayer = (v) => { setLayer(v); localStorage.setItem("idf_layer", v); };

  const domain = DOMAINS[domainId];
  const engine = useEngine(domain);
  const { world, worldForIntent, drafts, effects, signals, links, exec,
    overlay, overlayEntityIds, startInvestigation, commitInvestigation, cancelInvestigation } = engine;

  // Синхронизировать онтологию + намерения с сервером при смене домена
  useEffect(() => {
    const domainIdForServer = domain.DOMAIN_ID || "unknown";
    fetch(`/api/typemap?domain=${domainIdForServer}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(domain.ONTOLOGY),
    }).catch(() => {});
    fetch("/api/intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: domainIdForServer, intents: domain.INTENTS }),
    }).catch(() => {});
  }, [domain]);

  // При смене домена: загрузить seed если нужно, не удалять данные других доменов
  const switchDomain = useCallback(async (newDomainId) => {
    const newDomain = DOMAINS[newDomainId];
    // Проверить: есть ли seed-данные этого домена в БД
    const seedEffects = newDomain.getSeedEffects();
    if (seedEffects.length > 0) {
      // Проверить через API есть ли уже seed этого домена
      try {
        const res = await fetch("/api/effects");
        const existing = await res.json();
        const hasSeed = existing.some(e => e.intent_id === "_seed" && seedEffects.some(s => s.context?.id && JSON.stringify(e.context)?.includes(s.context.id)));
        if (!hasSeed) {
          await fetch("/api/effects/seed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(seedEffects),
          });
        }
      } catch {}
    }
    // Отправить онтологию + intents нового домена на сервер
    await fetch(`/api/typemap?domain=${newDomainId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDomain.ONTOLOGY),
    }).catch(() => {});
    await fetch("/api/intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: newDomainId, intents: newDomain.INTENTS }),
    }).catch(() => {});

    setDomainId(newDomainId);
    localStorage.setItem("idf_domain", newDomainId);
    setTopView(null);
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0c0e14", color: "#c9cdd4", fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', monospace", fontSize: 13, overflow: "hidden" }}>
      {/* HEADER */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #1e2230", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e5eb" }}>IDF</span>
        <span style={{ fontSize: 11, color: "#f59e0b", background: "#f59e0b18", padding: "2px 8px", borderRadius: 4, border: "1px solid #f59e0b30" }}>v1.0</span>

        {/* Переключатель доменов */}
        <div style={{ display: "flex", background: "#1e2230", borderRadius: 6, padding: 2 }}>
          {Object.entries(DOMAINS).map(([id, d]) => (
            <button key={id} onClick={() => { if (id !== domainId) switchDomain(id); }}
              style={{ padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11,
                background: domainId === id ? "#6366f1" : "transparent",
                color: domainId === id ? "#fff" : "#6b7280", fontWeight: domainId === id ? 600 : 400 }}>
              {d.DOMAIN_NAME}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Граф Φ и Онтология — в топбаре */}
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setTopView(topView === "graph" ? null : "graph")}
            style={{ padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11,
              background: topView === "graph" ? "#f59e0b" : "#1e2230",
              color: topView === "graph" ? "#0c0e14" : "#6b7280", fontWeight: topView === "graph" ? 600 : 400 }}>
            Граф Φ
          </button>
          <button onClick={() => setTopView(topView === "ontology" ? null : "ontology")}
            style={{ padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11,
              background: topView === "ontology" ? "#f59e0b" : "#1e2230",
              color: topView === "ontology" ? "#0c0e14" : "#6b7280", fontWeight: topView === "ontology" ? 600 : 400 }}>
            Онтология
          </button>
          <button onClick={() => setTopView(topView === "integrity" ? null : "integrity")}
            style={{ padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11,
              background: topView === "integrity" ? "#f59e0b" : "#1e2230",
              color: topView === "integrity" ? "#0c0e14" : "#6b7280", fontWeight: topView === "integrity" ? 600 : 400 }}>
            Целостность
          </button>
          <button onClick={() => setTopView(topView === "artifacts" ? null : "artifacts")}
            style={{ padding: "4px 12px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11,
              background: topView === "artifacts" ? "#8b5cf6" : "#1e2230",
              color: topView === "artifacts" ? "#fff" : "#6b7280", fontWeight: topView === "artifacts" ? 600 : 400 }}>
            🔮 Артефакты
          </button>
        </div>

        {/* Режим: ручной / кристаллизованный */}
        <div style={{ display: "flex", background: "#1e2230", borderRadius: 6, padding: 2 }}>
          {["manual", "crystallized"].map(m => (
            <button key={m} onClick={() => setAndSaveMode(m)} style={{
              padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 10,
              background: mode === m ? "#f59e0b" : "transparent",
              color: mode === m ? "#0c0e14" : "#6b7280", fontWeight: mode === m ? 600 : 400
            }}>{m === "manual" ? "Ручной" : "Кристалл."}</button>
          ))}
        </div>

        {/* Тема + вариант (только для кристаллизованного) */}
        {mode === "crystallized" && (
          <>
            <select value={theme} onChange={e => setAndSaveTheme(e.target.value)}
              style={{ fontSize: 10, padding: "3px 6px", borderRadius: 4, border: "1px solid #1e2230", background: "#1e2230", color: "#9ca3af", cursor: "pointer" }}>
              <option value="light">☀ Light</option>
              <option value="dark">🌙 Dark</option>
            </select>
            <select value={variant} onChange={e => setAndSaveVariant(e.target.value)}
              style={{ fontSize: 10, padding: "3px 6px", borderRadius: 4, border: "1px solid #1e2230", background: "#1e2230", color: "#9ca3af", cursor: "pointer" }}>
              <option value="clean">Clean</option>
              <option value="dense">Dense</option>
              <option value="playful">Playful</option>
              <option value="brutalist">Brutalist</option>
            </select>
          </>
        )}

        {/* Зритель + слой */}
        <select value={viewer} onChange={e => setAndSaveViewer(e.target.value)}
          style={{ fontSize: 10, padding: "3px 6px", borderRadius: 4, border: "1px solid #1e2230", background: "#1e2230", color: "#9ca3af", cursor: "pointer" }}>
          <option value="client">👤 Клиент</option>
          <option value="specialist">👨‍⚕️ Специалист</option>
          <option value="agent">🤖 Агент</option>
        </select>
        <select value={layer} onChange={e => setAndSaveLayer(e.target.value)}
          style={{ fontSize: 10, padding: "3px 6px", borderRadius: 4, border: "1px solid #1e2230", background: "#1e2230", color: "#9ca3af", cursor: "pointer" }}>
          <option value="canonical">📐 Канонический</option>
          <option value="adaptive:mobile">📱 Мобильный</option>
          <option value="adaptive:agent">🔌 API</option>
        </select>

        <span style={{ fontSize: 11, color: "#6b7280" }}>
          {Object.keys(domain.INTENTS).length} намерений · {effects.filter(e => e.intent_id !== "_seed").length} эффектов
        </span>
      </div>

      {/* Граф Φ / Онтология — полноэкранно поверх основного UI */}
      {topView === "graph" && (
        <div style={{ flex: 1, background: "#1a1a2e", position: "relative" }}>
          <CausalityGraph effects={effects} />
        </div>
      )}
      {topView === "ontology" && (
        <div style={{ flex: 1, overflow: "auto", background: "#0c0e14", color: "#e2e5eb" }}>
          <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
            <OntologyInspector world={world} domain={domain} dark />
          </div>
        </div>
      )}
      {topView === "artifacts" && (
        <div style={{ flex: 1, overflow: "auto", background: "#fafafa", color: "#1a1a2e" }}>
          <div style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
            <ArtifactView domain={domain} world={world} exec={exec} viewer={viewer} />
          </div>
        </div>
      )}
      {topView === "integrity" && (
        <div style={{ flex: 1, background: "#1a1a2e", position: "relative" }}>
          <IntegrityGraph domain={domain} />
        </div>
      )}

      {/* Основной UI (скрыт когда открыт граф/онтология) */}
      {!topView && (
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* LEFT: Definitions */}
          <div style={{ width: 320, borderRight: "1px solid #1e2230", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ display: "flex", borderBottom: "1px solid #1e2230" }}>
              {["intents", "algebra"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "8px 0", background: tab === t ? "#161923" : "transparent", color: tab === t ? "#e2e5eb" : "#6b7280", border: "none", cursor: "pointer", fontSize: 12, borderBottom: tab === t ? "2px solid #f59e0b" : "2px solid transparent" }}>
                  {t === "intents" ? "Намерения" : "Алгебра"}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
              {tab === "intents" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Намерения</div>
                  {Object.entries(domain.INTENTS).map(([id, intent]) => (
                    <div key={id} style={{ background: "#13151d", borderRadius: 6, padding: 8, border: "1px solid #1e2230" }}>
                      <div style={{ fontWeight: 600, color: "#e2e5eb", marginBottom: 4, fontSize: 11 }}>{intent.name} <span style={{ color: "#4b5068", fontWeight: 400 }}>({id})</span></div>
                      {Object.entries(intent.particles).map(([pName, pVal]) => {
                        const vals = Array.isArray(pVal) ? pVal : [pVal];
                        if (vals.length === 0 && pName !== "effects") return null;
                        return (
                          <div key={pName} style={{ marginBottom: 2, display: "flex", gap: 4, alignItems: "flex-start" }}>
                            <span style={{ fontSize: 9, color: PARTICLE_COLORS[pName] || "#6b7280", minWidth: 65, flexShrink: 0 }}>{pName}</span>
                            <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.3 }}>
                              {pName === "effects" ? vals.map((e, i) => (
                                <span key={i} style={{ display: "inline-block", background: "#34d39915", color: "#34d399", padding: "1px 4px", borderRadius: 3, marginRight: 2, fontSize: 9 }}>{ALPHA_LABELS[e.α]} {e.target}</span>
                              )) : vals.map((v, i) => (
                                <span key={i}>{typeof v === "object" ? JSON.stringify(v) : v}{i < vals.length - 1 ? ", " : ""}</span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {intent.antagonist && <div style={{ marginTop: 2, fontSize: 9, color: "#f472b6" }}>⇌ {intent.antagonist}</div>}
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 8 }}>Проекции</div>
                  {Object.entries(domain.PROJECTIONS).map(([id, proj]) => (
                    <div key={id} style={{ background: "#13151d", borderRadius: 6, padding: 8, border: "1px solid #1e2230" }}>
                      <div style={{ fontWeight: 600, color: "#e2e5eb", fontSize: 11 }}>{proj.name}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>Q: {proj.query}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Связи</div>
                  {links.map((l, i) => (
                    <div key={i} style={{ background: "#13151d", borderRadius: 6, padding: 8, border: "1px solid #1e2230", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#e2e5eb" }}>{domain.INTENTS[l.from]?.name}</span>
                      <span style={{ color: LINK_COLORS[l.type], fontWeight: 700, fontSize: 12 }}>{l.type}</span>
                      <span style={{ fontSize: 10, color: "#e2e5eb" }}>{domain.INTENTS[l.to]?.name}</span>
                      <span style={{ fontSize: 9, color: "#6b7280", marginLeft: "auto" }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CENTER: Domain UI */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ padding: "6px 16px", borderBottom: "1px solid #1e2230", background: "#10121a", fontSize: 10, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {domain.DOMAIN_NAME} — {mode === "crystallized" ? `кристаллизованный (${variant}, ${theme})` : "ручной UI"}
            </div>
            <div style={{ flex: 1, overflow: "auto", background: theme === "dark" && mode === "crystallized" ? "#0c0e14" : "#fafafa", color: theme === "dark" && mode === "crystallized" ? "#e2e5eb" : "#1a1a2e" }}>
              <div style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
                {mode === "manual" ? (
                  <domain.UI world={world} worldForIntent={worldForIntent} drafts={drafts} exec={exec} effects={effects}
                    viewer={viewer} layer={layer} overlay={overlay} overlayEntityIds={overlayEntityIds}
                    startInvestigation={startInvestigation} commitInvestigation={commitInvestigation} cancelInvestigation={cancelInvestigation} />
                ) : domainId === "messenger" ? (
                  <MessengerChat world={world} exec={exec} theme={theme} variant={variant} />
                ) : domainId === "workflow" ? (
                  <WorkflowCanvas world={world} exec={exec} theme={theme} variant={variant} viewer={viewer} layer={layer} />
                ) : domainId === "planning" ? (
                  <>
                    <PollOverview world={world} exec={exec} theme={theme} variant={variant} />
                    <div style={{ marginTop: 24 }}>
                      <VotingMatrix world={world} theme={theme} variant={variant} />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Booking кристаллизованный — вкладки */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                      {[
                        { id: "catalog", label: "Каталог" },
                        { id: "schedule", label: "Расписание" },
                        { id: "bookings", label: "Записи" },
                      ].map(v => (
                        <button key={v.id} onClick={() => setBookingView(v.id)}
                          style={{ padding: "6px 14px", borderRadius: 6, border: bookingView === v.id ? `2px solid ${theme === "dark" ? "#818cf8" : "#6366f1"}` : `1px solid ${theme === "dark" ? "#1e2230" : "#d1d5db"}`,
                            background: bookingView === v.id ? (theme === "dark" ? "#1e1b4b" : "#eef2ff") : (theme === "dark" ? "#13151d" : "#fff"),
                            color: theme === "dark" ? "#e2e5eb" : "#1a1a2e", fontSize: 12, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
                          {v.label}
                        </button>
                      ))}
                      {(drafts || []).length > 0 && (
                        <button onClick={() => setBookingView("draft")}
                          style={{ padding: "6px 14px", borderRadius: 6, border: `2px dashed ${theme === "dark" ? "#fbbf24" : "#f59e0b"}`,
                            background: bookingView === "draft" ? (theme === "dark" ? "#422006" : "#fffbeb") : "transparent",
                            color: theme === "dark" ? "#fbbf24" : "#f59e0b", fontSize: 12, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
                          Черновик Δ
                        </button>
                      )}
                    </div>
                    {bookingView === "catalog" && (
                      <ServiceCatalog world={world} exec={(...args) => { exec(...args); setBookingView("schedule"); }} drafts={drafts} theme={theme} variant={variant} viewer={viewer} layer={layer} />
                    )}
                    {bookingView === "schedule" && (
                      <SpecialistSchedule world={world} exec={(...args) => { exec(...args); if (args[0] === "select_slot") setBookingView("draft"); }} drafts={drafts} theme={theme} variant={variant} viewer={viewer} layer={layer} />
                    )}
                    {bookingView === "bookings" && (
                      <MyBookings world={world} exec={exec} theme={theme} variant={variant} viewer={viewer} layer={layer} />
                    )}
                    {bookingView === "draft" && (drafts || []).length > 0 && (() => {
                      const draft = drafts[0];
                      const slot = (world.slots || []).find(s => s.id === draft.slotId);
                      const s = getStyles(theme, variant);
                      return (
                        <div style={s.container}>
                          <h2 style={{ ...s.heading("h1"), marginBottom: s.v.gap }}>Черновик Δ</h2>
                          <div style={{ ...s.card, border: `2px dashed ${s.t.warning}` }}>
                            <div style={{ ...s.text("body"), marginBottom: 8 }}><b>Услуга:</b> {draft.serviceName} ({draft.duration} мин) · {draft.price} ₽</div>
                            <div style={{ ...s.text("body"), marginBottom: 16 }}>
                              <b>Слот:</b> {slot ? `${slot.date} ${slot.startTime}` : <span style={{ color: s.t.warning }}>не выбран — <button onClick={() => setBookingView("schedule")} style={{ background: "none", border: "none", color: s.t.accent, cursor: "pointer", textDecoration: "underline", fontSize: s.v.fontSize.body, fontFamily: s.v.font }}>выбрать</button></span>}
                            </div>
                            <div style={{ display: "flex", gap: s.v.gap }}>
                              <button onClick={() => { exec("confirm_booking"); setBookingView("bookings"); }}
                                disabled={!draft.slotId} style={draft.slotId ? s.button() : { ...s.button("muted"), cursor: "default" }}>Подтвердить</button>
                              <button onClick={() => { exec("abandon_draft"); setBookingView("catalog"); }}
                                style={s.buttonOutline()}>Отменить</button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {bookingView === "draft" && (drafts || []).length === 0 && (
                      <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>
                        Нет черновика. <button onClick={() => setBookingView("catalog")} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", textDecoration: "underline" }}>Выбрать услугу</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Effect stream */}
          <div style={{ width: 280, borderLeft: "1px solid #1e2230", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "6px 12px", borderBottom: "1px solid #1e2230", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>Φ</span>
              <span style={{ fontSize: 10, color: "#4b5068" }}>{effects.filter(e => e.intent_id !== "_seed").length}</span>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
              {effects.filter(e => e.intent_id !== "_seed" && e.intent_id !== "_sync" && e.scope !== "presentation").length === 0 ? (
                <div style={{ padding: 16, color: "#4b5068", fontSize: 11, textAlign: "center" }}>Пусто</div>
              ) : [...effects].filter(e => e.intent_id !== "_seed" && e.intent_id !== "_sync" && e.scope !== "presentation").reverse().map(e => {
                const statusColors = { proposed: "#f59e0b", confirmed: "#22c55e", rejected: "#ef4444" };
                return (
                  <div key={e.id} style={{
                    padding: "5px 7px", marginBottom: 3, borderRadius: 4, fontSize: 10,
                    background: e.status === "rejected" ? "#1a0f0f" : "#13151d",
                    border: `1px solid ${e.context?.foreign ? "#60a5fa30" : e.status === "rejected" ? "#ef444430" : "#1e2230"}`,
                    opacity: e.status === "rejected" ? 0.6 : 1,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 1 }}>
                      <span style={{ color: { add: "#34d399", replace: "#60a5fa", remove: "#f87171" }[e.alpha] || "#9ca3af" }}>{e.alpha}</span>
                      <span style={{ color: statusColors[e.status], fontSize: 9 }}>● {e.status}</span>
                    </div>
                    <div style={{ color: e.status === "rejected" ? "#ef4444" : "#c9cdd4", fontSize: 10 }}>{e.desc}</div>
                    {e.context?.foreign && <div style={{ color: "#60a5fa", fontSize: 9 }}>🌐 {e.context.foreign}</div>}
                    <div style={{ color: "#4b5068", fontSize: 9 }}>ε: {e.intent_id}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: "1px solid #1e2230" }}>
              <div style={{ padding: "6px 12px", fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>Σ</div>
              <div style={{ maxHeight: 100, overflow: "auto", padding: "0 6px 6px" }}>
                {signals.length === 0 ? (
                  <div style={{ padding: 6, color: "#4b5068", fontSize: 10, textAlign: "center" }}>—</div>
                ) : signals.map(s => (
                  <div key={s.id} style={{
                    padding: "3px 6px", marginBottom: 2, borderRadius: 4, fontSize: 9,
                    background: s.κ === "drift" ? "#1a0f0f" : "#1a0e20",
                    border: s.κ === "drift" ? "1px solid #ef444430" : "1px solid #2d1a3e",
                  }}>
                    <span style={{ color: s.κ === "drift" ? "#ef4444" : "#a78bfa" }}>{s.κ === "drift" ? "⚠ ДРЕЙФ" : s.κ}</span>
                    <span style={{ color: s.κ === "drift" ? "#ef4444" : "#7c6f9b", marginLeft: 4 }}>{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
