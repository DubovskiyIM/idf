// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PatternWorkflowDiagram from "../PatternWorkflowDiagram.jsx";

afterEach(cleanup);

describe("PatternWorkflowDiagram", () => {
  it("рисует все 5 стадий (candidate / pending / approved / shipped / rejected)", () => {
    const { container } = render(<PatternWorkflowDiagram />);
    const labels = container.querySelectorAll("text");
    const texts = Array.from(labels).map((t) => t.textContent);
    expect(texts).toEqual(expect.arrayContaining([
      "Candidate", "Pending", "Approved", "Shipped", "Rejected",
    ]));
  });

  it("currentStage='shipped' использует green fill для shipped box", () => {
    const { container } = render(<PatternWorkflowDiagram currentStage="shipped" />);
    const shippedRect = Array.from(container.querySelectorAll("g")).find((g) => {
      const t = g.querySelector("text");
      return t && t.textContent === "Shipped";
    })?.querySelector("rect");
    expect(shippedRect.getAttribute("fill")).toBe("#10b981");
  });

  it("currentStage='rejected' активирует rejected branch", () => {
    const { container } = render(<PatternWorkflowDiagram currentStage="rejected" />);
    const rejectedG = Array.from(container.querySelectorAll("g")).find((g) => {
      const t = g.querySelector("text");
      return t && t.textContent === "Rejected";
    });
    const rect = rejectedG.querySelector("rect");
    expect(rect.getAttribute("fill")).toBe("#7f1d1d");
  });

  it("compact mode не рисует caption-text", () => {
    const { container } = render(<PatternWorkflowDiagram compact />);
    const captions = Array.from(container.querySelectorAll("text"))
      .map((t) => t.textContent)
      .filter((t) => t.includes("intent: request_pattern_promotion"));
    expect(captions).toHaveLength(0);
  });
});
