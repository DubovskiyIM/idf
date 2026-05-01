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

  it("Tags tab — chip-list + AssociatePopover для add/remove", () => {
    const sch = { id: "s1", name: "sales", catalogId: "c1", tags: ["PII", "GDPR"], policies: [] };
    const onAssociate = vi.fn();
    render(<SchemaDetailPane
      schema={sch}
      catalog={CATALOG_REL}
      world={{ tables: TABLES, tags: [{ id: "t1", name: "PII" }, { id: "t2", name: "GDPR" }, { id: "t3", name: "Internal" }] }}
      onAssociate={onAssociate}
    />);
    fireEvent.click(screen.getByRole("tab", { name: /^tags$/i }));
    expect(screen.getByText("PII")).toBeTruthy();
    expect(screen.getByText("GDPR")).toBeTruthy();
    expect(screen.getByRole("button", { name: /associate tag/i })).toBeTruthy();
  });

  it("Policies tab — chip-list", () => {
    const sch = { id: "s1", name: "sales", catalogId: "c1", tags: [], policies: ["pii-mask"] };
    render(<SchemaDetailPane
      schema={sch}
      catalog={CATALOG_REL}
      world={{ tables: TABLES, policies: [{ id: "p1", name: "pii-mask" }] }}
      onAssociate={vi.fn()}
    />);
    fireEvent.click(screen.getByRole("tab", { name: /policies/i }));
    expect(screen.getByText("pii-mask")).toBeTruthy();
  });

  it("Set Owner-кнопка в header вызывает onSetOwner(schemaId)", () => {
    const onSetOwner = vi.fn();
    const sch = { id: "s1", name: "sales", catalogId: "c1", owner: "alice@acme" };
    render(<SchemaDetailPane schema={sch} catalog={CATALOG_REL} world={{ tables: TABLES }} onSetOwner={onSetOwner} />);
    fireEvent.click(screen.getByRole("button", { name: /edit owner/i }));
    expect(onSetOwner).toHaveBeenCalledWith("s1");
  });

  // U-fix-toggle-tabs: child-tables parity (Tags / Policies / Actions).
  it("Tables tab показывает Tags + Policies колонки", () => {
    const sch = { id: "s1", name: "sales", catalogId: "c1" };
    const tbls = [{ id: "t1", name: "fact_orders", schemaId: "s1", tags: ["PII"], policies: ["pii-mask"] }];
    render(<SchemaDetailPane
      schema={sch}
      catalog={CATALOG_REL}
      world={{ tables: tbls, tags: [{ id: "tg1", name: "PII" }], policies: [{ id: "p1", name: "pii-mask" }] }}
    />);
    expect(screen.getByText("fact_orders")).toBeTruthy();
    expect(screen.getByText("PII")).toBeTruthy();
    expect(screen.getByText("pii-mask")).toBeTruthy();
  });

  it("Tables tab — Edit action вызывает onChildEdit(item, 'tables')", () => {
    const sch = { id: "s1", name: "sales", catalogId: "c1" };
    const tbls = [{ id: "t1", name: "fact_orders", schemaId: "s1", tags: [], policies: [] }];
    const onChildEdit = vi.fn();
    render(<SchemaDetailPane
      schema={sch}
      catalog={CATALOG_REL}
      world={{ tables: tbls }}
      onChildEdit={onChildEdit}
    />);
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(onChildEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), "tables");
  });

  it("Tables tab — Set Owner action вызывает onChildSetOwner(item, 'tables')", () => {
    const sch = { id: "s1", name: "sales", catalogId: "c1" };
    const tbls = [{ id: "t1", name: "fact_orders", schemaId: "s1", tags: [], policies: [] }];
    const onChildSetOwner = vi.fn();
    render(<SchemaDetailPane
      schema={sch}
      catalog={CATALOG_REL}
      world={{ tables: tbls }}
      onChildSetOwner={onChildSetOwner}
    />);
    fireEvent.click(screen.getByRole("button", { name: /set owner/i }));
    expect(onChildSetOwner).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }), "tables");
  });
});
