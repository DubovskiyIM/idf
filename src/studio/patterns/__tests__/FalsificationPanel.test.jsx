// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import FalsificationPanel from "../FalsificationPanel.jsx";

const origFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: "p",
      shouldMatch: [
        {
          domain: "messenger",
          projection: "conversation_detail",
          expected: true,
          actual: false,
          reason: "Message-attachments",
          perRequire: [
            { kind: "sub-entity-exists", ok: false, reason: "no sub-entity referencing Conversation" },
            { kind: "entity-field", ok: "unknown", reason: "field placeholder" },
          ],
        },
        {
          domain: "sales",
          projection: "listing_edit",
          expected: true,
          actual: null,
          error: "projection-not-found",
        },
      ],
      shouldNotMatch: [
        {
          domain: "invest",
          projection: "portfolio_detail",
          expected: false,
          actual: false,
          reason: "no file content",
          perRequire: [
            { kind: "sub-entity-exists", ok: false, reason: "no sub-entity" },
          ],
        },
      ],
      regressions: [],
      note: "ref-candidate: generic evaluator best-effort",
    }),
  }));
});

afterEach(() => {
  globalThis.fetch = origFetch;
  cleanup();
});

describe("FalsificationPanel · per-require breakdown", () => {
  it("Run кнопка вызывает fetch и рендерит fixture-карточки", async () => {
    render(<FalsificationPanel patternId="p" />);
    fireEvent.click(screen.getByText(/Run falsification/));
    await waitFor(() => expect(screen.getByText(/Should match/)).toBeTruthy());
    expect(screen.getByText("messenger")).toBeTruthy();
    expect(screen.getByText("invest")).toBeTruthy();
    expect(screen.getByText(/Regressions: 0/)).toBeTruthy();
  });

  it("note из server отображается рядом с Run", async () => {
    render(<FalsificationPanel patternId="p" />);
    fireEvent.click(screen.getByText(/Run/));
    await waitFor(() => expect(screen.getByText(/best-effort/)).toBeTruthy());
  });

  it("fixture с actual=false vs expected=true → 'actual=false, expected=true' verdict", async () => {
    render(<FalsificationPanel patternId="p" />);
    fireEvent.click(screen.getByText(/Run/));
    await waitFor(() =>
      expect(screen.getByText(/actual=false, expected=true/)).toBeTruthy(),
    );
  });

  it("fixture с actual=null + error → undecidable verdict", async () => {
    render(<FalsificationPanel patternId="p" />);
    fireEvent.click(screen.getByText(/Run/));
    await waitFor(() => expect(screen.getByText(/projection-not-found/)).toBeTruthy());
  });

  it("клик по fixture-row раскрывает per-require breakdown", async () => {
    render(<FalsificationPanel patternId="p" />);
    fireEvent.click(screen.getByText(/Run/));
    await waitFor(() => screen.getByText("messenger"));
    // изначально breakdown скрыт
    expect(screen.queryByText(/no sub-entity referencing Conversation/)).toBeNull();
    // клик по messenger row
    fireEvent.click(screen.getByText("messenger").closest("div").parentElement);
    expect(screen.getByText(/no sub-entity referencing Conversation/)).toBeTruthy();
    // unknown require тоже виден
    expect(screen.getByText(/field placeholder/)).toBeTruthy();
  });

  it("fixture без perRequire (error case) не разворачивается", async () => {
    render(<FalsificationPanel patternId="p" />);
    fireEvent.click(screen.getByText(/Run/));
    await waitFor(() => screen.getByText("sales"));
    // sales — error case, perRequire отсутствует → нет ▸
    const salesRow = screen.getByText("sales").closest("div");
    expect(salesRow.textContent).not.toMatch(/▸|▾/);
  });
});
