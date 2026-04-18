import React, { useState, useEffect, useCallback, useRef } from "react";
import DomainPicker from "./DomainPicker.jsx";
import Graph3D from "./Graph3D.jsx";
import Inspector from "./Inspector.jsx";
import ChatDrawer from "./ChatDrawer.jsx";
import NewDomainModal from "./NewDomainModal.jsx";
import ThinkingCat from "./ThinkingCat.jsx";
import ProgressOverlay from "./ProgressOverlay.jsx";
import PrototypeReadyCTA from "./PrototypeReadyCTA.jsx";
import PatternsView from "./patterns/PatternsView.jsx";
import DomainRuntime from "../runtime/DomainRuntime.jsx";
import { fetchGraph } from "./api/graph.js";
import { subscribeDomain } from "./api/watch.js";

function nodeSignature(n) {
  if (n.kind === "entity") return JSON.stringify({ fields: n.fields, ownerField: n.ownerField, statuses: n.statuses });
  if (n.kind === "intent") return JSON.stringify(n.particles);
  if (n.kind === "role") return JSON.stringify({ base: n.base, canInvoke: n.canInvoke });
  if (n.kind === "projection") return JSON.stringify({ archetype: n.archetype, source: n.source });
  return JSON.stringify(n);
}

function computeDiff(oldGraph, newGraph) {
  const diff = new Map();
  const oldMap = new Map(oldGraph.nodes.map((n) => [n.id, n]));
  for (const n of newGraph.nodes) {
    const prev = oldMap.get(n.id);
    if (!prev) {
      diff.set(n.id, "added");
    } else if (nodeSignature(prev) !== nodeSignature(n)) {
      diff.set(n.id, "changed");
    }
  }
  return diff;
}

// Верхний tab-strip: переключатель между Graph (структура) / Прототип
// (runtime-UI того же домена) / Patterns (Pattern Bank). Высота 44px
// фиксирована, вложенные view рассчитывают через calc(100vh - 44px).
function TabStrip({ view, setView, domainName }) {
  const tabStyle = (active) => ({
    padding: "10px 20px",
    cursor: "pointer",
    background: active ? "#1e293b" : "transparent",
    color: active ? "#e0e7ff" : "#94a3b8",
    border: "none",
    borderBottom: active ? "2px solid #60a5fa" : "2px solid transparent",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    fontFamily: "inherit",
    outline: "none",
  });
  return (
    <div
      style={{
        height: 44,
        display: "flex",
        alignItems: "center",
        background: "#0b1220",
        borderBottom: "1px solid #1e293b",
        paddingRight: 16,
      }}
    >
      <div style={{ display: "flex" }}>
        <button onClick={() => setView("graph")} style={tabStyle(view === "graph")}>Граф</button>
        <button onClick={() => setView("prototype")} style={tabStyle(view === "prototype")}>Прототип</button>
        <button onClick={() => setView("patterns")} style={tabStyle(view === "patterns")}>Паттерны</button>
      </div>
      <div style={{ flex: 1 }} />
      {domainName && (
        <div style={{ fontSize: 12, color: "#64748b", fontFamily: "ui-monospace, 'SF Mono', monospace" }}>
          {domainName}
        </div>
      )}
    </div>
  );
}

function initialDomainFromUrl() {
  if (typeof window === "undefined") return null;
  try { return new URLSearchParams(window.location.search).get("domain"); }
  catch { return null; }
}
function initialViewFromUrl() {
  if (typeof window === "undefined") return "graph";
  try {
    const v = new URLSearchParams(window.location.search).get("view");
    return ["graph", "prototype", "patterns"].includes(v) ? v : "graph";
  } catch { return "graph"; }
}

export default function App() {
  const [view, setView] = useState(() => initialViewFromUrl());
  const [domain, setDomain] = useState(() => initialDomainFromUrl());
  const [graph, setGraph] = useState(null);
  const [selected, setSelected] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState("");
  const [newModal, setNewModal] = useState(false);
  const [pings, setPings] = useState(() => new Map());
  const prevGraphRef = useRef(null);
  const pingTimerRef = useRef(null);
  const [flyToken, setFlyToken] = useState(0);
  const [chatBusy, setChatBusy] = useState(false);
  const [progress, setProgress] = useState({ lastTool: null, toolCount: 0 });
  const [readyDomain, setReadyDomain] = useState(null);

  useEffect(() => { setReadyDomain(null); setProgress({ lastTool: null, toolCount: 0 }); }, [domain]);
  useEffect(() => { if (chatBusy) { setReadyDomain(null); setProgress({ lastTool: null, toolCount: 0 }); } }, [chatBusy]);

  useEffect(() => {
    if (!domain) return;
    setGraph(null);
    setSelected(null);
    prevGraphRef.current = null;
    setPings(new Map());
    fetchGraph(domain).then(setGraph).catch((e) => console.warn(e));
    let debounceTimer;
    const unsub = subscribeDomain(domain, () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchGraph(domain).then(setGraph).catch((e) => console.warn(e));
      }, 300);
    });
    return () => { unsub(); clearTimeout(debounceTimer); };
  }, [domain]);

  useEffect(() => {
    if (!graph) return;
    const prev = prevGraphRef.current;
    prevGraphRef.current = graph;
    if (!prev) return;
    const diff = computeDiff(prev, graph);
    if (diff.size === 0) return;
    setPings(diff);
    clearTimeout(pingTimerRef.current);
    pingTimerRef.current = setTimeout(() => setPings(new Map()), 3500);
  }, [graph]);

  useEffect(() => {
    if (!domain) return;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setChatOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setSelected(null);
        setChatOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [domain]);

  const onFixWithClaude = useCallback((node, warning) => {
    setChatPrefill(`В \`${node.intentId}\` ошибка анкеринга: "${warning.message}". Найди частицу и привяжи к правильному полю или удали. Перед Edit — Read файл и Grep похожие паттерны.`);
    setChatOpen(true);
  }, []);

  const renderGraphView = () => {
    if (!domain) {
      return (
        <>
          <DomainPicker
            onPick={setDomain}
            onNewDomain={() => setNewModal(true)}
            onGenerateFromDescription={({ slug, name, description }) => {
              setDomain(slug);
              setChatPrefill(`Создай начальный набор intents/entities/projections для домена "${name}". Описание процесса: ${description}. Следуй паттерну booking (как простейшего домена). Начни с ontology.entities, потом intents с частицами, в конце projections (feed/catalog/detail/form под archetype). Кратко отчитайся какие intents/entities созданы.`);
              setChatOpen(true);
            }}
          />
          {newModal && (
            <NewDomainModal
              onClose={() => setNewModal(false)}
              onCreated={({ name, prompt }) => {
                setNewModal(false);
                setDomain(name);
                if (prompt) {
                  setChatPrefill(`Создай начальный набор intents/entities/projections для домена "${name}": ${prompt}. Следуй паттерну booking (как простейшего домена). Начни с ontology.entities, потом intents с частицами.`);
                  setChatOpen(true);
                }
              }}
            />
          )}
        </>
      );
    }
    if (!graph) return <div style={{ padding: 24, color: "#94a3b8" }}>Загрузка графа…</div>;

    return (
      <div style={{ height: "calc(100vh - 44px)", position: "relative", background: "#0b1220" }}>
        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, background: "#1e293b", padding: "6px 12px", borderRadius: 6, fontSize: 12, display: "flex", alignItems: "center", gap: 10, color: "#cbd5e1" }}>
          <button onClick={() => setDomain(null)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, padding: 0 }}>← домены</button>
          <span style={{ color: "#475569" }}>·</span>
          <span>{graph.nodes.length} узлов</span>
          <span style={{ color: "#475569" }}>·</span>
          <span style={{ color: graph.warnings.length > 0 ? "#eab308" : "#94a3b8" }}>⚠ {graph.warnings.length}</span>
          <span style={{ color: "#475569" }}>·</span>
          <button onClick={() => setChatOpen(true)} style={{ background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: 12, padding: 0 }}>⌘K chat</button>
        </div>
        <Graph3D graph={graph} onNodeClick={setSelected} pings={pings} selectedId={selected?.id} flyToken={flyToken} />
        <ThinkingCat visible={chatBusy} />
        <ProgressOverlay
          busy={chatBusy}
          toolCount={progress.toolCount}
          lastTool={progress.lastTool}
          phase="Claude генерирует домен"
        />
        <PrototypeReadyCTA
          visible={!!readyDomain && !chatBusy}
          domain={readyDomain}
          intentsCount={graph.nodes.filter((n) => n.kind === "intent").length}
          entitiesCount={graph.nodes.filter((n) => n.kind === "entity").length}
          onDismiss={() => setReadyDomain(null)}
          onOpenPrototype={() => { setReadyDomain(null); setView("prototype"); }}
        />
        <Inspector
          node={selected}
          warnings={graph.warnings}
          onClose={() => setSelected(null)}
          onFixWithClaude={onFixWithClaude}
          onFlyTo={() => setFlyToken((t) => t + 1)}
        />
      </div>
    );
  };

  const renderPrototypeView = () => {
    if (!domain) {
      return (
        <div style={{ height: "calc(100vh - 44px)", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#94a3b8", fontFamily: "Inter, system-ui, sans-serif" }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>▢</div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, color: "#e2e8f0" }}>Сначала выбери домен</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
              Во вкладке <button onClick={() => setView("graph")} style={{ background: "transparent", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: 13, padding: 0, textDecoration: "underline" }}>Граф</button> открой или создай домен — runtime-UI появится здесь.
            </div>
          </div>
        </div>
      );
    }
    return (
      <div style={{ height: "calc(100vh - 44px)", background: "#0f172a" }}>
        <DomainRuntime domainId={domain} embedded />
      </div>
    );
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0b1220", color: "#e2e8f0", fontFamily: "Inter, -apple-system, system-ui, sans-serif" }}>
      <TabStrip view={view} setView={setView} domainName={domain} />
      {view === "graph" ? renderGraphView()
        : view === "prototype" ? renderPrototypeView()
        : <PatternsView />}
      {/* Chat доступен всегда когда выбран домен — не привязан к Graph-tab */}
      {domain && (
        <ChatDrawer
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          domain={domain}
          prefill={chatPrefill}
          onPrefillConsumed={() => setChatPrefill("")}
          onBusyChange={setChatBusy}
          onProgress={setProgress}
          onDone={() => setReadyDomain(domain)}
        />
      )}
    </div>
  );
}
