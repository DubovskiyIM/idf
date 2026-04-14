export const ONTOLOGY = {
  entities: {
    Workflow: {
      fields: ["id", "title", "status", "createdAt"],
      statuses: ["draft", "saved", "running", "completed", "failed"],
      type: "internal"
    },
    Node: {
      fields: ["id", "workflowId", "type", "label", "x", "y", "config"],
      type: "internal"
    },
    Edge: {
      fields: ["id", "workflowId", "source", "target", "sourceHandle", "targetHandle"],
      type: "internal"
    },
    NodeType: {
      fields: ["id", "name", "category", "inputs", "outputs", "configSchema"],
      type: "internal"
    },
    NodeResult: {
      fields: ["id", "executionId", "nodeId", "status", "output", "error", "duration"],
      statuses: ["pending", "running", "completed", "failed", "skipped"],
      type: "internal"
    },
    Execution: {
      fields: ["id", "workflowId", "status", "startedAt", "completedAt", "results"],
      statuses: ["pending", "running", "completed", "failed", "stopped"],
      type: "internal"
    }
  },
  predicates: {
    "workflow_is_draft": "workflow.status = 'draft'",
    "workflow_is_saved": "workflow.status = 'saved'",
    "workflow_is_running": "workflow.status = 'running'",
  },
  roles: {
    agent: {
      base: "agent", // §5 base role
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
