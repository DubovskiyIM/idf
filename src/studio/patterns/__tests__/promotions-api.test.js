import { describe, it, expect } from "vitest";
import { foldPatternPromotions, groupByStatus, groupCompeting } from "../../api/promotions.js";

describe("foldPatternPromotions", () => {
  it("create + replace на field-path даёт собранный объект", () => {
    const effects = [
      {
        target: "PatternPromotion",
        alpha: "create",
        context: JSON.stringify({
          id: "p1",
          candidateId: "rating-hero",
          status: "pending",
          weight: 70,
        }),
      },
      {
        target: "PatternPromotion.status",
        alpha: "replace",
        context: JSON.stringify({ id: "p1", status: "approved" }),
      },
    ];
    const items = foldPatternPromotions(effects);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("approved");
    expect(items[0].weight).toBe(70);
    expect(items[0].candidateId).toBe("rating-hero");
  });

  it("игнорирует other targets (BacklogItem, Witness)", () => {
    const effects = [
      { target: "BacklogItem", alpha: "create", context: JSON.stringify({ id: "b" }) },
      { target: "Witness", alpha: "create", context: JSON.stringify({ id: "w" }) },
      { target: "PatternPromotion", alpha: "create", context: JSON.stringify({ id: "p" }) },
    ];
    expect(foldPatternPromotions(effects)).toHaveLength(1);
  });
});

describe("groupCompeting", () => {
  it("≥2 pending одного archetype'а → competing с weightShare", () => {
    const promotions = [
      { id: "a", status: "pending", targetArchetype: "detail", weight: 60 },
      { id: "b", status: "pending", targetArchetype: "detail", weight: 40 },
      { id: "c", status: "pending", targetArchetype: "feed", weight: 50 },
    ];
    const competing = groupCompeting(promotions);
    expect(Object.keys(competing)).toEqual(["detail"]);
    const [a, b] = competing.detail;
    expect(a.weightShare).toBeCloseTo(0.6);
    expect(b.weightShare).toBeCloseTo(0.4);
  });

  it("одинокий pending не считается competing", () => {
    const promotions = [
      { id: "a", status: "pending", targetArchetype: "detail", weight: 50 },
    ];
    expect(groupCompeting(promotions)).toEqual({});
  });

  it("approved/shipped/rejected не входят в competing", () => {
    const promotions = [
      { id: "a", status: "approved", targetArchetype: "detail", weight: 60 },
      { id: "b", status: "pending", targetArchetype: "detail", weight: 40 },
    ];
    expect(groupCompeting(promotions)).toEqual({});
  });

  it("missing weight → fallback на 50, equal share", () => {
    const promotions = [
      { id: "a", status: "pending", targetArchetype: "detail" },
      { id: "b", status: "pending", targetArchetype: "detail" },
    ];
    const c = groupCompeting(promotions);
    expect(c.detail[0].weightShare).toBeCloseTo(0.5);
    expect(c.detail[1].weightShare).toBeCloseTo(0.5);
  });
});

describe("groupByStatus", () => {
  it("сортирует pending по requestedAt desc", () => {
    const items = [
      { id: "a", status: "pending", requestedAt: 100 },
      { id: "b", status: "pending", requestedAt: 200 },
    ];
    const buckets = groupByStatus(items);
    expect(buckets.pending[0].id).toBe("b");
    expect(buckets.pending[1].id).toBe("a");
  });
});
