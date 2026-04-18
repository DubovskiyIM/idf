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
