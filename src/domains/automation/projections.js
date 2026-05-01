/**
 * Projections automation-домена.
 *
 * Authored — минимум; остальное derived через R-rules.
 * Custom archetypes:
 *   - workflow_canvas (custom canvas — drag-drop nodes + edges)
 *   - execution_replay (custom dashboard — timeline + step inspector)
 */

export const PROJECTIONS = {
  // Custom canvas — drag-drop редактор workflow'а
  workflow_canvas: {
    id: "workflow_canvas",
    title: "Редактор workflow",
    archetype: "canvas",
    mainEntity: "Workflow",
    idParam: "workflowId",
    forRoles: ["editor"],
    witnesses: ["name", "status"],
    onItemClick: "workflow_canvas",
    // Body — кастомный (drag-drop nodes + connections), описание в адаптере
    slots: {
      hero: {
        kind: "card",
        fields: ["name", "status", "description"],
      },
      // body — managed by host UI (canvas drag-drop layer)
      toolbar: {
        intents: ["add_node", "connect_nodes", "run_workflow_manual", "activate_workflow"],
      },
    },
  },

  // Execution replay (timeline steps + per-step input/output diff)
  execution_replay: {
    id: "execution_replay",
    title: "Воспроизведение запуска",
    archetype: "dashboard",
    mainEntity: "Execution",
    idParam: "executionId",
    forRoles: ["editor", "executor", "viewer"],
    witnesses: ["status", "startedAt", "finishedAt", "errorSummary"],
    slots: {
      hero: {
        kind: "card",
        fields: ["status", "triggeredBy", "startedAt", "finishedAt", "errorSummary"],
      },
      body: {
        kind: "subCollection",
        entity: "ExecutionStep",
        foreignKey: "executionId",
        sort: "order",
        fields: ["order", "nodeId", "status", "errorMessage"],
      },
      toolbar: {
        intents: ["abort_execution", "replay_execution", "retry_failed_step"],
      },
    },
  },

  // Credential vault — отдельный от workflow editor с явным security note
  credential_vault: {
    id: "credential_vault",
    title: "Credentials",
    archetype: "catalog",
    mainEntity: "Credential",
    forRoles: ["editor"],
    witnesses: ["name", "provider", "scopes", "expiresAt", "active"],
    onItemClick: "credential_detail",
    slots: {
      header: { kind: "note", text: "Секреты хранятся opaque. Доступ только владельцу credential." },
      hero: { kind: "intent", intentId: "create_credential" },
    },
  },

  // Node palette — каталог типов с filter по category
  node_palette: {
    id: "node_palette",
    title: "Типы нод",
    archetype: "catalog",
    mainEntity: "NodeType",
    forRoles: ["editor"],
    witnesses: ["name", "category", "version", "isCommunity"],
    slots: {
      // header — facet filter по category
      header: {
        kind: "facetFilter",
        field: "category",
        options: ["trigger", "action", "transform", "control"],
      },
    },
  },
};

// Top-level navigation per role
export const ROOT_PROJECTIONS = {
  editor: ["workflow_list", "credential_vault", "node_palette", "execution_list"],
  executor: ["workflow_list", "execution_list"],
  viewer: ["execution_list"],
  agent: ["workflow_list"],
};
