import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { evaluateGenericRequires, evaluateRequire } = require("./genericTriggerEvaluator.cjs");

const ONTOLOGY = {
  entities: {
    Issue: {
      kind: "internal",
      fields: {
        id: { type: "text", fieldRole: "id" },
        title: { type: "text", fieldRole: "primary" },
        status: { type: "select", options: ["open", "closed", "done"], fieldRole: "status" },
        date: { type: "datetime", fieldRole: "date" },
      },
    },
    Block: {
      kind: "polymorphic",
      fields: { kind: { type: "text" } },
    },
    Tag: {
      kind: "reference",
      fields: { name: { type: "text" } },
    },
    IssueComment: {
      kind: "internal",
      fields: {
        id: { type: "text", fieldRole: "id" },
        issueId: { type: "entityRef", entity: "Issue" },
        body: { type: "textarea" },
      },
    },
  },
  roles: {
    customer: { base: "owner" },
    admin: { base: "admin" },
  },
};

const PROJECTION = {
  id: "issue-detail",
  archetype: "detail",
  mainEntity: "Issue",
  forRoles: ["customer"],
};

const INTENTS = [
  {
    id: "create_issue",
    α: "create",
    target: "Issue",
    confirmation: "form",
    particles: { effects: [{ α: "create", target: "Issue" }] },
  },
  {
    id: "close_issue",
    α: "replace",
    target: "Issue.status",
    confirmation: "click",
    particles: { effects: [{ α: "replace", target: "Issue.status" }] },
  },
  {
    id: "add_comment",
    α: "create",
    target: "IssueComment",
    confirmation: "enter",
    particles: { effects: [{ α: "create", target: "IssueComment" }] },
  },
];

const ctx = { intents: INTENTS, ontology: ONTOLOGY, projection: PROJECTION };

describe("evaluateRequire — entity-field", () => {
  it("точное entity+field → ok", () => {
    expect(evaluateRequire({ kind: "entity-field", entity: "Issue", field: "status" }, ctx).ok).toBe(true);
  });
  it("несуществующий field → false", () => {
    expect(evaluateRequire({ kind: "entity-field", entity: "Issue", field: "missing" }, ctx).ok).toBe(false);
  });
  it("placeholder entity → resolve в mainEntity", () => {
    expect(evaluateRequire({ kind: "entity-field", entity: "<view-entity>", field: "title" }, ctx).ok).toBe(true);
  });
  it("по fieldRole", () => {
    expect(evaluateRequire({ kind: "entity-field", entity: "Issue", fieldRole: "primary" }, ctx).ok).toBe(true);
  });
  it("hasValue match через select.options", () => {
    expect(evaluateRequire({ kind: "entity-field", entity: "Issue", field: "status", hasValue: "done" }, ctx).ok).toBe(true);
  });
  it("regex pattern", () => {
    expect(evaluateRequire({ kind: "entity-field", entity: "Issue", pattern: "^date$" }, ctx).ok).toBe(true);
  });
});

describe("evaluateRequire — entity-kind", () => {
  it("Issue.kind === internal", () => {
    expect(evaluateRequire({ kind: "entity-kind", entity: "Issue", "kind-value": "internal" }, ctx).ok).toBe(true);
  });
  it("Block.kind === polymorphic (alias kind_value)", () => {
    expect(evaluateRequire({ kind: "entity-kind", entity: "Block", kind_value: "polymorphic" }, ctx).ok).toBe(true);
  });
  it("entity отсутствует, ищет любую с kind=reference", () => {
    expect(evaluateRequire({ kind: "entity-kind", "kind-value": "reference" }, ctx).ok).toBe(true);
  });
  it("несуществующий kind → false", () => {
    expect(evaluateRequire({ kind: "entity-kind", entity: "Issue", "kind-value": "polymorphic" }, ctx).ok).toBe(false);
  });
  it("shorthand mirror через handler-alias", () => {
    expect(evaluateRequire({ kind: "mirror" }, ctx).ok).toBe(false);
  });
  it("shorthand polymorphic находит Block", () => {
    expect(evaluateRequire({ kind: "polymorphic" }, ctx).ok).toBe(true);
  });
});

describe("evaluateRequire — field-role-present", () => {
  it("role=date присутствует на Issue", () => {
    expect(evaluateRequire({ kind: "field-role-present", role: "date" }, ctx).ok).toBe(true);
  });
  it("несуществующая role", () => {
    expect(evaluateRequire({ kind: "field-role-present", role: "graphEdge" }, ctx).ok).toBe(false);
  });
});

describe("evaluateRequire — has-role", () => {
  it("role=customer найдена", () => {
    expect(evaluateRequire({ kind: "has-role", role: "customer" }, ctx).ok).toBe(true);
  });
  it("base=admin найдена", () => {
    expect(evaluateRequire({ kind: "has-role", base: "admin" }, ctx).ok).toBe(true);
  });
  it("отсутствующая role", () => {
    expect(evaluateRequire({ kind: "has-role", role: "freelancer" }, ctx).ok).toBe(false);
  });
});

describe("evaluateRequire — intent-confirmation", () => {
  it("values=[click] → true (close_issue)", () => {
    expect(evaluateRequire({ kind: "intent-confirmation", values: ["click"] }, ctx).ok).toBe(true);
  });
  it("value=enter → true (add_comment)", () => {
    expect(evaluateRequire({ kind: "intent-confirmation", value: "enter" }, ctx).ok).toBe(true);
  });
  it("value=wizard → false", () => {
    expect(evaluateRequire({ kind: "intent-confirmation", value: "wizard" }, ctx).ok).toBe(false);
  });
});

describe("evaluateRequire — intent-count", () => {
  it("min=2 → ok (3 intents)", () => {
    expect(evaluateRequire({ kind: "intent-count", min: 2 }, ctx).ok).toBe(true);
  });
  it("min=10 → false", () => {
    expect(evaluateRequire({ kind: "intent-count", min: 10 }, ctx).ok).toBe(false);
  });
  it("filter operation=create, min=2 → ok", () => {
    expect(evaluateRequire({ kind: "intent-count", operation: "create", min: 2 }, ctx).ok).toBe(true);
  });
});

describe("evaluateRequire — intent-creates", () => {
  it("creates=Issue → ok", () => {
    expect(evaluateRequire({ kind: "intent-creates", creates: "Issue" }, ctx).ok).toBe(true);
  });
  it("creates=Phantom → false", () => {
    expect(evaluateRequire({ kind: "intent-creates", creates: "Phantom" }, ctx).ok).toBe(false);
  });
  it("placeholder creates → unknown", () => {
    expect(evaluateRequire({ kind: "intent-creates", creates: "*" }, ctx).ok).toBe("unknown");
  });
});

describe("evaluateRequire — intent-effect", () => {
  it("intent name + α=replace + target=Issue.status → ok", () => {
    expect(
      evaluateRequire(
        { kind: "intent-effect", intent: "close_issue", α: "replace", target: "Issue.status" },
        ctx,
      ).ok,
    ).toBe(true);
  });
  it("targetField=status в Issue.status → ok", () => {
    expect(
      evaluateRequire({ kind: "intent-effect", α: "replace", targetField: "status" }, ctx).ok,
    ).toBe(true);
  });
});

describe("evaluateRequire — sub-entity-exists", () => {
  it("IssueComment ссылается на Issue → ok", () => {
    expect(
      evaluateRequire({ kind: "sub-entity-exists", parent: "Issue" }, ctx).ok,
    ).toBe(true);
  });
  it("без parent → берёт mainEntity", () => {
    expect(evaluateRequire({ kind: "sub-entity-exists" }, ctx).ok).toBe(true);
  });
  it("withField=body фильтрует", () => {
    expect(
      evaluateRequire({ kind: "sub-entity-exists", parent: "Issue", withField: "body" }, ctx).ok,
    ).toBe(true);
  });
});

describe("evaluateRequire — unknown kind", () => {
  it("session → unknown (single-case unsupported)", () => {
    expect(evaluateRequire({ kind: "session" }, ctx).ok).toBe("unknown");
  });
  it("полностью неизвестный kind", () => {
    expect(evaluateRequire({ kind: "made-up" }, ctx).ok).toBe("unknown");
  });
});

describe("evaluateGenericRequires — AND-композиция", () => {
  it("все true → matched=true", () => {
    const res = evaluateGenericRequires(
      {
        requires: [
          { kind: "entity-field", entity: "Issue", field: "status" },
          { kind: "intent-creates", creates: "Issue" },
        ],
      },
      ctx,
    );
    expect(res.matched).toBe(true);
  });
  it("один false → matched=false", () => {
    const res = evaluateGenericRequires(
      {
        requires: [
          { kind: "entity-field", entity: "Issue", field: "status" },
          { kind: "intent-creates", creates: "Phantom" },
        ],
      },
      ctx,
    );
    expect(res.matched).toBe(false);
  });
  it("нет false, есть unknown → matched=null (live-undecidable)", () => {
    const res = evaluateGenericRequires(
      {
        requires: [
          { kind: "entity-field", entity: "Issue", field: "status" },
          { kind: "session" },
        ],
      },
      ctx,
    );
    expect(res.matched).toBe(null);
  });
  it("perRequire содержит kind+ok+reason для каждого require", () => {
    const res = evaluateGenericRequires(
      { requires: [{ kind: "entity-field", entity: "Issue", field: "status" }] },
      ctx,
    );
    expect(res.perRequire).toHaveLength(1);
    expect(res.perRequire[0].kind).toBe("entity-field");
    expect(res.perRequire[0].ok).toBe(true);
    expect(res.perRequire[0].reason).toBeTruthy();
  });
});
