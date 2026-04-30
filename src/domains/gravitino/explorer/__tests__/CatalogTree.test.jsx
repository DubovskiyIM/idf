// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CatalogTree from "../CatalogTree.jsx";

afterEach(cleanup);

const CATALOGS = [
  { id: "c1", name: "hive_warehouse", type: "relational", provider: "hive",            metalakeId: "m1" },
  { id: "c2", name: "iceberg_lakehouse", type: "relational", provider: "iceberg",     metalakeId: "m1" },
  { id: "c3", name: "events_stream",  type: "messaging",  provider: "kafka",          metalakeId: "m1" },
  { id: "c4", name: "raw_landing",    type: "fileset",    provider: "hadoop",         metalakeId: "m1" },
  { id: "c5", name: "ml_registry",    type: "model",      provider: "model-registry", metalakeId: "m1" },
  { id: "x9", name: "other_metalake_catalog", type: "relational", provider: "hive",   metalakeId: "m2" },
];

describe("CatalogTree", () => {
  it("default tab Relational — показывает только relational catalogs текущего metalake", () => {
    render(<CatalogTree catalogs={CATALOGS} metalakeId="m1" onSelect={vi.fn()} />);
    expect(screen.getByText("hive_warehouse")).toBeTruthy();
    expect(screen.getByText("iceberg_lakehouse")).toBeTruthy();
    expect(screen.queryByText("events_stream")).toBeNull();      // messaging tab
    expect(screen.queryByText("raw_landing")).toBeNull();         // fileset tab
    expect(screen.queryByText("other_metalake_catalog")).toBeNull(); // другой metalake
  });

  it("клик по tab Messaging — показывает только messaging catalogs", () => {
    render(<CatalogTree catalogs={CATALOGS} metalakeId="m1" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /messaging/i }));
    expect(screen.getByText("events_stream")).toBeTruthy();
    expect(screen.queryByText("hive_warehouse")).toBeNull();
  });

  it("search фильтрует по подстроке name (case-insensitive)", () => {
    render(<CatalogTree catalogs={CATALOGS} metalakeId="m1" onSelect={vi.fn()} />);
    const search = screen.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: "ice" } });
    expect(screen.getByText("iceberg_lakehouse")).toBeTruthy();
    expect(screen.queryByText("hive_warehouse")).toBeNull();
  });

  it("клик по catalog узлу вызывает onSelect с catalog объектом", () => {
    const onSelect = vi.fn();
    render(<CatalogTree catalogs={CATALOGS} metalakeId="m1" onSelect={onSelect} />);
    fireEvent.click(screen.getByText("hive_warehouse"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", name: "hive_warehouse" }));
  });
});
