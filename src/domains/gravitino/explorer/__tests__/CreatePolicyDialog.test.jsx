// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CreatePolicyDialog from "../CreatePolicyDialog.jsx";

afterEach(cleanup);

describe("CreatePolicyDialog", () => {
  it("default Enabled=true", () => {
    render(<CreatePolicyDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    const enabledInput = screen.getByLabelText(/enabled/i);
    expect(enabledInput.checked).toBe(true);
  });

  it("Submit disabled пока name + ≥1 supported type не заданы", () => {
    render(<CreatePolicyDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^submit$/i }).disabled).toBe(true);
  });

  it("submit с name + types отдаёт payload", () => {
    const onSubmit = vi.fn();
    render(<CreatePolicyDialog visible={true} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/must start/i), { target: { value: "test_policy" } });
    fireEvent.click(screen.getByLabelText(/^table$/i));
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: "test_policy",
      enabled: true,
      supportedObjectTypes: expect.arrayContaining(["table"]),
    }));
  });

  it("+ Add Rule добавляет строку", () => {
    render(<CreatePolicyDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    const before = screen.getAllByPlaceholderText(/rule name/i).length;
    fireEvent.click(screen.getByRole("button", { name: /add rule/i }));
    const after = screen.getAllByPlaceholderText(/rule name/i).length;
    expect(after).toBe(before + 1);
  });
});
