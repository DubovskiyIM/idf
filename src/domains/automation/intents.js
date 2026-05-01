/**
 * Intents automation-домена — 35 namespace'ов.
 *
 * Категории:
 *   - Workflow CRUD (6)
 *   - Nodes (5)
 *   - Connections (3)
 *   - Credentials (5)
 *   - Execution (6)
 *   - Schedule (4)
 *   - NodeType catalog (3)
 *   - Imports / templates (2)
 *   - Observability (1)
 */

export const INTENTS = {
  // ─────────────────────────────────────────────────────────────
  // Workflow CRUD
  // ─────────────────────────────────────────────────────────────

  create_workflow: {
    α: "create",
    name: "Создать workflow",
    target: "Workflow",
    confirmation: "form",
    parameters: [
      { name: "name", type: "text", label: "Название", required: true },
      { name: "description", type: "textarea", label: "Описание" },
    ],
    particles: {
      effects: [
        {
          α: "create",
          target: "Workflow",
          fields: {
            id: "{{auto}}",
            name: "{{params.name}}",
            description: "{{params.description}}",
            ownerId: "{{viewer.id}}",
            status: "draft",
            createdAt: "{{now}}",
          },
        },
      ],
    },
  },

  update_workflow: {
    α: "update",
    name: "Изменить workflow",
    target: "Workflow",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Workflow", required: true },
      { name: "name", type: "text", label: "Название", required: true },
      { name: "description", type: "textarea", label: "Описание" },
    ],
    particles: {
      effects: [
        {
          α: "update",
          target: "Workflow",
          fields: { name: "{{params.name}}", description: "{{params.description}}" },
        },
      ],
    },
  },

  delete_workflow: {
    α: "remove",
    name: "Удалить workflow",
    target: "Workflow",
    confirmation: "form",
    context: { __irr: { point: "high", reason: "Удаляются также все executions и schedules" } },
    parameters: [{ name: "id", type: "entityRef", entity: "Workflow", required: true }],
    particles: { effects: [{ α: "remove", target: "Workflow", fields: {} }] },
  },

  duplicate_workflow: {
    α: "create",
    name: "Дублировать",
    target: "Workflow",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Workflow", required: true, label: "Источник" },
      { name: "newName", type: "text", required: true, label: "Название копии" },
    ],
    // Сложный multi-effect — обрабатывается в server/buildAutomationEffects.cjs
  },

  activate_workflow: {
    α: "replace",
    name: "Активировать",
    target: "Workflow.status",
    confirmation: "click",
    precondition: { "Workflow.status": ["draft", "paused"] },
    parameters: [{ name: "id", type: "entityRef", entity: "Workflow", required: true }],
    particles: {
      effects: [{ α: "replace", target: "Workflow.status", fields: { status: "active" } }],
    },
  },

  archive_workflow: {
    α: "replace",
    name: "В архив",
    target: "Workflow.status",
    confirmation: "click",
    parameters: [{ name: "id", type: "entityRef", entity: "Workflow", required: true }],
    particles: {
      effects: [{ α: "replace", target: "Workflow.status", fields: { status: "archived" } }],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Nodes
  // ─────────────────────────────────────────────────────────────

  add_node: {
    α: "create",
    name: "Добавить ноду",
    target: "Node",
    confirmation: "form",
    parameters: [
      { name: "workflowId", type: "entityRef", entity: "Workflow", required: true },
      { name: "nodeTypeId", type: "entityRef", entity: "NodeType", required: true, label: "Тип" },
      { name: "instanceName", type: "text", required: true, label: "Имя" },
      { name: "position", type: "json", label: "Позиция (x,y)" },
    ],
    particles: {
      effects: [
        {
          α: "create",
          target: "Node",
          fields: {
            id: "{{auto}}",
            workflowId: "{{params.workflowId}}",
            nodeTypeId: "{{params.nodeTypeId}}",
            instanceName: "{{params.instanceName}}",
            position: "{{params.position}}",
            configJson: {},
          },
        },
      ],
    },
  },

  remove_node: {
    α: "remove",
    name: "Удалить ноду",
    target: "Node",
    confirmation: "click",
    parameters: [{ name: "id", type: "entityRef", entity: "Node", required: true }],
    particles: { effects: [{ α: "remove", target: "Node", fields: {} }] },
  },

  configure_node: {
    α: "update",
    name: "Настроить ноду",
    target: "Node",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Node", required: true },
      { name: "configJson", type: "json", label: "Настройки", required: true },
      { name: "credentialId", type: "entityRef", entity: "Credential", label: "Credential" },
    ],
    particles: {
      effects: [
        {
          α: "update",
          target: "Node",
          fields: { configJson: "{{params.configJson}}", credentialId: "{{params.credentialId}}" },
        },
      ],
    },
  },

  move_node: {
    α: "update",
    name: "Переместить",
    target: "Node",
    confirmation: "none",
    parameters: [
      { name: "id", type: "entityRef", entity: "Node", required: true },
      { name: "position", type: "json", required: true },
    ],
    particles: {
      effects: [{ α: "update", target: "Node", fields: { position: "{{params.position}}" } }],
    },
  },

  rename_node: {
    α: "update",
    name: "Переименовать",
    target: "Node",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Node", required: true },
      { name: "instanceName", type: "text", required: true, label: "Новое имя" },
    ],
    particles: {
      effects: [{ α: "update", target: "Node", fields: { instanceName: "{{params.instanceName}}" } }],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Connections
  // ─────────────────────────────────────────────────────────────

  connect_nodes: {
    α: "create",
    name: "Соединить",
    target: "Connection",
    confirmation: "form",
    parameters: [
      { name: "workflowId", type: "entityRef", entity: "Workflow", required: true },
      { name: "sourceNodeId", type: "entityRef", entity: "Node", required: true },
      { name: "sourcePort", type: "text", required: true, label: "Source port" },
      { name: "targetNodeId", type: "entityRef", entity: "Node", required: true },
      { name: "targetPort", type: "text", required: true, label: "Target port" },
    ],
    particles: {
      effects: [
        {
          α: "create",
          target: "Connection",
          fields: {
            id: "{{auto}}",
            workflowId: "{{params.workflowId}}",
            sourceNodeId: "{{params.sourceNodeId}}",
            sourcePort: "{{params.sourcePort}}",
            targetNodeId: "{{params.targetNodeId}}",
            targetPort: "{{params.targetPort}}",
          },
        },
      ],
    },
  },

  disconnect_nodes: {
    α: "remove",
    name: "Удалить соединение",
    target: "Connection",
    confirmation: "click",
    parameters: [{ name: "id", type: "entityRef", entity: "Connection", required: true }],
    particles: { effects: [{ α: "remove", target: "Connection", fields: {} }] },
  },

  reroute_connection: {
    α: "update",
    name: "Переподключить",
    target: "Connection",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Connection", required: true },
      { name: "targetNodeId", type: "entityRef", entity: "Node", required: true },
      { name: "targetPort", type: "text", required: true },
    ],
    particles: {
      effects: [
        {
          α: "update",
          target: "Connection",
          fields: { targetNodeId: "{{params.targetNodeId}}", targetPort: "{{params.targetPort}}" },
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Credentials
  // ─────────────────────────────────────────────────────────────

  create_credential: {
    α: "create",
    name: "Создать credential",
    target: "Credential",
    confirmation: "form",
    parameters: [
      { name: "name", type: "text", required: true, label: "Название" },
      {
        name: "provider",
        type: "select",
        required: true,
        label: "Тип",
        options: ["oauth", "apiKey", "basic"],
        valueLabels: { oauth: "OAuth", apiKey: "API key", basic: "Basic auth" },
      },
      { name: "secretRef", type: "text", required: true, label: "Secret ref" },
      { name: "expiresAt", type: "datetime", label: "Истекает" },
      { name: "scopes", type: "text", label: "Scopes (csv)" },
    ],
    particles: {
      effects: [
        {
          α: "create",
          target: "Credential",
          fields: {
            id: "{{auto}}",
            name: "{{params.name}}",
            provider: "{{params.provider}}",
            secretRef: "{{params.secretRef}}",
            expiresAt: "{{params.expiresAt}}",
            scopes: "{{params.scopes}}",
            ownerId: "{{viewer.id}}",
            active: true,
          },
        },
      ],
    },
  },

  update_credential: {
    α: "update",
    name: "Изменить credential",
    target: "Credential",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Credential", required: true },
      { name: "name", type: "text", required: true },
      { name: "scopes", type: "text", label: "Scopes" },
      { name: "expiresAt", type: "datetime", label: "Истекает" },
    ],
    particles: {
      effects: [
        {
          α: "update",
          target: "Credential",
          fields: {
            name: "{{params.name}}",
            scopes: "{{params.scopes}}",
            expiresAt: "{{params.expiresAt}}",
          },
        },
      ],
    },
  },

  delete_credential: {
    α: "remove",
    name: "Удалить credential",
    target: "Credential",
    confirmation: "form",
    context: { __irr: { point: "high", reason: "Связанные ноды потеряют credential, executions с ним останутся orphan" } },
    parameters: [{ name: "id", type: "entityRef", entity: "Credential", required: true }],
    particles: { effects: [{ α: "remove", target: "Credential", fields: {} }] },
  },

  rotate_credential: {
    α: "update",
    name: "Ротация секрета",
    target: "Credential",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Credential", required: true },
      { name: "secretRef", type: "text", required: true, label: "Новый secret ref" },
      { name: "expiresAt", type: "datetime", label: "Новая дата истечения" },
    ],
    particles: {
      effects: [
        {
          α: "update",
          target: "Credential",
          fields: {
            secretRef: "{{params.secretRef}}",
            expiresAt: "{{params.expiresAt}}",
            active: true,
          },
        },
      ],
    },
  },

  share_credential: {
    α: "update",
    name: "Поделиться credential",
    target: "Credential",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "Credential", required: true },
      { name: "shareWithUserId", type: "entityRef", entity: "User", required: true, label: "Кому" },
    ],
    // Структурно — handler в server/buildAutomationEffects.cjs (m2m grant таблица).
  },

  // ─────────────────────────────────────────────────────────────
  // Execution
  // ─────────────────────────────────────────────────────────────

  run_workflow_manual: {
    α: "create",
    name: "Запустить",
    target: "Execution",
    confirmation: "click",
    precondition: { "Workflow.status": ["active"] },
    parameters: [{ name: "workflowId", type: "entityRef", entity: "Workflow", required: true }],
    // Custom — создаёт Execution + ExecutionStep'ы для всех Node, см. buildAutomationEffects.cjs
  },

  run_workflow_with_input: {
    α: "create",
    name: "Запустить с input",
    target: "Execution",
    confirmation: "form",
    precondition: { "Workflow.status": ["active"] },
    parameters: [
      { name: "workflowId", type: "entityRef", entity: "Workflow", required: true },
      { name: "inputJson", type: "json", required: true, label: "Input data" },
    ],
  },

  abort_execution: {
    α: "replace",
    name: "Прервать",
    target: "Execution.status",
    confirmation: "click",
    precondition: { "Execution.status": ["queued", "running"] },
    parameters: [{ name: "id", type: "entityRef", entity: "Execution", required: true }],
    particles: {
      effects: [
        {
          α: "replace",
          target: "Execution.status",
          fields: { status: "aborted", finishedAt: "{{now}}" },
        },
      ],
    },
  },

  replay_execution: {
    α: "create",
    name: "Повторить",
    target: "Execution",
    confirmation: "click",
    parameters: [{ name: "id", type: "entityRef", entity: "Execution", required: true }],
    // Custom — клонирует Execution + reused inputs, см. buildAutomationEffects.cjs
  },

  retry_failed_step: {
    α: "replace",
    name: "Повторить шаг",
    target: "ExecutionStep.status",
    confirmation: "click",
    precondition: { "ExecutionStep.status": ["failed"] },
    parameters: [{ name: "id", type: "entityRef", entity: "ExecutionStep", required: true }],
    particles: {
      effects: [
        {
          α: "replace",
          target: "ExecutionStep.status",
          fields: { status: "success", errorMessage: null, finishedAt: "{{now}}" },
        },
      ],
    },
  },

  view_execution_step: {
    α: "read",
    name: "Подробности шага",
    target: "ExecutionStep",
    parameters: [{ name: "id", type: "entityRef", entity: "ExecutionStep", required: true }],
  },

  // ─────────────────────────────────────────────────────────────
  // Schedule
  // ─────────────────────────────────────────────────────────────

  create_schedule: {
    α: "create",
    name: "Создать расписание",
    target: "ScheduledRun",
    confirmation: "form",
    parameters: [
      { name: "workflowId", type: "entityRef", entity: "Workflow", required: true },
      { name: "cronExpression", type: "text", required: true, label: "Cron expr (e.g. 0 9 * * *)" },
    ],
    particles: {
      effects: [
        {
          α: "create",
          target: "ScheduledRun",
          fields: {
            id: "{{auto}}",
            workflowId: "{{params.workflowId}}",
            cronExpression: "{{params.cronExpression}}",
            active: true,
            createdByUserId: "{{viewer.id}}",
          },
        },
      ],
    },
  },

  update_schedule: {
    α: "update",
    name: "Изменить расписание",
    target: "ScheduledRun",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "ScheduledRun", required: true },
      { name: "cronExpression", type: "text", required: true },
    ],
    particles: {
      effects: [
        {
          α: "update",
          target: "ScheduledRun",
          fields: { cronExpression: "{{params.cronExpression}}" },
        },
      ],
    },
  },

  disable_schedule: {
    α: "replace",
    name: "Отключить",
    target: "ScheduledRun.active",
    confirmation: "click",
    parameters: [{ name: "id", type: "entityRef", entity: "ScheduledRun", required: true }],
    particles: {
      effects: [{ α: "replace", target: "ScheduledRun.active", fields: { active: false } }],
    },
  },

  enable_schedule: {
    α: "replace",
    name: "Включить",
    target: "ScheduledRun.active",
    confirmation: "click",
    parameters: [{ name: "id", type: "entityRef", entity: "ScheduledRun", required: true }],
    particles: {
      effects: [{ α: "replace", target: "ScheduledRun.active", fields: { active: true } }],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // NodeType catalog
  // ─────────────────────────────────────────────────────────────

  register_node_type: {
    α: "create",
    name: "Зарегистрировать тип",
    target: "NodeType",
    confirmation: "form",
    parameters: [
      { name: "name", type: "text", required: true },
      {
        name: "category",
        type: "select",
        required: true,
        options: ["trigger", "action", "transform", "control"],
        valueLabels: { trigger: "Триггер", action: "Действие", transform: "Преобразование", control: "Управление" },
      },
      { name: "inputSchema", type: "json", label: "Schema входов" },
      { name: "outputSchema", type: "json", label: "Schema выходов" },
      { name: "iconKey", type: "text", label: "Иконка" },
      { name: "version", type: "text", required: true, label: "Версия" },
      { name: "isCommunity", type: "boolean", label: "Community" },
    ],
    particles: {
      effects: [
        {
          α: "create",
          target: "NodeType",
          fields: {
            id: "{{auto}}",
            name: "{{params.name}}",
            category: "{{params.category}}",
            inputSchema: "{{params.inputSchema}}",
            outputSchema: "{{params.outputSchema}}",
            iconKey: "{{params.iconKey}}",
            version: "{{params.version}}",
            isCommunity: "{{params.isCommunity}}",
          },
        },
      ],
    },
  },

  update_node_type: {
    α: "update",
    name: "Обновить тип",
    target: "NodeType",
    confirmation: "form",
    parameters: [
      { name: "id", type: "entityRef", entity: "NodeType", required: true },
      { name: "version", type: "text", required: true },
      { name: "inputSchema", type: "json" },
      { name: "outputSchema", type: "json" },
    ],
    particles: {
      effects: [
        {
          α: "update",
          target: "NodeType",
          fields: {
            version: "{{params.version}}",
            inputSchema: "{{params.inputSchema}}",
            outputSchema: "{{params.outputSchema}}",
          },
        },
      ],
    },
  },

  mark_node_type_deprecated: {
    α: "update",
    name: "Пометить deprecated",
    target: "NodeType",
    confirmation: "click",
    parameters: [{ name: "id", type: "entityRef", entity: "NodeType", required: true }],
    particles: {
      effects: [{ α: "update", target: "NodeType", fields: { isCommunity: true } }],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Imports / templates
  // ─────────────────────────────────────────────────────────────

  import_workflow: {
    α: "create",
    name: "Импортировать workflow",
    target: "Workflow",
    confirmation: "form",
    parameters: [{ name: "workflowJson", type: "json", required: true, label: "JSON workflow'а" }],
    // Custom — парсит JSON, создаёт Workflow + Nodes + Connections, см. buildAutomationEffects.cjs
  },

  export_workflow: {
    α: "read",
    name: "Экспортировать",
    target: "Workflow",
    parameters: [{ name: "id", type: "entityRef", entity: "Workflow", required: true }],
  },

  // ─────────────────────────────────────────────────────────────
  // Observability
  // ─────────────────────────────────────────────────────────────

  purge_execution_history: {
    α: "remove",
    name: "Очистить историю запусков",
    target: "Execution",
    confirmation: "form",
    context: {
      __irr: { point: "high", reason: "История выполнения удаляется без возможности восстановления" },
    },
    parameters: [{ name: "workflowId", type: "entityRef", entity: "Workflow", required: true }],
    // Custom — каскадно удаляет Execution + ExecutionStep, см. buildAutomationEffects.cjs
  },

  list_failed_executions: {
    α: "read",
    name: "Failed executions",
    target: "Execution",
    parameters: [{ name: "workflowId", type: "entityRef", entity: "Workflow", required: false }],
  },
};
