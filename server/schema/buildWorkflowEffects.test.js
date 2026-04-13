import { describe, it, expect } from "vitest";
import { buildWorkflowEffects } from "./buildWorkflowEffects.cjs";

const viewer = { id: "user_1" };
const draftWf = { id: "wf_1", title: "Pipeline", status: "draft", createdAt: 1000 };
const savedWf = { id: "wf_1", title: "Pipeline", status: "saved", createdAt: 1000 };
const node1 = { id: "n1", workflowId: "wf_1", type: "http_request", label: "Fetch", config: {} };
const node2 = { id: "n2", workflowId: "wf_1", type: "transform", label: "Parse", config: {} };

describe("buildWorkflowEffects", () => {
  it("create_workflow", () => {
    const ef = buildWorkflowEffects("create_workflow", { title: "Test" }, viewer, {});
    expect(ef).toHaveLength(1);
    expect(ef[0].alpha).toBe("add");
    expect(ef[0].context.status).toBe("draft");
  });

  it("create_workflow без title → null", () => {
    expect(buildWorkflowEffects("create_workflow", {}, viewer, {})).toBeNull();
  });

  it("add_node к draft workflow", () => {
    const ef = buildWorkflowEffects("add_node", { workflowId: "wf_1", type: "http_request" }, viewer, { workflows: [draftWf] });
    expect(ef).toHaveLength(1);
    expect(ef[0].context.type).toBe("http_request");
  });

  it("add_node к saved → вернуть в draft", () => {
    const ef = buildWorkflowEffects("add_node", { workflowId: "wf_1", type: "transform" }, viewer, { workflows: [savedWf] });
    expect(ef).toHaveLength(2);
    expect(ef[1].value).toBe("draft");
  });

  it("add_node к running → null", () => {
    expect(buildWorkflowEffects("add_node", { workflowId: "wf_1", type: "http_request" }, viewer, { workflows: [{ ...draftWf, status: "running" }] })).toBeNull();
  });

  it("connect_nodes", () => {
    const ef = buildWorkflowEffects("connect_nodes", { source: "n1", target: "n2" }, viewer, { nodes: [node1, node2] });
    expect(ef).toHaveLength(1);
    expect(ef[0].context.source).toBe("n1");
    expect(ef[0].context.target).toBe("n2");
  });

  it("configure_node", () => {
    const ef = buildWorkflowEffects("configure_node", { nodeId: "n1", config: { url: "https://api.test.com" } }, viewer, { nodes: [node1] });
    expect(ef).toHaveLength(1);
    expect(ef[0].value).toEqual({ url: "https://api.test.com" });
  });

  it("save_workflow draft → saved", () => {
    const ef = buildWorkflowEffects("save_workflow", { workflowId: "wf_1" }, viewer, { workflows: [draftWf] });
    expect(ef).toHaveLength(1);
    expect(ef[0].value).toBe("saved");
  });

  it("save_workflow saved → null", () => {
    expect(buildWorkflowEffects("save_workflow", { workflowId: "wf_1" }, viewer, { workflows: [savedWf] })).toBeNull();
  });

  it("execute_workflow saved → running", () => {
    const ef = buildWorkflowEffects("execute_workflow", { workflowId: "wf_1" }, viewer, { workflows: [savedWf] });
    expect(ef).toHaveLength(1);
    expect(ef[0].value).toBe("running");
  });

  it("execute_workflow draft → null", () => {
    expect(buildWorkflowEffects("execute_workflow", { workflowId: "wf_1" }, viewer, { workflows: [draftWf] })).toBeNull();
  });

  it("unknown → null", () => {
    expect(buildWorkflowEffects("unknown", {}, viewer, {})).toBeNull();
  });
});
