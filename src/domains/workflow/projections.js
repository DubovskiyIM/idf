export const PROJECTIONS = {
  workflow_list: {
    name: "Workflows",
    kind: "catalog",
    query: "все workflow",
    entities: ["Workflow"],
    mainEntity: "Workflow",
    routeEntities: [],
    sort: "-createdAt",
    witnesses: ["title", "status", "nodes.count"],
  },
  workflow_canvas: {
    name: "Canvas",
    // kind: "canvas" — требует canvas-архетип (React Flow holder), которого
    // пока нет в crystallize_v2. SUPPORTED_ARCHETYPES пропустит проекцию.
    // Переедет в отдельный canvas milestone (см. roadmap).
    kind: "canvas",
    query: "все узлы и рёбра workflow с позициями",
    entities: ["Workflow", "Node", "Edge"],
    mainEntity: "Workflow",
    witnesses: ["node.x", "node.y", "node.type", "node.label", "edge.source", "edge.target"],
  },
  node_inspector: {
    name: "Инспектор узла",
    kind: "detail",
    query: "выбранный узел с конфигурацией",
    entities: ["Node"],
    mainEntity: "Node",
    idParam: "nodeId",
    witnesses: ["label", "type", "config", "configSchema"],
  },
  execution_log: {
    name: "Лог исполнения",
    kind: "detail",
    query: "текущее исполнение с результатами по узлам",
    entities: ["Execution", "NodeResult"],
    mainEntity: "Execution",
    idParam: "executionId",
    witnesses: ["execution.status", "nodeResults", "duration"],
  },
};

// workflow_list доступен как root в V2-шелле. workflow_canvas — canvas, до
// отдельного milestone. Остальные — deep-проекции, достижимые через nav-graph.
export const ROOT_PROJECTIONS = ["workflow_list"];
