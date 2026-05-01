// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CreateRoleDialog from "../CreateRoleDialog.jsx";

afterEach(cleanup);

describe("CreateRoleDialog", () => {
  it("рендерит Securable Object accordion + privileges", () => {
    render(<CreateRoleDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getAllByText(/securable object/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Type$/i)).toBeTruthy();
    expect(screen.getByText(/full name/i)).toBeTruthy();
  });

  it("change Type → privileges list обновляется", () => {
    render(<CreateRoleDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^type$/i), { target: { value: "schema" } });
    fireEvent.click(screen.getByPlaceholderText(/add allow privileges/i));
    expect(screen.getByText(/use schema/i)).toBeTruthy();
  });

  it("полный submit отдаёт {name, securableObjects}", () => {
    const onSubmit = vi.fn();
    render(<CreateRoleDialog visible={true} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/role name/i), { target: { value: "data_engineer" } });
    fireEvent.change(screen.getByLabelText(/^type$/i), { target: { value: "schema" } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "sales" } });
    fireEvent.click(screen.getByPlaceholderText(/add allow privileges/i));
    fireEvent.click(screen.getByRole("checkbox", { name: /use schema/i }));
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: "data_engineer",
      securableObjects: expect.arrayContaining([expect.objectContaining({ type: "schema", name: "sales" })]),
    }));
  });

  it("+ Add Securable Object добавляет новый accordion", () => {
    render(<CreateRoleDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    const before = screen.getAllByText(/securable object/i).length;
    fireEvent.click(screen.getByRole("button", { name: /add securable object/i }));
    const after = screen.getAllByText(/securable object/i).length;
    expect(after).toBe(before + 1);
  });

  it("Remove кнопка убирает accordion", () => {
    render(<CreateRoleDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /add securable object/i }));
    const beforeRemove = screen.getAllByText(/securable object/i).length;
    const removeBtns = screen.getAllByRole("button", { name: /remove securable/i });
    expect(removeBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(removeBtns[0]);
    const afterRemove = screen.getAllByText(/securable object/i).length;
    expect(afterRemove).toBe(beforeRemove - 1);
  });

  it("initial prop pre-fills role с securableObjects", () => {
    const initial = { id: "r1", name: "data_engineer", securableObjects: [
      { type: "schema", name: "sales", privileges: ["USE_SCHEMA", "SELECT_TABLE"] },
    ]};
    render(<CreateRoleDialog visible={true} initial={initial} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /edit role/i })).toBeTruthy();
    expect(screen.getByLabelText(/role name/i).value).toBe("data_engineer");
    // Submit label = Save
    expect(screen.getByRole("button", { name: /save/i })).toBeTruthy();
    // Full Name pre-filled = sales
    expect(screen.getByLabelText(/full name/i).value).toBe("sales");
  });

  it("submit с initial preserves id и owner", () => {
    const onSubmit = vi.fn();
    const initial = { id: "r1", name: "data_engineer", owner: "alice", securableObjects: [
      { type: "schema", name: "sales", privileges: ["USE_SCHEMA"] },
    ]};
    render(<CreateRoleDialog visible={true} initial={initial} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      id: "r1", name: "data_engineer", owner: "alice",
    }));
  });

  it("submit с 2 securable objects отдаёт payload с обоими", () => {
    const onSubmit = vi.fn();
    render(<CreateRoleDialog visible={true} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/role name/i), { target: { value: "data_eng" } });
    // first accordion — type=schema по default, заполняем full name
    let fullNameInputs = screen.getAllByLabelText(/full name/i);
    fireEvent.change(fullNameInputs[0], { target: { value: "sales" } });
    let pickerInputs = screen.getAllByPlaceholderText(/add allow privileges/i);
    fireEvent.click(pickerInputs[0]);
    fireEvent.click(screen.getByRole("checkbox", { name: /use schema/i }));
    // (после выбора privilege chip заменяет placeholder)
    // Add second accordion
    fireEvent.click(screen.getByRole("button", { name: /add securable object/i }));
    // second accordion — change Type на catalog
    const typeSelects = screen.getAllByLabelText(/^type$/i);
    fireEvent.change(typeSelects[1], { target: { value: "catalog" } });
    const fullName2 = screen.getAllByLabelText(/full name/i);
    fireEvent.change(fullName2[1], { target: { value: "hive_warehouse" } });
    // У второго accordion placeholder остался — он первый из оставшихся
    pickerInputs = screen.getAllByPlaceholderText(/add allow privileges/i);
    fireEvent.click(pickerInputs[0]);
    fireEvent.click(screen.getByRole("checkbox", { name: /use catalog/i }));
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: "data_eng",
      securableObjects: expect.arrayContaining([
        expect.objectContaining({ type: "schema", name: "sales" }),
        expect.objectContaining({ type: "catalog", name: "hive_warehouse" }),
      ]),
    }));
  });
});
