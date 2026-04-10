/*
 * Кристаллизованная проекция: workflow_canvas + workflow_list + node_inspector + execution_log
 * Домен: workflow · 10 намерений · 4 сущности
 * Намерения: create_workflow, add_node, remove_node, move_node, connect_nodes,
 *   disconnect_nodes, configure_node, save_workflow, execute_workflow, stop_execution
 * Рабочий процесс: draft → saved → running → completed
 */

import { useState, useMemo, useCallback } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getStyles } from "./theme.js";

const NODE_META = {
  http_request: { label: "HTTP Request", color: "#6366f1", emoji: "🌐" },
  transform: { label: "Transform", color: "#f59e0b", emoji: "⚙" },
  condition: { label: "Condition", color: "#22c55e", emoji: "❓" },
  output: { label: "Output", color: "#ef4444", emoji: "📤" },
};

const WF_STATUS = { draft: "Черновик", saved: "Сохранён", running: "Запущен", completed: "Завершён", failed: "Ошибка" };

export default function WorkflowCanvasProjection({ world, exec, theme = "light", variant = "clean" }) {
  const s = getStyles(theme, variant);
  const [selectedWfId, setSelectedWfId] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const workflows = world.workflows || [];
  const allNodes = world.nodes || [];
  const allEdges = world.edges || [];
  const executions = world.executions || [];

  const wf = workflows.find(w => w.id === selectedWfId);
  const wfNodes = allNodes.filter(n => n.workflowId === selectedWfId);
  const wfEdges = allEdges.filter(e => e.workflowId === selectedWfId);
  const selectedNode = wfNodes.find(n => n.id === selectedNodeId);
  const canEdit = wf && (wf.status === "draft" || wf.status === "saved");

  const graphKey = useMemo(() => wfNodes.map(n => n.id).sort().join(",") + "|" + wfEdges.map(e => e.id).sort().join(",") + theme + variant, [wfNodes, wfEdges, theme, variant]);

  const initialNodes = useMemo(() => wfNodes.map(n => ({
    id: n.id,
    position: { x: n.x || 0, y: n.y || 0 },
    data: { label: `${NODE_META[n.type]?.emoji || ""} ${n.label}` },
    style: {
      background: theme === "dark" ? NODE_META[n.type]?.color + "30" : NODE_META[n.type]?.color + "15",
      border: `2px solid ${NODE_META[n.type]?.color || "#6b7280"}`,
      borderRadius: s.v.radius, padding: `${s.v.padding / 2}px ${s.v.padding}px`,
      fontSize: s.v.fontSize.small, color: s.t.text, fontFamily: s.v.font,
    },
  })), [graphKey]);

  const rfEdges = useMemo(() => wfEdges.map(e => ({
    id: e.id, source: e.source, target: e.target,
    sourceHandle: e.sourceHandle, targetHandle: e.targetHandle,
    animated: wf?.status === "running",
    style: { stroke: s.t.accent, strokeWidth: 2 },
  })), [wfEdges, wf?.status, s]);

  const onNodeDragStop = useCallback((_, node) => {
    exec("move_node", { id: node.id, x: Math.round(node.position.x), y: Math.round(node.position.y) });
  }, [exec]);

  const onConnect = useCallback((params) => {
    exec("connect_nodes", { source: params.source, target: params.target, sourceHandle: params.sourceHandle, targetHandle: params.targetHandle });
  }, [exec]);

  const onEdgesDelete = useCallback((edges) => { for (const e of edges) exec("disconnect_nodes", { id: e.id }); }, [exec]);
  const onNodesDelete = useCallback((nodes) => { for (const n of nodes) exec("remove_node", { id: n.id }); }, [exec]);

  // ===== Список workflow =====
  if (!wf) return (
    <div style={s.container}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: s.v.gap * 2 }}>
        <h2 style={s.heading("h1")}>Workflow</h2>
        <span style={s.text("small")}>{workflows.length} workflow</span>
      </div>

      <div style={{ display: "flex", gap: s.v.gap, marginBottom: s.v.gap * 2 }}>
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Название..."
          onKeyDown={e => { if (e.key === "Enter" && newTitle.trim()) { exec("create_workflow", { title: newTitle }); setNewTitle(""); } }}
          style={{ flex: 1, padding: s.v.padding * 0.7, borderRadius: s.v.radius, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.body, fontFamily: s.v.font, background: s.t.surface, color: s.t.text, outline: "none" }} />
        <button onClick={() => { if (newTitle.trim()) { exec("create_workflow", { title: newTitle }); setNewTitle(""); } }}
          disabled={!newTitle.trim()} style={s.button()}>+ Создать</button>
      </div>

      {workflows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, ...s.text() }}>Создайте первый workflow</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: s.v.gap }}>
          {workflows.sort((a, b) => b.createdAt - a.createdAt).map(w => (
            <div key={w.id} onClick={() => setSelectedWfId(w.id)}
              style={{ ...s.card, borderLeft: `3px solid ${s.statusColor(w.status)}`, cursor: "pointer", display: "flex", alignItems: "center", gap: s.v.gap }}>
              <div style={{ flex: 1 }}>
                <div style={s.heading("h2")}>{w.title}</div>
                <div style={s.text("small")}>{allNodes.filter(n => n.workflowId === w.id).length} узлов · {allEdges.filter(e => e.workflowId === w.id).length} связей</div>
              </div>
              <span style={s.badge(w.status)}>{WF_STATUS[w.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ===== Canvas =====
  return (
    <div style={s.container}>
      {/* Шапка */}
      <div style={{ display: "flex", alignItems: "center", gap: s.v.gap, marginBottom: s.v.gap }}>
        <button onClick={() => { setSelectedWfId(null); setSelectedNodeId(null); }} style={s.buttonOutline()}>←</button>
        <h2 style={{ ...s.heading("h2"), flex: 1 }}>{wf.title}</h2>
        <span style={s.badge(wf.status)}>{WF_STATUS[wf.status]}</span>
        {wf.status === "draft" && <button onClick={() => exec("save_workflow", { workflowId: wf.id })} style={s.button()}>💾 Save</button>}
        {wf.status === "saved" && <button onClick={() => exec("execute_workflow", { workflowId: wf.id })} style={s.button("success")}>▶ Run</button>}
        {wf.status === "running" && (() => {
          const re = executions.find(e => e.workflowId === wf.id && e.status === "running");
          return re && <button onClick={() => exec("stop_execution", { id: re.id })} style={s.button("danger")}>⏹ Stop</button>;
        })()}
      </div>

      {/* Палитра */}
      {canEdit && (
        <div style={{ display: "flex", gap: s.v.gap / 2, marginBottom: s.v.gap }}>
          {Object.entries(NODE_META).map(([type, meta]) => (
            <button key={type}
              onClick={() => exec("add_node", { workflowId: wf.id, type, x: 100 + Math.random() * 300, y: 50 + Math.random() * 200 })}
              style={{ ...s.buttonOutline(), borderColor: meta.color, color: meta.color, fontSize: s.v.fontSize.tiny }}>
              {meta.emoji} {meta.label}
            </button>
          ))}
        </div>
      )}

      {/* React Flow */}
      <div style={{ height: 420, borderRadius: s.v.radius, border: `1px solid ${s.t.border}`, overflow: "hidden" }}>
        <ReactFlow
          key={graphKey}
          defaultNodes={initialNodes} defaultEdges={rfEdges}
          onNodeDragStop={canEdit ? onNodeDragStop : undefined}
          onConnect={canEdit ? onConnect : undefined}
          onEdgesDelete={canEdit ? onEdgesDelete : undefined}
          onNodesDelete={canEdit ? onNodesDelete : undefined}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          fitView deleteKeyCode="Delete"
          style={{ background: theme === "dark" ? "#0c0e14" : "#fafafa" }}
          colorMode={theme}
        >
          <Background color={theme === "dark" ? "#1e2230" : "#e5e7eb"} />
          <Controls />
          <MiniMap style={{ height: 60 }} />
        </ReactFlow>
      </div>

      {/* Инспектор + конфигурация */}
      {selectedNode && (() => {
        const config = selectedNode.config || {};
        const meta = NODE_META[selectedNode.type];
        const save = (c) => exec("configure_node", { id: selectedNode.id, config: { ...config, ...c } });
        const inp = { width: "100%", padding: s.v.padding / 2, borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.small, fontFamily: "ui-monospace, monospace", background: s.t.surface, color: s.t.text, outline: "none" };
        const lbl = { ...s.text("tiny"), textTransform: "uppercase", display: "block", marginBottom: 4, marginTop: s.v.gap };

        return (
          <div style={{ ...s.card, marginTop: s.v.gap, borderColor: meta?.color }}>
            <div style={{ display: "flex", alignItems: "center", gap: s.v.gap, marginBottom: s.v.gap }}>
              <span style={s.heading("h2")}>{meta?.emoji} {selectedNode.label}</span>
              <span style={s.badge(selectedNode.type)}>{selectedNode.type}</span>
              <div style={{ flex: 1 }} />
              {canEdit && <button onClick={() => exec("remove_node", { id: selectedNode.id })} style={s.buttonOutline("danger")}>Удалить</button>}
              <button onClick={() => setSelectedNodeId(null)} style={{ background: "none", border: "none", color: s.t.textMuted, cursor: "pointer", fontSize: 16 }}>×</button>
            </div>

            {selectedNode.type === "http_request" && <>
              <label style={lbl}>URL</label>
              <input value={config.url || ""} onChange={e => save({ url: e.target.value })} disabled={!canEdit} placeholder="https://api.example.com/data" style={inp} />
              <label style={lbl}>Метод</label>
              <select value={config.method || "GET"} onChange={e => save({ method: e.target.value })} disabled={!canEdit} style={{ ...inp, cursor: "pointer" }}>
                <option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="DELETE">DELETE</option>
              </select>
              <label style={lbl}>Headers (JSON)</label>
              <textarea value={config.headers || "{}"} onChange={e => save({ headers: e.target.value })} disabled={!canEdit} rows={2} style={{ ...inp, resize: "vertical" }} />
              <label style={lbl}>Body</label>
              <textarea value={config.body || ""} onChange={e => save({ body: e.target.value })} disabled={!canEdit} rows={3} placeholder='{"key":"value"}' style={{ ...inp, resize: "vertical" }} />
            </>}

            {selectedNode.type === "transform" && <>
              <label style={lbl}>Выражение (JavaScript)</label>
              <textarea value={config.expression || ""} onChange={e => save({ expression: e.target.value })} disabled={!canEdit} rows={4} placeholder="data.results.map(i => i.name)" style={{ ...inp, resize: "vertical" }} />
              <div style={{ ...s.text("tiny"), marginTop: 4 }}>Переменная <code>data</code> — вход от предыдущего узла</div>
            </>}

            {selectedNode.type === "condition" && <>
              <label style={lbl}>Условие (→ boolean)</label>
              <textarea value={config.expression || ""} onChange={e => save({ expression: e.target.value })} disabled={!canEdit} rows={3} placeholder="data.status === 200" style={{ ...inp, resize: "vertical" }} />
              <div style={{ ...s.text("tiny"), marginTop: 4 }}>true → <span style={{ color: s.t.success }}>true</span> · false → <span style={{ color: s.t.danger }}>false</span></div>
            </>}

            {selectedNode.type === "output" && <>
              <label style={lbl}>Формат</label>
              <select value={config.format || "json"} onChange={e => save({ format: e.target.value })} disabled={!canEdit} style={{ ...inp, cursor: "pointer" }}>
                <option value="json">JSON</option><option value="text">Текст</option><option value="log">Лог</option>
              </select>
              <label style={lbl}>Заголовок</label>
              <input value={config.title || ""} onChange={e => save({ title: e.target.value })} disabled={!canEdit} placeholder="Результат" style={inp} />
            </>}

            <div style={{ ...s.text("tiny"), marginTop: s.v.gap, paddingTop: s.v.gap / 2, borderTop: `1px solid ${s.t.border}` }}>
              ({selectedNode.x}, {selectedNode.y}) · {selectedNode.id.slice(0, 12)}...
            </div>
          </div>
        );
      })()}

      {/* Execution log */}
      {executions.filter(e => e.workflowId === wf.id).length > 0 && (
        <div style={{ marginTop: s.v.gap }}>
          <div style={{ ...s.text("tiny"), textTransform: "uppercase", marginBottom: s.v.gap / 2 }}>Исполнения</div>
          {executions.filter(e => e.workflowId === wf.id).sort((a, b) => b.startedAt - a.startedAt).map(ex => (
            <div key={ex.id} style={{ ...s.card, borderLeft: `3px solid ${s.statusColor(ex.status)}`, marginBottom: s.v.gap / 2, padding: `${s.v.padding / 2}px ${s.v.padding}px` }}>
              <div style={{ display: "flex", alignItems: "center", gap: s.v.gap }}>
                <span style={s.badge(ex.status)}>{ex.status}</span>
                <span style={s.text("small")}>{new Date(ex.startedAt).toLocaleTimeString("ru")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
