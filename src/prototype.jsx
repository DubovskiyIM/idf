import { useState, useCallback, useEffect } from "react";
import { useEngine } from "./runtime/engine.js";
import { PARTICLE_COLORS, ALPHA_LABELS, LINK_COLORS } from "./runtime/constants.js";
import CausalityGraph from "./components/CausalityGraph.jsx";
import OntologyInspector from "./components/OntologyInspector.jsx";

// Домены
import * as bookingDomain from "./domains/booking/domain.js";
import * as planningDomain from "./domains/planning/domain.js";

// Manual UI
import BookingUI from "./domains/booking/ManualUI.jsx";
import PlanningUI from "./domains/planning/ManualUI.jsx";

// Кристаллизованные проекции planning
import PollOverview from "./crystallized/poll_overview.jsx";
import VotingMatrix from "./crystallized/voting_matrix.jsx";

const DOMAINS = {
  booking: { ...bookingDomain, UI: BookingUI },
  planning: { ...planningDomain, UI: PlanningUI },
};

export default function App() {
  const [domainId, setDomainId] = useState("booking");
  const [topView, setTopView] = useState(null); // null | "graph" | "ontology"
  const [tab, setTab] = useState("intents");
  const [mode, setMode] = useState("manual"); // "manual" | "crystallized"
  const [theme, setTheme] = useState("light"); // "light" | "dark"
  const [variant, setVariant] = useState("clean"); // "clean" | "dense" | "playful"

  const domain = DOMAINS[domainId];
  const engine = useEngine(domain);
  const { world, drafts, effects, signals, links, exec } = engine;

  // При смене домена: сбросить эффекты на сервере, загрузить seed
  const switchDomain = useCallback(async (newDomainId) => {
    const newDomain = DOMAINS[newDomainId];
    // Сбросить
    await fetch("/api/effects", { method: "DELETE" }).catch(() => {});
    // Загрузить seed нового домена
    const seedEffects = newDomain.getSeedEffects();
    if (seedEffects.length > 0) {
      await fetch("/api/effects/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seedEffects),
      }).catch(() => {});
    }
    setDomainId(newDomainId);
    setTopView(null);
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0c0e14", color: "#c9cdd4", fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', monospace", fontSize: 13, overflow: "hidden" }}>
      {/* HEADER */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid #1e2230", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e5eb" }}>IDF</span>
        <span style={{ fontSize: 11, color: "#f59e0b", background: "#f59e0b18", padding: "2px 8px", borderRadius: 4, border: "1px solid #f59e0b30" }}>v0.6</span>

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
        </div>

        {/* Режим: ручной / кристаллизованный */}
        {domainId === "planning" && (
          <div style={{ display: "flex", background: "#1e2230", borderRadius: 6, padding: 2 }}>
            {["manual", "crystallized"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 10,
                background: mode === m ? "#f59e0b" : "transparent",
                color: mode === m ? "#0c0e14" : "#6b7280", fontWeight: mode === m ? 600 : 400
              }}>{m === "manual" ? "Ручной" : "Кристалл."}</button>
            ))}
          </div>
        )}

        {/* Тема + вариант (только для кристаллизованного) */}
        {mode === "crystallized" && (
          <>
            <select value={theme} onChange={e => setTheme(e.target.value)}
              style={{ fontSize: 10, padding: "3px 6px", borderRadius: 4, border: "1px solid #1e2230", background: "#1e2230", color: "#9ca3af", cursor: "pointer" }}>
              <option value="light">☀ Light</option>
              <option value="dark">🌙 Dark</option>
            </select>
            <select value={variant} onChange={e => setVariant(e.target.value)}
              style={{ fontSize: 10, padding: "3px 6px", borderRadius: 4, border: "1px solid #1e2230", background: "#1e2230", color: "#9ca3af", cursor: "pointer" }}>
              <option value="clean">Clean</option>
              <option value="dense">Dense</option>
              <option value="playful">Playful</option>
            </select>
          </>
        )}

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
        <div style={{ flex: 1, overflow: "auto", background: "#fafafa", color: "#1a1a2e" }}>
          <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
            <OntologyInspector world={world} domain={domain} />
          </div>
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
                {mode === "manual" || domainId !== "planning" ? (
                  <domain.UI world={world} drafts={drafts} exec={exec} effects={effects} />
                ) : (
                  <>
                    <PollOverview world={world} exec={exec} theme={theme} variant={variant} />
                    <div style={{ marginTop: 24 }}>
                      <VotingMatrix world={world} theme={theme} variant={variant} />
                    </div>
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
              {effects.filter(e => e.intent_id !== "_seed" && e.intent_id !== "_sync").length === 0 ? (
                <div style={{ padding: 16, color: "#4b5068", fontSize: 11, textAlign: "center" }}>Пусто</div>
              ) : [...effects].filter(e => e.intent_id !== "_seed" && e.intent_id !== "_sync").reverse().map(e => {
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
