// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import GrantRoleDialog from "../GrantRoleDialog.jsx";

afterEach(cleanup);
const ROLES = [{ id: "r1", name: "test" }, { id: "r2", name: "test_1" }, { id: "r3", name: "admin" }];

describe("GrantRoleDialog", () => {
  it("рендерит target-name в subject", () => {
    render(<GrantRoleDialog visible={true} target={{ kind: "user", name: "i.dubovskii" }} availableRoles={ROLES} currentRoles={[]} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText(/i\.dubovskii/)).toBeTruthy();
  });

  it("pre-selected current roles", () => {
    render(<GrantRoleDialog visible={true} target={{ kind: "user", name: "x" }} availableRoles={ROLES} currentRoles={["test"]} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText("test")).toBeTruthy();
  });

  it("submit с выбранными ролями", () => {
    const onSubmit = vi.fn();
    render(<GrantRoleDialog visible={true} target={{ kind: "user", name: "x" }} availableRoles={ROLES} currentRoles={["test"]} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText("admin"));
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.arrayContaining(["test", "admin"]));
  });
});
