/**
 * Freelance Rules Engine (Cycle 2) — 2 правила:
 *   auto_accept_after_3d (schedule) — auto-accept через 72h после submit_work_result,
 *     warn customer'а @48h, revoke при accept/revision/cancel.
 *   recalc_rating (aggregation) — weighted avg rating по Review с учётом давности.
 * Остальные rules (recalc_level, quota_free_responses) — Cycle 3-4.
 */
export const RULES = [
  {
    id: "auto_accept_after_3d",
    extension: "schedule",
    trigger: "submit_work_result",
    after: "72h",
    warnAt: "48h",
    revokeOn: ["accept_result", "request_revision", "cancel_deal_mutual"],
    fireIntent: "auto_accept_result",
    params: { id: "$.id" },
    description: "Auto-accept через 72h если customer не среагировал на сдачу работы",
  },

  {
    id: "recalc_rating",
    extension: "aggregation",
    trigger: "leave_review",
    target: "ExecutorProfile.rating",
    formula: {
      op: "weightedAvg",
      of: "Review.rating",
      where: { role: "customer" },
      groupBy: "targetUserId",
      weights: {
        byRecency: { halfLife: "180d" },
      },
    },
    description: "Взвешенное среднее рейтинг исполнителя — свежие отзывы весят больше",
  },
];
