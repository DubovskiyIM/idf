import React, { useState, useEffect, useCallback } from "react";
import DomainPicker from "./DomainPicker.jsx";
import Graph3D from "./Graph3D.jsx";
import Inspector from "./Inspector.jsx";
import ChatDrawer from "./ChatDrawer.jsx";
import { fetchGraph } from "./api/graph.js";
import { subscribeDomain } from "./api/watch.js";

export default function App() {
  const [domain, setDomain] = useState(null);
  const [graph, setGraph] = useState(null);
  const [selected, setSelected] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState("");

  useEffect(() => {
    if (!domain) return;
    setGraph(null);
    setSelected(null);
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
    return <DomainPicker onPick={setDomain} onNewDomain={() => alert("Новый домен — Task 4.3")} />;
  }
  if (!graph) return <div style={{ padding: 24 }}>Загрузка графа…</div>;

  return (
    <div style={{ height: "100vh", position: "relative" }}>
      <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10, background: "#1e293b", padding: "6px 10px", borderRadius: 4, fontSize: 12 }}>
        <button onClick={() => setDomain(null)} style={{ marginRight: 8 }}>← domains</button>
        {domain} · {graph.nodes.length} узлов · ⚠ {graph.warnings.length} ·
        <button onClick={() => setChatOpen(true)} style={{ marginLeft: 8 }}>⌘K chat</button>
      </div>
      <Graph3D graph={graph} onNodeClick={setSelected} />
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
