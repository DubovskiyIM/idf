// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PatternStructureDiagram from "../PatternStructureDiagram.jsx";

afterEach(cleanup);

describe("PatternStructureDiagram", () => {
  it("без pattern — показывает hint", () => {
    render(<PatternStructureDiagram pattern={null} />);
    expect(screen.getByText(/Выберите паттерн/)).toBeTruthy();
  });

  it("без structure.slot — предупреждает что preview не визуализируется", () => {
    render(<PatternStructureDiagram pattern={{ id: "px", structure: {} }} />);
    expect(screen.getByText(/не декларирует structure\.slot/)).toBeTruthy();
  });

  it("с structure.slot — рисует Before и After колонки, помечает targeted slot", () => {
    render(
      <PatternStructureDiagram
        pattern={{
          id: "rating-aggregate-hero",
          structure: { slot: "hero", kind: "decorate", example: "5.0 ★ · 142 reviews" },
        }}
      />,
    );
    expect(screen.getByText(/Before — baseline archetype/)).toBeTruthy();
    expect(screen.getByText(/After — with rating-aggregate-hero/)).toBeTruthy();
    expect(screen.getByText(/hero · decorate/)).toBeTruthy();
    expect(screen.getByText(/5\.0 ★/)).toBeTruthy();
  });

  it("все 6 канонических слотов в Before-колонке", () => {
    const { container } = render(
      <PatternStructureDiagram pattern={{ id: "x", structure: { slot: "body" } }} />,
    );
    const text = container.textContent || "";
    for (const s of ["header", "hero", "body", "aside", "composer", "footer"]) {
      expect(text).toContain(s);
    }
  });
});
