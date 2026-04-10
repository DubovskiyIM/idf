import { useState, useMemo, useCallback } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const inputStyle = { width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12, fontFamily: "ui-monospace, monospace", outline: "none", background: "#fff", color: "#1a1a2e" };
const labelStyle = { fontSize: 10, color: "#6b7280", textTransform: "uppercase", display: "block", marginBottom: 4, marginTop: 8 };
const selectStyle = { ...inputStyle, cursor: "pointer" };

function NodeConfigurator({ node, exec, canEdit, onClose }) {
  const config = node.config || {};
  const meta = NODE_TYPES_META[node.type];

  const save = (newConfig) => {
    exec("configure_node", { id: node.id, config: { ...config, ...newConfig } });
  };

  return (
    <div style={{ marginTop: 12, background: "#fff", borderRadius: 8, padding: 14, border: `2px solid ${meta?.color || "#d1d5db"}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{meta?.emoji} {node.label}</span>
        <span style={{ fontSize: 10, color: meta?.color, fontWeight: 600, textTransform: "uppercase", background: (meta?.color || "#6b7280") + "15", padding: "2px 8px", borderRadius: 4 }}>{node.type}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: "#9ca3af" }}>({node.x}, {node.y})</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 16 }}>×</button>
      </div>

      {!canEdit && <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 8 }}>Редактирование заблокировано (workflow не в draft/saved)</div>}

      {/* HTTP Request */}
      {node.type === "http_request" && (
        <div>
          <label style={labelStyle}>URL</label>
          <input value={config.url || ""} onChange={e => save({ url: e.target.value })} placeholder="https://api.example.com/data" disabled={!canEdit} style={inputStyle} />
          <label style={labelStyle}>Метод</label>
          <select value={config.method || "GET"} onChange={e => save({ method: e.target.value })} disabled={!canEdit} style={selectStyle}>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          <label style={labelStyle}>Headers (JSON)</label>
          <textarea value={config.headers || "{}"} onChange={e => save({ headers: e.target.value })} disabled={!canEdit} rows={2}
            style={{ ...inputStyle, resize: "vertical" }} />
          <label style={labelStyle}>Body</label>
          <textarea value={config.body || ""} onChange={e => save({ body: e.target.value })} disabled={!canEdit} rows={3} placeholder='{"key": "value"}'
            style={{ ...inputStyle, resize: "vertical" }} />
        </div>
      )}

      {/* Transform */}
      {node.type === "transform" && (
        <div>
          <label style={labelStyle}>Выражение (JavaScript)</label>
          <textarea value={config.expression || ""} onChange={e => save({ expression: e.target.value })} disabled={!canEdit} rows={4}
            placeholder="data.results.map(item => item.name)" style={{ ...inputStyle, resize: "vertical" }} />
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Переменная <code>data</code> содержит входные данные от предыдущего узла.</div>
        </div>
      )}

      {/* Condition */}
      {node.type === "condition" && (
        <div>
          <label style={labelStyle}>Условие (JavaScript → boolean)</label>
          <textarea value={config.expression || ""} onChange={e => save({ expression: e.target.value })} disabled={!canEdit} rows={3}
            placeholder="data.status === 200" style={{ ...inputStyle, resize: "vertical" }} />
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
            true → выход <span style={{ color: "#22c55e", fontWeight: 600 }}>true</span> · false → выход <span style={{ color: "#ef4444", fontWeight: 600 }}>false</span>
          </div>
        </div>
      )}

      {/* Output */}
      {node.type === "output" && (
        <div>
          <label style={labelStyle}>Формат</label>
          <select value={config.format || "json"} onChange={e => save({ format: e.target.value })} disabled={!canEdit} style={selectStyle}>
            <option value="json">JSON</option>
            <option value="text">Текст</option>
            <option value="log">Лог в консоль</option>
          </select>
          <label style={labelStyle}>Заголовок вывода</label>
          <input value={config.title || ""} onChange={e => save({ title: e.target.value })} disabled={!canEdit} placeholder="Результат пайплайна" style={inputStyle} />
        </div>
      )}

      {/* Общее */}
      <div style={{ marginTop: 10, padding: "8px 0", borderTop: "1px solid #e5e7eb", fontSize: 10, color: "#9ca3af" }}>
        ID: {node.id.slice(0, 16)}... · Config: {JSON.stringify(config).slice(0, 60)}{JSON.stringify(config).length > 60 ? "..." : ""}
      </div>
    </div>
  );
}

const NODE_TYPES_META = {
  http_request: { label: "HTTP Request", color: "#6366f1", emoji: "🌐" },
  transform: { label: "Transform", color: "#f59e0b", emoji: "⚙" },
  condition: { label: "Condition", color: "#22c55e", emoji: "❓" },
  output: { label: "Output", color: "#ef4444", emoji: "📤" },
};

const WORKFLOW_STATUS_COLORS = { draft: "#6b7280", saved: "#6366f1", running: "#22c55e", completed: "#22c55e", failed: "#ef4444" };

export default function WorkflowUI({ world, exec }) {
  const [selectedWfId, setSelectedWfId] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const workflows = world.workflows || [];
  const allNodes = world.nodes || [];
  const allEdges = world.edges || [];
  const executions = world.executions || [];

  const selectedWf = workflows.find(w => w.id === selectedWfId);
  const wfNodes = allNodes.filter(n => n.workflowId === selectedWfId);
  const wfEdges = allEdges.filter(e => e.workflowId === selectedWfId);
  const selectedNode = wfNodes.find(n => n.id === selectedNodeId);

  // Ключ для пересоздания React Flow при изменении графа (добавление/удаление узлов)
  const graphKey = useMemo(() => wfNodes.map(n => n.id).sort().join(",") + "|" + wfEdges.map(e => e.id).sort().join(","), [wfNodes, wfEdges]);

  const initialNodes = useMemo(() => wfNodes.map(n => ({
    id: n.id,
    position: { x: n.x || 0, y: n.y || 0 },
    data: { label: `${NODE_TYPES_META[n.type]?.emoji || ""} ${n.label}`, node: n },
    style: {
      background: NODE_TYPES_META[n.type]?.color + "20",
      border: `2px solid ${NODE_TYPES_META[n.type]?.color || "#6b7280"}`,
      borderRadius: 8, padding: "8px 12px", fontSize: 12,
      color: "#1a1a2e", fontFamily: "system-ui, sans-serif",
    },
  })), [graphKey]);

  const initialEdges = useMemo(() => wfEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    animated: selectedWf?.status === "running",
    style: { stroke: "#6366f1" },
  })), [graphKey, selectedWf?.status]);

  const onNodeDragStop = useCallback((_, node) => {
    exec("move_node", { id: node.id, x: Math.round(node.position.x), y: Math.round(node.position.y) });
  }, [exec]);

  const onConnect = useCallback((params) => {
    exec("connect_nodes", {
      source: params.source,
      target: params.target,
      sourceHandle: params.sourceHandle,
      targetHandle: params.targetHandle,
    });
  }, [exec]);

  const onEdgesDelete = useCallback((edges) => {
    for (const edge of edges) {
      exec("disconnect_nodes", { id: edge.id });
    }
  }, [exec]);

  const onNodesDelete = useCallback((nodes) => {
    for (const node of nodes) {
      exec("remove_node", { id: node.id });
    }
  }, [exec]);

  // Список workflow
  if (!selectedWf) return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#1a1a2e" }}>Workflow</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Название workflow..."
          onKeyDown={e => { if (e.key === "Enter" && newTitle.trim()) { exec("create_workflow", { title: newTitle }); setNewTitle(""); } }}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" }} />
        <button onClick={() => { if (newTitle.trim()) { exec("create_workflow", { title: newTitle }); setNewTitle(""); } }}
          disabled={!newTitle.trim()}
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: newTitle.trim() ? "#6366f1" : "#d1d5db", color: "#fff", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
          + Создать
        </button>
      </div>
      {workflows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Нет workflow</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {workflows.sort((a, b) => b.createdAt - a.createdAt).map(wf => (
            <div key={wf.id} onClick={() => setSelectedWfId(wf.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 8, padding: "12px 16px", border: "1px solid #e5e7eb", borderLeft: `3px solid ${WORKFLOW_STATUS_COLORS[wf.status]}`, cursor: "pointer" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{wf.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{allNodes.filter(n => n.workflowId === wf.id).length} узлов · {allEdges.filter(e => e.workflowId === wf.id).length} связей</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: WORKFLOW_STATUS_COLORS[wf.status], textTransform: "uppercase" }}>{wf.status}</span>
              <button onClick={(e) => { e.stopPropagation(); exec("duplicate_workflow", { workflowId: wf.id }); }}
                style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 10, cursor: "pointer" }}>⧉</button>
              {wf.status !== "running" && (
                <button onClick={(e) => { e.stopPropagation(); exec("delete_workflow", { workflowId: wf.id }); }}
                  style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #ef4444", background: "#fff", color: "#ef4444", fontSize: 10, cursor: "pointer" }}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Canvas
  const canEdit = selectedWf.status === "draft" || selectedWf.status === "saved";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <button onClick={() => { setSelectedWfId(null); setSelectedNodeId(null); }}
          style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 12 }}>← Назад</button>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1a1a2e" }}>{selectedWf.title}</h2>
        <span style={{ fontSize: 10, fontWeight: 600, color: WORKFLOW_STATUS_COLORS[selectedWf.status], textTransform: "uppercase", background: WORKFLOW_STATUS_COLORS[selectedWf.status] + "18", padding: "2px 8px", borderRadius: 4 }}>{selectedWf.status}</span>
        <div style={{ flex: 1 }} />
        {selectedWf.status === "draft" && (
          <button onClick={() => exec("save_workflow", { workflowId: selectedWf.id })}
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, cursor: "pointer" }}>💾 Сохранить</button>
        )}
        {selectedWf.status === "saved" && (
          <button onClick={() => exec("execute_workflow", { workflowId: selectedWf.id })}
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#22c55e", color: "#fff", fontSize: 12, cursor: "pointer" }}>▶ Запустить</button>
        )}
        {selectedWf.status === "running" && (() => {
          const runningExec = executions.find(e => e.workflowId === selectedWf.id && e.status === "running");
          return runningExec && (
            <button onClick={() => exec("stop_execution", { id: runningExec.id })}
              style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#ef4444", color: "#fff", fontSize: 12, cursor: "pointer" }}>⏹ Стоп</button>
          );
        })()}
      </div>

      {/* Палитра узлов */}
      {canEdit && (
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {Object.entries(NODE_TYPES_META).map(([type, meta]) => (
            <button key={type} onClick={() => exec("add_node", { workflowId: selectedWf.id, type, x: 100 + Math.random() * 300, y: 50 + Math.random() * 200 })}
              style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${meta.color}`, background: meta.color + "10", color: meta.color, fontSize: 11, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
              {meta.emoji} {meta.label}
            </button>
          ))}
        </div>
      )}

      {/* React Flow canvas */}
      <div style={{ height: 400, borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <ReactFlow
          key={graphKey}
          defaultNodes={initialNodes}
          defaultEdges={initialEdges}
          onNodeDragStop={canEdit ? onNodeDragStop : undefined}
          onConnect={canEdit ? onConnect : undefined}
          onEdgesDelete={canEdit ? onEdgesDelete : undefined}
          onNodesDelete={canEdit ? onNodesDelete : undefined}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          fitView
          deleteKeyCode="Delete"
          style={{ background: "#fafafa" }}
        >
          <Background />
          <Controls />
          <MiniMap style={{ height: 80 }} />
        </ReactFlow>
      </div>

      {/* Инспектор + конфигурация узла */}
      {selectedNode && (
        <NodeConfigurator node={selectedNode} exec={exec} canEdit={canEdit} onClose={() => setSelectedNodeId(null)} />
      )}
    </div>
  );
}
