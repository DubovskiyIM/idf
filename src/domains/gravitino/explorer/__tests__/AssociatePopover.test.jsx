// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import AssociatePopover from "../AssociatePopover.jsx";

afterEach(cleanup);

const ITEMS = [
  { id: "t1", name: "PII" },
  { id: "t2", name: "Financial" },
  { id: "t3", name: "GDPR" },
  { id: "t4", name: "Internal" },
];

describe("AssociatePopover", () => {
  it("рендерит title + checkbox list + Apply/Cancel", () => {
    render(<AssociatePopover title="Associate Tag" available={ITEMS} selected={[]} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Associate Tag")).toBeTruthy();
    expect(screen.getByText("PII")).toBeTruthy();
    expect(screen.getByRole("button", { name: /apply|применить/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /cancel|отмена/i })).toBeTruthy();
  });

  it("search фильтрует видимые items (case-insensitive)", () => {
    render(<AssociatePopover title="Associate Tag" available={ITEMS} selected={[]} onApply={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "fin" } });
    expect(screen.getByText("Financial")).toBeTruthy();
    expect(screen.queryByText("PII")).toBeNull();
  });

  it("pre-selected items имеют checked checkbox", () => {
    render(<AssociatePopover title="Associate Tag" available={ITEMS} selected={["PII", "GDPR"]} onApply={vi.fn()} onClose={vi.fn()} />);
    const piiCheckbox = screen.getByLabelText("PII");
    const gdprCheckbox = screen.getByLabelText("GDPR");
    const finCheckbox = screen.getByLabelText("Financial");
    expect(piiCheckbox.checked).toBe(true);
    expect(gdprCheckbox.checked).toBe(true);
    expect(finCheckbox.checked).toBe(false);
  });

  it("Apply вызывает onApply со списком выбранных names", () => {
    const onApply = vi.fn();
    render(<AssociatePopover title="Associate Tag" available={ITEMS} selected={["PII"]} onApply={onApply} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Financial"));
    fireEvent.click(screen.getByRole("button", { name: /apply|применить/i }));
    expect(onApply).toHaveBeenCalledWith(["PII", "Financial"]);
  });

  it("Cancel вызывает onClose без onApply", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<AssociatePopover title="Associate Tag" available={ITEMS} selected={[]} onApply={onApply} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel|отмена/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
