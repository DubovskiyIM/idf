import { describe, it, expect } from "vitest";
import { computeAlgebra } from "../src/intentAlgebra.js";
import { parseCondition } from "../src/conditionParser.js";

describe("parseCondition", () => {
  it("parses entity.field = 'value'", () => {
    const c = parseCondition("listing.status = 'active'");
    expect(c.entity).toBe("listing");
    expect(c.field).toBe("status");
    expect(c.op).toBe("=");
    expect(c.value).toBe("active");
  });

  it("parses != null", () => {
    const c = parseCondition("user.email != null");
    expect(c.op).toBe("!=");
    expect(c.value).toBeNull();
  });
});

describe("computeAlgebra", () => {
  const ONTOLOGY = {
    entities: {
      Task: { fields: { id: { type: "id" }, title: { type: "text" }, status: { type: "enum" } } },
    },
  };

  const INTENTS = {
    create_task: {
      name: "Create",
      creates: "Task(draft)",
      particles: {
        entities: ["task: Task"],
        conditions: [],
        effects: [{ α: "add", target: "tasks" }],
        witnesses: ["title"],
        confirmation: "click",
      },
    },
    publish_task: {
      name: "Publish",
      particles: {
        entities: ["task: Task"],
        conditions: ["task.status = 'draft'"],
        effects: [{ α: "replace", target: "task.status", value: "active" }],
        witnesses: ["title"],
        confirmation: "click",
      },
    },
    close_task: {
      name: "Close",
      particles: {
        entities: ["task: Task"],
        conditions: ["task.status = 'active'"],
        effects: [{ α: "replace", target: "task.status", value: "done" }],
        witnesses: [],
        confirmation: "click",
      },
    },
  };

  it("derives sequential: create ▷ publish", () => {
    const map = computeAlgebra(INTENTS, ONTOLOGY);
    expect(map.publish_task.sequentialIn).toContain("create_task");
    expect(map.create_task.sequentialOut).toContain("publish_task");
  });

  it("derives sequential chain: publish ▷ close", () => {
    const map = computeAlgebra(INTENTS, ONTOLOGY);
    expect(map.close_task.sequentialIn).toContain("publish_task");
  });

  it("every intent present in map", () => {
    const map = computeAlgebra(INTENTS, ONTOLOGY);
    expect(Object.keys(map).sort()).toEqual(["close_task", "create_task", "publish_task"]);
  });

  it("all relation arrays exist", () => {
    const map = computeAlgebra(INTENTS, ONTOLOGY);
    for (const rels of Object.values(map)) {
      expect(rels).toHaveProperty("sequentialIn");
      expect(rels).toHaveProperty("sequentialOut");
      expect(rels).toHaveProperty("antagonists");
      expect(rels).toHaveProperty("excluding");
      expect(rels).toHaveProperty("parallel");
    }
  });
});
