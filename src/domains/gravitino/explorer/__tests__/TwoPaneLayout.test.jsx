// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import TwoPaneLayout from "../TwoPaneLayout.jsx";

afterEach(cleanup);

const SECTIONS = [
  { key: "tags",     label: "Tags" },
  { key: "policies", label: "Policies" },
  { key: "filters",  label: "Row Filters", disabled: true },
];

describe("TwoPaneLayout", () => {
  it("рендерит left-submenu + right body", () => {
    render(<TwoPaneLayout sections={SECTIONS} active="tags" onSelect={vi.fn()} title="Data Compliance"><div>BODY</div></TwoPaneLayout>);
    expect(screen.getByText("Tags")).toBeTruthy();
    expect(screen.getByText("Policies")).toBeTruthy();
    expect(screen.getByText("Row Filters")).toBeTruthy();
    expect(screen.getByText("BODY")).toBeTruthy();
  });

  it("active section подсвечена", () => {
    render(<TwoPaneLayout sections={SECTIONS} active="policies" onSelect={vi.fn()}><div>x</div></TwoPaneLayout>);
    const policiesTab = screen.getByText("Policies").closest("button");
    expect(policiesTab.getAttribute("aria-current")).toBe("page");
  });

  it("click по section вызывает onSelect", () => {
    const onSelect = vi.fn();
    render(<TwoPaneLayout sections={SECTIONS} active="tags" onSelect={onSelect}><div>x</div></TwoPaneLayout>);
    fireEvent.click(screen.getByText("Policies"));
    expect(onSelect).toHaveBeenCalledWith("policies");
  });

  it("disabled section не вызывает onSelect", () => {
    const onSelect = vi.fn();
    render(<TwoPaneLayout sections={SECTIONS} active="tags" onSelect={onSelect}><div>x</div></TwoPaneLayout>);
    fireEvent.click(screen.getByText("Row Filters"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
