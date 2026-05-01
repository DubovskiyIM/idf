// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import TableDetailPane from "../TableDetailPane.jsx";

afterEach(cleanup);

const TABLE = {
  id: "t1", name: "fact_orders", comment: "Order facts",
  columns: [
    { name: "id", type: "bigint", nullable: false, comment: "PK" },
    { name: "amount", type: "decimal(10,2)", nullable: false },
    { name: "created_at", type: "timestamp", nullable: true },
  ],
  partitioning: [{ strategy: "day", column: "created_at" }],
  properties: { format: "PARQUET", location: "s3://bucket" },
  schemaId: "s1",
};

describe("TableDetailPane", () => {
  it("header показывает table name", () => {
    render(<TableDetailPane table={TABLE} />);
    expect(screen.getAllByText("fact_orders").length).toBeGreaterThan(0);
  });

  it("Columns tab default — показывает все колонки", () => {
    render(<TableDetailPane table={TABLE} />);
    expect(screen.getByText("id")).toBeTruthy();
    expect(screen.getByText("amount")).toBeTruthy();
    expect(screen.getByText("decimal(10,2)")).toBeTruthy();
  });

  it("Partitioning tab показывает partition spec", () => {
    render(<TableDetailPane table={TABLE} />);
    fireEvent.click(screen.getByRole("tab", { name: /partitioning/i }));
    expect(screen.getByText(/day/)).toBeTruthy();
    expect(screen.getByText(/created_at/)).toBeTruthy();
  });

  it("Properties tab показывает key-value", () => {
    render(<TableDetailPane table={TABLE} />);
    fireEvent.click(screen.getByRole("tab", { name: /properties/i }));
    expect(screen.getByText("format")).toBeTruthy();
    expect(screen.getByText("PARQUET")).toBeTruthy();
  });

  it("table без columns → empty state", () => {
    render(<TableDetailPane table={{ id: "t2", name: "empty_table" }} />);
    expect(screen.getByText(/нет колонок|no columns/i)).toBeTruthy();
  });
});
