import { describe, it, expect } from "vitest";
import { filterWorldForRole } from "@intent-driven/core";

const ONTOLOGY = {
  entities: {
    User: {
      ownerField: "id",
      fields: { id: { type: "text" }, name: { type: "text" } },
    },
    Task: {
      ownerField: "customerId",
      fields: {
        id: { type: "text" },
        customerId: { type: "text" },
        title: { type: "text" },
      },
    },
    Response: {
      ownerField: "executorId",
      fields: {
        id: { type: "text" },
        executorId: { type: "text" },
        taskId: { type: "text" },
      },
    },
  },
  roles: {
    customer: {
      base: "owner",
      visibleFields: {
        Task: ["id", "customerId", "title"],
        Response: ["id", "executorId", "taskId"],
        User: ["id", "name"],
      },
    },
    executor: {
      base: "owner",
      visibleFields: {
        Task: ["id", "title"],
        Response: ["id", "executorId", "taskId"],
        User: ["id", "name"],
      },
    },
  },
};

const world = {
  users: [
    { id: "u1", name: "Универсал" },
    { id: "u2", name: "Другой" },
  ],
  tasks: [
    { id: "t1", customerId: "u1", title: "Задача универсала" },
    { id: "t2", customerId: "u2", title: "Чужая задача" },
  ],
  responses: [
    { id: "r1", executorId: "u1", taskId: "t2" },
    { id: "r2", executorId: "u2", taskId: "t1" },
  ],
};

describe("filterWorldForRole — universal user (customer+executor в одном User)", () => {
  const viewer = { id: "u1" };

  it("customer role: Task.ownerField=customerId фильтрует свои задачи", () => {
    const out = filterWorldForRole(world, ONTOLOGY, "customer", viewer);
    expect(out.tasks).toHaveLength(1);
    expect(out.tasks[0].id).toBe("t1");
  });

  it("executor role: Response.ownerField=executorId фильтрует свои отклики", () => {
    const out = filterWorldForRole(world, ONTOLOGY, "executor", viewer);
    expect(out.responses).toHaveLength(1);
    expect(out.responses[0].id).toBe("r1");
  });

  it("universal-user data: viewer видит И свои Task (как customer), И свои Response (как executor) независимо от roleName — данные секционируются по ownerField, роль влияет на visibleFields и canExecute", () => {
    const asCustomer = filterWorldForRole(world, ONTOLOGY, "customer", viewer);
    const asExecutor = filterWorldForRole(world, ONTOLOGY, "executor", viewer);
    expect(asCustomer.tasks).toHaveLength(1);
    expect(asCustomer.responses).toHaveLength(1);
    expect(asExecutor.tasks).toHaveLength(1);
    expect(asExecutor.responses).toHaveLength(1);
  });

  it("визуальная разница через visibleFields: customer.Task включает customerId, executor.Task — только id+title", () => {
    const asCustomer = filterWorldForRole(world, ONTOLOGY, "customer", viewer);
    const asExecutor = filterWorldForRole(world, ONTOLOGY, "executor", viewer);
    expect(asCustomer.tasks[0]).toHaveProperty("customerId");
    expect(asExecutor.tasks[0]).not.toHaveProperty("customerId");
  });

  it("API принимает две owner-базированные роли для одного viewer без exception — session_set_active_role меняет roleName, переключение работает", () => {
    expect(() => filterWorldForRole(world, ONTOLOGY, "customer", viewer)).not.toThrow();
    expect(() => filterWorldForRole(world, ONTOLOGY, "executor", viewer)).not.toThrow();
  });
});
