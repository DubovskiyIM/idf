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
    const ontology = { invariants: [{ name: "x", kind: "wtf" }] };
    const result = checkInvariants({}, ontology);
    expect(result.ok).toBe(false);
    expect(result.violations[0].details.reason).toBe("unknown_kind");
  });

  it("severity по умолчанию 'error'", () => {
    const ontology = { invariants: [{ name: "x", kind: "wtf" }] };
    const result = checkInvariants({}, ontology);
    expect(result.violations[0].severity).toBe("error");
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
