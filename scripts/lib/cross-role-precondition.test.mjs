import { describe, it, expect } from "vitest";
import {
  extractPreconditionFieldRefs,
  rolesThatCanExecute,
  isFieldVisibleToRole,
  auditCrossRolePrecondition,
} from "./cross-role-precondition.mjs";

// ────────────────────────────────────────────────────────────────────
// Helpers / parsers
// ────────────────────────────────────────────────────────────────────

describe("extractPreconditionFieldRefs", () => {
  it("вытаскивает refs из object-form { 'Entity.field': [vals] }", () => {
    const refs = extractPreconditionFieldRefs({
      "Workflow.status": ["draft", "active"],
      "Execution.status": ["queued"],
    });
    expect(refs).toEqual([
      { entity: "Workflow", field: "status" },
      { entity: "Execution", field: "status" },
    ]);
  });

  it("вытаскивает refs из string-expression формы", () => {
    const refs = extractPreconditionFieldRefs(
      "Order.status === 'paid' && Invoice.amount > 0"
    );
    expect(refs).toEqual([
      { entity: "Order", field: "status" },
      { entity: "Invoice", field: "amount" },
    ]);
  });

  it("возвращает [] для null / undefined / пустой строки", () => {
    expect(extractPreconditionFieldRefs(null)).toEqual([]);
    expect(extractPreconditionFieldRefs(undefined)).toEqual([]);
    expect(extractPreconditionFieldRefs("")).toEqual([]);
    expect(extractPreconditionFieldRefs({})).toEqual([]);
  });

  it("игнорирует ключи без uppercase entity prefix", () => {
    const refs = extractPreconditionFieldRefs({
      "lowercase.field": ["x"],
      "1Number.field": ["y"],
    });
    expect(refs).toEqual([]);
  });
});

describe("rolesThatCanExecute", () => {
  it("возвращает все роли с intent в canExecute", () => {
    const roles = {
      editor: { canExecute: ["create_x", "update_x"] },
      viewer: { canExecute: ["list_x"] },
      agent: { canExecute: ["create_x"] },
    };
    const out = rolesThatCanExecute("create_x", roles);
    expect(out.map(([n]) => n).sort()).toEqual(["agent", "editor"]);
  });

  it("возвращает [] если никто не может execute", () => {
    const roles = { viewer: { canExecute: ["list_x"] } };
    expect(rolesThatCanExecute("create_x", roles)).toEqual([]);
  });
});

describe("isFieldVisibleToRole", () => {
  it("admin role видит всё (row-override)", () => {
    const role = { base: "admin", visibleFields: {} };
    expect(isFieldVisibleToRole(role, "Workflow", "status")).toBe(true);
  });

  it("wildcard '*' даёт visibility для всех полей entity", () => {
    const role = { visibleFields: { Workflow: ["*"] } };
    expect(isFieldVisibleToRole(role, "Workflow", "status")).toBe(true);
    expect(isFieldVisibleToRole(role, "Workflow", "anything")).toBe(true);
  });

  it("explicit list ограничивает видимость", () => {
    const role = { visibleFields: { Workflow: ["id", "name"] } };
    expect(isFieldVisibleToRole(role, "Workflow", "name")).toBe(true);
    expect(isFieldVisibleToRole(role, "Workflow", "status")).toBe(false);
  });

  it("entity не в visibleFields → невидимо", () => {
    const role = { visibleFields: { Workflow: ["*"] } };
    expect(isFieldVisibleToRole(role, "Credential", "secretRef")).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────
// Integration: full audit
// ────────────────────────────────────────────────────────────────────

function buildDomain({ intents = {}, roles = {}, entities = {} }) {
  return {
    id: "synthetic",
    intents,
    ontology: { roles, entities },
    projections: {},
  };
}

describe("auditCrossRolePrecondition (integration)", () => {
  it("clean domain (precondition refs все видимые) → 0 findings", () => {
    const domain = buildDomain({
      intents: {
        activate: {
          α: "replace",
          target: "Workflow.status",
          precondition: { "Workflow.status": ["draft"] },
        },
      },
      roles: {
        editor: {
          canExecute: ["activate"],
          visibleFields: { Workflow: ["*"] },
        },
      },
      entities: {
        Workflow: { fields: { id: { type: "text" }, status: { type: "select" } } },
      },
    });

    const result = auditCrossRolePrecondition(domain);
    expect(result.findings).toHaveLength(0);
    expect(result.metrics.intentsWithPrecondition).toBe(1);
    expect(result.metrics.preconditionFieldRefs).toBe(1);
  });

  it("ловит H¹-нарушение: agent execute, но не видит precondition-поле", () => {
    const domain = buildDomain({
      intents: {
        run_workflow: {
          α: "create",
          target: "Execution",
          precondition: { "Workflow.status": ["active"] },
        },
      },
      roles: {
        agent: {
          base: "agent",
          canExecute: ["run_workflow"],
          // visibleFields есть, но Workflow.status не в списке — вот баг
          visibleFields: { Workflow: ["id", "name"] },
        },
      },
      entities: {
        Workflow: { fields: { id: {}, name: {}, status: { type: "select" } } },
      },
    });

    const result = auditCrossRolePrecondition(domain);
    expect(result.findings).toHaveLength(1);
    const f = result.findings[0];
    expect(f.severity).toBe("warning");
    expect(f.axis).toBe("crossRolePrecondition");
    expect(f.details).toEqual({
      intentId: "run_workflow",
      role: "agent",
      entity: "Workflow",
      field: "status",
    });
    expect(f.message).toContain("Workflow.status");
  });

  it("ловит несколько ролей одновременно для одного intent", () => {
    const domain = buildDomain({
      intents: {
        x: { precondition: { "Y.f": ["v"] } },
      },
      roles: {
        a: { canExecute: ["x"], visibleFields: { Y: ["other"] } },
        b: { canExecute: ["x"], visibleFields: { Y: ["other"] } },
        c: { canExecute: ["x"], visibleFields: { Y: ["f"] } }, // OK
      },
      entities: { Y: { fields: { f: {}, other: {} } } },
    });

    const result = auditCrossRolePrecondition(domain);
    expect(result.findings).toHaveLength(2);
    const roles = result.findings.map((f) => f.details.role).sort();
    expect(roles).toEqual(["a", "b"]);
  });

  it("admin role не порождает findings (row-override)", () => {
    const domain = buildDomain({
      intents: { x: { precondition: { "Y.f": ["v"] } } },
      roles: {
        admin: { base: "admin", canExecute: ["x"], visibleFields: {} }, // даже пустой visibleFields
      },
      entities: { Y: { fields: { f: {} } } },
    });

    const result = auditCrossRolePrecondition(domain);
    expect(result.findings).toHaveLength(0);
  });

  it("wildcard '*' в visibleFields не порождает findings", () => {
    const domain = buildDomain({
      intents: { x: { precondition: { "Y.f": ["v"] } } },
      roles: {
        any: { canExecute: ["x"], visibleFields: { Y: ["*"] } },
      },
      entities: { Y: { fields: { f: {} } } },
    });

    const result = auditCrossRolePrecondition(domain);
    expect(result.findings).toHaveLength(0);
  });

  it("entity не в онтологии → no finding (другая ось ловит)", () => {
    const domain = buildDomain({
      intents: { x: { precondition: { "Phantom.f": ["v"] } } },
      roles: { a: { canExecute: ["x"], visibleFields: {} } },
      entities: {}, // Phantom не существует
    });

    const result = auditCrossRolePrecondition(domain);
    expect(result.findings).toHaveLength(0);
  });

  it("поле не существует в entity → no finding", () => {
    const domain = buildDomain({
      intents: { x: { precondition: { "Y.ghost": ["v"] } } },
      roles: { a: { canExecute: ["x"], visibleFields: { Y: ["other"] } } },
      entities: { Y: { fields: { other: {} } } }, // ghost не объявлено
    });

    const result = auditCrossRolePrecondition(domain);
    expect(result.findings).toHaveLength(0);
  });

  it("intents без precondition не считаются", () => {
    const domain = buildDomain({
      intents: {
        a: { α: "create" },
        b: { α: "read" },
      },
      roles: { editor: { canExecute: ["a", "b"], visibleFields: {} } },
      entities: {},
    });

    const result = auditCrossRolePrecondition(domain);
    expect(result.metrics.intentsWithPrecondition).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it("string-expression precondition с invisible field тоже ловится", () => {
    const domain = buildDomain({
      intents: {
        finalize: { precondition: "Order.status === 'paid' && Order.total > 0" },
      },
      roles: {
        cashier: {
          canExecute: ["finalize"],
          visibleFields: { Order: ["status"] }, // total не виден
        },
      },
      entities: { Order: { fields: { status: {}, total: {} } } },
    });

    const result = auditCrossRolePrecondition(domain);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].details.field).toBe("total");
  });
});
