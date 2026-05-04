// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import HeatmapView from "../HeatmapView.jsx";

const SAMPLE = {
  domains: ["argocd", "messenger"],
  projections: [
    { key: "argocd/app_list", domain: "argocd", projection: "app_list", mainEntity: "App" },
    { key: "messenger/conversation_detail", domain: "messenger", projection: "conversation_detail", mainEntity: "Conversation" },
  ],
  patterns: [
    {
      id: "pattern-a",
      archetype: "catalog",
      refSource: "x.json",
      matches: { "argocd/app_list": "true", "messenger/conversation_detail": "false" },
      stats: { match: 1, miss: 1, undecidable: 0 },
    },
    {
      id: "pattern-b",
      archetype: "detail",
      refSource: "y.json",
      matches: { "argocd/app_list": "null", "messenger/conversation_detail": "true" },
      stats: { match: 1, miss: 0, undecidable: 1 },
    },
  ],
  cached: false,
  generatedAt: 12345,
};

const origFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => SAMPLE,
  }));
});

afterEach(() => {
  globalThis.fetch = origFetch;
  cleanup();
});

describe("HeatmapView", () => {
  it("грузит /api/patterns/heatmap и рендерит таблицу", async () => {
    render(<HeatmapView />);
    await waitFor(() => expect(screen.getByText("pattern-a")).toBeTruthy());
    expect(screen.getByText("pattern-b")).toBeTruthy();
    expect(screen.getByText("argocd")).toBeTruthy();
    expect(screen.getByText("messenger")).toBeTruthy();
  });

  it("totals в toolbar: match/miss/unk суммированы", async () => {
    render(<HeatmapView />);
    await waitFor(() => expect(screen.getByText("pattern-a")).toBeTruthy());
    expect(screen.getByText(/match 2/)).toBeTruthy(); // 1 + 1
    expect(screen.getByText(/miss 1/)).toBeTruthy();
    expect(screen.getByText(/unk 1/)).toBeTruthy();
  });

  it("search фильтрует по pattern-id", async () => {
    render(<HeatmapView />);
    await waitFor(() => expect(screen.getByText("pattern-a")).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText(/Поиск/), { target: { value: "b" } });
    expect(screen.queryByText("pattern-a")).toBeNull();
    expect(screen.getByText("pattern-b")).toBeTruthy();
  });

  it("min-match фильтрует по stats.match >= N", async () => {
    render(<HeatmapView />);
    await waitFor(() => expect(screen.getByText("pattern-a")).toBeTruthy());
    fireEvent.change(screen.getByDisplayValue("0"), { target: { value: "5" } });
    expect(screen.queryByText("pattern-a")).toBeNull();
    expect(screen.queryByText("pattern-b")).toBeNull();
  });

  it("клик по pattern-имени вызывает onPickPattern с id", async () => {
    const onPick = vi.fn();
    render(<HeatmapView onPickPattern={onPick} />);
    await waitFor(() => expect(screen.getByText("pattern-a")).toBeTruthy());
    fireEvent.click(screen.getByText("pattern-a"));
    expect(onPick).toHaveBeenCalledWith("pattern-a");
  });

  it("Re-compute вызывает fetch с ?force=1", async () => {
    render(<HeatmapView />);
    await waitFor(() => expect(screen.getByText("pattern-a")).toBeTruthy());
    fireEvent.click(screen.getByText(/Re-compute/));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    const lastCall = globalThis.fetch.mock.calls[1][0];
    expect(lastCall).toMatch(/force=1/);
  });
});
