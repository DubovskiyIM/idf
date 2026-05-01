// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import SetOwnerDialog from "../SetOwnerDialog.jsx";

afterEach(cleanup);

const USERS = [
  { id: "u1", name: "alice@acme" },
  { id: "u2", name: "bob@acme" },
  { id: "u3", name: "charlie@acme" },
];
const GROUPS = [
  { id: "g1", name: "analytics" },
  { id: "g2", name: "platform" },
];

describe("SetOwnerDialog", () => {
  it("не рендерится когда visible=false", () => {
    render(<SetOwnerDialog visible={false} users={USERS} groups={GROUPS} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/set owner|назначить владельца/i)).toBeNull();
  });

  it("рендерится с текущим owner и tabs Users/Groups", () => {
    render(<SetOwnerDialog visible={true} currentOwner="alice@acme" users={USERS} groups={GROUPS} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /users/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /groups/i })).toBeTruthy();
    expect(screen.getByText("alice@acme")).toBeTruthy();
    expect(screen.getByText("bob@acme")).toBeTruthy();
  });

  it("default tab Users — показывает users", () => {
    render(<SetOwnerDialog visible={true} users={USERS} groups={GROUPS} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText("alice@acme")).toBeTruthy();
    expect(screen.queryByText("analytics")).toBeNull();
  });

  it("click на tab Groups — показывает groups вместо users", () => {
    render(<SetOwnerDialog visible={true} users={USERS} groups={GROUPS} onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /groups/i }));
    expect(screen.getByText("analytics")).toBeTruthy();
    expect(screen.getByText("platform")).toBeTruthy();
    expect(screen.queryByText("alice@acme")).toBeNull();
  });

  it("search фильтрует видимый список", () => {
    render(<SetOwnerDialog visible={true} users={USERS} groups={GROUPS} onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "char" } });
    expect(screen.getByText("charlie@acme")).toBeTruthy();
    expect(screen.queryByText("alice@acme")).toBeNull();
  });

  it("click на user row + Apply → onSubmit({kind:'user', name})", () => {
    const onSubmit = vi.fn();
    render(<SetOwnerDialog visible={true} users={USERS} groups={GROUPS} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText("bob@acme"));
    fireEvent.click(screen.getByRole("button", { name: /apply|применить/i }));
    expect(onSubmit).toHaveBeenCalledWith({ kind: "user", name: "bob@acme" });
  });

  it("click на group row + Apply → onSubmit({kind:'group', name})", () => {
    const onSubmit = vi.fn();
    render(<SetOwnerDialog visible={true} users={USERS} groups={GROUPS} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("tab", { name: /groups/i }));
    fireEvent.click(screen.getByText("platform"));
    fireEvent.click(screen.getByRole("button", { name: /apply|применить/i }));
    expect(onSubmit).toHaveBeenCalledWith({ kind: "group", name: "platform" });
  });

  it("Cancel вызывает onClose без onSubmit", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<SetOwnerDialog visible={true} users={USERS} groups={GROUPS} onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel|отмена/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
