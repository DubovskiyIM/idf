// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TagsTable, PoliciesTable, UsersTable, GroupsTable, RolesTable } from "../iamTables.jsx";

afterEach(cleanup);

describe("TagsTable", () => {
  const TAGS = [{ id: "t1", name: "ALPHA", color: "#0369a1", comment: "alpha tag", audit: { createTime: "2026-03-19T14:26:32Z" } }];
  it("рендерит таблицу с tag", () => {
    render(<TagsTable tags={TAGS} onCreate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("ALPHA")).toBeTruthy();
  });
  it("+ Create Tag вызывает onCreate", () => {
    const onCreate = vi.fn();
    render(<TagsTable tags={TAGS} onCreate={onCreate} onEdit={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /create tag/i })[0]);
    expect(onCreate).toHaveBeenCalled();
  });
});

describe("UsersTable", () => {
  const USERS = [{ id: "u1", name: "alice@acme", roles: ["test", "test_1"] }];
  it("рендерит row + roles chips", () => {
    render(<UsersTable users={USERS} onAdd={vi.fn()} onGrantRole={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("alice@acme")).toBeTruthy();
    expect(screen.getByText("test")).toBeTruthy();
  });
  it("Grant role вызывает onGrantRole(user)", () => {
    const onGrantRole = vi.fn();
    render(<UsersTable users={USERS} onAdd={vi.fn()} onGrantRole={onGrantRole} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByTitle(/grant role/i));
    expect(onGrantRole).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }));
  });
});

describe("GroupsTable", () => {
  it("Grant role вызывает onGrantRole(group)", () => {
    const onGrantRole = vi.fn();
    const GROUPS = [{ id: "g1", name: "developer", roles: ["test"] }];
    render(<GroupsTable groups={GROUPS} onAdd={vi.fn()} onGrantRole={onGrantRole} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByTitle(/grant role/i));
    expect(onGrantRole).toHaveBeenCalledWith(expect.objectContaining({ id: "g1" }));
  });
});

describe("RolesTable", () => {
  const ROLES = [{ id: "r1", name: "test", owner: "alice@acme" }];
  it("рендерит row с owner", () => {
    render(<RolesTable roles={ROLES} onCreate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("test")).toBeTruthy();
    expect(screen.getByText("alice@acme")).toBeTruthy();
  });
});

describe("PoliciesTable", () => {
  const POLS = [{ id: "p1", name: "test_policy", policyType: "custom" }];
  it("рендерит policy", () => {
    render(<PoliciesTable policies={POLS} onCreate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onView={vi.fn()} />);
    expect(screen.getByText("test_policy")).toBeTruthy();
  });
});
