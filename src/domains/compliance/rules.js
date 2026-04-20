/**
 * Compliance Rules Engine — 7 правил, все 4 v1.5 extension'а.
 *
 * Quarterly attestation cycle orchestrated через §4 v1.7 scheduler:
 * 4 schedule-правила покрывают жизненный цикл от T-30 (notify) до T+60
 * (review-close). revokeOn: ["cancel_cycle"] даёт kill-switch.
 */
export const RULES = [
  // ── schedule 1: T-30 дней до periodEnd — уведомить controlOwners.
  {
    id: "notify_control_owners_before_cycle",
    extension: "schedule",
    trigger: "open_cycle",
    before: { field: "periodEnd", days: 30 },
    revokeOn: ["cancel_cycle"],
    fireIntent: "notify_control_owners",
    params: { cycleId: "$.id" },
    description: "T-30: уведомить control-owners о предстоящем cycle",
  },

  // ── schedule 2: T+0 (periodEnd) — open collection phase.
  {
    id: "open_collection_phase",
    extension: "schedule",
    trigger: "open_cycle",
    at: { field: "periodEnd" },
    revokeOn: ["cancel_cycle"],
    fireIntent: "transition_cycle_to_collecting",
    params: { cycleId: "$.id" },
    description: "T+0 (конец периода): cycle → collecting",
  },

  // ── schedule 3: T+30 — close collection, auto-findings for missing.
  {
    id: "close_collection_phase",
    extension: "schedule",
    trigger: "open_cycle",
    after: { field: "periodEnd", days: 30 },
    revokeOn: ["cancel_cycle"],
    fireIntent: "close_collection_and_raise_findings",
    params: { cycleId: "$.id" },
    description: "T+30: cycle → reviewing; pending attestations → Finding (deficiency)",
  },

  // ── schedule 4: T+60 — close review phase.
  {
    id: "close_review_phase",
    extension: "schedule",
    trigger: "open_cycle",
    after: { field: "periodEnd", days: 60 },
    revokeOn: ["cancel_cycle"],
    fireIntent: "close_review_phase_system",
    params: { cycleId: "$.id" },
    description: "T+60: cycle → closed_with_findings или ожидание CFO-signoff",
  },

  // ── condition: auto-raise Finding при submit_attestation с effectiveness=ineffective.
  {
    id: "auto_raise_finding_on_ineffective",
    extension: "condition",
    trigger: "submit_attestation",
    when: "ctx.effectiveness === 'ineffective'",
    fireIntent: "flag_finding",
    params: {
      title: "Auto: ineffective attestation",
      severity: "significant_deficiency",
      relatedAttestationId: "$.id",
    },
    description: "ineffective attestation → Finding severity=significant_deficiency",
  },

  // ── threshold: >50% ineffective в cycle → escalate to CFO review.
  {
    id: "escalate_cycle_on_material_coverage",
    extension: "threshold",
    trigger: "submit_attestation",
    lookback: "current_cycle",
    threshold: { ratio: 0.5, of: "ineffective" },
    fireIntent: "flag_cycle_requires_cfo_review",
    params: { cycleId: "$.cycleId" },
    description: ">50% ineffective в cycle → requiresCfoReview=true",
  },

  // ── aggregation: 3+ findings per control за последние 4 cycles → риск-флаг.
  {
    id: "control_at_risk_flag",
    extension: "aggregation",
    trigger: "flag_finding",
    target: "Control.riskFlag",
    formula: {
      op: "countOverLookback",
      of: "Finding",
      where: { severity: { $in: ["significant_deficiency", "material_weakness"] } },
      groupBy: "relatedAttestation.controlId",
      lookback: { cycles: 4 },
      threshold: 3,
      value: "high",
    },
    description: "3+ серьёзных findings за 4 cycles → Control.riskFlag='high'",
  },
];
