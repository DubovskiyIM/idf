import { describe, it, expect } from "vitest";
import { INTENTS } from "./intents.js";

describe("compliance.intents", () => {
  it("объявлено ~38 intents", () => {
    const n = Object.keys(INTENTS).length;
    expect(n).toBeGreaterThanOrEqual(35);
    expect(n).toBeLessThanOrEqual(42);
  });

  it("каждый intent имеет particles.effects (может быть пустым)", () => {
    for (const [name, intent] of Object.entries(INTENTS)) {
      expect(intent.particles, name).toBeDefined();
      expect(Array.isArray(intent.particles.effects), name).toBe(true);
    }
  });

  it("каждый intent имеет irreversibility", () => {
    for (const [name, intent] of Object.entries(INTENTS)) {
      expect(["low", "medium", "high"], name).toContain(intent.irreversibility);
    }
  });

  it("intents с irreversibility:'high' — явные SOX-moments", () => {
    const irr = Object.entries(INTENTS)
      .filter(([, i]) => i.irreversibility === "high")
      .map(([n]) => n)
      .sort();
    expect(irr).toEqual([
      "amend_attestation",
      "approve_journal_entry",
      "file_amendment",
      "sign_off_cycle_404",
      "submit_attestation",
    ]);
  });

  it("все intent'ы с 'creates' — рефы на known entities", () => {
    const known = [
      "Control", "JournalEntry", "Approval", "AttestationCycle",
      "Attestation", "Finding", "Evidence", "Amendment",
    ];
    for (const [name, intent] of Object.entries(INTENTS)) {
      if (intent.creates) {
        expect(known, name).toContain(intent.creates);
      }
    }
  });
});
