import { describe, it, expect } from "vitest";
import {
  BASE_ROLES,
  validateBase,
  getRolesByBase,
  isAgentRole,
  isObserverRole,
  isOwnerRole,
  auditOntologyRoles,
} from "./baseRoles.cjs";

describe("baseRoles vocabulary", () => {
  it("exposes four canonical base roles", () => {
    expect(BASE_ROLES).toEqual(["owner", "viewer", "agent", "observer"]);
  });

  it("BASE_ROLES is frozen (immutable)", () => {
    expect(Object.isFrozen(BASE_ROLES)).toBe(true);
  });
});

describe("validateBase", () => {
  it("accepts owner/viewer/agent/observer", () => {
    for (const base of BASE_ROLES) {
      expect(validateBase({ base }).ok).toBe(true);
    }
  });

  it("rejects unknown base", () => {
    const r = validateBase({ base: "moderator" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("base_invalid");
    expect(r.got).toBe("moderator");
    expect(r.allowed).toEqual(BASE_ROLES);
  });

  it("rejects missing base", () => {
    const r = validateBase({ canExecute: [] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("base_missing");
  });

  it("rejects non-object", () => {
    expect(validateBase(null).ok).toBe(false);
    expect(validateBase("owner").ok).toBe(false);
  });
});

describe("getRolesByBase", () => {
  const ontology = {
    roles: {
      investor: { base: "owner", canExecute: [] },
      advisor:  { base: "owner", canExecute: [] },
      agent:    { base: "agent", canExecute: ["x"] },
      observer: { base: "observer", canExecute: [] },
      legacy:   { canExecute: [] }, // без base
    },
  };

  it("возвращает домен-роли с указанным base", () => {
    expect(getRolesByBase(ontology, "owner").sort()).toEqual(["advisor", "investor"]);
    expect(getRolesByBase(ontology, "agent")).toEqual(["agent"]);
    expect(getRolesByBase(ontology, "observer")).toEqual(["observer"]);
    expect(getRolesByBase(ontology, "viewer")).toEqual([]);
  });

  it("игнорирует роли без base", () => {
    const all = [...getRolesByBase(ontology, "owner"), ...getRolesByBase(ontology, "agent"),
                  ...getRolesByBase(ontology, "observer"), ...getRolesByBase(ontology, "viewer")];
    expect(all).not.toContain("legacy");
  });

  it("пустой ontology → []", () => {
    expect(getRolesByBase({}, "owner")).toEqual([]);
    expect(getRolesByBase(null, "owner")).toEqual([]);
  });
});

describe("semantic helpers", () => {
  it("isAgentRole true для base:'agent'", () => {
    expect(isAgentRole({ base: "agent" })).toBe(true);
    expect(isAgentRole({ base: "owner" })).toBe(false);
  });

  it("isObserverRole требует пустой canExecute", () => {
    expect(isObserverRole({ base: "observer", canExecute: [] })).toBe(true);
    expect(isObserverRole({ base: "observer" })).toBe(true); // отсутствующий тоже OK
    expect(isObserverRole({ base: "observer", canExecute: ["x"] })).toBe(false);
  });

  it("isOwnerRole true для base:'owner'", () => {
    expect(isOwnerRole({ base: "owner" })).toBe(true);
    expect(isOwnerRole({ base: "agent" })).toBe(false);
  });
});

describe("auditOntologyRoles", () => {
  it("ок для valid онтологии", () => {
    const onto = { roles: { x: { base: "owner" }, y: { base: "agent", canExecute: ["a"] } } };
    const r = auditOntologyRoles(onto);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("ловит missing base", () => {
    const onto = { roles: { x: {} } };
    const r = auditOntologyRoles(onto);
    expect(r.ok).toBe(false);
    expect(r.errors[0].role).toBe("x");
    expect(r.errors[0].reason).toBe("base_missing");
  });

  it("ловит observer с canExecute — инвариант нарушен", () => {
    const onto = { roles: { o: { base: "observer", canExecute: ["write_x"] } } };
    const r = auditOntologyRoles(onto);
    expect(r.ok).toBe(false);
    expect(r.errors[0].reason).toBe("observer_has_canExecute");
  });
});

// ───────────────────────────────────────────────────────────
// Cross-domain integration: все 8 доменов должны иметь valid base
// ───────────────────────────────────────────────────────────

describe("все 8 доменов аннотированы", async () => {
  // Собираем все онтологии в одном месте для валидации
  const domains = [
    ["booking",   (await import("../../src/domains/booking/ontology.js")).ONTOLOGY],
    ["planning",  (await import("../../src/domains/planning/ontology.js")).ONTOLOGY],
    ["workflow",  (await import("../../src/domains/workflow/ontology.js")).ONTOLOGY],
    ["messenger", (await import("../../src/domains/messenger/ontology.js")).ONTOLOGY],
    ["sales",    (await import("../../src/domains/sales/ontology.js")).ONTOLOGY],
    ["lifequest", (await import("../../src/domains/lifequest/ontology.js")).ONTOLOGY],
    ["reflect",   (await import("../../src/domains/reflect/ontology.js")).ONTOLOGY],
    ["invest",    (await import("../../src/domains/invest/ontology.js")).ONTOLOGY],
  ];

  for (const [name, ontology] of domains) {
    it(`${name}: все роли имеют valid base`, () => {
      const r = auditOntologyRoles(ontology);
      if (!r.ok) {
        console.error(`${name}:`, JSON.stringify(r.errors, null, 2));
      }
      expect(r.ok).toBe(true);
    });
  }

  it("каждый домен имеет хотя бы одну agent-роль (для §17 agent layer)", () => {
    for (const [name, ontology] of domains) {
      const agents = getRolesByBase(ontology, "agent");
      expect(agents.length, `${name}: нет agent-роли`).toBeGreaterThan(0);
    }
  });

  it("invest — единственный домен с observer-ролью", () => {
    const withObserver = domains.filter(([, o]) => getRolesByBase(o, "observer").length > 0);
    expect(withObserver.map(([n]) => n)).toEqual(["invest"]);
  });

  it("распределение baseRoles по доменам — консистентно", () => {
    const summary = {};
    for (const [name, ontology] of domains) {
      summary[name] = {};
      for (const base of BASE_ROLES) {
        const roles = getRolesByBase(ontology, base);
        if (roles.length > 0) summary[name][base] = roles;
      }
    }
    // Snapshot ожиданий v1.6 для CI-визуализации
    expect(summary.booking).toEqual({ owner: ["client", "specialist"], agent: ["agent"] });
    expect(summary.messenger).toEqual({ owner: ["self"], viewer: ["contact"], agent: ["agent"] });
    expect(summary.invest).toEqual({
      owner: ["investor", "advisor"],
      agent: ["agent"],
      observer: ["observer"],
    });
    expect(summary.sales).toEqual({
      owner: ["buyer", "seller"],
      agent: ["moderator", "agent"],
    });
  });
});
