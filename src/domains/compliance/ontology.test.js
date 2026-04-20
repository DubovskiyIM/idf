import { describe, it, expect } from "vitest";
import { ONTOLOGY } from "./ontology.js";

describe("compliance.ontology", () => {
  it("framework tag = SOX-ICFR", () => {
    expect(ONTOLOGY.framework).toBe("SOX-ICFR");
  });

  it("10 сущностей", () => {
    expect(Object.keys(ONTOLOGY.entities)).toHaveLength(10);
    expect(Object.keys(ONTOLOGY.entities).sort()).toEqual([
      "Amendment", "Approval", "Attestation", "AttestationCycle",
      "Control", "Department", "Evidence", "Finding", "JournalEntry", "User",
    ]);
  });

  it("6 ролей, все через role.base", () => {
    const roles = ONTOLOGY.roles;
    expect(Object.keys(roles)).toHaveLength(6);
    for (const [name, def] of Object.entries(roles)) {
      expect(def.base, name).toBeDefined();
      expect(["owner", "agent", "observer", "admin"]).toContain(def.base);
    }
  });

  it("auditor — observer (read-only)", () => {
    expect(ONTOLOGY.roles.auditor.base).toBe("observer");
  });

  it("15 invariants", () => {
    expect(ONTOLOGY.invariants).toHaveLength(15);
  });

  it("≥4 expression-invariants (SoD-triplet + threshold + cycle-close)", () => {
    const expr = ONTOLOGY.invariants.filter(i => i.kind === "expression");
    expect(expr.length).toBeGreaterThanOrEqual(4);
  });

  it("все kinds в invariants покрыты 5-kind-set'ом + expression", () => {
    const kinds = new Set(ONTOLOGY.invariants.map(i => i.kind));
    for (const k of kinds) {
      expect(["role-capability", "referential", "transition", "cardinality", "aggregate", "expression"])
        .toContain(k);
    }
  });

  it("7 rules, все 4 v1.5 extension'а представлены", () => {
    expect(ONTOLOGY.rules).toHaveLength(7);
    const ext = new Set(ONTOLOGY.rules.map(r => r.extension));
    for (const e of ["schedule", "condition", "threshold", "aggregation"]) {
      expect(ext.has(e), e).toBe(true);
    }
  });

  it("ownerField корректен у owned-entities", () => {
    expect(ONTOLOGY.entities.JournalEntry.ownerField).toBe("preparerId");
    expect(ONTOLOGY.entities.Attestation.ownerField).toBe("controlOwnerId");
    expect(ONTOLOGY.entities.Control.ownerField).toBe("controlOwnerId");
    expect(ONTOLOGY.entities.Evidence.ownerField).toBe("attachedById");
    expect(ONTOLOGY.entities.Amendment.ownerField).toBe("authorId");
    expect(ONTOLOGY.entities.Finding.ownerField).toBe("openedById");
  });

  it("Department — reference-kind (читаем из справочника)", () => {
    expect(ONTOLOGY.entities.Department.kind).toBe("reference");
  });
});
