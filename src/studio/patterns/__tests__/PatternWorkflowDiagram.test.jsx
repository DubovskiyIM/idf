// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PatternWorkflowDiagram from "../PatternWorkflowDiagram.jsx";

afterEach(cleanup);

describe("PatternWorkflowDiagram (compact chips)", () => {
  it("рендерит все 5 chips: Candidate / Pending / Approved / Shipped / Rejected", () => {
    render(<PatternWorkflowDiagram />);
    for (const label of ["Candidate", "Pending", "Approved", "Shipped", "Rejected"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("currentStage='shipped' — Shipped chip с green fill", () => {
    render(<PatternWorkflowDiagram currentStage="shipped" />);
    const chip = screen.getByText("Shipped").closest("span");
    expect(chip.style.background).toMatch(/rgb\(16,\s*185,\s*129\)|#10b981/);
  });

  it("currentStage='rejected' — Rejected chip с красным fill", () => {
    render(<PatternWorkflowDiagram currentStage="rejected" />);
    const chip = screen.getByText("Rejected").closest("span");
    expect(chip.style.background).toMatch(/rgb\(248,\s*113,\s*113\)|#f87171/);
  });

  it("Shipped chip когда active — показывает ⚠ irreversibility marker", () => {
    const { container } = render(<PatternWorkflowDiagram currentStage="shipped" />);
    expect(container.textContent).toContain("⚠");
  });

  it("Без currentStage — все chips muted (background не accent)", () => {
    render(<PatternWorkflowDiagram />);
    const chip = screen.getByText("Candidate").closest("span");
    expect(chip.style.background).toMatch(/rgb\(15,\s*23,\s*42\)|#0f172a/);
  });
});
