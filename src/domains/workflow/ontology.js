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
  }
};
