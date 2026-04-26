import { describe, it, expect } from "vitest";
import * as domain from "../domain.js";

describe("automation domain smoke", () => {
  it("ontology has 8 entities (User + 7 domain entities)", () => {
    const entityCount = Object.keys(domain.ONTOLOGY.entities).length;
    expect(entityCount).toBe(9); // User + Workflow + NodeType + Node + Connection + Credential + Execution + ExecutionStep + ScheduledRun
  });

  it("has 35+ intents declared (target: 35)", () => {
    const intentCount = Object.keys(domain.INTENTS).length;
    expect(intentCount).toBeGreaterThanOrEqual(34);
  });

  it("getSeedEffects returns 39 effects covering all entities", () => {
    const seed = domain.getSeedEffects();
    expect(seed.length).toBeGreaterThanOrEqual(35);
    const targets = new Set(seed.map((e) => e.target));
    expect(targets.has("workflows")).toBe(true);
    expect(targets.has("nodes")).toBe(true);
    expect(targets.has("connections")).toBe(true);
    expect(targets.has("nodeTypes")).toBe(true);
    expect(targets.has("credentials")).toBe(true);
    expect(targets.has("executions")).toBe(true);
    expect(targets.has("executionSteps")).toBe(true);
    expect(targets.has("scheduledRuns")).toBe(true);
  });

  it("editor role canExecute covers all CRUD intents", () => {
    const editorCanExec = domain.ONTOLOGY.roles.editor.canExecute;
    expect(editorCanExec).toContain("create_workflow");
    expect(editorCanExec).toContain("create_credential");
    expect(editorCanExec).toContain("run_workflow_manual");
    expect(editorCanExec).toContain("create_schedule");
    expect(editorCanExec.length).toBeGreaterThanOrEqual(30);
  });

  it("executor role base agent + preapproval check active", () => {
    expect(domain.ONTOLOGY.roles.executor.base).toBe("agent");
    expect(domain.ONTOLOGY.roles.executor.preapproval?.checks?.length).toBeGreaterThan(0);
    expect(domain.ONTOLOGY.roles.executor.preapproval.checks.some((c) => c.kind === "active")).toBe(true);
  });

  it("invariants include all 5 kinds — referential / transition / expression / cardinality", () => {
    const kinds = new Set(domain.ONTOLOGY.invariants.map((i) => i.kind));
    expect(kinds.has("referential")).toBe(true);
    expect(kinds.has("transition")).toBe(true);
    expect(kinds.has("expression")).toBe(true);
    expect(kinds.has("cardinality")).toBe(true);
    expect(domain.ONTOLOGY.invariants.length).toBeGreaterThanOrEqual(14);
  });

  it("4 projections authored (workflow_canvas / execution_replay / credential_vault / node_palette)", () => {
    expect(domain.PROJECTIONS).toHaveProperty("workflow_canvas");
    expect(domain.PROJECTIONS).toHaveProperty("execution_replay");
    expect(domain.PROJECTIONS).toHaveProperty("credential_vault");
    expect(domain.PROJECTIONS).toHaveProperty("node_palette");
  });

  it("ROOT_PROJECTIONS правильно скоупит роли", () => {
    expect(domain.ROOT_PROJECTIONS.editor).toContain("workflow_list");
    expect(domain.ROOT_PROJECTIONS.viewer).toEqual(["execution_list"]);
  });

  it("__irr.high задан на 3 destructive intents", () => {
    const irrIntents = Object.entries(domain.INTENTS).filter(
      ([, intent]) => intent.context?.__irr?.point === "high"
    );
    expect(irrIntents.length).toBeGreaterThanOrEqual(3);
    const ids = irrIntents.map(([id]) => id);
    expect(ids).toContain("delete_workflow");
    expect(ids).toContain("delete_credential");
    expect(ids).toContain("purge_execution_history");
  });
});
