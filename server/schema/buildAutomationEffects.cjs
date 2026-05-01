/**
 * Серверный builder эффектов для automation-домена (17-й полевой тест).
 *
 * Покрывает agent / executor canExecute:
 *   - run_workflow_manual / run_workflow_with_input — создаёт Execution
 *     + ExecutionStep per Node (status=success при demo, для real engine
 *     это в out-of-scope MVP).
 *   - replay_execution — клонирует Execution с reused inputs.
 *   - abort_execution / retry_failed_step — null (через generic
 *     particles.effects fallback).
 *
 * Editor-only intents (CRUD workflow / nodes / credentials / schedule /
 * imports / purge_history) идут через клиентский crystallize и
 * particles.effects handler, не через /api/agent/exec.
 */

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeEffect(props) {
  return {
    id: uid("eff"),
    parent_id: null,
    status: "proposed",
    ttl: null,
    created_at: Date.now(),
    confirmedAt: new Date().toISOString(),
    ...props,
  };
}

function buildAutomationEffects(intentId, params, viewer, world) {
  switch (intentId) {
    case "run_workflow_manual":
    case "run_workflow_with_input": {
      const workflowId = params.workflowId;
      if (!workflowId) return null;

      const wf = world?.workflows?.[workflowId];
      if (!wf) return null;
      if (wf.status !== "active") return null; // precondition mirror

      const execId = uid("exec");
      const startedAt = new Date().toISOString();

      const execEffect = makeEffect({
        alpha: "create",
        entity: "Execution",
        fields: {
          id: execId,
          workflowId,
          triggeredBy: "manual",
          status: "queued",
          startedAt,
          triggeredByUserId: viewer?.id || null,
        },
        context: { actor: "user", inputJson: params.inputJson || null },
      });

      // Per-Node steps (status=success для demo; реальный engine — out of scope MVP)
      const wfNodes = Object.values(world?.nodes || {}).filter((n) => n.workflowId === workflowId);
      wfNodes.sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));
      const stepEffects = wfNodes.map((node, idx) =>
        makeEffect({
          alpha: "create",
          entity: "ExecutionStep",
          fields: {
            id: uid("step"),
            executionId: execId,
            nodeId: node.id,
            order: idx + 1,
            status: "success",
            startedAt,
            finishedAt: startedAt,
          },
          context: { actor: "system" },
        })
      );

      const finishEffect = makeEffect({
        alpha: "replace",
        entity: "Execution.status",
        fields: { id: execId, status: "success", finishedAt: new Date().toISOString() },
        context: { actor: "system" },
      });

      return [execEffect, ...stepEffects, finishEffect];
    }

    case "replay_execution": {
      const sourceExecId = params.id;
      if (!sourceExecId) return null;
      const sourceExec = world?.executions?.[sourceExecId];
      if (!sourceExec) return null;

      const newExecId = uid("exec");
      const startedAt = new Date().toISOString();

      const newExec = makeEffect({
        alpha: "create",
        entity: "Execution",
        fields: {
          id: newExecId,
          workflowId: sourceExec.workflowId,
          triggeredBy: "manual",
          status: "queued",
          startedAt,
          triggeredByUserId: viewer?.id || null,
        },
        context: { actor: "user", replayOf: sourceExecId },
      });

      // Reuse step inputs из source execution
      const sourceSteps = Object.values(world?.executionSteps || {}).filter(
        (s) => s.executionId === sourceExecId
      );
      sourceSteps.sort((a, b) => (a.order || 0) - (b.order || 0));
      const replayedSteps = sourceSteps.map((src) =>
        makeEffect({
          alpha: "create",
          entity: "ExecutionStep",
          fields: {
            id: uid("step"),
            executionId: newExecId,
            nodeId: src.nodeId,
            order: src.order,
            status: "success",
            inputJson: src.inputJson,
            startedAt,
            finishedAt: startedAt,
          },
          context: { actor: "system", replayOf: src.id },
        })
      );

      const finish = makeEffect({
        alpha: "replace",
        entity: "Execution.status",
        fields: { id: newExecId, status: "success", finishedAt: new Date().toISOString() },
        context: { actor: "system" },
      });

      return [newExec, ...replayedSteps, finish];
    }

    // abort_execution / retry_failed_step / view_execution_step / list_failed_executions
    // — generic particles fallback или read-only.
    default:
      return null;
  }
}

module.exports = { buildAutomationEffects };
