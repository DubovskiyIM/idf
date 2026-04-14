import { useState, useCallback, useEffect } from "react";
import { useMantineColorScheme } from "@mantine/core";
import { useEngine } from "./runtime/engine.js";
import { PARTICLE_COLORS, ALPHA_LABELS, LINK_COLORS } from "./runtime/constants.js";
import CausalityGraph from "./components/CausalityGraph.jsx";
import OntologyInspector from "./components/OntologyInspector.jsx";
import IntegrityGraph from "./components/IntegrityGraph.jsx";

// Домены
import * as bookingDomain from "./domains/booking/domain.js";
import * as planningDomain from "./domains/planning/domain.js";
import * as workflowDomain from "./domains/workflow/domain.js";
import * as messengerDomain from "./domains/messenger/domain.js";
import * as meshokDomain from "./domains/meshok/domain.js";
import * as lifequestDomain from "./domains/lifequest/domain.js";

// Manual UI
import BookingUI from "./domains/booking/ManualUI.jsx";
import PlanningUI from "./domains/planning/ManualUI.jsx";
import WorkflowUI from "./domains/workflow/ManualUI.jsx";
import MessengerUI from "./domains/messenger/ManualUI.jsx";

// V2 рендерер — доменонезависимый shell с кристаллизатором v2
import V2Shell from "./runtime/renderer/shell/V2Shell.jsx";
import { useAuth } from "./runtime/renderer/auth/useAuth.js";
import AuthGate from "./runtime/renderer/auth/AuthGate.jsx";
import { registerUIAdapter } from "./runtime/renderer/adapters/registry.js";
import { mantineAdapter } from "./runtime/renderer/adapters/mantine/index.jsx";
import { shadcnAdapter } from "./runtime/renderer/adapters/shadcn/index.jsx";
import { appleAdapter } from "./runtime/renderer/adapters/apple/index.jsx";
import { usePersonalPrefs } from "./runtime/renderer/personal/usePersonalPrefs.js";

const UI_KITS = { mantine: mantineAdapter, shadcn: shadcnAdapter, apple: appleAdapter };
const DOMAIN_DEFAULT_KITS = { lifequest: shadcnAdapter, reflect: appleAdapter };

const DOMAINS = {
  booking: { ...bookingDomain, UI: BookingUI },
  planning: { ...planningDomain, UI: PlanningUI },
  workflow: { ...workflowDomain, UI: WorkflowUI },
  messenger: { ...messengerDomain, UI: MessengerUI },
  meshok: meshokDomain,
  lifequest: lifequestDomain,
};

export default function App() {
  const [domainId, setDomainId] = useState(() => localStorage.getItem("idf_domain") || "booking");

  // UI-kit адаптер: prefs override → дефолт домена → mantine
  const { prefs: uiPrefs } = usePersonalPrefs();
  const adapter = UI_KITS[uiPrefs?.uiKit]
    || DOMAIN_DEFAULT_KITS[domainId]
    || mantineAdapter;
  registerUIAdapter(adapter);
  const adapterKey = `kit-${uiPrefs?.uiKit || domainId}`;

  const [topView, setTopView] = useState(null); // null | "graph" | "ontology" | "integrity"
  const [tab, setTab] = useState("intents");
  const [mode, setMode] = useState(() => localStorage.getItem("idf_mode") || "manual");
  // Mantine color scheme — управляется через MantineProvider + useMantineColorScheme.
  // Синхронизация с кристаллизованным theme: оба обновляются одной функцией.
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const theme = colorScheme === "dark" ? "dark" : "light";
  const [variant, setVariant] = useState(() => localStorage.getItem("idf_variant") || "clean");
  const [viewer, setViewer] = useState(() => localStorage.getItem("idf_viewer") || "client");
  const [layer, setLayer] = useState(() => localStorage.getItem("idf_layer") || "canonical");
  const auth = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const setAndSaveMode = (v) => { setMode(v); localStorage.setItem("idf_mode", v); };
  // Mantine сама persist'ит через colorSchemeManager — просто вызываем setColorScheme
  const setAndSaveTheme = (v) => setColorScheme(v);
  const setAndSaveVariant = (v) => { setVariant(v); localStorage.setItem("idf_variant", v); };
  const setAndSaveViewer = (v) => { setViewer(v); localStorage.setItem("idf_viewer", v); };
  const setAndSaveLayer = (v) => { setLayer(v); localStorage.setItem("idf_layer", v); };

  const domain = DOMAINS[domainId];
  const realViewer = auth.currentUser ? { id: auth.currentUser.id, name: auth.currentUser.name, email: auth.currentUser.email } : null;
  const engine = useEngine(domain);
  const { world, worldForIntent, drafts, effects, signals, algebra, exec,
    overlay, overlayEntityIds, startInvestigation, commitInvestigation, cancelInvestigation } = engine;

  // Эффекты этого домена: server отдаёт эффекты всех доменов сразу, здесь
  // фильтруем по intent_id ∈ domain.INTENTS (+ служебные _seed/_sync/foreign).
  // Нужно для раздела «Граф Φ», панели Φ справа и артефактов, чтобы они
  // показывали только текущий домен.
  const domainEffects = effects.filter(e =>
    domain.INTENTS[e.intent_id] ||
    e.intent_id === "_seed" || e.intent_id === "_sync" ||
    e.context?.foreign
  );

  // Синхронизировать онтологию + намерения с сервером при смене домена
  useEffect(() => {
    const domainIdForServer = domain.DOMAIN_ID || "unknown";
    fetch(`/api/typemap?domain=${domainIdForServer}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(domain.ONTOLOGY),
    }).catch(() => {});
    fetch(`/api/intents?domain=${domainIdForServer}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(domain.INTENTS),
    }).catch(() => {});
  }, [domain]);

  // При смене домена: загрузить seed если нужно, не удалять данные других доменов
  const switchDomain = useCallback(async (newDomainId) => {
    const newDomain = DOMAINS[newDomainId];
    // Проверить: есть ли seed-данные этого домена в БД
    const seedEffects = newDomain.getSeedEffects();
    if (seedEffects.length > 0) {
      // Проверить через API — seed полный? Сравниваем количество seed-эффектов в БД с ожидаемым.
      try {
        const res = await fetch("/api/effects");
        const existing = await res.json();
        const existingSeedCount = existing.filter(e => e.intent_id === "_seed").length;
        if (existingSeedCount < seedEffects.length) {
          // Досидим недостающие эффекты (идемпотентно по id)
          const existingIds = new Set(existing.map(e => e.id));
          const missing = seedEffects.filter(e => !existingIds.has(e.id));
          if (missing.length > 0) {
            await fetch("/api/effects/seed", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(missing),
            });
          }
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
    <div key={adapterKey} style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0c0e14", color: "#c9cdd4", fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', monospace", fontSize: 13, overflow: "hidden" }}>
      {/* HEADER */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid #1e2230", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, position: "relative" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e5eb" }}>IDF</span>
        <span style={{ fontSize: 10, color: "#f59e0b", background: "#f59e0b18", padding: "1px 6px", borderRadius: 4, border: "1px solid #f59e0b30" }}>v1.2</span>

        {/* Переключатель доменов — выпадающий список */}
        <select
          value={domainId}
          onChange={e => { if (e.target.value !== domainId) switchDomain(e.target.value); }}
          style={{
            padding: "5px 10px", borderRadius: 6, fontSize: 12,
            border: "1px solid #1e2230", background: "#1e2230",
            color: "#e2e5eb", cursor: "pointer", fontFamily: "inherit",
            fontWeight: 600,
          }}
        >
          {Object.entries(DOMAINS).map(([id, d]) => (
            <option key={id} value={id}>{d.DOMAIN_NAME}</option>
          ))}
        </select>

        {/* Разделы — единый сегмент-контрол с иконками вместо отдельных кнопок */}
        <div style={{ display: "flex", background: "#1e2230", borderRadius: 6, padding: 2 }}>
          {[
            { id: null, icon: "▣", label: "Домен" },
            { id: "graph", icon: "◉", label: "Граф Φ" },
            { id: "ontology", icon: "◈", label: "Онтология" },
            { id: "integrity", icon: "△", label: "Целостность" },
          ].map(({ id, icon, label }) => {
            const active = topView === id;
            return (
              <button key={label} onClick={() => setTopView(id)} title={label}
                style={{ padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11,
                  background: active ? "#f59e0b" : "transparent",
                  color: active ? "#0c0e14" : "#6b7280",
                  fontWeight: active ? 600 : 400,
                  display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 12 }}>{icon}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 10, color: "#6b7280" }}>
          {Object.keys(domain.INTENTS).length} нам. · {domainEffects.filter(e => e.intent_id !== "_seed").length} эфф.
        </span>

        {/* Кнопка Настройки — открывает popover */}
        <button onClick={() => setSettingsOpen(v => !v)} title="Настройки"
          style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #1e2230", cursor: "pointer", fontSize: 12,
            background: settingsOpen ? "#1e2230" : "transparent", color: "#9ca3af" }}>
          ⚙ Настройки
        </button>

        {/* Popover с селекторами */}
        {settingsOpen && (
          <>
            <div onClick={() => setSettingsOpen(false)} style={{
              position: "fixed", inset: 0, zIndex: 20, background: "transparent",
            }} />
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", right: 12,
              background: "#13151d", border: "1px solid #1e2230", borderRadius: 8,
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)", padding: 12, zIndex: 21,
              display: "flex", flexDirection: "column", gap: 10, minWidth: 240,
            }}>
              <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Режим UI</div>
              <div style={{ display: "flex", background: "#1e2230", borderRadius: 6, padding: 2 }}>
                {["manual", "crystallized"].map(m => (
                  <button key={m} onClick={() => setAndSaveMode(m)} style={{
                    flex: 1, padding: "5px 10px", borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11,
                    background: mode === m ? "#f59e0b" : "transparent",
                    color: mode === m ? "#0c0e14" : "#9ca3af", fontWeight: mode === m ? 600 : 400
                  }}>{m === "manual" ? "Ручной" : "Кристаллиз."}</button>
                ))}
              </div>

              {/* Тема и вариант — всегда в настройках. Применяется к
                  кристаллизованным проекциям; ручной UI игнорирует. */}
              <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Тема и вариант</div>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={theme} onChange={e => setAndSaveTheme(e.target.value)}
                  style={{ flex: 1, fontSize: 11, padding: "5px 8px", borderRadius: 4, border: "1px solid #1e2230", background: "#1e2230", color: "#e2e5eb", cursor: "pointer" }}>
                  <option value="light">☀ Light</option>
                  <option value="dark">🌙 Dark</option>
                </select>
                <select value={variant} onChange={e => setAndSaveVariant(e.target.value)}
                  style={{ flex: 1, fontSize: 11, padding: "5px 8px", borderRadius: 4, border: "1px solid #1e2230", background: "#1e2230", color: "#e2e5eb", cursor: "pointer" }}>
                  <option value="clean">Clean</option>
                  <option value="dense">Dense</option>
                  <option value="playful">Playful</option>
                  <option value="brutalist">Brutalist</option>
                </select>
              </div>

              <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Зритель</div>
              <select value={viewer} onChange={e => setAndSaveViewer(e.target.value)}
                style={{ fontSize: 11, padding: "5px 8px", borderRadius: 4, border: "1px solid #1e2230", background: "#1e2230", color: "#e2e5eb", cursor: "pointer" }}>
                <option value="client">👤 Клиент</option>
                <option value="specialist">👨‍⚕️ Специалист</option>
                <option value="agent">🤖 Агент</option>
              </select>

              <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Слой</div>
              <select value={layer} onChange={e => setAndSaveLayer(e.target.value)}
                style={{ fontSize: 11, padding: "5px 8px", borderRadius: 4, border: "1px solid #1e2230", background: "#1e2230", color: "#e2e5eb", cursor: "pointer" }}>
                <option value="canonical">📐 Канонический</option>
                <option value="adaptive:mobile">📱 Мобильный</option>
                <option value="adaptive:agent">🔌 API</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* Граф Φ / Онтология — полноэкранно поверх основного UI.
          key={domainId} пересоздаёт CausalityGraph при смене домена —
          3d-force-graph держит WebGL-сцену, и без перемонтажа новые effects
          не отображаются корректно. */}
      {topView === "graph" && (
        <div style={{ flex: 1, background: "#1a1a2e", position: "relative" }}>
          <CausalityGraph key={domainId} effects={domainEffects} />
        </div>
      )}
      {topView === "ontology" && (
        <div style={{ flex: 1, overflow: "auto", background: "#0c0e14", color: "#e2e5eb" }}>
          <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
            <OntologyInspector world={world} domain={domain} dark />
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
                  {Object.entries(algebra || {}).map(([id, relations]) => {
                    const intentName = domain.INTENTS[id]?.name || id;
                    const edges = [
                      ...relations.sequentialOut.map(to => ({ type: "▷", to, color: "#60a5fa" })),
                      ...relations.antagonists.map(to => ({ type: "⇌", to, color: "#f472b6" })),
                      ...relations.excluding.map(to => ({ type: "⊕", to, color: "#ef4444" })),
                      ...relations.parallel.map(to => ({ type: "∥", to, color: "#9ca3af" })),
                    ];
                    if (edges.length === 0) return null;
                    return (
                      <div key={id} style={{ background: "#13151d", borderRadius: 6, padding: 8, border: "1px solid #1e2230" }}>
                        <div style={{ fontWeight: 600, color: "#e2e5eb", fontSize: 11, marginBottom: 4 }}>
                          {intentName}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {edges.map((e, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
                              <span style={{ color: e.color, fontWeight: 700, minWidth: 10 }}>{e.type}</span>
                              <span style={{ color: "#9ca3af" }}>{domain.INTENTS[e.to]?.name || e.to}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* CENTER: Domain UI */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ padding: "6px 16px", borderBottom: "1px solid #1e2230", background: "#10121a", fontSize: 10, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {domain.DOMAIN_NAME} — {mode === "crystallized" ? "кристаллизованный (v2, rules)" : "ручной UI"}
            </div>
            {mode === "manual" && domain.UI ? (
              <div style={{ flex: 1, overflow: "auto", background: "#fafafa", color: "#1a1a2e", minHeight: 0 }}>
                <div style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
                  <domain.UI world={world} worldForIntent={worldForIntent} drafts={drafts} exec={exec} execBatch={engine.execBatch} effects={effects}
                    viewer={viewer} layer={layer} overlay={overlay} overlayEntityIds={overlayEntityIds}
                    startInvestigation={startInvestigation} commitInvestigation={commitInvestigation} cancelInvestigation={cancelInvestigation} />
                </div>
              </div>
            ) : (
              // Кристаллизованный режим: универсальный V2Shell с кристаллизатором
              // v2. key={domainId} — перемонтаж при смене домена (иначе
              // useProjectionRoute держит старый стек).
              // Для workflow канвас-архетип отсутствует — V2Shell покажет
              // «проекция не поддерживается».
              <div style={{ flex: 1, background: "var(--mantine-color-body)", minHeight: 0, display: "flex", flexDirection: "column" }}>
                <AuthGate
                  currentUser={auth.currentUser}
                  doAuth={auth.doAuth}
                  authError={auth.authError}
                  isLoading={auth.isLoading}
                  title={domain.DOMAIN_NAME || domainId}
                >
                  <V2Shell
                    key={domainId}
                    domain={domain}
                    domainId={domainId}
                    world={world}
                    exec={exec}
                    execBatch={engine.execBatch}
                    viewer={realViewer || { id: viewer, name: viewer }}
                    onLogout={auth.logout}
                  />
                </AuthGate>
              </div>
            )}
          </div>

          {/* RIGHT: Effect stream — показывает только эффекты текущего домена */}
          <div style={{ width: 280, borderLeft: "1px solid #1e2230", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "6px 12px", borderBottom: "1px solid #1e2230", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>Φ</span>
              <span style={{ fontSize: 10, color: "#4b5068" }}>{domainEffects.filter(e => e.intent_id !== "_seed").length}</span>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
              {domainEffects.filter(e => e.intent_id !== "_seed" && e.intent_id !== "_sync" && e.scope !== "presentation").length === 0 ? (
                <div style={{ padding: 16, color: "#4b5068", fontSize: 11, textAlign: "center" }}>Пусто</div>
              ) : [...domainEffects].filter(e => e.intent_id !== "_seed" && e.intent_id !== "_sync" && e.scope !== "presentation").reverse().map(e => {
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
