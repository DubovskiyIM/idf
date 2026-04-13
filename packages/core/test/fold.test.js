import { describe, it, expect } from "vitest";
import { fold, applyPresentation, filterByStatus } from "../src/fold.js";
import { pluralize } from "../src/pluralize.js";

function typeMap(...entities) {
  const map = { draft: "drafts" };
  for (const e of entities) map[e.toLowerCase()] = pluralize(e);
  return map;
}

function ef(id, alpha, target, context = {}, value = null, opts = {}) {
  return {
    id, intent_id: "test", alpha, target, value,
    scope: opts.scope || "account", parent_id: opts.parent_id || null,
    status: "confirmed", ttl: null, context, created_at: opts.created_at || 1000,
  };
}

describe("fold", () => {
  it("add creates entity", () => {
    const effects = [ef("e1", "add", "users", { id: "u1", name: "Alice" })];
    const world = fold(effects, typeMap("User"));
    expect(world.users).toEqual([{ id: "u1", name: "Alice" }]);
  });

  it("replace updates field", () => {
    const effects = [
      ef("e1", "add", "users", { id: "u1", name: "Alice" }),
      ef("e2", "replace", "user.name", { id: "u1" }, "Bob"),
    ];
    const world = fold(effects, typeMap("User"));
    expect(world.users[0].name).toBe("Bob");
  });

  it("remove deletes entity", () => {
    const effects = [
      ef("e1", "add", "users", { id: "u1", name: "Alice" }),
      ef("e2", "remove", "users", { id: "u1" }),
    ];
    const world = fold(effects, typeMap("User"));
    expect(world.users || []).toEqual([]);
  });

  it("batch unwinds sub-effects", () => {
    const effects = [{
      id: "b1", intent_id: "test", alpha: "batch", target: "batch",
      value: [
        { alpha: "add", target: "users", context: { id: "u1", name: "A" } },
        { alpha: "replace", target: "user.name", context: { id: "u1" }, value: "B" },
      ],
      scope: "account", parent_id: null, status: "confirmed", ttl: null,
      context: {}, created_at: 1000,
    }];
    const world = fold(effects, typeMap("User"));
    expect(world.users[0].name).toBe("B");
  });

  it("excludes presentation scope", () => {
    const effects = [
      ef("e1", "add", "users", { id: "u1", name: "Alice" }),
      ef("e2", "replace", "user.name", { id: "u1" }, "Bob", { scope: "presentation" }),
    ];
    const world = fold(effects, typeMap("User"));
    expect(world.users[0].name).toBe("Alice");
  });

  it("excludes drafts target", () => {
    const effects = [ef("e1", "add", "drafts.booking", { id: "d1", title: "draft" })];
    const world = fold(effects, typeMap("Booking"));
    expect(world.bookings || []).toEqual([]);
  });

  it("causal ordering: parent before child even with inverted timestamps", () => {
    const effects = [
      ef("child", "replace", "user.name", { id: "u1" }, "Bob", { parent_id: "parent", created_at: 500 }),
      ef("parent", "add", "users", { id: "u1", name: "Alice" }, null, { created_at: 1000 }),
    ];
    const world = fold(effects, typeMap("User"));
    expect(world.users[0].name).toBe("Bob");
  });
});

describe("applyPresentation", () => {
  it("overlays presentation effects on world copy", () => {
    const world = { users: [{ id: "u1", name: "Alice", x: 0 }] };
    const effects = [
      ef("p1", "replace", "user.x", { id: "u1" }, 100, { scope: "presentation" }),
    ];
    const visual = applyPresentation(world, effects, typeMap("User"));
    expect(visual.users[0].x).toBe(100);
    expect(world.users[0].x).toBe(0);
  });
});

describe("filterByStatus", () => {
  it("filters effects by status", () => {
    const effects = [
      { id: "1", status: "confirmed" },
      { id: "2", status: "proposed" },
      { id: "3", status: "rejected" },
    ];
    expect(filterByStatus(effects, "confirmed")).toHaveLength(1);
    expect(filterByStatus(effects, "confirmed", "proposed")).toHaveLength(2);
  });
});
