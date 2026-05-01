// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import EditTableDialog from "../EditTableDialog.jsx";

afterEach(cleanup);

const TABLE = {
  id: "t_orders", name: "fact_orders", comment: "Order facts",
  columns: [
    { name: "id",          type: "bigint",        nullable: false, autoIncrement: true,  defaultValue: null, comment: "PK" },
    { name: "amount",      type: "decimal(10,2)", nullable: false, autoIncrement: false, defaultValue: null, comment: "" },
    { name: "created_at",  type: "timestamp",     nullable: true,  autoIncrement: false, defaultValue: null, comment: "" },
  ],
  indexes: [{ name: "pk_orders", type: "PRIMARY_KEY", fieldNames: [["id"]] }],
  partitioning: [],
  distribution: null,
  sortOrders: [],
  properties: { format: "PARQUET" },
  schemaId: "s1",
};

describe("EditTableDialog", () => {
  it("не рендерится когда visible=false", () => {
    render(<EditTableDialog visible={false} initial={TABLE} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/edit table/i)).toBeNull();
  });

  it("рендерит pre-filled Table Name (placeholder) + Columns tab default", () => {
    render(<EditTableDialog visible={true} initial={TABLE} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /edit table/i })).toBeTruthy();
    expect(screen.getByPlaceholderText(/fact_orders/i)).toBeTruthy();
    expect(screen.getByRole("tab", { name: /columns/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /indexes/i })).toBeTruthy();
    // 3 columns rows, проверяем по name input value
    expect(screen.getAllByDisplayValue("id")).toBeTruthy();
    expect(screen.getAllByDisplayValue("amount")).toBeTruthy();
  });

  it("+ Add Column добавляет пустую строку", () => {
    render(<EditTableDialog visible={true} initial={TABLE} onClose={vi.fn()} onSubmit={vi.fn()} />);
    const before = screen.getAllByPlaceholderText(/column name/i).length;
    fireEvent.click(screen.getByRole("button", { name: /add column/i }));
    const after = screen.getAllByPlaceholderText(/column name/i).length;
    expect(after).toBe(before + 1);
  });

  it("− Remove удаляет column", () => {
    render(<EditTableDialog visible={true} initial={TABLE} onClose={vi.fn()} onSubmit={vi.fn()} />);
    const before = screen.getAllByPlaceholderText(/column name/i).length;
    const removes = screen.getAllByRole("button", { name: /^remove column$/i });
    fireEvent.click(removes[removes.length - 1]); // последняя created_at
    const after = screen.getAllByPlaceholderText(/column name/i).length;
    expect(after).toBe(before - 1);
  });

  it("Indexes tab показывает existing indexes", () => {
    render(<EditTableDialog visible={true} initial={TABLE} onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /indexes/i }));
    expect(screen.getByDisplayValue("pk_orders")).toBeTruthy();
  });

  it("Submit отдаёт payload preserving id + edited columns", () => {
    const onSubmit = vi.fn();
    render(<EditTableDialog visible={true} initial={TABLE} onClose={vi.fn()} onSubmit={onSubmit} />);
    // Edit comment поля у first column
    const commentInputs = screen.getAllByPlaceholderText(/column comment/i);
    fireEvent.change(commentInputs[0], { target: { value: "primary key changed" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      id: "t_orders",
      name: "fact_orders",
      columns: expect.arrayContaining([
        expect.objectContaining({ name: "id", comment: "primary key changed" }),
      ]),
    }));
  });

  it("Cancel вызывает onClose без onSubmit", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<EditTableDialog visible={true} initial={TABLE} onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
