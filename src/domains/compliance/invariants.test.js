/**
 * Compliance invariants — trinity SoD + dynamic threshold + cycle-close.
 *
 * Тесты используют `checkInvariants` из @intent-driven/core@0.33+, который
 * dispatch'ит 6 kinds (включая expression с world/viewer/context args).
 */
import { describe, it, expect } from "vitest";
import { checkInvariants } from "@intent-driven/core";
import { ONTOLOGY } from "./ontology.js";

function minWorld(over = {}) {
  return {
    users: [], departments: [], controls: [],
    journalentries: [], approvals: [],
    attestationcycles: [], attestations: [],
    findings: [], evidences: [], amendments: [],
    ...over,
  };
}

// Helper: оставить только expression-инварианты, которые напрямую валидируются
// во всех тестах (role-capability/transition требуют corresponding context).
function runCheck(world) {
  return checkInvariants(world, ONTOLOGY);
}

describe("compliance.invariants — SoD trinity", () => {
  it("SoD reviewer === preparer → violation", () => {
    const world = minWorld({
      journalentries: [{ id: "je1", preparerId: "alice", amount: 50000, status: "approved" }],
      approvals: [
        { id: "ap1", entryId: "je1", role: "reviewer", reviewerId: "alice", verdict: "approved" },
        { id: "ap2", entryId: "je1", role: "approver", approverId: "dan",   verdict: "approved" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.map(v => v.name)).toContain("sod_reviewer_neq_preparer");
  });

  it("SoD reviewer !== preparer → OK", () => {
    const world = minWorld({
      journalentries: [{ id: "je1", preparerId: "alice", amount: 5000, status: "approved" }],
      approvals: [
        { id: "ap1", entryId: "je1", role: "reviewer", reviewerId: "bob", verdict: "approved" },
        { id: "ap2", entryId: "je1", role: "approver", approverId: "dan", verdict: "approved" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.filter(v => v.name === "sod_reviewer_neq_preparer")).toHaveLength(0);
  });

  it("SoD approver === preparer → violation", () => {
    const world = minWorld({
      journalentries: [{ id: "je1", preparerId: "alice", amount: 50000, status: "approved" }],
      approvals: [
        { id: "ap1", entryId: "je1", role: "reviewer", reviewerId: "bob",   verdict: "approved" },
        { id: "ap2", entryId: "je1", role: "approver", approverId: "alice", verdict: "approved" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.map(v => v.name)).toContain("sod_approver_distinct");
  });

  it("SoD approver === reviewer на том же JE → violation", () => {
    const world = minWorld({
      journalentries: [{ id: "je1", preparerId: "alice", amount: 50000, status: "approved" }],
      approvals: [
        { id: "ap1", entryId: "je1", role: "reviewer", reviewerId: "bob", verdict: "approved" },
        { id: "ap2", entryId: "je1", role: "approver", approverId: "bob", verdict: "approved" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.map(v => v.name)).toContain("sod_approver_distinct");
  });

  it("SoD CFO === preparer → violation", () => {
    const world = minWorld({
      journalentries: [{ id: "je1", preparerId: "carol", amount: 150000, status: "approved" }],
      approvals: [
        { id: "ap1", entryId: "je1", role: "reviewer", reviewerId: "bob",   verdict: "approved" },
        { id: "ap2", entryId: "je1", role: "approver", approverId: "dan",   verdict: "approved" },
        { id: "ap3", entryId: "je1", role: "cfo",      approverId: "carol", verdict: "approved" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.map(v => v.name)).toContain("sod_cfo_neq_own_je_preparer");
  });
});

describe("compliance.invariants — dynamic threshold approvals", () => {
  it("< $10k: 1 approver OK", () => {
    const world = minWorld({
      journalentries: [{ id: "je1", preparerId: "alice", amount: 5000, status: "approved" }],
      approvals: [
        { id: "ap1", entryId: "je1", role: "approver", approverId: "dan", verdict: "approved" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.filter(v => v.name === "threshold_approvals_required")).toHaveLength(0);
  });

  it("$50k без reviewer → violation", () => {
    const world = minWorld({
      journalentries: [{ id: "je1", preparerId: "alice", amount: 50000, status: "approved" }],
      approvals: [
        { id: "ap1", entryId: "je1", role: "approver", approverId: "dan", verdict: "approved" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.map(v => v.name)).toContain("threshold_approvals_required");
  });

  it("$50k с reviewer + approver → OK", () => {
    const world = minWorld({
      journalentries: [{ id: "je1", preparerId: "alice", amount: 50000, status: "approved" }],
      approvals: [
        { id: "ap1", entryId: "je1", role: "reviewer", reviewerId: "bob", verdict: "approved" },
        { id: "ap2", entryId: "je1", role: "approver", approverId: "dan", verdict: "approved" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.filter(v => v.name === "threshold_approvals_required")).toHaveLength(0);
  });

  it("$150k без CFO → violation", () => {
    const world = minWorld({
      journalentries: [{ id: "je1", preparerId: "alice", amount: 150000, status: "approved" }],
      approvals: [
        { id: "ap1", entryId: "je1", role: "reviewer", reviewerId: "bob", verdict: "approved" },
        { id: "ap2", entryId: "je1", role: "approver", approverId: "dan", verdict: "approved" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.map(v => v.name)).toContain("threshold_approvals_required");
  });

  it("$150k с reviewer + approver + CFO → OK", () => {
    const world = minWorld({
      journalentries: [{ id: "je1", preparerId: "alice", amount: 150000, status: "approved" }],
      approvals: [
        { id: "ap1", entryId: "je1", role: "reviewer", reviewerId: "bob",   verdict: "approved" },
        { id: "ap2", entryId: "je1", role: "approver", approverId: "dan",   verdict: "approved" },
        { id: "ap3", entryId: "je1", role: "cfo",      approverId: "carol", verdict: "approved" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.filter(v => v.name === "threshold_approvals_required")).toHaveLength(0);
  });
});

describe("compliance.invariants — cycle-close guard", () => {
  it("cycle='closed' но pending attestations → violation", () => {
    const world = minWorld({
      attestationcycles: [{ id: "cy1", status: "closed" }],
      attestations: [
        { id: "a1", cycleId: "cy1", controlId: "ctrl-01", status: "pending" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.map(v => v.name))
      .toContain("cycle_close_requires_no_pending_attestations");
  });

  it("cycle='closed' со всеми confirmed attestations → OK", () => {
    const world = minWorld({
      attestationcycles: [{ id: "cy1", status: "closed" }],
      attestations: [
        { id: "a1", cycleId: "cy1", controlId: "ctrl-01", status: "confirmed" },
        { id: "a2", cycleId: "cy1", controlId: "ctrl-02", status: "confirmed" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.filter(v => v.name === "cycle_close_requires_no_pending_attestations")).toHaveLength(0);
  });
});

describe("compliance.invariants — cardinality", () => {
  it("две active cycle в одном periodEnd → violation", () => {
    const world = minWorld({
      attestationcycles: [
        { id: "cy1", status: "collecting", periodEnd: "2026-12-31T23:59:59Z" },
        { id: "cy2", status: "collecting", periodEnd: "2026-12-31T23:59:59Z" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.map(v => v.name)).toContain("one_active_cycle_per_period");
  });

  it("двойной Attestation на (cycle, control) → violation (composite groupBy)", () => {
    const world = minWorld({
      attestations: [
        { id: "a1", cycleId: "cy1", controlId: "ctrl-01", status: "confirmed" },
        { id: "a2", cycleId: "cy1", controlId: "ctrl-01", status: "pending" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.map(v => v.name)).toContain("one_attestation_per_control_per_cycle");
  });
});

describe("compliance.invariants — referential integrity", () => {
  it("Approval ссылается на несуществующий JE → violation", () => {
    const world = minWorld({
      journalentries: [{ id: "je1", preparerId: "alice", amount: 100, status: "draft" }],
      approvals: [
        { id: "ap1", entryId: "je-ghost", role: "reviewer", reviewerId: "bob", verdict: "approved" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.map(v => v.name)).toContain("approval_references_je");
  });

  it("Attestation ссылается на несуществующий Cycle → violation", () => {
    const world = minWorld({
      attestations: [
        { id: "a1", cycleId: "cy-ghost", controlId: "ctrl-01", status: "pending" },
      ],
    });
    const { violations } = runCheck(world);
    expect(violations.map(v => v.name)).toContain("attestation_references_cycle");
  });
});
