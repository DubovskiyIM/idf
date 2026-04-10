import { useState, useMemo, useCallback, useRef, useEffect } from "react";

const STATUS_COLORS = {
  proposed: "#f59e0b",
  confirmed: "#22c55e",
  rejected: "#ef4444",
};

const FOREIGN_COLOR = "#60a5fa";

const ALPHA_SIZE = {
  add: 20,
  replace: 14,
  remove: 8,
};

export default function CausalityGraph({ effects }) {
  const [showAll, setShowAll] = useState(false);
  const [showOnlyRejected, setShowOnlyRejected] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const containerRef = useRef();
  const graphInstanceRef = useRef(null);

  const filteredEffects = useMemo(() => {
    let filtered = effects;
    if (!showAll) {
      filtered = filtered.filter(e => e.intent_id !== "_seed" && e.intent_id !== "_sync");
    }
    if (showOnlyRejected) {
      filtered = filtered.filter(e => e.status === "rejected");
    }
    return filtered;
  }, [effects, showAll, showOnlyRejected]);

  const highlightIds = useMemo(() => {
    if (!selectedId) return null;
    const ids = new Set();
    ids.add(selectedId);
    const findAncestors = (id) => {
      const ef = effects.find(e => e.id === id);
      if (ef?.parent_id) { ids.add(ef.parent_id); findAncestors(ef.parent_id); }
    };
    findAncestors(selectedId);
    const findDescendants = (id) => {
      effects.filter(e => e.parent_id === id).forEach(e => { ids.add(e.id); findDescendants(e.id); });
    };
    findDescendants(selectedId);
    return ids;
  }, [selectedId, effects]);

  const graphData = useMemo(() => {
    const effectIds = new Set(filteredEffects.map(e => e.id));
    const nodes = filteredEffects.map(e => ({
      id: e.id,
      name: e.desc || `${e.alpha} ${e.intent_id}`,
      val: ALPHA_SIZE[e.alpha] || 5,
      color: e.context?.foreign ? FOREIGN_COLOR : STATUS_COLORS[e.status] || "#6b7280",
      effect: e,
    }));

    const links = [];
    for (const e of filteredEffects) {
      if (e.parent_id && effectIds.has(e.parent_id)) {
        links.push({ source: e.parent_id, target: e.id, color: "#ffffff66", type: "causal" });
      }
    }
    const groups = {};
    for (const e of filteredEffects) {
      if (e.intent_id === "_seed" || e.intent_id === "_sync") continue;
      const key = `${e.intent_id}_${e.created_at}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e.id);
    }
    for (const ids of Object.values(groups)) {
      if (ids.length > 1) {
        for (let i = 1; i < ids.length; i++) {
          links.push({ source: ids[0], target: ids[i], color: "#ffffff22", type: "group" });
        }
      }
    }
    return { nodes, links };
  }, [filteredEffects]);

  const selectedEffect = useMemo(() => effects.find(e => e.id === selectedId), [effects, selectedId]);

  // Инициализация 3d-force-graph напрямую (без React-обёртки)
  useEffect(() => {
    let graph;
    let destroyed = false;

    import("3d-force-graph").then(mod => {
      if (destroyed || !containerRef.current) return;
      const ForceGraph3D = mod.default;
      const el = containerRef.current;
      const rect = el.getBoundingClientRect();

      graph = new ForceGraph3D()(el)
        .backgroundColor("#1a1a2e")
        .width(rect.width)
        .height(rect.height)
        .nodeLabel("name")
        .nodeVal("val")
        .nodeColor(n => n.color)
        .nodeOpacity(0.9)
        .linkColor(l => l.type === "causal" ? "#88aaffcc" : "#88aaff55")
        .linkWidth(l => l.type === "causal" ? 3 : 1)
        .linkDirectionalArrowLength(6)
        .linkDirectionalArrowRelPos(1)
        .onNodeClick(node => {
          setSelectedId(prev => prev === node.id ? null : node.id);
        })
        .graphData(graphData);

      graphInstanceRef.current = graph;

      const onResize = () => {
        if (containerRef.current && graph) {
          const r = containerRef.current.getBoundingClientRect();
          graph.width(r.width).height(r.height);
        }
      };
      window.addEventListener("resize", onResize);
      graph._resizeHandler = onResize;
    });

    return () => {
      destroyed = true;
      if (graph) {
        window.removeEventListener("resize", graph._resizeHandler);
        graph._destructor?.();
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      graphInstanceRef.current = null;
    };
  }, []);

  // Обновить данные при изменении
  useEffect(() => {
    if (graphInstanceRef.current) {
      graphInstanceRef.current.graphData(graphData);
    }
  }, [graphData]);

  // Обновить цвета при highlight
  useEffect(() => {
    if (graphInstanceRef.current) {
      graphInstanceRef.current
        .nodeColor(node => {
          if (!highlightIds) return node.color;
          return highlightIds.has(node.id) ? node.color : "#555555";
        })
        .nodeOpacity(highlightIds ? undefined : 0.9)
        .linkColor(link => {
          if (!highlightIds) return link.type === "causal" ? "#88aaffcc" : "#88aaff55";
          const srcId = typeof link.source === "object" ? link.source.id : link.source;
          const tgtId = typeof link.target === "object" ? link.target.id : link.target;
          return (highlightIds.has(srcId) && highlightIds.has(tgtId)) ? "#ffcc00" : "#333333";
        })
        .linkWidth(link => {
          if (!highlightIds) return link.type === "causal" ? 3 : 1;
          const srcId = typeof link.source === "object" ? link.source.id : link.source;
          const tgtId = typeof link.target === "object" ? link.target.id : link.target;
          return (highlightIds.has(srcId) && highlightIds.has(tgtId)) ? 5 : 0.3;
        });
    }
  }, [highlightIds]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Контейнер для графа */}
      <div ref={containerRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* Фильтры */}
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, display: "flex", gap: 8 }}>
        <label style={{ fontSize: 11, fontFamily: "system-ui, sans-serif", color: "#6b7280", display: "flex", alignItems: "center", gap: 4, background: "#fff", padding: "4px 10px", borderRadius: 6, border: "1px solid #e5e7eb", cursor: "pointer" }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Все эффекты
        </label>
        <label style={{ fontSize: 11, fontFamily: "system-ui, sans-serif", color: "#6b7280", display: "flex", alignItems: "center", gap: 4, background: "#fff", padding: "4px 10px", borderRadius: 6, border: "1px solid #e5e7eb", cursor: "pointer" }}>
          <input type="checkbox" checked={showOnlyRejected} onChange={e => setShowOnlyRejected(e.target.checked)} />
          Только rejected
        </label>
        <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "system-ui, sans-serif", alignSelf: "center" }}>
          {graphData.nodes.length} узлов · {graphData.links.length} связей
        </span>
      </div>

      {/* Карточка выбранного эффекта */}
      {selectedEffect && (
        <div style={{
          position: "absolute", top: 12, right: 12, zIndex: 10,
          width: 280, background: "#fff", borderRadius: 8, padding: 14,
          border: "1px solid #e5e7eb", boxShadow: "0 4px 12px #0002",
          fontFamily: "system-ui, sans-serif", fontSize: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: "#1a1a2e" }}>{selectedEffect.intent_id}</span>
            <button onClick={() => setSelectedId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16 }}>×</button>
          </div>
          <div style={{ color: selectedEffect.status === "rejected" ? "#ef4444" : "#1a1a2e", marginBottom: 8 }}>
            {selectedEffect.desc}
          </div>
          <table style={{ width: "100%", fontSize: 11, color: "#6b7280" }}>
            <tbody>
              <tr><td style={{ paddingRight: 8, color: "#9ca3af" }}>id</td><td style={{ wordBreak: "break-all" }}>{selectedEffect.id.slice(0, 12)}...</td></tr>
              <tr><td style={{ paddingRight: 8, color: "#9ca3af" }}>alpha</td><td>{selectedEffect.alpha}</td></tr>
              <tr><td style={{ paddingRight: 8, color: "#9ca3af" }}>target</td><td>{selectedEffect.target}</td></tr>
              <tr><td style={{ paddingRight: 8, color: "#9ca3af" }}>status</td><td style={{ color: STATUS_COLORS[selectedEffect.status] }}>{selectedEffect.status}</td></tr>
              {selectedEffect.parent_id && <tr><td style={{ paddingRight: 8, color: "#9ca3af" }}>parent</td><td style={{ wordBreak: "break-all" }}>{selectedEffect.parent_id.slice(0, 12)}...</td></tr>}
              {selectedEffect.ttl && <tr><td style={{ paddingRight: 8, color: "#9ca3af" }}>ttl</td><td>{selectedEffect.ttl / 1000}s</td></tr>}
              {selectedEffect.reason && <tr><td style={{ paddingRight: 8, color: "#ef4444" }}>reason</td><td style={{ color: "#ef4444" }}>{selectedEffect.reason}</td></tr>}
              {selectedEffect.context?.foreign && <tr><td style={{ paddingRight: 8, color: "#60a5fa" }}>foreign</td><td style={{ color: "#60a5fa" }}>{selectedEffect.context.foreign}</td></tr>}
              <tr><td style={{ paddingRight: 8, color: "#9ca3af" }}>time</td><td>{selectedEffect.time}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Легенда */}
      <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 10, display: "flex", gap: 12, fontSize: 10, fontFamily: "system-ui, sans-serif" }}>
        {[
          { color: STATUS_COLORS.confirmed, label: "confirmed" },
          { color: STATUS_COLORS.proposed, label: "proposed" },
          { color: STATUS_COLORS.rejected, label: "rejected" },
          { color: FOREIGN_COLOR, label: "foreign" },
        ].map(l => (
          <span key={l.label} style={{ color: l.color, display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, display: "inline-block" }} />
            {l.label}
          </span>
        ))}
        <span style={{ color: "#9ca3af" }}>— клик: подсветить цепочку</span>
      </div>
    </div>
  );
}
