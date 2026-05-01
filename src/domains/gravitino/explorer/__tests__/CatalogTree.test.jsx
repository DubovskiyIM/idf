// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CatalogTree from "../CatalogTree.jsx";

beforeEach(() => {
  // localStorage persist (D15) → очищаем, чтобы тесты не заражались
  if (typeof localStorage !== "undefined") localStorage.removeItem("gravitino-tree-expanded");
});
afterEach(cleanup);

const CATALOGS = [
  { id: "c1", name: "hive_warehouse", type: "relational", provider: "hive",            metalakeId: "m1" },
  { id: "c2", name: "iceberg_lakehouse", type: "relational", provider: "iceberg",     metalakeId: "m1" },
  { id: "c3", name: "events_stream",  type: "messaging",  provider: "kafka",          metalakeId: "m1" },
  { id: "c4", name: "raw_landing",    type: "fileset",    provider: "hadoop",         metalakeId: "m1" },
  { id: "c5", name: "ml_registry",    type: "model",      provider: "model-registry", metalakeId: "m1" },
  { id: "x9", name: "other_metalake_catalog", type: "relational", provider: "hive",   metalakeId: "m2" },
];

const SCHEMAS = [
  { id: "s_sales", name: "sales", catalogId: "c1" },
  { id: "s_marketing", name: "marketing", catalogId: "c1" },
];
const TABLES = [
  { id: "t_orders", name: "fact_orders", schemaId: "s_sales" },
  { id: "t_customer", name: "dim_customer", schemaId: "s_sales" },
];
const TOPICS = [
  { id: "tp_orders", name: "orders_topic", catalogId: "c3" },
];
const MODELS = [
  { id: "m_predictor", name: "price_predictor", schemaId: "s_ml" },
];
const FILESETS = [
  { id: "f_landing", name: "landing_zone", schemaId: "s_external" },
];

const SCHEMAS_EXT = [
  { id: "s_sales", name: "sales", catalogId: "c1" },
  { id: "s_marketing", name: "marketing", catalogId: "c1" },
  { id: "s_ml", name: "ml_prod", catalogId: "c5" },
  { id: "s_external", name: "external", catalogId: "c4" },
];

const EMPTY_WORLD = { schemas: [], tables: [], topics: [], models: [], filesets: [] };

describe("CatalogTree", () => {
  it("default tab Relational — показывает только relational catalogs текущего metalake", () => {
    render(<CatalogTree catalogs={CATALOGS} world={EMPTY_WORLD} metalakeId="m1" onSelect={vi.fn()} />);
    expect(screen.getByText("hive_warehouse")).toBeTruthy();
    expect(screen.getByText("iceberg_lakehouse")).toBeTruthy();
    expect(screen.queryByText("events_stream")).toBeNull();      // messaging tab
    expect(screen.queryByText("raw_landing")).toBeNull();         // fileset tab
    expect(screen.queryByText("other_metalake_catalog")).toBeNull(); // другой metalake
  });

  it("клик по tab Messaging — показывает только messaging catalogs", () => {
    render(<CatalogTree catalogs={CATALOGS} world={EMPTY_WORLD} metalakeId="m1" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /messaging/i }));
    expect(screen.getByText("events_stream")).toBeTruthy();
    expect(screen.queryByText("hive_warehouse")).toBeNull();
  });

  it("search фильтрует по подстроке name (case-insensitive)", () => {
    render(<CatalogTree catalogs={CATALOGS} world={EMPTY_WORLD} metalakeId="m1" onSelect={vi.fn()} />);
    const search = screen.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: "ice" } });
    expect(screen.getByText("iceberg_lakehouse")).toBeTruthy();
    expect(screen.queryByText("hive_warehouse")).toBeNull();
  });

  it("клик по catalog узлу вызывает onSelect с catalog объектом", () => {
    const onSelect = vi.fn();
    render(<CatalogTree catalogs={CATALOGS} world={EMPTY_WORLD} metalakeId="m1" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("hive_warehouse"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", name: "hive_warehouse" }));
  });

  it("expand catalog → видны schemas (relational)", () => {
    render(
      <CatalogTree
        catalogs={CATALOGS}
        world={{ schemas: SCHEMAS_EXT, tables: TABLES, topics: [], models: [], filesets: [] }}
        metalakeId="m1"
        onSelect={vi.fn()}
      />
    );
    // Изначально schemas скрыты
    expect(screen.queryByText("sales")).toBeNull();
    // Раскрываем hive_warehouse
    const expandBtn = screen.getByRole("button", { name: /expand-catalog:c1/i });
    fireEvent.click(expandBtn);
    expect(screen.getByText("sales")).toBeTruthy();
    expect(screen.getByText("marketing")).toBeTruthy();
  });

  it("expand schema (relational) → видны tables", () => {
    render(
      <CatalogTree
        catalogs={CATALOGS}
        world={{ schemas: SCHEMAS_EXT, tables: TABLES, topics: [], models: [], filesets: [] }}
        metalakeId="m1"
        onSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand-catalog:c1/i }));
    fireEvent.click(screen.getByRole("button", { name: /expand-schema:s_sales/i }));
    expect(screen.getByText("fact_orders")).toBeTruthy();
    expect(screen.getByText("dim_customer")).toBeTruthy();
  });

  it("messaging catalog → topics напрямую (без schemas)", () => {
    render(
      <CatalogTree
        catalogs={CATALOGS}
        world={{ schemas: SCHEMAS_EXT, tables: [], topics: TOPICS, models: [], filesets: [] }}
        metalakeId="m1"
        onSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: /messaging/i }));
    fireEvent.click(screen.getByRole("button", { name: /expand-catalog:c3/i }));
    expect(screen.getByText("orders_topic")).toBeTruthy();
  });

  it("expand schema (relational) → видны и tables, и functions если есть (U6.2)", () => {
    const FNS = [{ id: "fn1", name: "revenue_split", schemaId: "s_sales" }];
    render(
      <CatalogTree
        catalogs={CATALOGS}
        world={{ schemas: SCHEMAS_EXT, tables: TABLES, functions: FNS, topics: [], models: [], filesets: [] }}
        metalakeId="m1"
        onSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand-catalog:c1/i }));
    fireEvent.click(screen.getByRole("button", { name: /expand-schema:s_sales/i }));
    expect(screen.getByText("fact_orders")).toBeTruthy();
    expect(screen.getByText("revenue_split")).toBeTruthy();
  });

  it("click на table узел вызывает onSelect с table объектом", () => {
    const onSelect = vi.fn();
    render(
      <CatalogTree
        catalogs={CATALOGS}
        world={{ schemas: SCHEMAS_EXT, tables: TABLES, topics: [], models: [], filesets: [] }}
        metalakeId="m1"
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand-catalog:c1/i }));
    fireEvent.click(screen.getByRole("button", { name: /expand-schema:s_sales/i }));
    fireEvent.click(screen.getByText("fact_orders"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "t_orders", name: "fact_orders" }));
  });

  it("expand state persists в localStorage (D15)", () => {
    // Очистить state перед тестом
    localStorage.removeItem("gravitino-tree-expanded");
    const { unmount } = render(
      <CatalogTree
        catalogs={CATALOGS}
        world={{ schemas: SCHEMAS_EXT, tables: TABLES, topics: [], models: [], filesets: [], functions: [] }}
        metalakeId="m1"
        onSelect={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /expand-catalog:c1/i }));
    // hive_warehouse expanded → schemas видны
    expect(screen.getByText("sales")).toBeTruthy();
    unmount();

    // Re-render — expanded state восстанавливается
    render(
      <CatalogTree
        catalogs={CATALOGS}
        world={{ schemas: SCHEMAS_EXT, tables: TABLES, topics: [], models: [], filesets: [], functions: [] }}
        metalakeId="m1"
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText("sales")).toBeTruthy(); // sales всё ещё виден
  });
});
