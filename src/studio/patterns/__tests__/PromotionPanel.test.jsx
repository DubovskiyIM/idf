// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import PromotionPanel from "../PromotionPanel.jsx";

let fetchCalls;
const origFetch = globalThis.fetch;

beforeEach(() => {
  fetchCalls = [];
  globalThis.fetch = vi.fn(async (url, init) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "ok" }),
      text: async () => "",
    };
  });
});

afterEach(() => {
  globalThis.fetch = origFetch;
  cleanup();
});

const PROMOTIONS = [
  {
    id: "p1",
    candidateId: "rating-hero",
    targetArchetype: "detail",
    rationale: "встречается в 5+ продуктах",
    status: "pending",
    weight: 60,
    requestedAt: 1700000000000,
  },
  {
    id: "p2",
    candidateId: "stat-aggregate",
    targetArchetype: "detail",
    rationale: "альтернатива rating-hero",
    status: "pending",
    weight: 40,
    requestedAt: 1700001000000,
  },
  {
    id: "p3",
    candidateId: "ship-me",
    targetArchetype: "catalog",
    status: "approved",
    weight: 50,
    decidedAt: 1700002000000,
  },
  {
    id: "p4",
    candidateId: "shipped-x",
    targetArchetype: "feed",
    status: "shipped",
    sdkPrUrl: "https://github.com/x/y/pull/1",
    decidedAt: 1700003000000,
  },
];

describe("PromotionPanel", () => {
  it("tabs показывают counts по статусам", () => {
    render(<PromotionPanel promotions={PROMOTIONS} />);
    expect(screen.getByText(/Pending/).textContent).toMatch(/2/);
    expect(screen.getByText(/Approved/).textContent).toMatch(/1/);
    expect(screen.getByText(/Shipped/).textContent).toMatch(/1/);
    expect(screen.getByText(/Rejected/).textContent).not.toMatch(/[1-9]/);
  });

  it("Pending tab — Approve кнопка POSTит /api/effects с alpha=replace + status=approved", async () => {
    const onChange = vi.fn();
    render(<PromotionPanel promotions={PROMOTIONS} onChange={onChange} />);
    const approveBtns = screen.getAllByText("Approve");
    fireEvent.click(approveBtns[0]);
    await waitFor(() => expect(fetchCalls).toHaveLength(1));
    const call = fetchCalls[0];
    expect(call.url).toBe("/api/effects");
    expect(call.init.method).toBe("POST");
    const body = JSON.parse(call.init.body);
    expect(body.intent_id).toBe("approve_pattern_promotion");
    expect(body.alpha).toBe("replace");
    expect(body.target).toBe("PatternPromotion.status");
    expect(body.context.status).toBe("approved");
    expect(onChange).toHaveBeenCalled();
  });

  it("Pending tab — Competing block показывается когда >=2 pending одного archetype'a", () => {
    render(<PromotionPanel promotions={PROMOTIONS} />);
    expect(screen.getByText(/Competing pending/)).toBeTruthy();
    // 2 pending для detail с весами 60 и 40 → 60% и 40%
    expect(screen.getByText("60%")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
  });

  it("Approved tab — Ship открывает inline form с SDK PR url, потом POSTит ship intent", async () => {
    render(<PromotionPanel promotions={PROMOTIONS} />);
    fireEvent.click(screen.getByText(/Approved/));
    fireEvent.click(screen.getByText(/Ship → SDK/));
    const url = "https://github.com/intent-driven/idf-sdk/pull/42";
    const input = screen.getByPlaceholderText(/SDK PR URL/);
    fireEvent.change(input, { target: { value: url } });
    fireEvent.click(screen.getByText("Confirm Ship"));
    await waitFor(() => expect(fetchCalls).toHaveLength(1));
    const body = JSON.parse(fetchCalls[0].init.body);
    expect(body.intent_id).toBe("ship_pattern_promotion");
    expect(body.context.sdkPrUrl).toBe(url);
    expect(body.context.status).toBe("shipped");
  });

  it("Shipped tab — рендерит SDK PR ссылку как clickable", () => {
    render(<PromotionPanel promotions={PROMOTIONS} />);
    fireEvent.click(screen.getByText(/Shipped/));
    const link = screen.getByText("https://github.com/x/y/pull/1");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("https://github.com/x/y/pull/1");
  });
});
