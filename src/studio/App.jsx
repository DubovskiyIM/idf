import React, { useState, useEffect, useCallback, useRef } from "react";
import DomainPicker from "./DomainPicker.jsx";
import Graph3D from "./Graph3D.jsx";
import Inspector from "./Inspector.jsx";
import ChatDrawer from "./ChatDrawer.jsx";
import NewDomainModal from "./NewDomainModal.jsx";
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

export default function App() {
  const [domain, setDomain] = useState(null);
  const [graph, setGraph] = useState(null);
  const [selected, setSelected] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState("");
  const [newModal, setNewModal] = useState(false);
  const [pings, setPings] = useState(() => new Map());
  const prevGraphRef = useRef(null);
  const pingTimerRef = useRef(null);

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

  if (!domain) {
    return (
      <>
        <DomainPicker onPick={setDomain} onNewDomain={() => setNewModal(true)} />
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
  if (!graph) return <div style={{ padding: 24 }}>Загрузка графа…</div>;

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10, background: "#1e293b", padding: "6px 10px", borderRadius: 4, fontSize: 12 }}>
        <button onClick={() => setDomain(null)} style={{ marginRight: 8 }}>← domains</button>
        {domain} · {graph.nodes.length} узлов · ⚠ {graph.warnings.length} ·
        <button onClick={() => setChatOpen(true)} style={{ marginLeft: 8 }}>⌘K chat</button>
      </div>
      <Graph3D graph={graph} onNodeClick={setSelected} pings={pings} selectedId={selected?.id} />
      <Inspector
        node={selected}
        warnings={graph.warnings}
        onClose={() => setSelected(null)}
        onFixWithClaude={onFixWithClaude}
      />
      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        domain={domain}
        prefill={chatPrefill}
        onPrefillConsumed={() => setChatPrefill("")}
      />
    </div>
  );
}
