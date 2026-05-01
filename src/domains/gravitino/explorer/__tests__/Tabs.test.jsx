// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import Tabs from "../Tabs.jsx";

afterEach(cleanup);

const TABS = [
  { key: "a", label: "Tab A" },
  { key: "b", label: "Tab B" },
  { key: "c", label: "Tab C" },
];

describe("Tabs", () => {
  it("рендерит tab-bar с label'ами", () => {
    render(<Tabs tabs={TABS} active="a" onChange={vi.fn()}>content</Tabs>);
    expect(screen.getByRole("tab", { name: /tab a/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /tab b/i })).toBeTruthy();
    expect(screen.getByText("content")).toBeTruthy();
  });

  it("active tab имеет aria-selected=true", () => {
    render(<Tabs tabs={TABS} active="b" onChange={vi.fn()}>x</Tabs>);
    const tabB = screen.getByRole("tab", { name: /tab b/i });
    const tabA = screen.getByRole("tab", { name: /tab a/i });
    expect(tabB.getAttribute("aria-selected")).toBe("true");
    expect(tabA.getAttribute("aria-selected")).toBe("false");
  });

  it("click по tab вызывает onChange(key)", () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} active="a" onChange={onChange}>x</Tabs>);
    fireEvent.click(screen.getByRole("tab", { name: /tab c/i }));
    expect(onChange).toHaveBeenCalledWith("c");
  });
});
