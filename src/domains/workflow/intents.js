export const INTENTS = {
  create_workflow: {
    name: "Создать workflow", particles: {
      entities: ["workflow: Workflow"],
      conditions: [],
      effects: [{ α: "add", target: "workflows", σ: "account" }],
      witnesses: ["workflow.title"],
      confirmation: "form"
    }, antagonist: null, creates: "Workflow(draft)",
    parameters: [{ name: "title", type: "text", required: true, placeholder: "Название workflow" }],
  },
  add_node: {
    name: "Добавить узел", particles: {
      entities: ["workflow: Workflow", "node: Node"],
      conditions: ["workflow.status IN ('draft','saved')"],
      effects: [{ α: "add", target: "nodes", σ: "account" }],
      witnesses: ["node.type", "node.x", "node.y"],
      confirmation: "drag"
    }, antagonist: null, creates: "Node"
  },
  remove_node: {
    name: "Удалить узел", particles: {
      entities: ["node: Node"],
      conditions: ["workflow.status IN ('draft','saved')"],
      effects: [
        { α: "remove", target: "nodes", σ: "account" },
        { α: "remove", target: "edges", σ: "account" }
      ],
      witnesses: ["node.label", "connected_edges.count"],
      confirmation: "click"
    }, antagonist: null, creates: null, irreversibility: "medium"
  },
  move_node: {
    name: "Переместить узел", particles: {
      entities: ["node: Node"],
      conditions: ["workflow.status IN ('draft','saved')"],
      effects: [
        { α: "replace", target: "node.x", σ: "account" },
        { α: "replace", target: "node.y", σ: "account" }
      ],
      witnesses: [],
      confirmation: "drag-end"
    }, antagonist: null, creates: null
  },
  connect_nodes: {
    name: "Соединить узлы", particles: {
      entities: ["edge: Edge", "source: Node", "target: Node"],
      conditions: ["workflow.status IN ('draft','saved')"],
      effects: [{ α: "add", target: "edges", σ: "account" }],
      witnesses: ["source.label", "target.label"],
      confirmation: "drag"
    }, antagonist: "disconnect_nodes", creates: "Edge"
  },
  disconnect_nodes: {
    name: "Удалить связь", particles: {
      entities: ["edge: Edge"],
      conditions: ["workflow.status IN ('draft','saved')"],
      effects: [{ α: "remove", target: "edges", σ: "account" }],
      witnesses: ["source.label", "target.label"],
      confirmation: "click"
    }, antagonist: "connect_nodes", creates: null, irreversibility: "low"
  },
  configure_node: {
    name: "Настроить узел", particles: {
      entities: ["node: Node"],
      conditions: ["workflow.status IN ('draft','saved')"],
      effects: [{ α: "replace", target: "node.config", σ: "account" }],
      witnesses: ["node.type", "node.config", "configSchema"],
      confirmation: "form"
    }, antagonist: null, creates: null, phase: "investigation"
  },
  save_workflow: {
    name: "Сохранить", particles: {
      entities: ["workflow: Workflow"],
      conditions: ["workflow.status = 'draft'"],
      effects: [{ α: "replace", target: "workflow.status", value: "saved", σ: "account" }],
      witnesses: ["nodes.count", "edges.count"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  execute_workflow: {
    name: "Запустить", particles: {
      entities: ["workflow: Workflow"],
      conditions: ["workflow.status = 'saved'"],
      effects: [
        { α: "replace", target: "workflow.status", value: "running", σ: "account" },
        { α: "add", target: "executions", σ: "account" }
      ],
      witnesses: ["workflow.title"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  stop_execution: {
    name: "Остановить", particles: {
      entities: ["execution: Execution"],
      conditions: ["execution.status = 'running'"],
      effects: [
        { α: "replace", target: "execution.status", value: "stopped", σ: "account" },
        { α: "replace", target: "workflow.status", value: "saved", σ: "account" }
      ],
      witnesses: ["running_nodes"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  rename_node: {
    name: "Переименовать узел", particles: {
      entities: ["node: Node"],
      conditions: ["workflow.status IN ('draft','saved')"],
      effects: [{ α: "replace", target: "node.label", σ: "account" }],
      witnesses: ["node.label"],
      confirmation: "form"
    }, antagonist: null, creates: null, phase: "investigation"
  },
  delete_workflow: {
    name: "Удалить workflow", particles: {
      entities: ["workflow: Workflow"],
      conditions: ["workflow.status != 'running'"],
      effects: [
        { α: "remove", target: "workflows", σ: "account" },
        { α: "remove", target: "nodes", σ: "account" },
        { α: "remove", target: "edges", σ: "account" }
      ],
      witnesses: ["workflow.title", "nodes.count"],
      confirmation: "click"
    }, antagonist: null, creates: null, irreversibility: "high"
  },
  duplicate_workflow: {
    name: "Дублировать workflow", particles: {
      entities: ["workflow: Workflow"],
      conditions: [],
      effects: [
        { α: "add", target: "workflows", σ: "account" },
        { α: "add", target: "nodes", σ: "account" },
        { α: "add", target: "edges", σ: "account" }
      ],
      witnesses: ["workflow.title"],
      confirmation: "click"
    }, antagonist: null, creates: null, extended: true
  },
  add_custom_node_type: {
    name: "Создать тип узла", particles: {
      entities: ["nodeType: NodeType"],
      conditions: [],
      effects: [{ α: "add", target: "nodetypes", σ: "account" }],
      witnesses: ["existing_types"],
      confirmation: "form"
    }, antagonist: null, creates: "NodeType"
  },
  import_workflow: {
    name: "Импортировать", particles: {
      entities: ["workflow: Workflow"],
      conditions: [],
      effects: [
        { α: "add", target: "workflows", σ: "account" },
        { α: "add", target: "nodes", σ: "account" },
        { α: "add", target: "edges", σ: "account" }
      ],
      witnesses: ["json_preview"],
      confirmation: "file"
    }, antagonist: null, creates: "Workflow"
  }
};
