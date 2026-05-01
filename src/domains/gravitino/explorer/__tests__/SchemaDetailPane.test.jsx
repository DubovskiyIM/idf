// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import SchemaDetailPane from "../SchemaDetailPane.jsx";

afterEach(cleanup);

const SCHEMA = { id: "s1", name: "sales", comment: "Sales fact tables", properties: { owner: "analytics" }, catalogId: "c1" };
const CATALOG_REL = { id: "c1", name: "hive_warehouse", type: "relational" };
const CATALOG_FS = { id: "c4", name: "raw_landing", type: "fileset" };
const TABLES = [
  { id: "t1", name: "fact_orders", comment: "Order facts", schemaId: "s1" },
  { id: "t2", name: "dim_customer", comment: "Customers", schemaId: "s1" },
];
const FILESETS = [{ id: "f1", name: "landing_zone", schemaId: "s1" }];

describe("SchemaDetailPane", () => {
  it("показывает schema name + comment в header", () => {
    render(<SchemaDetailPane schema={SCHEMA} catalog={CATALOG_REL} world={{ tables: TABLES }} />);
    expect(screen.getAllByText("sales").length).toBeGreaterThan(0);
    expect(screen.getByText("Sales fact tables")).toBeTruthy();
  });

  it("relational catalog → tab Tables показывает дочерние таблицы", () => {
    render(<SchemaDetailPane schema={SCHEMA} catalog={CATALOG_REL} world={{ tables: TABLES }} />);
    expect(screen.getByRole("tab", { name: /tables/i })).toBeTruthy();
    expect(screen.getByText("fact_orders")).toBeTruthy();
    expect(screen.getByText("dim_customer")).toBeTruthy();
  });

  it("fileset catalog → tab Filesets вместо Tables", () => {
    render(<SchemaDetailPane schema={SCHEMA} catalog={CATALOG_FS} world={{ filesets: FILESETS }} />);
    expect(screen.getByRole("tab", { name: /filesets/i })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /^tables$/i })).toBeNull();
  });

  it("Properties tab показывает key-value", () => {
    render(<SchemaDetailPane schema={SCHEMA} catalog={CATALOG_REL} world={{ tables: TABLES }} />);
    fireEvent.click(screen.getByRole("tab", { name: /properties/i }));
    expect(screen.getByText("owner")).toBeTruthy();
    expect(screen.getByText("analytics")).toBeTruthy();
  });
});
