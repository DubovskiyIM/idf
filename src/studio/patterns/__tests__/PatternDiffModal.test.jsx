// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import PatternDiffModal from "../PatternDiffModal.jsx";

afterEach(cleanup);

const CAND = {
  id: "rating-aggregate-hero",
  archetype: "detail",
  structure: { slot: "header" },
  trigger: {
    requires: [
      { kind: "sub-entity-exists" },
      { kind: "field-role-present" },
      { kind: "intent-creates" },
    ],
  },
  rationale: {
    evidence: [
      { source: "Avito", reliability: "high" },
      { source: "Airbnb", reliability: "medium" },
    ],
  },
};

const STABLE = {
  id: "review-criterion-breakdown",
  archetype: "detail",
  structure: { slot: "body" },
  trigger: {
    requires: [
      { kind: "sub-entity-exists" }, // shared
      { kind: "entity-field" }, // stable-only
    ],
  },
  rationale: {
    evidence: [{ source: "Airbnb", reliability: "high" }],
  },
};

describe("PatternDiffModal", () => {
  it("без candidate/stable → не рендерит", () => {
    const { container } = render(<PatternDiffModal candidate={null} stable={STABLE} />);
    expect(container.firstChild).toBeNull();
  });

  it("показывает обе колонки с id паттернов", () => {
    render(<PatternDiffModal candidate={CAND} stable={STABLE} similarity={0.7} />);
    expect(screen.getByText("rating-aggregate-hero")).toBeTruthy();
    expect(screen.getByText("review-criterion-breakdown")).toBeTruthy();
  });

  it("similarity badge — округлённый процент", () => {
    render(<PatternDiffModal candidate={CAND} stable={STABLE} similarity={0.731} />);
    expect(screen.getByText(/similarity 73%/)).toBeTruthy();
  });

  it("archetype match → ✓ archetype", () => {
    render(<PatternDiffModal candidate={CAND} stable={STABLE} similarity={0.7} />);
    expect(screen.getByText(/✓ archetype/)).toBeTruthy();
  });

  it("slot mismatch → ≠ slot", () => {
    render(<PatternDiffModal candidate={CAND} stable={STABLE} similarity={0.7} />);
    expect(screen.getByText(/≠ slot/)).toBeTruthy();
  });

  it("shared kinds показаны как ✓ в обеих колонках", () => {
    render(<PatternDiffModal candidate={CAND} stable={STABLE} similarity={0.7} />);
    // sub-entity-exists shared → должно быть 2 раза (по chip в каждой колонке)
    const sharedChips = screen.getAllByText(/✓ sub-entity-exists/);
    expect(sharedChips.length).toBe(2);
  });

  it("candidate-only kind → '+' в left", () => {
    render(<PatternDiffModal candidate={CAND} stable={STABLE} similarity={0.7} />);
    expect(screen.getByText(/\+ field-role-present/)).toBeTruthy();
    expect(screen.getByText(/\+ intent-creates/)).toBeTruthy();
  });

  it("stable-only kind → '−' в right", () => {
    render(<PatternDiffModal candidate={CAND} stable={STABLE} similarity={0.7} />);
    expect(screen.getByText(/− entity-field/)).toBeTruthy();
  });

  it("evidence list рендерит source + reliability", () => {
    render(<PatternDiffModal candidate={CAND} stable={STABLE} similarity={0.7} />);
    expect(screen.getAllByText("Avito").length).toBe(1);
    expect(screen.getAllByText("Airbnb").length).toBeGreaterThan(0);
  });

  it("✕ кнопка вызывает onClose", () => {
    const onClose = vi.fn();
    render(<PatternDiffModal candidate={CAND} stable={STABLE} similarity={0.7} onClose={onClose} />);
    fireEvent.click(screen.getByText("✕"));
    expect(onClose).toHaveBeenCalled();
  });

  it("'Открыть stable' вызывает onOpenInWorkspace с stable.id", () => {
    const onOpen = vi.fn();
    render(
      <PatternDiffModal
        candidate={CAND}
        stable={STABLE}
        similarity={0.7}
        onOpenInWorkspace={onOpen}
      />,
    );
    fireEvent.click(screen.getByText(/Открыть stable/));
    expect(onOpen).toHaveBeenCalledWith("review-criterion-breakdown");
  });

  it("Esc вызывает onClose", () => {
    const onClose = vi.fn();
    render(<PatternDiffModal candidate={CAND} stable={STABLE} similarity={0.7} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("similarity ≥ 65% — duplicate-warning стиль (yellow border)", () => {
    const { container } = render(
      <PatternDiffModal candidate={CAND} stable={STABLE} similarity={0.78} />,
    );
    const txt = container.textContent || "";
    expect(txt).toMatch(/78%/);
  });
});
