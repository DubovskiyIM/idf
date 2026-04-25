/**
 * Seed automation-домена в host-format `{intent_id:"_seed", alpha:"add",
 * target:"<plural>", scope:"account", value:null, context:{...row}}`.
 *
 * Host shape: каждый seed effect — confirmed эффект, который при первом
 * запуске домена fetch'ится через /api/effects/seed и becomes part of Φ.
 *
 * Coverage: 3 User, 8 NodeType, 2 Credential, 2 Workflow, 8 Node,
 * 6 Connection, 1 ScheduledRun, 4 Execution, 5 ExecutionStep.
 * Итого: 39 effects.
 */

const NOW = Date.now();
const H = 1000 * 60 * 60;

function ef(target, ctx) {
  return {
    id: `seed_automation_${target}_${ctx.id}`,
    intent_id: "_seed",
    alpha: "add",
    scope: "account",
    parent_id: null,
    status: "confirmed",
    ttl: null,
    created_at: NOW,
    resolved_at: NOW,
    target,
    value: null,
    context: { ...ctx, createdAt: ctx.createdAt || NOW },
  };
}

export function getSeedEffects() {
  const effects = [];

  // ── Users ────────────────────────────────────────────────────
  effects.push(ef("users", { id: "user-editor", name: "Артём (editor)", email: "artem@fold.demo" }));
  effects.push(ef("users", { id: "user-executor", name: "Бот (executor)", email: "bot@fold.demo" }));
  effects.push(ef("users", { id: "user-viewer", name: "Аудитор (viewer)", email: "audit@fold.demo" }));

  // ── NodeTypes (8) ─────────────────────────────────────────────
  effects.push(ef("nodeTypes", {
    id: "nt-webhook", name: "Webhook Trigger", category: "trigger", iconKey: "webhook",
    version: "1.0.0", isCommunity: false,
  }));
  effects.push(ef("nodeTypes", {
    id: "nt-schedule", name: "Schedule Trigger", category: "trigger", iconKey: "calendar",
    version: "1.0.0", isCommunity: false,
  }));
  effects.push(ef("nodeTypes", {
    id: "nt-http", name: "HTTP Request", category: "action", iconKey: "globe",
    version: "1.2.0", isCommunity: false,
  }));
  effects.push(ef("nodeTypes", {
    id: "nt-slack", name: "Slack Send", category: "action", iconKey: "slack",
    version: "2.0.0", isCommunity: false,
  }));
  effects.push(ef("nodeTypes", {
    id: "nt-email", name: "Email Send", category: "action", iconKey: "mail",
    version: "1.5.0", isCommunity: false,
  }));
  effects.push(ef("nodeTypes", {
    id: "nt-json", name: "JSON Transform", category: "transform", iconKey: "code",
    version: "1.0.0", isCommunity: false,
  }));
  effects.push(ef("nodeTypes", {
    id: "nt-if", name: "Conditional", category: "control", iconKey: "branch",
    version: "1.0.0", isCommunity: false,
  }));
  effects.push(ef("nodeTypes", {
    id: "nt-subwf", name: "Sub-Workflow", category: "control", iconKey: "nested",
    version: "1.0.0", isCommunity: false,
  }));

  // ── Credentials (2) ───────────────────────────────────────────
  effects.push(ef("credentials", {
    id: "cred-slack",
    name: "Slack workspace #ops",
    provider: "oauth",
    ownerId: "user-editor",
    secretRef: "vault://slack/ops-token",
    expiresAt: "2027-04-01T00:00:00Z",
    scopes: "chat:write,channels:read",
    active: true,
  }));
  effects.push(ef("credentials", {
    id: "cred-smtp",
    name: "SMTP corp gateway",
    provider: "basic",
    ownerId: "user-editor",
    secretRef: "vault://smtp/corp",
    expiresAt: "2026-12-31T00:00:00Z",
    scopes: "send",
    active: true,
  }));

  // ── Workflow 1: Slack daily summary (active) ──────────────────
  effects.push(ef("workflows", {
    id: "wf-slack-summary",
    name: "Daily Slack summary",
    description: "Каждый день в 9:00 шлёт сводку в #ops",
    ownerId: "user-editor",
    status: "active",
  }));
  effects.push(ef("nodes", {
    id: "node-1", workflowId: "wf-slack-summary", nodeTypeId: "nt-schedule",
    instanceName: "Trigger 9 AM", position: { x: 80, y: 120 },
    configJson: { cronExpression: "0 9 * * *" },
  }));
  effects.push(ef("nodes", {
    id: "node-2", workflowId: "wf-slack-summary", nodeTypeId: "nt-http",
    instanceName: "Fetch metrics", position: { x: 320, y: 120 },
    configJson: { url: "https://api.internal/metrics/daily", method: "GET" },
  }));
  effects.push(ef("nodes", {
    id: "node-3", workflowId: "wf-slack-summary", nodeTypeId: "nt-json",
    instanceName: "Format summary", position: { x: 560, y: 120 },
    configJson: { template: "Метрики за сутки: {{json.summary}}" },
  }));
  effects.push(ef("nodes", {
    id: "node-4", workflowId: "wf-slack-summary", nodeTypeId: "nt-slack",
    instanceName: "Post to #ops", position: { x: 800, y: 120 },
    configJson: { channel: "#ops", text: "{{previous.text}}" },
    credentialId: "cred-slack",
  }));
  effects.push(ef("connections", {
    id: "conn-1", workflowId: "wf-slack-summary", sourceNodeId: "node-1",
    sourcePort: "main", targetNodeId: "node-2", targetPort: "main",
  }));
  effects.push(ef("connections", {
    id: "conn-2", workflowId: "wf-slack-summary", sourceNodeId: "node-2",
    sourcePort: "main", targetNodeId: "node-3", targetPort: "main",
  }));
  effects.push(ef("connections", {
    id: "conn-3", workflowId: "wf-slack-summary", sourceNodeId: "node-3",
    sourcePort: "main", targetNodeId: "node-4", targetPort: "main",
  }));

  // ── Workflow 2: Webhook → branch → email/slack (draft) ────────
  effects.push(ef("workflows", {
    id: "wf-incident",
    name: "Incident triage",
    description: "Webhook от Sentry → email при severity=high, иначе slack",
    ownerId: "user-editor",
    status: "draft",
  }));
  effects.push(ef("nodes", {
    id: "node-5", workflowId: "wf-incident", nodeTypeId: "nt-webhook",
    instanceName: "Sentry webhook", position: { x: 80, y: 200 },
    configJson: { path: "/hooks/sentry" },
  }));
  effects.push(ef("nodes", {
    id: "node-6", workflowId: "wf-incident", nodeTypeId: "nt-if",
    instanceName: "If high severity", position: { x: 320, y: 200 },
    configJson: { condition: "{{json.severity}} === 'high'" },
  }));
  effects.push(ef("nodes", {
    id: "node-7", workflowId: "wf-incident", nodeTypeId: "nt-email",
    instanceName: "Page on-call", position: { x: 560, y: 80 },
    configJson: { to: "oncall@fold.demo", subject: "Critical incident" },
    credentialId: "cred-smtp",
  }));
  effects.push(ef("nodes", {
    id: "node-8", workflowId: "wf-incident", nodeTypeId: "nt-slack",
    instanceName: "Notify slack #incidents", position: { x: 560, y: 320 },
    configJson: { channel: "#incidents", text: "{{json.title}}" },
    credentialId: "cred-slack",
  }));
  effects.push(ef("connections", {
    id: "conn-4", workflowId: "wf-incident", sourceNodeId: "node-5",
    sourcePort: "main", targetNodeId: "node-6", targetPort: "main",
  }));
  effects.push(ef("connections", {
    id: "conn-5", workflowId: "wf-incident", sourceNodeId: "node-6",
    sourcePort: "true", targetNodeId: "node-7", targetPort: "main",
  }));
  effects.push(ef("connections", {
    id: "conn-6", workflowId: "wf-incident", sourceNodeId: "node-6",
    sourcePort: "false", targetNodeId: "node-8", targetPort: "main",
  }));

  // ── ScheduledRun ──────────────────────────────────────────────
  effects.push(ef("scheduledRuns", {
    id: "sched-1", workflowId: "wf-slack-summary",
    cronExpression: "0 9 * * *",
    nextFireAt: NOW + 6 * H, lastFireAt: NOW - 18 * H,
    active: true, createdByUserId: "user-editor",
  }));

  // ── Executions (4) + steps (5) ────────────────────────────────
  // 1. success
  effects.push(ef("executions", {
    id: "exec-success", workflowId: "wf-slack-summary",
    triggeredBy: "schedule", status: "success",
    startedAt: NOW - 18 * H, finishedAt: NOW - 18 * H + 12000,
    triggeredByUserId: "user-executor",
  }));
  effects.push(ef("executionSteps", {
    id: "step-success-1", executionId: "exec-success", nodeId: "node-2",
    order: 1, status: "success",
    startedAt: NOW - 18 * H + 1000, finishedAt: NOW - 18 * H + 8000,
  }));
  effects.push(ef("executionSteps", {
    id: "step-success-2", executionId: "exec-success", nodeId: "node-4",
    order: 2, status: "success",
    startedAt: NOW - 18 * H + 9000, finishedAt: NOW - 18 * H + 12000,
  }));
  // 2. running
  effects.push(ef("executions", {
    id: "exec-running", workflowId: "wf-slack-summary",
    triggeredBy: "manual", status: "running",
    startedAt: NOW - 5 * 60 * 1000,
    triggeredByUserId: "user-editor",
  }));
  effects.push(ef("executionSteps", {
    id: "step-running-1", executionId: "exec-running", nodeId: "node-2",
    order: 1, status: "success",
    startedAt: NOW - 5 * 60 * 1000 + 1000, finishedAt: NOW - 5 * 60 * 1000 + 9000,
  }));
  // 3. failed
  effects.push(ef("executions", {
    id: "exec-failed", workflowId: "wf-slack-summary",
    triggeredBy: "schedule", status: "failed",
    startedAt: NOW - 42 * H, finishedAt: NOW - 42 * H + 18000,
    errorSummary: "Slack API: rate_limited",
    triggeredByUserId: "user-executor",
  }));
  effects.push(ef("executionSteps", {
    id: "step-failed-1", executionId: "exec-failed", nodeId: "node-4",
    order: 2, status: "failed",
    errorMessage: "Slack API: rate_limited (retry-after: 30s)",
    startedAt: NOW - 42 * H + 10000, finishedAt: NOW - 42 * H + 18000,
  }));
  // 4. aborted
  effects.push(ef("executions", {
    id: "exec-aborted", workflowId: "wf-slack-summary",
    triggeredBy: "manual", status: "aborted",
    startedAt: NOW - 60 * H, finishedAt: NOW - 60 * H + 6000,
    triggeredByUserId: "user-editor",
  }));

  return effects;
}
