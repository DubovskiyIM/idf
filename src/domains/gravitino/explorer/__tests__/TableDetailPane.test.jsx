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

  it("Distribution tab показывает strategy + number", () => {
    const table = {
      id: "t1", name: "fact_orders",
      distribution: { strategy: "HASH", number: 8, expressions: [["customer_id"]] },
      columns: [], properties: {},
    };
    render(<TableDetailPane table={table} world={{}} onAssociate={vi.fn()} onSetOwner={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /distribution/i }));
    expect(screen.getByText(/HASH/)).toBeTruthy();
    expect(screen.getByText(/8/)).toBeTruthy();
  });

  it("SortOrder tab показывает expression + direction", () => {
    const table = {
      id: "t1", name: "fact_orders",
      sortOrders: [{ expression: "order_ts", direction: "DESC", nullOrder: "FIRST" }],
      columns: [], properties: {},
    };
    render(<TableDetailPane table={table} world={{}} onAssociate={vi.fn()} onSetOwner={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /sort order/i }));
    expect(screen.getByText("order_ts")).toBeTruthy();
    expect(screen.getByText(/DESC/)).toBeTruthy();
  });

  it("Indexes tab — таблица индексов с type", () => {
    const table = {
      id: "t1", name: "fact_orders",
      indexes: [{ name: "pk_orders", type: "PRIMARY_KEY", fieldNames: [["order_id"]] }],
      columns: [], properties: {},
    };
    render(<TableDetailPane table={table} world={{}} onAssociate={vi.fn()} onSetOwner={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /indexes/i }));
    expect(screen.getByText("pk_orders")).toBeTruthy();
    expect(screen.getByText(/PRIMARY_KEY/)).toBeTruthy();
  });

  it("Tags tab — chip + Associate", () => {
    const table = { id: "t1", name: "fact_orders", tags: ["PII"], policies: [], columns: [], properties: {} };
    render(<TableDetailPane
      table={table}
      world={{ tags: [{ id: "t1", name: "PII" }, { id: "t2", name: "GDPR" }] }}
      onAssociate={vi.fn()}
      onSetOwner={vi.fn()}
    />);
    fireEvent.click(screen.getByRole("tab", { name: /^tags$/i }));
    expect(screen.getByText("PII")).toBeTruthy();
    expect(screen.getByRole("button", { name: /associate tag/i })).toBeTruthy();
  });

  it("Policies tab — chip-list", () => {
    const table = { id: "t1", name: "fact_orders", tags: [], policies: ["pii-mask"], columns: [], properties: {} };
    render(<TableDetailPane
      table={table}
      world={{ policies: [{ id: "p1", name: "pii-mask" }] }}
      onAssociate={vi.fn()}
      onSetOwner={vi.fn()}
    />);
    fireEvent.click(screen.getByRole("tab", { name: /policies/i }));
    expect(screen.getByText("pii-mask")).toBeTruthy();
  });

  it("Set Owner кнопка в header вызывает onSetOwner(tableId)", () => {
    const onSetOwner = vi.fn();
    const table = { id: "t1", name: "fact_orders", owner: "alice@acme", columns: [], properties: {} };
    render(<TableDetailPane table={table} world={{}} onAssociate={vi.fn()} onSetOwner={onSetOwner} />);
    fireEvent.click(screen.getByRole("button", { name: /edit owner/i }));
    expect(onSetOwner).toHaveBeenCalledWith("t1");
  });

  it("nested struct column → expandable, click ▸ показывает inner fields", () => {
    const table = {
      id: "t1", name: "events",
      columns: [
        { name: "id", type: "bigint", nullable: false },
        { name: "metadata", type: "struct<source:string, version:int>", nullable: true, comment: "meta" },
      ],
      properties: {},
    };
    render(<TableDetailPane table={table} world={{}} onAssociate={vi.fn()} onSetOwner={vi.fn()} />);
    expect(screen.getByText(/struct</)).toBeTruthy();
    expect(screen.queryByText("source")).toBeNull();
    const expandBtn = screen.getByRole("button", { name: /expand-metadata/i });
    fireEvent.click(expandBtn);
    expect(screen.getByText("source")).toBeTruthy();
    expect(screen.getByText("version")).toBeTruthy();
  });

  it("array column показывает array<...> + expand → element type", () => {
    const table = {
      id: "t1", name: "events",
      columns: [
        { name: "tags", type: "array<string>", nullable: true },
      ],
      properties: {},
    };
    render(<TableDetailPane table={table} world={{}} onAssociate={vi.fn()} onSetOwner={vi.fn()} />);
    expect(screen.getByText(/array<string>|array<.../)).toBeTruthy();
    const expandBtn = screen.getByRole("button", { name: /expand-tags/i });
    fireEvent.click(expandBtn);
    expect(screen.getByText(/element|item/i)).toBeTruthy();
  });
});
