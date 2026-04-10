/**
 * REST API для workflow — проекция World(t) через удобные эндпоинты.
 * Данные вычисляются из Φ (foldWorld), не дублируются.
 */
const { Router } = require("express");
const { foldWorld } = require("../validator.js");

const router = Router();

// GET /api/workflows — все workflow
router.get("/", (req, res) => {
  const world = foldWorld();
  const workflows = (world.workflows || []).map(wf => ({
    ...wf,
    nodes: (world.nodes || []).filter(n => n.workflowId === wf.id),
    edges: (world.edges || []).filter(e => e.workflowId === wf.id),
    executions: (world.executions || []).filter(ex => ex.workflowId === wf.id),
  }));
  res.json(workflows);
});

// GET /api/workflows/:id — один workflow с графом
router.get("/:id", (req, res) => {
  const world = foldWorld();
  const wf = (world.workflows || []).find(w => w.id === req.params.id);
  if (!wf) return res.status(404).json({ error: "Not found" });
  res.json({
    ...wf,
    nodes: (world.nodes || []).filter(n => n.workflowId === wf.id),
    edges: (world.edges || []).filter(e => e.workflowId === wf.id),
    executions: (world.executions || []).filter(ex => ex.workflowId === wf.id),
    nodeResults: (world.noderesults || []).filter(nr => {
      const exec = (world.executions || []).find(ex => ex.id === nr.executionId);
      return exec && exec.workflowId === wf.id;
    }),
  });
});

// GET /api/workflows/:id/export — экспорт как JSON (для import_workflow)
router.get("/:id/export", (req, res) => {
  const world = foldWorld();
  const wf = (world.workflows || []).find(w => w.id === req.params.id);
  if (!wf) return res.status(404).json({ error: "Not found" });
  const nodes = (world.nodes || []).filter(n => n.workflowId === wf.id).map(n => ({
    id: n.id, type: n.type, label: n.label, x: n.x, y: n.y, config: n.config
  }));
  const edges = (world.edges || []).filter(e => e.workflowId === wf.id).map(e => ({
    id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle
  }));
  res.json({ title: wf.title, nodes, edges });
});

// GET /api/world — полная проекция World(t) (для отладки)
router.get("/../world", (req, res) => {
  res.json(foldWorld());
});

module.exports = router;
