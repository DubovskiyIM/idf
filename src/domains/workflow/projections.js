export const PROJECTIONS = {
  workflow_canvas: {
    name: "Canvas",
    query: "все узлы и рёбра workflow с позициями",
    witnesses: ["node.x", "node.y", "node.type", "node.label", "edge.source", "edge.target"]
  },
  node_inspector: {
    name: "Инспектор узла",
    query: "выбранный узел с конфигурацией",
    witnesses: ["label", "type", "config", "configSchema"]
  },
  execution_log: {
    name: "Лог исполнения",
    query: "текущее исполнение с результатами по узлам",
    witnesses: ["execution.status", "nodeResults", "duration"]
  },
  workflow_list: {
    name: "Список workflow",
    query: "все workflow",
    witnesses: ["title", "status", "nodes.count"]
  }
};
