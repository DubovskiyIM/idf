// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import GroupDetailPane from "../GroupDetailPane.jsx";

afterEach(cleanup);

const GROUP = {
  id: "g1", name: "analytics",
  members: ["alice@acme", "diane@acme"],
  roles: ["analyst", "data_viewer"],
};
const USERS = [
  { id: "u1", name: "alice@acme" },
  { id: "u2", name: "bob@acme" },
  { id: "u3", name: "charlie@acme" },
  { id: "u4", name: "diane@acme" },
];

describe("GroupDetailPane", () => {
  it("header показывает group name + member count", () => {
    render(<GroupDetailPane group={GROUP} users={USERS} onAddMember={vi.fn()} onRemoveMember={vi.fn()} />);
    expect(screen.getAllByText("analytics").length).toBeGreaterThan(0);
    expect(screen.getByText(/2 member/i)).toBeTruthy();
  });

  it("Members tab default — список всех members", () => {
    render(<GroupDetailPane group={GROUP} users={USERS} onAddMember={vi.fn()} onRemoveMember={vi.fn()} />);
    expect(screen.getByText("alice@acme")).toBeTruthy();
    expect(screen.getByText("diane@acme")).toBeTruthy();
    expect(screen.queryByText("bob@acme")).toBeNull();
  });

  it("Каждый member имеет Remove-кнопку → onRemoveMember(name)", () => {
    const onRemove = vi.fn();
    render(<GroupDetailPane group={GROUP} users={USERS} onAddMember={vi.fn()} onRemoveMember={onRemove} />);
    const removes = screen.getAllByRole("button", { name: /remove|удалить/i });
    expect(removes.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(removes[0]);
    expect(onRemove).toHaveBeenCalledWith("alice@acme");
  });

  it("+ Add Member открывает selector, выбор → onAddMember(userName)", () => {
    const onAdd = vi.fn();
    render(<GroupDetailPane group={GROUP} users={USERS} onAddMember={onAdd} onRemoveMember={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add member|\+ add/i }));
    // Список не-members → bob/charlie
    expect(screen.getByText("bob@acme")).toBeTruthy();
    expect(screen.getByText("charlie@acme")).toBeTruthy();
    fireEvent.click(screen.getByText("bob@acme"));
    expect(onAdd).toHaveBeenCalledWith("bob@acme");
  });

  it("Roles tab — показывает roles", () => {
    render(<GroupDetailPane group={GROUP} users={USERS} onAddMember={vi.fn()} onRemoveMember={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /roles/i }));
    expect(screen.getByText(/analyst/)).toBeTruthy();
    expect(screen.getByText(/data_viewer/)).toBeTruthy();
  });

  it("group без members → empty state", () => {
    render(<GroupDetailPane group={{ ...GROUP, members: [] }} users={USERS} onAddMember={vi.fn()} onRemoveMember={vi.fn()} />);
    expect(screen.getByText(/нет членов|no members/i)).toBeTruthy();
  });
});
