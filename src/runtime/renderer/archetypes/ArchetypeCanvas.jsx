/**
 * ArchetypeCanvas — обёртка для canvas-проекций.
 * Делегирует рендер domain-specific компонентам через реестр.
 * Workflow — WorkflowCanvas, lifequest — CalendarCanvas/VisionBoardCanvas/RadarChart.
 */
import { useMemo } from "react";

// Реестр domain-specific canvas-компонентов.
// Ключ = projectionId или domainId, значение = React-компонент.
const CANVAS_REGISTRY = {};

export function registerCanvas(key, component) {
  CANVAS_REGISTRY[key] = component;
}

export default function ArchetypeCanvas({ slots, ctx }) {
  const { world, exec, viewer, artifact } = ctx;
  const projectionId = artifact?.projection;
  const domainId = artifact?.domain;

  // 1. Попробовать по projectionId
  const CanvasComponent = CANVAS_REGISTRY[projectionId] || CANVAS_REGISTRY[domainId];

  if (CanvasComponent) {
    return <CanvasComponent artifact={artifact} ctx={ctx} world={world} exec={exec} viewer={viewer} />;
  }

  // 2. Fallback — workflow (обратная совместимость)
  try {
    const { WorkflowCanvas } = require("../../../domains/workflow/ManualUI.jsx");
    const idParam = ctx.routeParams?.workflowId;
    const workflows = world.workflows || [];
    const workflow = workflows.find(w => w.id === idParam);
    const nodes = (world.nodes || []).filter(n => n.workflowId === idParam);
    const edges = (world.edges || []).filter(e => e.workflowId === idParam);
    const executions = world.executions || [];

    if (!workflow) {
      return <div style={{ padding: 24, color: "#6b7280" }}>Workflow не найден (id: {idParam || "не задан"})</div>;
    }
    return <WorkflowCanvas workflow={workflow} nodes={nodes} edges={edges} executions={executions} exec={exec} />;
  } catch (e) {
    // Workflow не доступен — показать placeholder
  }

  return (
    <div style={{
      padding: 24, color: "var(--color-doodle-ink-light, #6b7280)",
      fontFamily: "var(--font-doodle, system-ui)",
      textAlign: "center",
    }}>
      Canvas-компонент не зарегистрирован для проекции «{projectionId}»
    </div>
  );
}
