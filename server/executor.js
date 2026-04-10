const { v4: uuid } = require("uuid");
const db = require("./db.js");
const { foldWorld } = require("./validator.js");

/**
 * Исполнитель workflow-пайплайнов.
 * Обходит граф топологически, выполняет узлы, записывает результаты в Φ.
 */

let broadcast = () => {};
function setBroadcast(fn) { broadcast = fn; }

async function executeWorkflow(workflowId) {
  const world = foldWorld();
  const workflow = (world.workflows || []).find(w => w.id === workflowId);
  if (!workflow) throw new Error("Workflow not found");

  const nodes = (world.nodes || []).filter(n => n.workflowId === workflowId);
  const edges = (world.edges || []).filter(e => e.workflowId === workflowId);

  if (nodes.length === 0) throw new Error("No nodes");

  // Создать execution
  const execId = `exec_${Date.now()}`;
  const now = Date.now();
  insertEffect({ id: uuid(), intent_id: "_executor", alpha: "add", target: "executions",
    context: { id: execId, workflowId, status: "running", startedAt: now, results: [] }, created_at: now });

  // Workflow → running
  insertEffect({ id: uuid(), intent_id: "_executor", alpha: "replace", target: "workflow.status",
    value: "running", context: { id: workflowId }, created_at: now });
  broadcast("effect:confirmed", { id: "reload" });

  // Топологическая сортировка
  const sorted = topologicalSort(nodes, edges);
  const nodeOutputs = {}; // nodeId → output data

  console.log(`  [executor] Запуск: ${workflow.title} (${sorted.length} узлов)`);

  for (const node of sorted) {
    const resultId = uuid();
    const nodeStart = Date.now();

    // Собрать входные данные от предшественников
    const incomingEdges = edges.filter(e => e.target === node.id);
    let inputData = null;
    if (incomingEdges.length === 1) {
      inputData = nodeOutputs[incomingEdges[0].source];
    } else if (incomingEdges.length > 1) {
      inputData = incomingEdges.map(e => nodeOutputs[e.source]).filter(Boolean);
    }

    // Записать nodeResult pending
    insertEffect({ id: uuid(), intent_id: "_executor", alpha: "add", target: "noderesults",
      context: { id: resultId, executionId: execId, nodeId: node.id, status: "running", output: null, error: null },
      created_at: Date.now() });
    broadcast("effect:confirmed", { id: "reload" });

    try {
      const output = await executeNode(node, inputData);
      nodeOutputs[node.id] = output;
      const duration = Date.now() - nodeStart;

      // Обновить nodeResult → completed
      insertEffect({ id: uuid(), intent_id: "_executor", alpha: "replace", target: "noderesult.status",
        value: "completed", context: { id: resultId, output: JSON.stringify(output)?.slice(0, 500), duration },
        created_at: Date.now() });

      // Обновить node status
      insertEffect({ id: uuid(), intent_id: "_executor", alpha: "replace", target: "node.status",
        value: "completed", context: { id: node.id }, created_at: Date.now() });

      broadcast("effect:confirmed", { id: "reload" });
      console.log(`  [executor] ✓ ${node.label} (${duration}ms)`);

      // Condition: пропустить false-ветку
      if (node.type === "condition") {
        const falseEdges = edges.filter(e => e.source === node.id && e.sourceHandle === "false");
        const trueEdges = edges.filter(e => e.source === node.id && e.sourceHandle === "true");
        const skipEdges = output ? falseEdges : trueEdges;
        // Пометить узлы пропущенной ветки как skipped
        for (const edge of skipEdges) {
          const skipNode = nodes.find(n => n.id === edge.target);
          if (skipNode) {
            insertEffect({ id: uuid(), intent_id: "_executor", alpha: "replace", target: "node.status",
              value: "skipped", context: { id: skipNode.id }, created_at: Date.now() });
          }
        }
      }
    } catch (err) {
      // Обновить nodeResult → failed
      insertEffect({ id: uuid(), intent_id: "_executor", alpha: "replace", target: "noderesult.status",
        value: "failed", context: { id: resultId, error: err.message },
        created_at: Date.now() });
      insertEffect({ id: uuid(), intent_id: "_executor", alpha: "replace", target: "node.status",
        value: "failed", context: { id: node.id }, created_at: Date.now() });
      broadcast("effect:confirmed", { id: "reload" });
      console.log(`  [executor] ✕ ${node.label}: ${err.message}`);

      // Не останавливаем весь пайплайн — продолжаем (partial success)
    }

    // Пауза между узлами для визуализации
    await sleep(500);
  }

  // Execution → completed
  insertEffect({ id: uuid(), intent_id: "_executor", alpha: "replace", target: "execution.status",
    value: "completed", context: { id: execId, completedAt: Date.now() }, created_at: Date.now() });
  // Workflow → saved
  insertEffect({ id: uuid(), intent_id: "_executor", alpha: "replace", target: "workflow.status",
    value: "saved", context: { id: workflowId }, created_at: Date.now() });
  broadcast("effect:confirmed", { id: "reload" });
  console.log(`  [executor] ✓ Пайплайн завершён`);
}

/**
 * Выполнить один узел.
 */
async function executeNode(node, inputData) {
  const config = node.config || {};

  switch (node.type) {
    case "http_request": {
      const url = config.url;
      if (!url) throw new Error("URL не указан");
      const options = { method: config.method || "GET" };
      if (config.headers) {
        try { options.headers = JSON.parse(config.headers); } catch {}
      }
      if (config.body && options.method !== "GET") {
        options.body = config.body;
      }
      const res = await fetch(url, options);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      return { status: res.status, data };
    }

    case "transform": {
      const expr = config.expression;
      if (!expr) return inputData;
      try {
        const data = inputData?.data || inputData;
        const fn = new Function("data", `return (${expr})`);
        return fn(data);
      } catch (e) {
        throw new Error(`Transform error: ${e.message}`);
      }
    }

    case "condition": {
      const expr = config.expression;
      if (!expr) return true;
      try {
        const data = inputData?.data || inputData;
        const fn = new Function("data", `return !!(${expr})`);
        return fn(data);
      } catch (e) {
        throw new Error(`Condition error: ${e.message}`);
      }
    }

    case "output": {
      const format = config.format || "json";
      const data = inputData?.data || inputData;
      console.log(`  [output] ${config.title || "Result"}:`, format === "json" ? JSON.stringify(data, null, 2)?.slice(0, 200) : String(data)?.slice(0, 200));
      return { format, title: config.title, data };
    }

    default:
      return inputData;
  }
}

/**
 * Топологическая сортировка (Kahn's algorithm).
 */
function topologicalSort(nodes, edges) {
  const inDegree = {};
  const adj = {};
  for (const n of nodes) { inDegree[n.id] = 0; adj[n.id] = []; }
  for (const e of edges) {
    if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    if (adj[e.source]) adj[e.source].push(e.target);
  }

  const queue = nodes.filter(n => inDegree[n.id] === 0);
  const sorted = [];

  while (queue.length > 0) {
    const node = queue.shift();
    sorted.push(node);
    for (const targetId of (adj[node.id] || [])) {
      inDegree[targetId]--;
      if (inDegree[targetId] === 0) {
        const targetNode = nodes.find(n => n.id === targetId);
        if (targetNode) queue.push(targetNode);
      }
    }
  }

  return sorted;
}

function insertEffect(ef) {
  db.prepare(`
    INSERT INTO effects (id, intent_id, alpha, target, value, scope, parent_id, status, ttl, context, created_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, 'account', NULL, 'confirmed', NULL, ?, ?, ?)
  `).run(ef.id, ef.intent_id, ef.alpha, ef.target,
    ef.value != null ? JSON.stringify(ef.value) : null,
    JSON.stringify(ef.context), ef.created_at, ef.created_at);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { executeWorkflow, setBroadcast };
