// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import MetalakesTable from "../MetalakesTable.jsx";

afterEach(cleanup);

const METALAKES = [
  { id: "m1", name: "prod_lake",    comment: "Prod",    owner: "alice@acme", inUse: true,  audit: { creator: "alice@acme",   createTime: "2026-04-01T10:00:00Z" }, properties: { env: "prod" } },
  { id: "m2", name: "staging_lake", comment: "Staging", owner: "bob@acme",   inUse: true,  audit: { creator: "bob@acme",     createTime: "2026-04-15T10:00:00Z" }, properties: { env: "staging" } },
  { id: "m3", name: "dev_lake",     comment: "Dev",                          inUse: false, audit: { creator: "charlie@acme", createTime: "2026-04-20T10:00:00Z" }, properties: {} },
];

describe("MetalakesTable", () => {
  it("рендерит rows со всеми колонками (Name/Creator/Owner/Created/Properties/Comment/In Use)", () => {
    render(<MetalakesTable metalakes={METALAKES} onSelect={vi.fn()} onSetOwner={vi.fn()} onToggleInUse={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("prod_lake")).toBeTruthy();
    expect(screen.getByText("staging_lake")).toBeTruthy();
    expect(screen.getByText("dev_lake")).toBeTruthy();
    // alice@acme встречается и в Creator и в Owner
    expect(screen.getAllByText("alice@acme").length).toBeGreaterThan(0);
    expect(screen.getByText("Prod")).toBeTruthy();
  });

  it("In-Use toggle для true → показывает 'In Use', click → onToggleInUse(id, false)", () => {
    const onToggle = vi.fn();
    render(<MetalakesTable metalakes={METALAKES} onSelect={vi.fn()} onSetOwner={vi.fn()} onToggleInUse={onToggle} onDelete={vi.fn()} />);
    const toggles = screen.getAllByRole("button", { name: /in use|disabled/i });
    expect(toggles.length).toBe(3);
    // m1 → "In Use" → click → toggle off
    fireEvent.click(toggles[0]);
    expect(onToggle).toHaveBeenCalledWith("m1", false);
  });

  it("Owner cell без owner — '+ Set Owner' кнопка", () => {
    render(<MetalakesTable metalakes={METALAKES} onSelect={vi.fn()} onSetOwner={vi.fn()} onToggleInUse={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole("button", { name: /\+ set owner/i })).toBeTruthy();
  });

  it("click name cell → onSelect(metalake)", () => {
    const onSelect = vi.fn();
    render(<MetalakesTable metalakes={METALAKES} onSelect={onSelect} onSetOwner={vi.fn()} onToggleInUse={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByText("prod_lake"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "m1", name: "prod_lake" }));
  });

  it("Delete button вызывает onDelete(metalake)", () => {
    const onDelete = vi.fn();
    render(<MetalakesTable metalakes={METALAKES} onSelect={vi.fn()} onSetOwner={vi.fn()} onToggleInUse={vi.fn()} onDelete={onDelete} />);
    const deletes = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(deletes[0]);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }));
  });

  it("✎ owner-edit вызывает onSetOwner(metalakeId)", () => {
    const onSetOwner = vi.fn();
    render(<MetalakesTable metalakes={METALAKES} onSelect={vi.fn()} onSetOwner={onSetOwner} onToggleInUse={vi.fn()} onDelete={vi.fn()} />);
    const editBtns = screen.getAllByRole("button", { name: /edit owner/i });
    fireEvent.click(editBtns[0]);
    expect(onSetOwner).toHaveBeenCalledWith("m1");
  });

  it("empty list → empty-state hint", () => {
    render(<MetalakesTable metalakes={[]} onSelect={vi.fn()} onSetOwner={vi.fn()} onToggleInUse={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText(/нет metalakes/i)).toBeTruthy();
  });
});
