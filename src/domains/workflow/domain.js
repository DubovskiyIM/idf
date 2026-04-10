import { v4 as uuid } from "uuid";

export { INTENTS } from "./intents.js";
export { PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";

export const DOMAIN_ID = "workflow";
export const DOMAIN_NAME = "Workflow";

const ts = () => new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 2 });

const NODE_TYPES = {
  http_request: { label: "HTTP Request", color: "#6366f1", inputs: ["trigger"], outputs: ["response"] },
  transform: { label: "Transform", color: "#f59e0b", inputs: ["data"], outputs: ["result"] },
  condition: { label: "Condition", color: "#22c55e", inputs: ["data"], outputs: ["true", "false"] },
  output: { label: "Output", color: "#ef4444", inputs: ["data"], outputs: [] },
};

export { NODE_TYPES };

export function describeEffect(intentId, alpha, ctx, target) {
  switch (intentId) {
    case "create_workflow": return `📊 Workflow: ${ctx.title || ctx.id}`;
    case "add_node": return `+ Узел: ${ctx.label || ctx.type}`;
    case "remove_node": return `✕ Узел удалён: ${ctx.label || ctx.id}`;
    case "move_node": return `↔ ${ctx.label || ctx.id}: (${ctx.x}, ${ctx.y})`;
    case "connect_nodes": return `🔗 Связь: ${ctx.sourceLabel || "?"} → ${ctx.targetLabel || "?"}`;
    case "disconnect_nodes": return `✂ Связь удалена: ${ctx.id}`;
    case "configure_node": return `⚙ Настройка: ${ctx.label || ctx.id}`;
    case "save_workflow": return `💾 Сохранено`;
    case "execute_workflow": return `▶ Запуск пайплайна`;
    case "stop_execution": return `⏹ Остановлено`;
    case "rename_node": return `✎ Переименован: ${ctx.label || ctx.id}`;
    case "delete_workflow": return `✕ Workflow удалён: ${ctx.title || ctx.id}`;
    case "duplicate_workflow": return `⧉ Дубликат: ${ctx.title || ctx.id}`;
    case "add_custom_node_type": return `+ Тип узла: ${ctx.name || ctx.id}`;
    case "import_workflow": return `📥 Импорт: ${ctx.title || "workflow"}`;
    case "_seed": return `seed: ${alpha} ${ctx.id || ""}`;
    case "_executor": return `⚡ ${alpha} ${ctx.id?.slice(0, 12) || ""}`;
    default: return `${alpha} ${intentId}`;
  }
}

export function signalForIntent(intentId) {
  switch (intentId) {
    case "save_workflow": return { κ: "notification", desc: "Workflow сохранён" };
    case "execute_workflow": return { κ: "notification", desc: "Пайплайн запущен" };
    default: return null;
  }
}

export function buildEffects(intentId, ctx, world, drafts) {
  const now = Date.now();
  const effects = [];
  const ef = (props) => effects.push({ id: uuid(), intent_id: intentId, parent_id: null, status: "proposed", ttl: null, created_at: now, time: ts(), ...props });

  switch (intentId) {
    case "create_workflow": {
      if (!ctx.title?.trim()) return null;
      ef({ alpha: "add", target: "workflows", scope: "account", value: null,
        context: { id: `wf_${now}`, title: ctx.title.trim(), status: "draft", createdAt: now },
        desc: describeEffect(intentId, "add", { title: ctx.title }) });
      break;
    }
    case "add_node": {
      const wf = (world.workflows || []).find(w => w.id === ctx.workflowId);
      if (!wf || (wf.status !== "draft" && wf.status !== "saved")) return null;
      const nodeType = NODE_TYPES[ctx.type];
      if (!nodeType) return null;
      const nodeId = `node_${now}_${Math.random().toString(36).slice(2, 6)}`;
      ef({ alpha: "add", target: "nodes", scope: "account", value: null,
        context: { id: nodeId, workflowId: ctx.workflowId, type: ctx.type, label: ctx.label || nodeType.label, x: ctx.x || 100, y: ctx.y || 100, config: {} },
        desc: describeEffect(intentId, "add", { label: ctx.label || nodeType.label, type: ctx.type }) });
      // Если workflow был saved → вернуть в draft
      if (wf.status === "saved") {
        ef({ alpha: "replace", target: "workflow.status", scope: "account", value: "draft",
          context: { id: wf.id }, desc: "📊 Workflow → draft" });
      }
      break;
    }
    case "remove_node": {
      const node = (world.nodes || []).find(n => n.id === ctx.id);
      if (!node) return null;
      // Каскад: удалить связанные рёбра
      const relatedEdges = (world.edges || []).filter(e => e.source === ctx.id || e.target === ctx.id);
      for (const edge of relatedEdges) {
        ef({ alpha: "remove", target: "edges", scope: "account", value: null,
          context: { id: edge.id }, desc: `✂ Каскад: ребро ${edge.id.slice(0, 8)}` });
      }
      ef({ alpha: "remove", target: "nodes", scope: "account", value: null,
        context: { id: node.id, label: node.label }, desc: describeEffect(intentId, "remove", { label: node.label }) });
      break;
    }
    case "move_node": {
      const node = (world.nodes || []).find(n => n.id === ctx.id);
      if (!node) return null;
      ef({ alpha: "replace", target: "node.x", scope: "presentation", value: ctx.x,
        context: { id: node.id, label: node.label, x: ctx.x, y: ctx.y }, desc: describeEffect(intentId, "replace", { label: node.label, x: ctx.x, y: ctx.y }) });
      ef({ alpha: "replace", target: "node.y", scope: "presentation", value: ctx.y,
        context: { id: node.id }, desc: `↔ y: ${ctx.y}` });
      break;
    }
    case "connect_nodes": {
      if (!ctx.source || !ctx.target) return null;
      const sourceNode = (world.nodes || []).find(n => n.id === ctx.source);
      const targetNode = (world.nodes || []).find(n => n.id === ctx.target);
      if (!sourceNode || !targetNode) return null;
      const edgeId = `edge_${now}_${Math.random().toString(36).slice(2, 6)}`;
      ef({ alpha: "add", target: "edges", scope: "account", value: null,
        context: { id: edgeId, workflowId: sourceNode.workflowId, source: ctx.source, target: ctx.target,
          sourceHandle: ctx.sourceHandle || null, targetHandle: ctx.targetHandle || null,
          sourceLabel: sourceNode.label, targetLabel: targetNode.label },
        desc: describeEffect(intentId, "add", { sourceLabel: sourceNode.label, targetLabel: targetNode.label }) });
      break;
    }
    case "disconnect_nodes": {
      const edge = (world.edges || []).find(e => e.id === ctx.id);
      if (!edge) return null;
      ef({ alpha: "remove", target: "edges", scope: "account", value: null,
        context: { id: edge.id }, desc: describeEffect(intentId, "remove", { id: edge.id }) });
      break;
    }
    case "configure_node": {
      const node = (world.nodes || []).find(n => n.id === ctx.id);
      if (!node) return null;
      ef({ alpha: "replace", target: "node.config", scope: "account", value: ctx.config,
        context: { id: node.id, label: node.label }, desc: describeEffect(intentId, "replace", { label: node.label }) });
      break;
    }
    case "save_workflow": {
      const wf = (world.workflows || []).find(w => w.id === ctx.workflowId);
      if (!wf || wf.status !== "draft") return null;
      ef({ alpha: "replace", target: "workflow.status", scope: "account", value: "saved",
        context: { id: wf.id }, desc: describeEffect(intentId, "replace", {}) });
      break;
    }
    case "execute_workflow": {
      const wf = (world.workflows || []).find(w => w.id === ctx.workflowId);
      if (!wf || wf.status !== "saved") return null;
      // Не создаём эффекты на клиенте — сервер сделает всё
      // Вызываем серверный executor напрямую
      fetch(`/api/execute/${wf.id}`, { method: "POST" }).catch(() => {});
      return null; // эффекты придут через SSE от сервера
    }
    case "stop_execution": {
      const exec = (world.executions || []).find(e => e.id === ctx.id);
      if (!exec || exec.status !== "running") return null;
      ef({ alpha: "replace", target: "execution.status", scope: "account", value: "stopped",
        context: { id: exec.id }, desc: "⏹ Execution → stopped" });
      const wf = (world.workflows || []).find(w => w.id === exec.workflowId);
      if (wf) {
        ef({ alpha: "replace", target: "workflow.status", scope: "account", value: "saved",
          context: { id: wf.id }, desc: "📊 Workflow → saved" });
      }
      break;
    }
    case "rename_node": {
      const node = (world.nodes || []).find(n => n.id === ctx.id);
      if (!node || !ctx.label?.trim()) return null;
      ef({ alpha: "replace", target: "node.label", scope: "account", value: ctx.label.trim(),
        context: { id: node.id }, desc: `✎ ${node.label} → ${ctx.label.trim()}` });
      break;
    }
    case "delete_workflow": {
      const wf = (world.workflows || []).find(w => w.id === ctx.workflowId);
      if (!wf || wf.status === "running") return null;
      const wfEdges = (world.edges || []).filter(e => e.workflowId === wf.id);
      const wfNodes = (world.nodes || []).filter(n => n.workflowId === wf.id);
      // Batch: один эффект вместо N+M+1
      const subEffects = [
        ...wfEdges.map(e => ({ alpha: "remove", target: "edges", context: { id: e.id } })),
        ...wfNodes.map(n => ({ alpha: "remove", target: "nodes", context: { id: n.id } })),
        { alpha: "remove", target: "workflows", context: { id: wf.id } },
      ];
      ef({ alpha: "batch", target: "workflows", scope: "account", value: subEffects,
        context: { id: wf.id, title: wf.title }, desc: `✕ Workflow: ${wf.title} (${wfNodes.length} узлов, ${wfEdges.length} рёбер)` });
      break;
    }
    case "duplicate_workflow": {
      const wf = (world.workflows || []).find(w => w.id === ctx.workflowId);
      if (!wf) return null;
      const newWfId = `wf_${now}`;
      const idMap = {};
      const subEffects = [];
      subEffects.push({ alpha: "add", target: "workflows",
        context: { id: newWfId, title: `${wf.title} (копия)`, status: "draft", createdAt: now } });
      const wfNodes = (world.nodes || []).filter(n => n.workflowId === wf.id);
      for (const n of wfNodes) {
        const newId = `node_${now}_${Math.random().toString(36).slice(2, 6)}`;
        idMap[n.id] = newId;
        subEffects.push({ alpha: "add", target: "nodes",
          context: { id: newId, workflowId: newWfId, type: n.type, label: n.label, x: n.x + 20, y: n.y + 20, config: n.config || {} } });
      }
      const wfEdges = (world.edges || []).filter(e => e.workflowId === wf.id);
      for (const e of wfEdges) {
        const s = idMap[e.source], t = idMap[e.target];
        if (s && t) subEffects.push({ alpha: "add", target: "edges",
          context: { id: `edge_${now}_${Math.random().toString(36).slice(2, 6)}`, workflowId: newWfId, source: s, target: t, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle } });
      }
      ef({ alpha: "batch", target: "workflows", scope: "account", value: subEffects,
        context: { id: newWfId, title: `${wf.title} (копия)` },
        desc: `⧉ Дубликат: ${wf.title} (${wfNodes.length} узлов, ${wfEdges.length} рёбер)` });
      break;
    }
    case "add_custom_node_type": {
      if (!ctx.name?.trim()) return null;
      const typeId = ctx.name.trim().toLowerCase().replace(/\s+/g, "_");
      ef({ alpha: "add", target: "nodetypes", scope: "account", value: null,
        context: { id: typeId, name: ctx.name.trim(), category: ctx.category || "custom", inputs: ctx.inputs || ["data"], outputs: ctx.outputs || ["result"], configSchema: ctx.configSchema || {} },
        desc: `+ Тип узла: ${ctx.name}` });
      break;
    }
    case "import_workflow": {
      if (!ctx.json) return null;
      let data;
      try { data = typeof ctx.json === "string" ? JSON.parse(ctx.json) : ctx.json; } catch { return null; }
      if (!data.title || !data.nodes) return null;
      const newWfId = `wf_${now}`;
      const idMap = {};
      ef({ alpha: "add", target: "workflows", scope: "account", value: null,
        context: { id: newWfId, title: data.title, status: "draft", createdAt: now },
        desc: `📥 Импорт: ${data.title}` });
      for (const n of (data.nodes || [])) {
        const newId = `node_${now}_${Math.random().toString(36).slice(2, 6)}`;
        idMap[n.id] = newId;
        ef({ alpha: "add", target: "nodes", scope: "account", value: null,
          context: { id: newId, workflowId: newWfId, type: n.type, label: n.label, x: n.x || 100, y: n.y || 100, config: n.config || {} },
          desc: `+ ${n.label}` });
      }
      for (const e of (data.edges || [])) {
        const s = idMap[e.source], t = idMap[e.target];
        if (s && t) {
          ef({ alpha: "add", target: "edges", scope: "account", value: null,
            context: { id: `edge_${now}_${Math.random().toString(36).slice(2, 6)}`, workflowId: newWfId, source: s, target: t },
            desc: `🔗 Связь` });
        }
      }
      break;
    }
    default: return null;
  }
  return effects.length > 0 ? effects : null;
}

export function getSeedEffects() { return []; }
