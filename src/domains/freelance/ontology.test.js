import { describe, it, expect } from "vitest";
import { ONTOLOGY } from "./ontology.js";

describe("freelance ontology — entities", () => {
  const EXPECTED = [
    "User", "CustomerProfile", "ExecutorProfile",
    "Skill", "ExecutorSkill", "Category", "Task", "Response",
    "Deal", "Wallet", "Transaction", "Review",
  ];

  it("содержит 12 сущностей в Cycle 2 (8 Cycle 1 + 4 escrow)", () => {
    for (const e of EXPECTED) {
      expect(ONTOLOGY.entities[e], `entity ${e}`).toBeDefined();
    }
    expect(Object.keys(ONTOLOGY.entities)).toHaveLength(EXPECTED.length);
  });

  it("User имеет флаги universal-role — customerVerified / executorVerified", () => {
    expect(ONTOLOGY.entities.User.fields.customerVerified).toBeDefined();
    expect(ONTOLOGY.entities.User.fields.executorVerified).toBeDefined();
  });

  it("CustomerProfile.ownerField === 'userId'", () => {
    expect(ONTOLOGY.entities.CustomerProfile.ownerField).toBe("userId");
  });

  it("ExecutorProfile.ownerField === 'userId' и имеет bio/rating/level", () => {
    expect(ONTOLOGY.entities.ExecutorProfile.ownerField).toBe("userId");
    const fields = ONTOLOGY.entities.ExecutorProfile.fields;
    expect(fields.bio).toBeDefined();
    expect(fields.rating).toBeDefined();
    expect(fields.level).toBeDefined();
  });

  it("Skill и Category — kind: 'reference'", () => {
    expect(ONTOLOGY.entities.Skill.kind).toBe("reference");
    expect(ONTOLOGY.entities.Category.kind).toBe("reference");
  });

  it("ExecutorSkill — kind: 'assignment', ownerField: executorId", () => {
    expect(ONTOLOGY.entities.ExecutorSkill.kind).toBe("assignment");
    expect(ONTOLOGY.entities.ExecutorSkill.ownerField).toBe("executorId");
  });

  it("Task.ownerField === 'customerId' и имеет status с 4 значениями draft/moderation/published/closed", () => {
    expect(ONTOLOGY.entities.Task.ownerField).toBe("customerId");
    expect(ONTOLOGY.entities.Task.fields.status.options).toEqual(
      expect.arrayContaining(["draft", "moderation", "published", "closed"])
    );
  });

  it("Response.ownerField === 'executorId' и имеет taskId с FK", () => {
    expect(ONTOLOGY.entities.Response.ownerField).toBe("executorId");
    expect(ONTOLOGY.entities.Response.fields.taskId).toBeDefined();
  });

  it("Deal.ownerField = [customerId, executorId] (R7b multi-owner), имеет taskId, amount, status", () => {
    const d = ONTOLOGY.entities.Deal;
    // R7b: ownerField — массив для multi-owner disjunction
    expect(Array.isArray(d.ownerField)).toBe(true);
    expect(d.ownerField).toEqual(["customerId", "executorId"]);
    expect(d.fields.customerId).toBeDefined();
    expect(d.fields.executorId).toBeDefined();
    expect(d.fields.taskId).toBeDefined();
    expect(d.fields.amount).toBeDefined();
    expect(d.fields.status.options).toEqual(expect.arrayContaining([
      "new", "awaiting_payment", "in_progress", "on_review", "completed", "cancelled",
    ]));
  });

  it("Wallet.ownerField === 'userId', balance/reserved с fieldRole=price (SDK PriceBlock + AntdNumber ₽-префикс)", () => {
    const w = ONTOLOGY.entities.Wallet;
    expect(w.ownerField).toBe("userId");
    // fieldRole="price" — SDK inferFieldRole маппит в role:"price", который
    // buildDetailBody (assignToSlotsDetail §3 PriceBlock) группирует и
    // рендерит через PriceBlock с ₽-суффиксом. "money" в SDK не имеет
    // обработчика — раньше балансы дропались из detail body.
    expect(w.fields.balance.fieldRole).toBe("price");
    expect(w.fields.reserved.fieldRole).toBe("price");
  });

  it("Transaction.ownerField === 'walletId', kind options покрывают 4 типа", () => {
    const t = ONTOLOGY.entities.Transaction;
    expect(t.ownerField).toBe("walletId");
    expect(t.fields.kind.options).toEqual(expect.arrayContaining([
      "topup", "escrow-hold", "release", "commission",
    ]));
    expect(t.fields.status.options).toEqual(expect.arrayContaining([
      "pending", "posted", "reverted",
    ]));
  });

  it("Review.ownerField === 'authorId', role — customer|executor", () => {
    const r = ONTOLOGY.entities.Review;
    expect(r.ownerField).toBe("authorId");
    expect(r.fields.dealId).toBeDefined();
    expect(r.fields.role.options).toEqual(["customer", "executor"]);
    expect(r.fields.rating).toBeDefined();
  });
});

describe("freelance ontology — roles", () => {
  const base = (name) => ONTOLOGY.roles[name]?.base;

  it("customer и executor имеют base: 'owner'", () => {
    expect(base("customer")).toBe("owner");
    expect(base("executor")).toBe("owner");
  });

  it("guest имеет base: 'viewer'", () => {
    expect(base("guest")).toBe("viewer");
  });

  it("customer видит CustomerProfile как own", () => {
    expect(ONTOLOGY.roles.customer.visibleFields.Task).toBeDefined();
    expect(ONTOLOGY.roles.customer.visibleFields.CustomerProfile).toBe("own");
  });

  it("executor видит Response 'own', Task — public fields", () => {
    expect(ONTOLOGY.roles.executor.visibleFields.Response).toBe("own");
    expect(ONTOLOGY.roles.executor.visibleFields.Task).toBeInstanceOf(Array);
  });

  it("guest видит публичные Task и ExecutorProfile — без customerId, без Wallet/Response", () => {
    const guestTask = ONTOLOGY.roles.guest.visibleFields.Task;
    expect(guestTask).toBeInstanceOf(Array);
    expect(guestTask).not.toContain("customerId");
    expect(ONTOLOGY.roles.guest.visibleFields.Wallet).toBeUndefined();
    expect(ONTOLOGY.roles.guest.visibleFields.Response).toBeUndefined();
  });

  it("все 4 роли имеют canExecute массив", () => {
    for (const r of ["customer", "executor", "guest", "agent"]) {
      expect(Array.isArray(ONTOLOGY.roles[r].canExecute)).toBe(true);
    }
  });

  it("agent имеет base: 'agent' (§5 таксономия)", () => {
    expect(base("agent")).toBe("agent");
  });

  it("agent может читать public-каталог и подавать отклики/ревью", () => {
    const a = ONTOLOGY.roles.agent.canExecute;
    // Safe read-intensive
    expect(a).toContain("search_tasks");
    expect(a).toContain("view_wallet_balance");
    expect(a).toContain("view_reviews_for_user");
    // Safe writes
    expect(a).toContain("submit_response");
    expect(a).toContain("leave_review");
  });

  it("agent НЕ может исполнять необратимые escrow-intents без preapproval", () => {
    const a = ONTOLOGY.roles.agent.canExecute;
    // __irr:high должны быть исключены до ревизии с preapproval
    expect(a).not.toContain("confirm_deal");
    expect(a).not.toContain("accept_result");
    // Risky money-moves тоже исключены
    expect(a).not.toContain("top_up_wallet_by_card");
    expect(a).not.toContain("select_executor");
    expect(a).not.toContain("cancel_deal_mutual");
  });

  it("agent видит own Response/Deal/Wallet + public Task/Category/ExecutorProfile", () => {
    const vf = ONTOLOGY.roles.agent.visibleFields;
    expect(vf.Response).toBe("own");
    expect(vf.Deal).toBe("own");
    expect(vf.Wallet).toBe("own");
    expect(vf.User).toBe("own");
    expect(vf.Task).toBeInstanceOf(Array);
    expect(vf.Category).toBeInstanceOf(Array);
    expect(vf.ExecutorProfile).toBeInstanceOf(Array);
  });

  it("customer может инициировать deal/wallet/review intents", () => {
    const customerIntents = ONTOLOGY.roles.customer.canExecute;
    expect(customerIntents).toContain("select_executor");
    expect(customerIntents).toContain("confirm_deal");
    expect(customerIntents).toContain("accept_result");
    expect(customerIntents).toContain("request_revision");
    expect(customerIntents).toContain("cancel_deal_mutual");
    expect(customerIntents).toContain("top_up_wallet_by_card");
    expect(customerIntents).toContain("view_wallet_balance");
    expect(customerIntents).toContain("view_transaction_history");
    expect(customerIntents).toContain("leave_review");
    expect(customerIntents).toContain("reply_to_review");
  });

  it("customer видит Deal / Wallet / Transaction / Review", () => {
    const vf = ONTOLOGY.roles.customer.visibleFields;
    expect(vf.Deal).toBeDefined();
    expect(vf.Wallet).toBeDefined();
    expect(vf.Transaction).toBeDefined();
    expect(vf.Review).toBeDefined();
  });

  it("executor может инициировать deal/wallet/review intents", () => {
    const executorIntents = ONTOLOGY.roles.executor.canExecute;
    expect(executorIntents).toContain("submit_work_result");
    expect(executorIntents).toContain("submit_revision");
    expect(executorIntents).toContain("cancel_deal_mutual");
    expect(executorIntents).toContain("top_up_wallet_by_card");
    expect(executorIntents).toContain("view_wallet_balance");
    expect(executorIntents).toContain("view_transaction_history");
    expect(executorIntents).toContain("leave_review");
    expect(executorIntents).toContain("reply_to_review");
  });

  it("executor видит Deal / Wallet / Transaction / Review", () => {
    const vf = ONTOLOGY.roles.executor.visibleFields;
    expect(vf.Deal).toBeDefined();
    expect(vf.Wallet).toBeDefined();
    expect(vf.Transaction).toBeDefined();
    expect(vf.Review).toBeDefined();
  });
});

describe("freelance ontology — invariants", () => {
  const byName = (n) => ONTOLOGY.invariants.find(i => i.name === n);

  it("содержит 6 invariants (5 enforced + 1 documentary: response_unique_per_executor_task)", () => {
    expect(ONTOLOGY.invariants).toHaveLength(6);
  });

  it("response_unique_per_executor_task — documentary-инвариант (severity:info, реальное enforcement в buildCustomEffects)", () => {
    const inv = ONTOLOGY.invariants.find(i => i.name === "response_unique_per_executor_task");
    expect(inv).toBeDefined();
    expect(inv.kind).toBe("cardinality");
    expect(inv.severity).toBe("info");
    expect(inv.where).toEqual({ status: "pending" });
  });

  it("task_status_transition — transition с 4 whitelist парами", () => {
    const inv = byName("task_status_transition");
    expect(inv).toBeDefined();
    expect(inv.kind).toBe("transition");
    expect(inv.entity).toBe("Task");
    expect(inv.field).toBe("status");
    expect(inv.transitions).toEqual(expect.arrayContaining([
      ["draft", "moderation"],
      ["moderation", "published"],
      ["moderation", "draft"],
      ["published", "closed"],
    ]));
  });

  it("response_references_task — referential FK в SDK-схеме from/to", () => {
    const inv = byName("response_references_task");
    expect(inv).toBeDefined();
    expect(inv.kind).toBe("referential");
    expect(inv.from).toBe("Response.taskId");
    expect(inv.to).toBe("Task.id");
  });

  it("task_has_at_most_one_selected_response — cardinality ≤1 selected", () => {
    const inv = byName("task_has_at_most_one_selected_response");
    expect(inv).toBeDefined();
    expect(inv.kind).toBe("cardinality");
    expect(inv.entity).toBe("Response");
    expect(inv.groupBy).toBe("taskId");
    expect(inv.max).toBe(1);
    expect(inv.where).toEqual({ status: "selected" });
  });

  it("deal_status_transition — transition cycle включая revision_requested", () => {
    const inv = byName("deal_status_transition");
    expect(inv).toBeDefined();
    expect(inv.kind).toBe("transition");
    expect(inv.entity).toBe("Deal");
    expect(inv.field).toBe("status");
    // Revision-cycle: on_review ↔ revision_requested ↔ on_review → completed.
    // `on_review → in_progress` снят — revision проходит через отдельный
    // статус revision_requested, который даёт executor'у и customer'у
    // явный сигнал о фазе.
    expect(inv.transitions).toEqual(expect.arrayContaining([
      ["new", "awaiting_payment"],
      ["awaiting_payment", "in_progress"],
      ["in_progress", "on_review"],
      ["on_review", "completed"],
      ["on_review", "revision_requested"],
      ["revision_requested", "on_review"],
      ["revision_requested", "cancelled"],
      ["new", "cancelled"],
    ]));
  });

  it("wallet_reserved_equals_escrow_sum — aggregate в SDK-схеме op/from/target", () => {
    const inv = byName("wallet_reserved_equals_escrow_sum");
    expect(inv).toBeDefined();
    expect(inv.kind).toBe("aggregate");
    expect(inv.op).toBe("sum");
    expect(inv.from).toBe("Transaction.amount");
    expect(inv.target).toBe("Wallet.reserved");
    expect(inv.where).toMatchObject({ kind: "escrow-hold", status: "posted", walletId: "$target.id" });
  });

  it("severity: shared-collection инварианты переведены в warning", () => {
    // tasks / deals / wallets пересекаются между доменами в общей DB; SDK-handler'ы
    // не фильтруют по domain → transition/aggregate переведены в warning.
    expect(byName("task_status_transition").severity).toBe("warning");
    expect(byName("deal_status_transition").severity).toBe("warning");
    expect(byName("wallet_reserved_equals_escrow_sum").severity).toBe("warning");
    // Freelance-internal остаются error.
    expect(byName("response_references_task").severity).toBe("error");
    expect(byName("task_has_at_most_one_selected_response").severity).toBe("error");
  });
});
