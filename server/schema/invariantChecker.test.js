import { describe, it, expect } from "vitest";
import { checkInvariants } from "./invariantChecker.cjs";

describe("checkInvariants — dispatch", () => {
  it("возвращает ok:true на пустую ontology.invariants", () => {
    const result = checkInvariants({}, {});
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("возвращает ok:true на отсутствующий invariants-ключ", () => {
    const result = checkInvariants({ users: [] }, { entities: {} });
    expect(result.ok).toBe(true);
  });

  it("unknown kind → violation с reason:unknown_kind", () => {
    // SDK core@0.22+ defensive: unknown kind → warning, не ломает ok.
    // Поведение: добавить handler через registerKind, чтобы strictность вернулась.
    const ontology = { invariants: [{ name: "x", kind: "wtf" }] };
    const result = checkInvariants({}, ontology);
    expect(result.violations[0].details.reason).toBe("unknown_kind");
  });

  it("unknown kind — severity:warning (не ломает ok)", () => {
    const ontology = { invariants: [{ name: "x", kind: "wtf" }] };
    const result = checkInvariants({}, ontology);
    expect(result.violations[0].severity).toBe("warning");
    expect(result.ok).toBe(true);
  });

  it("severity:warning не ломает ok если errors нет", () => {
    const ontology = { invariants: [{ name: "x", kind: "wtf", severity: "warning" }] };
    const result = checkInvariants({}, ontology);
    expect(result.ok).toBe(true);
    expect(result.violations.length).toBe(1);
  });
});

describe("kind: role-capability", () => {
  const ontology = {
    roles: {
      owner:    { base: "owner",    canExecute: ["create_order"] },
      observer: { base: "observer", canExecute: [] },
    },
    invariants: [
      { name: "observer_readonly", kind: "role-capability",
        role: "observer", require: { canExecute: "empty" } }
    ],
  };

  it("проходит если observer.canExecute пустой", () => {
    const r = checkInvariants({}, ontology);
    expect(r.ok).toBe(true);
  });

  it("ловит observer с непустым canExecute", () => {
    const bad = {
      ...ontology,
      roles: { ...ontology.roles, observer: { base: "observer", canExecute: ["x"] } },
    };
    const r = checkInvariants({}, bad);
    expect(r.ok).toBe(false);
    expect(r.violations[0].details.role).toBe("observer");
    expect(r.violations[0].details.canExecute).toEqual(["x"]);
  });

  it("role указывает base — проверяет все роли с этим base", () => {
    const multi = {
      roles: {
        regulator: { base: "observer", canExecute: [] },
        auditor:   { base: "observer", canExecute: ["reveal"] },
      },
      invariants: [
        { name: "o", kind: "role-capability", role: "observer",
          require: { canExecute: "empty" } }
      ],
    };
    const r = checkInvariants({}, multi);
    expect(r.ok).toBe(false);
    expect(r.violations.length).toBe(1);
    expect(r.violations[0].details.role).toBe("auditor");
  });

  it("несуществующая роль → warning-violation", () => {
    const o = {
      roles: {},
      invariants: [
        { name: "o", kind: "role-capability", role: "ghost",
          require: { canExecute: "empty" } }
      ],
    };
    const r = checkInvariants({}, o);
    expect(r.violations[0].details.reason).toBe("role_not_found");
  });
});

describe("kind: referential", () => {
  const ontology = {
    entities: { Bid: {}, Listing: {} },
    invariants: [
      { name: "bid_listing_fk", kind: "referential",
        from: "Bid.listingId", to: "Listing.id" }
    ],
  };

  it("проходит при валидных FK", () => {
    const world = {
      bids:     [{ id: "b1", listingId: "L1" }],
      listings: [{ id: "L1" }],
    };
    expect(checkInvariants(world, ontology).ok).toBe(true);
  });

  it("ловит dangling reference", () => {
    const world = {
      bids:     [{ id: "b1", listingId: "L_GONE" }],
      listings: [{ id: "L1" }],
    };
    const r = checkInvariants(world, ontology);
    expect(r.ok).toBe(false);
    expect(r.violations[0].details.fromId).toBe("b1");
    expect(r.violations[0].details.danglingValue).toBe("L_GONE");
  });

  it("несколько нарушений — каждое отдельный violation", () => {
    const world = {
      bids:     [{ id: "b1", listingId: "X" }, { id: "b2", listingId: "Y" }],
      listings: [],
    };
    const r = checkInvariants(world, ontology);
    expect(r.violations.length).toBe(2);
  });

  it("allowNull:true — null FK пропускает", () => {
    const ont = {
      ...ontology,
      invariants: [{ ...ontology.invariants[0], allowNull: true }],
    };
    const world = { bids: [{ id: "b1", listingId: null }], listings: [] };
    expect(checkInvariants(world, ont).ok).toBe(true);
  });

  it("allowNull:false (default) — null тоже нарушение", () => {
    const world = { bids: [{ id: "b1", listingId: null }], listings: [] };
    expect(checkInvariants(world, ontology).ok).toBe(false);
  });

  it("пустая from-коллекция — ok", () => {
    const world = { bids: [], listings: [] };
    expect(checkInvariants(world, ontology).ok).toBe(true);
  });
});

describe("kind: transition", () => {
  const ontology = {
    invariants: [
      { name: "order_status", kind: "transition",
        entity: "Order", field: "status",
        order: ["created","paid","shipped","delivered"] }
    ],
  };

  it("проходит если текущий статус в order", () => {
    const world = { orders: [{ id: "o1", status: "paid" }] };
    expect(checkInvariants(world, ontology).ok).toBe(true);
  });

  it("ловит статус не из допустимого набора", () => {
    const world = { orders: [{ id: "o1", status: "frozen" }] };
    const r = checkInvariants(world, ontology);
    expect(r.ok).toBe(false);
    expect(r.violations[0].details.currentValue).toBe("frozen");
  });

  it("с историей: проходит monotonic forward", () => {
    const world = { orders: [{ id: "o1", status: "shipped" }] };
    const opts = { history: { "o1.status": ["created", "paid", "shipped"] } };
    expect(checkInvariants(world, ontology, opts).ok).toBe(true);
  });

  it("с историей: ловит backward transition", () => {
    const world = { orders: [{ id: "o1", status: "paid" }] };
    const opts = { history: { "o1.status": ["created", "shipped", "paid"] } };
    const r = checkInvariants(world, ontology, opts);
    expect(r.ok).toBe(false);
    expect(r.violations[0].details.from).toBe("shipped");
    expect(r.violations[0].details.to).toBe("paid");
  });

  it("explicit transitions[]: разрешены только объявленные пары", () => {
    const ont = {
      invariants: [
        { name: "t", kind: "transition", entity: "Order", field: "status",
          transitions: [["created","paid"], ["paid","shipped"]] }
      ],
    };
    const world = { orders: [{ id: "o1", status: "shipped" }] };
    const opts = { history: { "o1.status": ["created", "shipped"] } };
    const r = checkInvariants(world, ont, opts);
    expect(r.ok).toBe(false);
    expect(r.violations[0].details.from).toBe("created");
  });

  it("повтор того же статуса допустим", () => {
    const world = { orders: [{ id: "o1", status: "paid" }] };
    const opts = { history: { "o1.status": ["created", "paid", "paid"] } };
    expect(checkInvariants(world, ontology, opts).ok).toBe(true);
  });
});

describe("kind: cardinality", () => {
  it("max:1 groupBy userId — ловит дублирование", () => {
    const ontology = {
      invariants: [
        { name: "single_active", kind: "cardinality",
          entity: "Portfolio", where: { status: "active" },
          groupBy: "userId", max: 1 }
      ],
    };
    const world = { portfolios: [
      { id: "p1", userId: "u1", status: "active" },
      { id: "p2", userId: "u1", status: "active" },
      { id: "p3", userId: "u1", status: "archived" },
    ]};
    const r = checkInvariants(world, ontology);
    expect(r.ok).toBe(false);
    expect(r.violations[0].details.group).toBe("u1");
    expect(r.violations[0].details.count).toBe(2);
  });

  it("max:1 без groupBy — по всей коллекции", () => {
    const ontology = {
      invariants: [
        { name: "one", kind: "cardinality", entity: "Portfolio", max: 1 }
      ],
    };
    const world = { portfolios: [{ id: "p1" }, { id: "p2" }] };
    expect(checkInvariants(world, ontology).ok).toBe(false);
  });

  it("min:1 не ловит пустые группы (только населённые)", () => {
    const ontology = {
      invariants: [
        { name: "m", kind: "cardinality", entity: "Portfolio",
          groupBy: "userId", min: 1 }
      ],
    };
    const world = { portfolios: [{ id: "p1", userId: "u1" }] };
    expect(checkInvariants(world, ontology).ok).toBe(true);
  });

  it("where-фильтр применяется до groupBy", () => {
    const ontology = {
      invariants: [
        { name: "m", kind: "cardinality", entity: "Portfolio",
          where: { status: "active" }, groupBy: "userId", max: 1 }
      ],
    };
    const world = { portfolios: [
      { id: "p1", userId: "u1", status: "active" },
      { id: "p2", userId: "u1", status: "archived" },
    ]};
    expect(checkInvariants(world, ontology).ok).toBe(true);
  });
});

describe("kind: aggregate", () => {
  const ontology = {
    invariants: [
      { name: "portfolio_value_sum", kind: "aggregate",
        op: "sum", from: "Position.value",
        where: { portfolioId: "$target.id" },
        target: "Portfolio.totalValue",
        tolerance: 0.01, severity: "warning" }
    ],
  };

  it("sum совпадает — ok", () => {
    const world = {
      portfolios: [{ id: "p1", totalValue: 300 }],
      positions:  [{ id: "x", portfolioId: "p1", value: 100 },
                   { id: "y", portfolioId: "p1", value: 200 }],
    };
    expect(checkInvariants(world, ontology).ok).toBe(true);
  });

  it("sum не совпадает — violation warning", () => {
    const world = {
      portfolios: [{ id: "p1", totalValue: 250 }],
      positions:  [{ id: "x", portfolioId: "p1", value: 100 },
                   { id: "y", portfolioId: "p1", value: 200 }],
    };
    const r = checkInvariants(world, ontology);
    expect(r.ok).toBe(true);
    expect(r.violations.length).toBe(1);
    expect(r.violations[0].severity).toBe("warning");
    expect(r.violations[0].details.computed).toBe(300);
    expect(r.violations[0].details.expected).toBe(250);
  });

  it("tolerance поглощает малую дельту", () => {
    const world = {
      portfolios: [{ id: "p1", totalValue: 300.005 }],
      positions:  [{ id: "x", portfolioId: "p1", value: 300 }],
    };
    expect(checkInvariants(world, ontology).ok).toBe(true);
  });

  it("op:count считает строки", () => {
    const ont = {
      invariants: [
        { name: "c", kind: "aggregate", op: "count",
          from: "Position.id", where: { portfolioId: "$target.id" },
          target: "Portfolio.positionCount", tolerance: 0 }
      ],
    };
    const world = {
      portfolios: [{ id: "p1", positionCount: 2 }],
      positions:  [{ id: "x", portfolioId: "p1" }, { id: "y", portfolioId: "p1" }],
    };
    expect(checkInvariants(world, ont).ok).toBe(true);
  });
});
