/**
 * ArchetypeCanvas — обёртка для canvas-проекций (workflow editor).
 * Делегирует рендер domain-specific WorkflowCanvas.
 * Кристаллизатор генерирует минимальный артефакт (body.type="canvas"),
 * фактический рендер — в WorkflowCanvas из domain.
 */
import { useMemo } from "react";
import { WorkflowCanvas } from "../../../domains/workflow/ManualUI.jsx";

export default function ArchetypeCanvas({ artifact, ctx }) {
  const { world, exec } = ctx;
  const mainEntity = artifact.slots?.body?.mainEntity || "Workflow";
  const idParam = ctx.routeParams?.workflowId;

  const workflows = world.workflows || [];
  const workflow = workflows.find(w => w.id === idParam);

  const nodes = useMemo(() => (world.nodes || []).filter(n => n.workflowId === idParam), [world.nodes, idParam]);
  const edges = useMemo(() => (world.edges || []).filter(e => e.workflowId === idParam), [world.edges, idParam]);
  const executions = world.executions || [];

  if (!workflow) {
    return <div style={{ padding: 24, color: "#6b7280" }}>Workflow не найден (id: {idParam || "не задан"})</div>;
  }

  return <WorkflowCanvas workflow={workflow} nodes={nodes} edges={edges} executions={executions} exec={exec} />;
}
