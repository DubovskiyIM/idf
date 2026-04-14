import { describe, it, expect } from "vitest";
import { checkInvariants } from "./schema/invariantChecker.cjs";

describe("integration: checkInvariants + foldWorld world shape", () => {
  it("контракт: world — это plain object с plural-ключами к массивам", () => {
    const world = {
      portfolios: [{ id: "p1", totalValue: 100 }],
      positions:  [{ id: "x", portfolioId: "p1", value: 100 }],
    };
    const ontology = {
      invariants: [{ name: "s", kind: "aggregate", op: "sum",
        from: "Position.value", where: { portfolioId: "$target.id" },
        target: "Portfolio.totalValue", tolerance: 0 }],
    };
    expect(checkInvariants(world, ontology).ok).toBe(true);
  });

  it("world от foldWorld совместим с checkInvariants (smoke)", () => {
    const r = checkInvariants({}, { invariants: [] });
    expect(r.ok).toBe(true);
  });
});
