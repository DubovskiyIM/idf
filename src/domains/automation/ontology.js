/**
 * Онтология automation-домена — visual workflow automation в духе n8n.
 *
 * 8 сущностей, 4 роли (editor / executor / viewer / agent).
 * 17-й полевой тест IDF (после ArgoCD 16-го).
 *
 * Lineage: AntD enterprise (invest → compliance → keycloak → argocd → automation).
 */

export const ONTOLOGY = {
  domain: "automation",
  features: {
    domainScope: "automation", // discriminator для коллизий entity-names
  },
  entities: {
    User: {
      ownerField: "id",
      fields: {
        id: { type: "text" },
        email: { type: "email" },
        name: { type: "text", required: true, fieldRole: "primary", label: "Имя" },
        avatar: { type: "url" },
      },
    },

    Workflow: {
      ownerField: "ownerId",
      fields: {
        id: { type: "text" },
        name: { type: "text", required: true, fieldRole: "primary", label: "Название" },
        description: { type: "textarea", label: "Описание" },
        ownerId: { type: "entityRef", entity: "User" },
        status: {
          type: "select",
          options: ["draft", "active", "paused", "archived"],
          required: true,
          valueLabels: {
            draft: "Черновик",
            active: "Активен",
            paused: "Приостановлен",
            archived: "В архиве",
          },
        },
        createdAt: { type: "datetime", fieldRole: "createdAt" },
      },
    },

    NodeType: {
      kind: "reference", // shared catalog, не per-tenant
      fields: {
        id: { type: "text" },
        name: { type: "text", required: true, fieldRole: "primary", label: "Название" },
        category: {
          type: "select",
          options: ["trigger", "action", "transform", "control"],
          required: true,
          valueLabels: {
            trigger: "Триггер",
            action: "Действие",
            transform: "Преобразование",
            control: "Управление",
          },
        },
        inputSchema: { type: "json", label: "Schema входов" },
        outputSchema: { type: "json", label: "Schema выходов" },
        iconKey: { type: "text", label: "Иконка" },
        version: { type: "text", label: "Версия" },
        isCommunity: { type: "boolean", label: "Community" },
      },
    },

    Node: {
      fields: {
        id: { type: "text" },
        workflowId: { type: "entityRef", entity: "Workflow", required: true },
        nodeTypeId: { type: "entityRef", entity: "NodeType", required: true, label: "Тип" },
        instanceName: { type: "text", required: true, fieldRole: "primary", label: "Имя в workflow" },
        configJson: { type: "json", label: "Настройки" },
        position: { type: "json", label: "Позиция" }, // {x, y}
        credentialId: { type: "entityRef", entity: "Credential", label: "Credential" },
      },
    },

    Connection: {
      fields: {
        id: { type: "text" },
        workflowId: { type: "entityRef", entity: "Workflow", required: true },
        sourceNodeId: { type: "entityRef", entity: "Node", required: true },
        sourcePort: { type: "text", required: true, label: "Source port" },
        targetNodeId: { type: "entityRef", entity: "Node", required: true },
        targetPort: { type: "text", required: true, label: "Target port" },
      },
    },

    Credential: {
      ownerField: "ownerId",
      fields: {
        id: { type: "text" },
        name: { type: "text", required: true, fieldRole: "primary", label: "Название" },
        provider: {
          type: "select",
          options: ["oauth", "apiKey", "basic"],
          required: true,
          valueLabels: { oauth: "OAuth", apiKey: "API key", basic: "Basic auth" },
        },
        ownerId: { type: "entityRef", entity: "User" },
        secretRef: { type: "text", label: "Secret ref (opaque)" },
        expiresAt: { type: "datetime", label: "Истекает" },
        scopes: { type: "text", label: "Scopes (csv)" },
        active: { type: "boolean", label: "Активен" },
      },
    },

    Execution: {
      temporal: true, // date-witness для catalog timeline
      fields: {
        id: { type: "text" },
        workflowId: { type: "entityRef", entity: "Workflow", required: true },
        triggeredBy: {
          type: "select",
          options: ["manual", "schedule", "webhook", "api"],
          required: true,
          valueLabels: {
            manual: "Вручную",
            schedule: "По расписанию",
            webhook: "Webhook",
            api: "API",
          },
        },
        status: {
          type: "select",
          options: ["queued", "running", "success", "failed", "aborted"],
          required: true,
          valueLabels: {
            queued: "В очереди",
            running: "Выполняется",
            success: "Успех",
            failed: "Ошибка",
            aborted: "Отменён",
          },
        },
        startedAt: { type: "datetime", fieldRole: "createdAt" },
        finishedAt: { type: "datetime" },
        errorSummary: { type: "textarea", label: "Описание ошибки" },
        triggeredByUserId: { type: "entityRef", entity: "User" },
      },
    },

    ExecutionStep: {
      fields: {
        id: { type: "text" },
        executionId: { type: "entityRef", entity: "Execution", required: true },
        nodeId: { type: "entityRef", entity: "Node", required: true },
        order: { type: "number", required: true, label: "Порядок" },
        status: {
          type: "select",
          options: ["success", "failed", "skipped"],
          required: true,
          valueLabels: { success: "Успех", failed: "Ошибка", skipped: "Пропущен" },
        },
        inputJson: { type: "json", label: "Input" },
        outputJson: { type: "json", label: "Output" },
        errorMessage: { type: "textarea", label: "Сообщение об ошибке" },
        startedAt: { type: "datetime" },
        finishedAt: { type: "datetime" },
      },
    },

    ScheduledRun: {
      fields: {
        id: { type: "text" },
        workflowId: { type: "entityRef", entity: "Workflow", required: true },
        cronExpression: { type: "text", required: true, label: "Cron" },
        nextFireAt: { type: "datetime", label: "Следующий запуск" },
        lastFireAt: { type: "datetime", label: "Последний запуск" },
        active: { type: "boolean", label: "Активно" },
        createdByUserId: { type: "entityRef", entity: "User" },
      },
    },
  },

  roles: {
    editor: {
      base: "owner",
      visibleFields: {
        Workflow: ["*"],
        Node: ["*"],
        Connection: ["*"],
        NodeType: ["*"],
        Credential: ["id", "name", "provider", "scopes", "expiresAt", "active", "ownerId"],
        Execution: ["*"],
        ExecutionStep: ["*"],
        ScheduledRun: ["*"],
        User: ["id", "name", "email", "avatar"],
      },
      canExecute: [
        // Workflow CRUD
        "create_workflow", "update_workflow", "delete_workflow", "duplicate_workflow",
        "activate_workflow", "archive_workflow",
        // Nodes
        "add_node", "remove_node", "configure_node", "move_node", "rename_node",
        // Connections
        "connect_nodes", "disconnect_nodes", "reroute_connection",
        // Credentials
        "create_credential", "update_credential", "delete_credential",
        "rotate_credential", "share_credential",
        // Execution
        "run_workflow_manual", "run_workflow_with_input", "abort_execution",
        "replay_execution", "retry_failed_step", "view_execution_step",
        // Schedule
        "create_schedule", "update_schedule", "disable_schedule", "enable_schedule",
        // NodeType catalog
        "register_node_type", "update_node_type", "mark_node_type_deprecated",
        // Imports / templates
        "import_workflow", "export_workflow",
        // Observability
        "purge_execution_history", "list_failed_executions",
      ],
    },

    executor: {
      base: "agent",
      canExecute: [
        "run_workflow_manual",
        "run_workflow_with_input",
        "abort_execution",
        "replay_execution",
        "retry_failed_step",
        "view_execution_step",
        "list_failed_executions",
      ],
      preapproval: {
        entity: "Credential",
        ownerField: "ownerId",
        checks: [
          { kind: "active", field: "active" },
          { kind: "notExpired", field: "expiresAt" },
        ],
        // requiredFor задаём узкий — только runs, не view
        requiredFor: ["run_workflow_manual", "run_workflow_with_input"],
      },
      visibleFields: {
        Workflow: ["id", "name", "description", "status", "createdAt"],
        Node: ["*"],
        Connection: ["*"],
        NodeType: ["*"],
        Execution: ["*"],
        ExecutionStep: ["*"],
        ScheduledRun: ["id", "workflowId", "cronExpression", "active", "nextFireAt"],
      },
    },

    viewer: {
      base: "viewer",
      canExecute: ["view_execution_step", "list_failed_executions"],
      visibleFields: {
        Workflow: ["id", "name", "status"],
        Execution: ["id", "workflowId", "status", "startedAt", "finishedAt", "triggeredBy", "errorSummary"],
        ExecutionStep: ["id", "executionId", "order", "status", "errorMessage"],
        NodeType: ["id", "name", "category", "iconKey"],
      },
    },

    agent: {
      base: "agent",
      canExecute: ["run_workflow_manual", "abort_execution"],
      preapproval: {
        entity: "Credential",
        ownerField: "ownerId",
        checks: [{ kind: "active", field: "active" }],
        requiredFor: ["run_workflow_manual"],
      },
      visibleFields: {
        Workflow: ["id", "name", "status", "ownerId"],
        Node: ["id", "workflowId", "nodeTypeId", "instanceName"],
        Execution: ["*"],
        ExecutionStep: ["*"],
      },
    },
  },

  invariants: [
    // Referential FK (10)
    { kind: "referential", from: "Node.workflowId", to: "Workflow.id", name: "node_belongs_to_workflow" },
    { kind: "referential", from: "Connection.workflowId", to: "Workflow.id", name: "conn_belongs_to_workflow" },
    { kind: "referential", from: "Connection.sourceNodeId", to: "Node.id", name: "conn_source" },
    { kind: "referential", from: "Connection.targetNodeId", to: "Node.id", name: "conn_target" },
    { kind: "referential", from: "Node.nodeTypeId", to: "NodeType.id", name: "node_type" },
    { kind: "referential", from: "Node.credentialId", to: "Credential.id", name: "node_cred" },
    { kind: "referential", from: "Execution.workflowId", to: "Workflow.id", name: "exec_workflow" },
    { kind: "referential", from: "ExecutionStep.executionId", to: "Execution.id", name: "step_exec" },
    { kind: "referential", from: "ExecutionStep.nodeId", to: "Node.id", name: "step_node" },
    { kind: "referential", from: "ScheduledRun.workflowId", to: "Workflow.id", name: "schedule_workflow" },

    // Transition (2)
    {
      kind: "transition",
      entity: "Execution",
      field: "status",
      transitions: {
        queued: ["running", "aborted"],
        running: ["success", "failed", "aborted"],
      },
      name: "execution_lifecycle",
    },
    {
      kind: "transition",
      entity: "Workflow",
      field: "status",
      transitions: {
        draft: ["active", "archived"],
        active: ["paused", "archived"],
        paused: ["active", "archived"],
      },
      name: "workflow_lifecycle",
    },

    // Expression (2)
    {
      kind: "expression",
      name: "no_self_loop_connection",
      entity: "Connection",
      predicate: "row.sourceNodeId !== row.targetNodeId",
    },
    {
      kind: "expression",
      name: "credential_owner_match",
      entity: "Node",
      predicate:
        "(row, world) => !row.credentialId || (world.credentials?.[row.credentialId]?.ownerId === world.workflows?.[row.workflowId]?.ownerId)",
    },

    // Cardinality (1)
    {
      kind: "cardinality",
      name: "one_active_schedule_per_workflow",
      entity: "ScheduledRun",
      groupBy: "workflowId",
      where: "row.active === true",
      max: 1,
    },
  ],

  rules: [
    {
      name: "alert_on_consecutive_failures",
      trigger: "execution.status",
      threshold: {
        lookback: 3,
        field: "status",
        condition: "value === 'failed'",
      },
      effect: { kind: "log", message: "3 consecutive failures detected" },
    },
    {
      name: "schedule_next_run",
      trigger: "execution.finished",
      schedule: { revokeOn: "workflow.archived" },
      effect: { kind: "enqueue_next_execution" },
    },
  ],
};
