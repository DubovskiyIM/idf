// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CatalogExplorer from "../CatalogExplorer.jsx";

afterEach(cleanup);

const world = {
  metalakes: [
    { id: "m1", name: "prod_lake", comment: "Production" },
  ],
  catalogs: [
    { id: "c1", name: "hive_warehouse",   type: "relational", provider: "hive",      comment: "Hive WH",     metalakeId: "m1" },
    { id: "c2", name: "iceberg_lakehouse", type: "relational", provider: "iceberg",   comment: "Iceberg",     metalakeId: "m1" },
    { id: "c3", name: "events_stream",    type: "messaging",  provider: "kafka",      comment: "Kafka",       metalakeId: "m1" },
  ],
};

describe("CatalogExplorer", () => {
  it("breadcrumb показывает 'Metalakes › prod_lake'", () => {
    render(<CatalogExplorer world={world} routeParams={{ metalakeId: "m1" }} exec={vi.fn()} />);
    expect(screen.getByText(/metalakes/i)).toBeTruthy();
    expect(screen.getByText("prod_lake")).toBeTruthy();
  });

  it("default правая панель — таблица всех catalogs текущего metalake", () => {
    render(<CatalogExplorer world={world} routeParams={{ metalakeId: "m1" }} exec={vi.fn()} />);
    // hive_warehouse рендерится и в tree (Relational tab default), и в таблице
    expect(screen.getAllByText("hive_warehouse").length).toBeGreaterThan(0);
    // в правой таблице — все 3 (включая messaging который НЕ в tree default tab)
    expect(screen.getAllByText("events_stream").length).toBeGreaterThan(0);
  });

  it("click на catalog node в tree → breadcrumb расширяется catalog name", () => {
    render(<CatalogExplorer world={world} routeParams={{ metalakeId: "m1" }} exec={vi.fn()} />);
    // tree-узел и cell в таблице оба содержат "hive_warehouse" — берём первый
    // (tree button) по role=button.
    const treeButtons = screen.getAllByRole("button", { name: /hive_warehouse/i });
    fireEvent.click(treeButtons[0]);
    // breadcrumb теперь должен содержать hive_warehouse трейл (пока simple — текст где-то в crumbs)
    const crumbs = screen.getByLabelText(/breadcrumb/i);
    expect(crumbs.textContent).toContain("hive_warehouse");
  });

  it("неизвестный metalakeId → fallback empty-state", () => {
    render(<CatalogExplorer world={world} routeParams={{ metalakeId: "missing" }} exec={vi.fn()} />);
    expect(screen.getByText(/metalake.*не найден|not found/i)).toBeTruthy();
  });

  // ArchetypeCanvas в @intent-driven/renderer передаёт canvas-component
  // props { artifact, ctx, world, exec, viewer } — routeParams живут на
  // ctx.routeParams, не на top-level. Контракт идентичен notion BlockCanvas.
  // Этот тест пинит ctx-extraction path, чтобы регрессия ловилась.
  it("читает routeParams из ctx когда top-level routeParams не передан", () => {
    render(
      <CatalogExplorer
        world={world}
        ctx={{ routeParams: { metalakeId: "m1" } }}
      />
    );
    expect(screen.getByText("prod_lake")).toBeTruthy();
    expect(screen.queryByText(/metalake.*не найден/i)).toBeNull();
  });
});
