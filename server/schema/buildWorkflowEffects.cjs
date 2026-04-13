/**
 * Серверный builder эффектов для agent-разрешённых workflow-intent'ов.
 * 6 intents: create_workflow, add_node, connect_nodes, configure_node,
 * save_workflow, execute_workflow.
 */

const { v4: uuid } = require("uuid");

const NODE_TYPES = {
  http_request: { label: "HTTP Request" },
  transform: { label: "Transform" },
  condition: { label: "Condition" },
  output: { label: "Output" },
};

function ts() {
  return new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function makeEffect(intentId, props) {
  return { id: uuid(), intent_id: intentId, parent_id: null, status: "proposed", ttl: null, created_at: Date.now(), time: ts(), ...props };
}

function buildWorkflowEffects(intentId, params, viewer, world) {
  const now = Date.now();

  switch (intentId) {
    case "create_workflow": {
      if (!params.title?.trim()) return null;
      return [makeEffect(intentId, {
        alpha: "add", target: "workflows", scope: "account", value: null,
        context: { id: `wf_${now}`, title: params.title.trim(), status: "draft", createdAt: now },
        desc: `📊 Новый workflow: ${params.title.trim().slice(0, 30)}`
      })];
    }

    case "add_node": {
      const wf = (world.workflows || []).find(w => w.id === params.workflowId);
      if (!wf || (wf.status !== "draft" && wf.status !== "saved")) return null;
      const nodeType = NODE_TYPES[params.type];
      if (!nodeType) return null;
      const nodeId = `node_${now}_${Math.random().toString(36).slice(2, 6)}`;
      const effects = [makeEffect(intentId, {
        alpha: "add", target: "nodes", scope: "account", value: null,
        context: {
          id: nodeId, workflowId: params.workflowId, type: params.type,
          label: params.label || nodeType.label,
          x: params.x || 100, y: params.y || 100, config: {},
        },
        desc: `+ Узел: ${params.label || nodeType.label}`
      })];
      if (wf.status === "saved") {
        effects.push(makeEffect(intentId, {
          alpha: "replace", target: "workflow.status", scope: "account",
          value: "draft", context: { id: wf.id }, desc: "Workflow → draft"
        }));
      }
      return effects;
    }

    case "connect_nodes": {
      if (!params.source || !params.target) return null;
      const sourceNode = (world.nodes || []).find(n => n.id === params.source);
      const targetNode = (world.nodes || []).find(n => n.id === params.target);
      if (!sourceNode || !targetNode) return null;
      const edgeId = `edge_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [makeEffect(intentId, {
        alpha: "add", target: "edges", scope: "account", value: null,
        context: {
          id: edgeId, workflowId: sourceNode.workflowId,
          source: params.source, target: params.target,
          sourceHandle: params.sourceHandle || null, targetHandle: params.targetHandle || null,
        },
        desc: `🔗 ${sourceNode.label} → ${targetNode.label}`
      })];
    }

    case "configure_node": {
      const node = (world.nodes || []).find(n => n.id === params.nodeId);
      if (!node || !params.config) return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "node.config", scope: "account",
        value: params.config, context: { id: node.id },
        desc: `⚙ Настройка: ${node.label}`
      })];
    }

    case "save_workflow": {
      const wf = (world.workflows || []).find(w => w.id === params.workflowId);
      if (!wf || wf.status !== "draft") return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "workflow.status", scope: "account",
        value: "saved", context: { id: wf.id },
        desc: `💾 Сохранён: ${wf.title}`
      })];
    }

    case "execute_workflow": {
      const wf = (world.workflows || []).find(w => w.id === params.workflowId);
      if (!wf || wf.status !== "saved") return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "workflow.status", scope: "account",
        value: "running", context: { id: wf.id },
        desc: `▶ Запуск: ${wf.title}`
      })];
    }

    default:
      return null;
  }
}

module.exports = { buildWorkflowEffects };
