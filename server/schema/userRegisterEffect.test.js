import { describe, it, expect } from "vitest";
import { fold, buildTypeMap, filterByStatus } from "@intent-driven/core";

describe("_user_register эффект", () => {
  const typeMap = buildTypeMap({ entities: { User: {} } });

  it("add эффект создаёт user в world.users", () => {
    const effects = [{
      id: "_user_register_u1",
      intent_id: "_user_register",
      alpha: "add",
      target: "users",
      status: "confirmed",
      context: { id: "u1", name: "Alice", email: "alice@test.com", avatar: "", createdAt: 1000 },
      created_at: 1000,
    }];
    const world = fold(effects, typeMap);
    expect(world.users).toHaveLength(1);
    expect(world.users[0]).toMatchObject({ id: "u1", name: "Alice", email: "alice@test.com" });
  });

  it("replace user.avatar работает поверх _user_register", () => {
    const effects = [
      {
        id: "_user_register_u1",
        intent_id: "_user_register",
        alpha: "add",
        target: "users",
        status: "confirmed",
        context: { id: "u1", name: "Alice", email: "alice@test.com", avatar: "", createdAt: 1000 },
        created_at: 1000,
      },
      {
        id: "ef2",
        intent_id: "update_avatar",
        alpha: "replace",
        target: "user.avatar",
        value: "pic.jpg",
        status: "confirmed",
        context: { id: "u1" },
        created_at: 2000,
      },
    ];
    const world = fold(effects, typeMap);
    expect(world.users).toHaveLength(1);
    expect(world.users[0].avatar).toBe("pic.jpg");
    expect(world.users[0].name).toBe("Alice");
  });

  it("несколько пользователей", () => {
    const effects = [
      {
        id: "_user_register_u1",
        intent_id: "_user_register",
        alpha: "add",
        target: "users",
        status: "confirmed",
        context: { id: "u1", name: "Alice", email: "a@t.com", avatar: "", createdAt: 1000 },
        created_at: 1000,
      },
      {
        id: "_user_register_u2",
        intent_id: "_user_register",
        alpha: "add",
        target: "users",
        status: "confirmed",
        context: { id: "u2", name: "Bob", email: "b@t.com", avatar: "", createdAt: 2000 },
        created_at: 2000,
      },
    ];
    const world = fold(effects, typeMap);
    expect(world.users).toHaveLength(2);
    expect(world.users.map(u => u.name).sort()).toEqual(["Alice", "Bob"]);
  });

  it("rejected _user_register не попадает в world (через filterByStatus)", () => {
    const effects = [{
      id: "_user_register_u1",
      intent_id: "_user_register",
      alpha: "add",
      target: "users",
      status: "rejected",
      context: { id: "u1", name: "Alice", email: "a@t.com", avatar: "", createdAt: 1000 },
      created_at: 1000,
    }];
    const confirmed = filterByStatus(effects, "confirmed");
    const world = fold(confirmed, typeMap);
    expect(world.users || []).toHaveLength(0);
  });
});
