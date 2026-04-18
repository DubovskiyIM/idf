export const ONTOLOGY = {
  entities: {
    Workflow: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Автор" },
        title: { type: "text", read: ["*"], write: ["self"], required: true, label: "Название" },
        description: { type: "textarea", read: ["*"], write: ["self"], label: "Описание" },
        status: {
          type: "enum", read: ["*"], label: "Статус",
          values: ["draft", "saved", "running", "completed", "failed"],
          valueLabels: { draft: "Черновик", saved: "Сохранён", running: "Выполняется", completed: "Завершён", failed: "Ошибка" },
        },
        createdAt: { type: "datetime", read: ["*"], label: "Создан" },
      },
      statuses: ["draft", "saved", "running", "completed", "failed"],
      ownerField: "userId",
      type: "internal",
    },
    Node: {
      fields: {
        id: { type: "id" },
        workflowId: { type: "entityRef", read: ["*"], label: "Workflow" },
        type: {
          type: "enum", read: ["*"], write: ["self"], required: true, label: "Тип",
          values: ["trigger", "action", "condition", "delay"],
          valueLabels: { trigger: "Триггер", action: "Действие", condition: "Условие", delay: "Задержка" },
        },
        label: { type: "text", read: ["*"], write: ["self"], label: "Метка" },
        x: { type: "number", read: ["*"], write: ["self"], label: "X" },
        y: { type: "number", read: ["*"], write: ["self"], label: "Y" },
        config: { type: "textarea", read: ["*"], write: ["self"], label: "Конфигурация" },
      },
      type: "internal",
    },
    Edge: {
      fields: {
        id: { type: "id" },
        workflowId: { type: "entityRef", read: ["*"], label: "Workflow" },
        source: { type: "entityRef", read: ["*"], label: "Источник" },
        target: { type: "entityRef", read: ["*"], label: "Цель" },
        sourceHandle: { type: "text", read: ["*"], label: "Выход" },
        targetHandle: { type: "text", read: ["*"], label: "Вход" },
      },
      type: "internal",
    },
    NodeType: {
      fields: {
        id: { type: "id" },
        name: { type: "text", read: ["*"], required: true, label: "Название" },
        category: {
          type: "enum", read: ["*"], label: "Категория",
          values: ["trigger", "action", "condition", "delay"],
          valueLabels: { trigger: "Триггер", action: "Действие", condition: "Условие", delay: "Задержка" },
        },
        inputs: { type: "textarea", read: ["*"], label: "Входы" },
        outputs: { type: "textarea", read: ["*"], label: "Выходы" },
        configSchema: { type: "textarea", read: ["*"], label: "Схема конфигурации" },
      },
      type: "reference",
    },
    NodeResult: {
      fields: {
        id: { type: "id" },
        executionId: { type: "entityRef", read: ["*"], label: "Выполнение" },
        nodeId: { type: "entityRef", read: ["*"], label: "Узел" },
        status: {
          type: "enum", read: ["*"], label: "Статус",
          values: ["pending", "running", "completed", "failed", "skipped"],
          valueLabels: { pending: "Ожидает", running: "Выполняется", completed: "Успех", failed: "Ошибка", skipped: "Пропущен" },
        },
        output: { type: "textarea", read: ["*"], label: "Вывод" },
        error: { type: "textarea", read: ["*"], label: "Ошибка" },
        duration: { type: "number", read: ["*"], label: "Длительность (мс)" },
      },
      type: "internal",
    },
    Execution: {
      fields: {
        id: { type: "id" },
        workflowId: { type: "entityRef", read: ["*"], label: "Workflow" },
        status: {
          type: "enum", read: ["*"], label: "Статус",
          values: ["pending", "running", "completed", "failed", "stopped"],
          valueLabels: { pending: "Ожидает", running: "Выполняется", completed: "Завершено", failed: "Ошибка", stopped: "Остановлено" },
        },
        startedAt: { type: "datetime", read: ["*"], label: "Начало" },
        completedAt: { type: "datetime", read: ["*"], label: "Окончание" },
        results: { type: "textarea", read: ["*"], label: "Результаты" },
      },
      statuses: ["pending", "running", "completed", "failed", "stopped"],
      type: "internal",
    },
  },
  predicates: {
    "workflow_is_draft": "workflow.status = 'draft'",
    "workflow_is_saved": "workflow.status = 'saved'",
    "workflow_is_running": "workflow.status = 'running'",
  },
  roles: {
    self: {
      base: "owner",
      label: "Автор",
      canExecute: [
        "create_workflow", "save_workflow", "execute_workflow", "stop_execution",
        "delete_workflow", "duplicate_workflow", "import_workflow",
        "add_node", "remove_node", "move_node", "rename_node", "configure_node",
        "connect_nodes", "disconnect_nodes",
        "add_custom_node_type",
      ],
      visibleFields: {
        Workflow: ["id", "userId", "title", "description", "status", "createdAt"],
        Node: ["id", "workflowId", "type", "label", "x", "y", "config"],
        Edge: ["id", "workflowId", "source", "target", "sourceHandle", "targetHandle"],
        NodeType: ["id", "name", "category", "inputs", "outputs", "configSchema"],
        Execution: ["id", "workflowId", "status", "startedAt", "completedAt"],
        NodeResult: ["id", "executionId", "nodeId", "status", "output", "error", "duration"],
      },
    },
    agent: {
      base: "agent",
      label: "Агент (API)",
      canExecute: [
        "create_workflow", "add_node", "connect_nodes",
        "configure_node", "save_workflow", "execute_workflow",
      ],
      visibleFields: {
        Workflow: ["id", "title", "status", "createdAt"],
        Node: ["id", "workflowId", "type", "label", "config"],
        Edge: ["id", "workflowId", "source", "target"],
        Execution: ["id", "workflowId", "status", "startedAt", "completedAt"],
        NodeResult: ["id", "executionId", "nodeId", "status", "output", "error"],
      },
    },
  },
};
