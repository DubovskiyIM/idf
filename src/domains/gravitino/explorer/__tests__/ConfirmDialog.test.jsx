// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ConfirmDialog from "../ConfirmDialog.jsx";

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("не рендерится когда visible=false", () => {
    render(<ConfirmDialog visible={false} entityName="prod_lake" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByText(/delete|удалить/i)).toBeNull();
  });

  it("рендерится с предупреждением и input для подтверждения", () => {
    render(<ConfirmDialog visible={true} entityName="prod_lake" entityKind="metalake" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText(/delete metalake|удаление metalake/i)).toBeTruthy();
    expect(screen.getAllByText(/prod_lake/).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/prod_lake/i)).toBeTruthy();
  });

  it("Confirm-кнопка disabled пока не введён точный name", () => {
    render(<ConfirmDialog visible={true} entityName="prod_lake" onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const confirmBtn = screen.getByRole("button", { name: /^delete$|^удалить$/i });
    expect(confirmBtn.disabled).toBe(true);
    const input = screen.getByPlaceholderText(/prod_lake/i);
    fireEvent.change(input, { target: { value: "prod" } });
    expect(confirmBtn.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "prod_lake" } });
    expect(confirmBtn.disabled).toBe(false);
  });

  it("Confirm с правильным name вызывает onConfirm", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog visible={true} entityName="prod_lake" onCancel={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByPlaceholderText(/prod_lake/i), { target: { value: "prod_lake" } });
    fireEvent.click(screen.getByRole("button", { name: /^delete$|^удалить$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("Cancel вызывает onCancel без onConfirm", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog visible={true} entityName="prod_lake" onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel|отмена/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
