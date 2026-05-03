/**
 * Тесты для selectRelevantInvariants — фильтрация инвариантов под конкретный
 * intent. Fixtures построены по образцу реальных freelance/compliance
 * онтологий, чтобы поведение сразу соответствовало production-доменам.
 */

import { describe, it, expect } from "vitest";
import { selectRelevantInvariants, _internals } from "./selectInvariants.cjs";

const ONTOLOGY = {
  entities: {
    Task: { ownerField: "customerId" },
    Response: { ownerField: "executorId" },
    Deal: {},
    Wallet: {},
    Transaction: {},
    JournalEntry: {},
    Approval: {},
  },
  invariants: [
    {
      name: "task_status_transition",
      kind: "transition",
      entity: "Task",
      field: "status",
      transitions: [["draft", "moderation"], ["moderation", "published"]],
      severity: "warning",
    },
    {
      name: "response_references_task",
      kind: "referential",
      from: "Response.taskId",
      to: "Task.id",
      severity: "error",
    },
    {
      name: "task_has_at_most_one_selected_response",
      kind: "cardinality",
      entity: "Response",
      groupBy: "taskId",
      max: 1,
      where: { status: "selected" },
      severity: "error",
    },
    {
      name: "deal_status_transition",
      kind: "transition",
      entity: "Deal",
      field: "status",
      transitions: [["new", "in_progress"], ["in_progress", "completed"]],
      severity: "warning",
    },
    {
      name: "wallet_reserved_equals_escrow_sum",
      kind: "aggregate",
      op: "sum",
      from: "Transaction.amount",
      where: { kind: "escrow-hold", status: "posted", walletId: "$target.id" },
      target: "Wallet.reserved",
      severity: "warning",
    },
    {
      name: "auditor_read_only_je",
      kind: "expression",
      entity: "JournalEntry",
      predicate: () => true,
      message: "auditor cannot mutate JE",
      severity: "warning",
    },
    {
      name: "cfo_can_sign_off",
      kind: "role-capability",
      role: "cfo",
      require: { canExecute: "non-empty" },
      severity: "error",
    },
  ],
};

describe("selectRelevantInvariants — pure filtering", () => {
  it("создание Response: relevant referential + (writable cardinality on Response)", () => {
    const intent = {
      creates: "Response",
      particles: {
        effects: [{ alpha: "add", target: "Response" }],
      },
    };
    const result = selectRelevantInvariants(intent, ONTOLOGY);
    const names = result.map(i => i.name).sort();
    expect(names).toContain("response_references_task");
    expect(names).toContain("task_has_at_most_one_selected_response");
    // не должно быть transition (нет replace) и Wallet/JE-инвариантов
    expect(names).not.toContain("task_status_transition");
    expect(names).not.toContain("deal_status_transition");
    expect(names).not.toContain("wallet_reserved_equals_escrow_sum");
  });

  it("replace Deal.status: relevant transition Deal", () => {
    const intent = {
      particles: {
        effects: [{ alpha: "replace", target: "Deal.status" }],
      },
    };
    const result = selectRelevantInvariants(intent, ONTOLOGY);
    const names = result.map(i => i.name);
    expect(names).toContain("deal_status_transition");
    expect(names).not.toContain("task_status_transition");
    expect(names).not.toContain("response_references_task"); // referential нерелевантен на replace без add
  });

  it("create Transaction: aggregate Wallet.reserved (через from-entity)", () => {
    const intent = {
      particles: {
        effects: [{ alpha: "add", target: "Transaction" }],
      },
    };
    const result = selectRelevantInvariants(intent, ONTOLOGY);
    const names = result.map(i => i.name);
    expect(names).toContain("wallet_reserved_equals_escrow_sum");
  });

  it("update JournalEntry: relevant expression", () => {
    const intent = {
      particles: {
        effects: [{ alpha: "replace", target: "JournalEntry.amount" }],
      },
    };
    const result = selectRelevantInvariants(intent, ONTOLOGY);
    const names = result.map(i => i.name);
    expect(names).toContain("auditor_read_only_je");
  });

  it("role-capability никогда не возвращается через этот канал", () => {
    const intent = {
      particles: {
        effects: [{ alpha: "add", target: "JournalEntry" }],
      },
    };
    const result = selectRelevantInvariants(intent, ONTOLOGY);
    expect(result.map(i => i.name)).not.toContain("cfo_can_sign_off");
  });

  it("intent без effects → пустой массив (нечего нарушать)", () => {
    const intent = { particles: {} };
    expect(selectRelevantInvariants(intent, ONTOLOGY)).toEqual([]);
  });

  it("онтология без invariants → пустой массив", () => {
    const intent = {
      particles: { effects: [{ alpha: "add", target: "Task" }] },
    };
    expect(selectRelevantInvariants(intent, { entities: {} })).toEqual([]);
  });

  it("greek alpha (α) вместо alpha — поддерживается", () => {
    const intent = {
      particles: { effects: [{ α: "replace", target: "Deal.status" }] },
    };
    const result = selectRelevantInvariants(intent, ONTOLOGY);
    expect(result.map(i => i.name)).toContain("deal_status_transition");
  });

  it("collection-form target (responses) резолвится в Response", () => {
    const intent = {
      particles: { effects: [{ alpha: "add", target: "responses" }] },
    };
    const result = selectRelevantInvariants(intent, ONTOLOGY);
    expect(result.map(i => i.name)).toContain("response_references_task");
  });

  it("transition: НЕ relevant если replace на другой field той же entity", () => {
    // Intent делает replace на Deal.paidAt, не на Deal.status — transition
    // invariant на field=status НЕ должен сработать.
    const ontologyWithPaidAt = {
      ...ONTOLOGY,
      entities: { ...ONTOLOGY.entities, Deal: { fields: { paidAt: { type: "datetime" } } } },
    };
    const intent = {
      particles: { effects: [{ alpha: "replace", target: "Deal.paidAt" }] },
    };
    const result = selectRelevantInvariants(intent, ontologyWithPaidAt);
    expect(result.map(i => i.name)).not.toContain("deal_status_transition");
  });

  it("transition: relevant ровно для replace на entity.field инварианта", () => {
    const intent = {
      particles: { effects: [{ alpha: "replace", target: "Deal.status" }] },
    };
    const result = selectRelevantInvariants(intent, ONTOLOGY);
    expect(result.map(i => i.name)).toContain("deal_status_transition");
  });
});

describe("normalizeForAgent — output shape", () => {
  it("transition: summary человекочитаемый", () => {
    const intent = {
      particles: { effects: [{ alpha: "replace", target: "Deal.status" }] },
    };
    const [inv] = selectRelevantInvariants(intent, ONTOLOGY);
    expect(inv.kind).toBe("transition");
    expect(inv.entity).toBe("Deal");
    expect(inv.severity).toBe("warning");
    expect(inv.summary).toContain("new→in_progress");
    expect(inv.summary).toContain("in_progress→completed");
  });

  it("referential: summary показывает FK", () => {
    const intent = {
      creates: "Response",
      particles: { effects: [{ alpha: "add", target: "Response" }] },
    };
    const result = selectRelevantInvariants(intent, ONTOLOGY);
    const ref = result.find(i => i.kind === "referential");
    expect(ref.summary).toBe("Response.taskId must reference existing Task.id");
  });

  it("cardinality: summary показывает groupBy+where+max", () => {
    const intent = {
      creates: "Response",
      particles: { effects: [{ alpha: "add", target: "Response" }] },
    };
    const result = selectRelevantInvariants(intent, ONTOLOGY);
    const card = result.find(i => i.kind === "cardinality");
    expect(card.summary).toContain("Response");
    expect(card.summary).toContain("max 1");
    expect(card.summary).toContain("per taskId");
    expect(card.summary).toContain('status="selected"');
  });

  it("aggregate: summary показывает op + target = sum(from)", () => {
    const intent = {
      particles: { effects: [{ alpha: "add", target: "Transaction" }] },
    };
    const result = selectRelevantInvariants(intent, ONTOLOGY);
    const agg = result.find(i => i.kind === "aggregate");
    expect(agg.summary).toContain("Wallet.reserved");
    expect(agg.summary).toContain("sum(Transaction.amount)");
  });

  it("expression: summary использует message", () => {
    const intent = {
      particles: { effects: [{ alpha: "replace", target: "JournalEntry.amount" }] },
    };
    const result = selectRelevantInvariants(intent, ONTOLOGY);
    const expr = result.find(i => i.kind === "expression");
    expect(expr.summary).toBe("auditor cannot mutate JE");
  });
});

describe("internals", () => {
  it("resolveEntityName: case-insensitive + plural form", () => {
    const { resolveEntityName } = _internals;
    expect(resolveEntityName("Deal", ONTOLOGY)).toBe("Deal");
    expect(resolveEntityName("deal", ONTOLOGY)).toBe("Deal");
    expect(resolveEntityName("deals", ONTOLOGY)).toBe("Deal");
    expect(resolveEntityName("unknown", ONTOLOGY)).toBe(null);
  });

  it("collectAlphas: нормализует create→add, update→replace, delete→remove", () => {
    const { collectAlphas } = _internals;
    const intent = {
      particles: {
        effects: [
          { alpha: "create", target: "Task" },
          { alpha: "update", target: "Task.status" },
          { alpha: "delete", target: "Task" },
        ],
      },
    };
    const alphas = collectAlphas(intent);
    expect(alphas.has("add")).toBe(true);
    expect(alphas.has("replace")).toBe(true);
    expect(alphas.has("remove")).toBe(true);
  });
});
