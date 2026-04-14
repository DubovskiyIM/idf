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
