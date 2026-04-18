import { describe, it, expect } from "vitest";
import { ONTOLOGY } from "./ontology.js";

describe("freelance ontology — entities", () => {
  const EXPECTED = [
    "User", "CustomerProfile", "ExecutorProfile",
    "Skill", "ExecutorSkill", "Category", "Task", "Response",
  ];

  it("содержит 8 базовых сущностей", () => {
    for (const e of EXPECTED) {
      expect(ONTOLOGY.entities[e], `entity ${e}`).toBeDefined();
    }
    expect(Object.keys(ONTOLOGY.entities)).toHaveLength(EXPECTED.length);
  });

  it("User имеет флаги universal-role — customerVerified / executorVerified", () => {
    expect(ONTOLOGY.entities.User.fields.customerVerified).toBeDefined();
    expect(ONTOLOGY.entities.User.fields.executorVerified).toBeDefined();
  });

  it("CustomerProfile.ownerField === 'userId'", () => {
    expect(ONTOLOGY.entities.CustomerProfile.ownerField).toBe("userId");
  });

  it("ExecutorProfile.ownerField === 'userId' и имеет bio/rating/level", () => {
    expect(ONTOLOGY.entities.ExecutorProfile.ownerField).toBe("userId");
    const fields = ONTOLOGY.entities.ExecutorProfile.fields;
    expect(fields.bio).toBeDefined();
    expect(fields.rating).toBeDefined();
    expect(fields.level).toBeDefined();
  });

  it("Skill и Category — kind: 'reference'", () => {
    expect(ONTOLOGY.entities.Skill.kind).toBe("reference");
    expect(ONTOLOGY.entities.Category.kind).toBe("reference");
  });

  it("ExecutorSkill — kind: 'assignment', ownerField: executorId", () => {
    expect(ONTOLOGY.entities.ExecutorSkill.kind).toBe("assignment");
    expect(ONTOLOGY.entities.ExecutorSkill.ownerField).toBe("executorId");
  });

  it("Task.ownerField === 'customerId' и имеет status с 4 значениями draft/moderation/published/closed", () => {
    expect(ONTOLOGY.entities.Task.ownerField).toBe("customerId");
    expect(ONTOLOGY.entities.Task.fields.status.options).toEqual(
      expect.arrayContaining(["draft", "moderation", "published", "closed"])
    );
  });

  it("Response.ownerField === 'executorId' и имеет taskId с FK", () => {
    expect(ONTOLOGY.entities.Response.ownerField).toBe("executorId");
    expect(ONTOLOGY.entities.Response.fields.taskId).toBeDefined();
  });
});

describe("freelance ontology — roles", () => {
  const base = (name) => ONTOLOGY.roles[name]?.base;

  it("customer и executor имеют base: 'owner'", () => {
    expect(base("customer")).toBe("owner");
    expect(base("executor")).toBe("owner");
  });

  it("guest имеет base: 'viewer'", () => {
    expect(base("guest")).toBe("viewer");
  });

  it("customer видит CustomerProfile как own", () => {
    expect(ONTOLOGY.roles.customer.visibleFields.Task).toBeDefined();
    expect(ONTOLOGY.roles.customer.visibleFields.CustomerProfile).toBe("own");
  });

  it("executor видит Response 'own', Task — public fields", () => {
    expect(ONTOLOGY.roles.executor.visibleFields.Response).toBe("own");
    expect(ONTOLOGY.roles.executor.visibleFields.Task).toBeInstanceOf(Array);
  });

  it("guest видит публичные Task и ExecutorProfile — без customerId, без Wallet/Response", () => {
    const guestTask = ONTOLOGY.roles.guest.visibleFields.Task;
    expect(guestTask).toBeInstanceOf(Array);
    expect(guestTask).not.toContain("customerId");
    expect(ONTOLOGY.roles.guest.visibleFields.Wallet).toBeUndefined();
    expect(ONTOLOGY.roles.guest.visibleFields.Response).toBeUndefined();
  });

  it("все 3 роли имеют canExecute массив", () => {
    for (const r of ["customer", "executor", "guest"]) {
      expect(Array.isArray(ONTOLOGY.roles[r].canExecute)).toBe(true);
    }
  });
});

describe("freelance ontology — invariants", () => {
  const byName = (n) => ONTOLOGY.invariants.find(i => i.name === n);

  it("содержит ровно 3 invariants в Cycle 1", () => {
    expect(ONTOLOGY.invariants).toHaveLength(3);
  });

  it("task_status_transition — transition с 4 allowed переходами", () => {
    const inv = byName("task_status_transition");
    expect(inv).toBeDefined();
    expect(inv.kind).toBe("transition");
    expect(inv.entity).toBe("Task");
    expect(inv.field).toBe("status");
    expect(inv.allowed).toEqual(expect.arrayContaining([
      ["draft", "moderation"],
      ["moderation", "published"],
      ["moderation", "draft"],
      ["published", "closed"],
    ]));
  });

  it("response_references_task — referential FK", () => {
    const inv = byName("response_references_task");
    expect(inv).toBeDefined();
    expect(inv.kind).toBe("referential");
    expect(inv.entity).toBe("Response");
    expect(inv.field).toBe("taskId");
    expect(inv.references).toBe("tasks");
  });

  it("task_has_at_most_one_selected_response — cardinality ≤1 selected", () => {
    const inv = byName("task_has_at_most_one_selected_response");
    expect(inv).toBeDefined();
    expect(inv.kind).toBe("cardinality");
    expect(inv.entity).toBe("Response");
    expect(inv.groupBy).toBe("taskId");
    expect(inv.max).toBe(1);
    expect(inv.where).toEqual({ status: "selected" });
  });
});
