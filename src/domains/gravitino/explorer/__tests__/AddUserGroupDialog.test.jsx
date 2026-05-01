// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import AddUserGroupDialog from "../AddUserGroupDialog.jsx";

afterEach(cleanup);

describe("AddUserGroupDialog", () => {
  it("kind=user → title 'Add User'", () => {
    render(<AddUserGroupDialog visible={true} kind="user" onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /add user$/i })).toBeTruthy();
  });

  it("kind=group → title 'Add User Group'", () => {
    render(<AddUserGroupDialog visible={true} kind="group" onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /add user group/i })).toBeTruthy();
  });

  it("Submit disabled пока name пуст", () => {
    render(<AddUserGroupDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /submit/i }).disabled).toBe(true);
  });

  it("submit с name → onSubmit({name})", () => {
    const onSubmit = vi.fn();
    render(<AddUserGroupDialog visible={true} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "alice@acme" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "alice@acme" });
  });

  it("Cancel вызывает onClose без onSubmit", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<AddUserGroupDialog visible={true} onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
