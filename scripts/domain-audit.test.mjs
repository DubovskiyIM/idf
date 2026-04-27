import { describe, it, expect } from "vitest";
import { checkFieldsTyped, checkEnumValues, checkEntityKind, checkRoleBase, checkOwnerField, checkEmptyConditions, checkEmptyWitnesses, checkAntagonistSymmetry, checkIrreversibility, checkCreatesConfirmation, auditDomain } from "./domain-audit.mjs";

describe("checkFieldsTyped", () => {
  it("entity с fields-массивом даёт gap", () => {
    const onto = { entities: { Foo: { fields: ["id", "name"] } } };
    const gaps = checkFieldsTyped(onto);
    expect(gaps).toEqual([
      { kind: "fields-array-form", entity: "Foo" },
    ]);
  });

  it("entity с typed-объектом проходит", () => {
    const onto = { entities: { Foo: { fields: { id: { type: "id" }, name: { type: "text" } } } } };
    expect(checkFieldsTyped(onto)).toEqual([]);
  });

  it("смешанная онтология возвращает только array-сущности", () => {
    const onto = {
      entities: {
        Good: { fields: { id: { type: "id" } } },
        Bad: { fields: ["id", "name"] },
      },
    };
    expect(checkFieldsTyped(onto)).toEqual([{ kind: "fields-array-form", entity: "Bad" }]);
  });
});

describe("checkEnumValues", () => {
  it("enum без values даёт gap", () => {
    const onto = { entities: { Foo: { fields: { status: { type: "enum" } } } } };
    expect(checkEnumValues(onto)).toEqual([
      { kind: "enum-no-values", entity: "Foo", field: "status" },
    ]);
  });

  it("enum с values но без valueLabels даёт gap", () => {
    const onto = { entities: { Foo: { fields: { status: { type: "enum", values: ["a", "b"] } } } } };
    expect(checkEnumValues(onto)).toEqual([
      { kind: "enum-no-valueLabels", entity: "Foo", field: "status" },
    ]);
  });

  it("полный enum проходит", () => {
    const onto = { entities: { Foo: { fields: { status: { type: "enum", values: ["a"], valueLabels: { a: "A" } } } } } };
    expect(checkEnumValues(onto)).toEqual([]);
  });

  it("array-form entity пропускается (другая проверка)", () => {
    const onto = { entities: { Foo: { fields: ["id", "status"] } } };
    expect(checkEnumValues(onto)).toEqual([]);
  });
});

describe("checkEntityKind", () => {
  // §12.5 (2026-04-26): default = "internal" (не gap).
  // Помечаем только entity с явным невалидным kind/type.
  it("entity без kind/type — не gap (default internal)", () => {
    const onto = { entities: { Foo: { fields: { id: { type: "id" } } } } };
    expect(checkEntityKind(onto)).toEqual([]);
  });
  it("entity с type=internal проходит", () => {
    const onto = { entities: { Foo: { fields: {}, type: "internal" } } };
    expect(checkEntityKind(onto)).toEqual([]);
  });
  it("entity с canonical kind='reference' проходит", () => {
    const onto = { entities: { Foo: { fields: {}, kind: "reference" } } };
    expect(checkEntityKind(onto)).toEqual([]);
  });
  it("entity с invalid kind даёт gap", () => {
    const onto = { entities: { Foo: { fields: {}, kind: "garbage" } } };
    expect(checkEntityKind(onto)).toEqual([{ kind: "entity-no-type", entity: "Foo", value: "garbage" }]);
  });
});

describe("checkRoleBase", () => {
  it("роль без base даёт gap", () => {
    const onto = { roles: { client: { label: "Клиент" } } };
    expect(checkRoleBase(onto)).toEqual([{ kind: "role-no-base", role: "client" }]);
  });
  it("роль с base=owner проходит", () => {
    const onto = { roles: { client: { base: "owner" } } };
    expect(checkRoleBase(onto)).toEqual([]);
  });
  it("роль с неизвестным base даёт gap", () => {
    const onto = { roles: { r: { base: "stranger" } } };
    expect(checkRoleBase(onto)).toEqual([{ kind: "role-bad-base", role: "r", value: "stranger" }]);
  });
});

describe("checkOwnerField", () => {
  it("entity с userId и type=internal но без ownerField даёт gap", () => {
    const onto = { entities: { Note: { type: "internal", fields: { id: { type: "id" }, userId: { type: "entityRef" }, text: { type: "text" } } } } };
    expect(checkOwnerField(onto)).toEqual([
      { kind: "owner-field-missing", entity: "Note", candidate: "userId" },
    ]);
  });
  it("entity с ownerField проходит", () => {
    const onto = { entities: { Note: { type: "internal", ownerField: "userId", fields: { id: { type: "id" }, userId: { type: "entityRef" } } } } };
    expect(checkOwnerField(onto)).toEqual([]);
  });
  it("reference-сущность пропускается", () => {
    const onto = { entities: { Cat: { type: "reference", fields: { id: { type: "id" } } } } };
    expect(checkOwnerField(onto)).toEqual([]);
  });
});

describe("checkEmptyConditions", () => {
  it("транзиционный интент без conditions даёт gap", () => {
    const intents = {
      close_goal: {
        creates: null,
        particles: { entities: ["goal: Goal"], conditions: [], effects: [{ α: "replace", target: "goal.status", value: "closed" }], witnesses: [] },
      },
    };
    expect(checkEmptyConditions(intents)).toEqual([{ kind: "empty-conditions", intent: "close_goal" }]);
  });
  it("create-интент пропускается", () => {
    const intents = {
      create_goal: {
        creates: "Goal",
        particles: { entities: ["goal: Goal"], conditions: [], effects: [{ α: "add", target: "goals" }], witnesses: [] },
      },
    };
    expect(checkEmptyConditions(intents)).toEqual([]);
  });
  it("интент с conditions проходит", () => {
    const intents = {
      edit_goal: {
        particles: { entities: ["goal: Goal"], conditions: ["goal.userId = me.id"], effects: [{ α: "replace", target: "goal.title" }], witnesses: [] },
      },
    };
    expect(checkEmptyConditions(intents)).toEqual([]);
  });
  it("системный интент без entities пропускается", () => {
    const intents = {
      earn_xp: {
        particles: { entities: [], conditions: [], effects: [{ α: "replace", target: "user.xp" }], witnesses: [] },
      },
    };
    expect(checkEmptyConditions(intents)).toEqual([]);
  });
  it("интент с system: true пропускается", () => {
    const intents = {
      level_up: {
        system: true,
        particles: { entities: ["user: User"], conditions: [], effects: [{ α: "replace", target: "user.level" }] },
      },
    };
    expect(checkEmptyConditions(intents)).toEqual([]);
  });
});

describe("checkEmptyWitnesses", () => {
  it("form-интент без witnesses даёт gap", () => {
    const intents = {
      edit_goal: { particles: { entities: ["goal: Goal"], conditions: [], effects: [{ α: "replace", target: "goal.title" }], witnesses: [], confirmation: "form" } },
    };
    expect(checkEmptyWitnesses(intents)).toEqual([{ kind: "empty-witnesses", intent: "edit_goal" }]);
  });
  it("auto-confirmation пропускается", () => {
    const intents = {
      mark_read: { particles: { witnesses: [], confirmation: "auto", effects: [{ α: "replace", target: "p.lastReadAt" }], entities: [] } },
    };
    expect(checkEmptyWitnesses(intents)).toEqual([]);
  });
  it("witnesses заполнены — проходит", () => {
    const intents = {
      edit_goal: { particles: { witnesses: ["goal.title"], confirmation: "form", effects: [], entities: [] } },
    };
    expect(checkEmptyWitnesses(intents)).toEqual([]);
  });
  it("click + чистая status-replace на entity в контексте пропускается", () => {
    const intents = {
      complete_goal: {
        particles: {
          entities: ["goal: Goal"],
          effects: [{ α: "replace", target: "goal.status", value: "completed" }],
          witnesses: [], confirmation: "click",
        },
      },
    };
    expect(checkEmptyWitnesses(intents)).toEqual([]);
  });
  it("click с add-effect (не status-replace) всё равно требует witness", () => {
    const intents = {
      send_sticker: {
        particles: {
          entities: ["message: Message"],
          effects: [{ α: "add", target: "messages" }],
          witnesses: [], confirmation: "click",
        },
      },
    };
    expect(checkEmptyWitnesses(intents)).toEqual([{ kind: "empty-witnesses", intent: "send_sticker" }]);
  });
});

describe("checkAntagonistSymmetry", () => {
  it("односторонний antagonist даёт gap", () => {
    const intents = {
      pin: { antagonist: "unpin", particles: {} },
      unpin: { antagonist: null, particles: {} },
    };
    expect(checkAntagonistSymmetry(intents)).toEqual([
      { kind: "antagonist-asymmetry", intent: "unpin", expected: "pin" },
    ]);
  });
  it("взаимный antagonist проходит", () => {
    const intents = {
      pin: { antagonist: "unpin", particles: {} },
      unpin: { antagonist: "pin", particles: {} },
    };
    expect(checkAntagonistSymmetry(intents)).toEqual([]);
  });
  it("antagonist на несуществующий интент даёт gap", () => {
    const intents = { pin: { antagonist: "ghost", particles: {} } };
    expect(checkAntagonistSymmetry(intents)).toEqual([
      { kind: "antagonist-missing-target", intent: "pin", target: "ghost" },
    ]);
  });
});

describe("checkIrreversibility", () => {
  it("α=remove без irreversibility даёт gap", () => {
    const intents = {
      delete_x: { particles: { effects: [{ α: "remove", target: "xs" }] } },
    };
    expect(checkIrreversibility(intents)).toEqual([
      { kind: "irreversibility-missing", intent: "delete_x" },
    ]);
  });
  it("α=remove с irreversibility проходит", () => {
    const intents = {
      delete_x: { irreversibility: "medium", particles: { effects: [{ α: "remove", target: "xs" }] } },
    };
    expect(checkIrreversibility(intents)).toEqual([]);
  });
  it("status→archived без irreversibility даёт gap", () => {
    const intents = {
      archive_x: { particles: { effects: [{ α: "replace", target: "x.status", value: "archived" }] } },
    };
    expect(checkIrreversibility(intents)).toEqual([
      { kind: "irreversibility-missing", intent: "archive_x" },
    ]);
  });
  // §12.7: per-effect __irr.point на одном из effects → не gap
  it("intent.context.__irr.point=high — проходит (intent-level)", () => {
    const intents = {
      delete_x: {
        context: { __irr: { point: "high", reason: "permanent" } },
        particles: { effects: [{ α: "remove", target: "xs" }] },
      },
    };
    expect(checkIrreversibility(intents)).toEqual([]);
  });
  it("per-effect context.__irr.point — проходит (multi-effect intent)", () => {
    const intents = {
      capture_payment: {
        α: "create",
        particles: {
          effects: [
            { α: "create", target: "Payment", fields: { id: "{{auto}}" } },
            {
              α: "replace",
              target: "Order.status",
              value: "paid",
              context: { __irr: { point: "high", reason: "Payment captured" } },
            },
          ],
        },
      },
    };
    expect(checkIrreversibility(intents)).toEqual([]);
  });
  it("invalid __irr.point (typo) — gap остаётся", () => {
    const intents = {
      delete_x: {
        context: { __irr: { point: "MEGA-HIGH" } },
        particles: { effects: [{ α: "remove", target: "xs" }] },
      },
    };
    expect(checkIrreversibility(intents)).toEqual([
      { kind: "irreversibility-missing", intent: "delete_x" },
    ]);
  });
});

describe("checkCreatesConfirmation", () => {
  it("creates с confirmation=click даёт gap", () => {
    const intents = {
      new_x: { creates: "X", particles: { confirmation: "click" } },
    };
    expect(checkCreatesConfirmation(intents)).toEqual([
      { kind: "creates-needs-form", intent: "new_x" },
    ]);
  });
  it("creates с confirmation=form проходит", () => {
    const intents = {
      new_x: { creates: "X", particles: { confirmation: "form" } },
    };
    expect(checkCreatesConfirmation(intents)).toEqual([]);
  });
});

describe("auditDomain", () => {
  it("собирает все gaps из онтологии и интентов", () => {
    const ontology = { entities: { Foo: { fields: ["id", "name"] } } };
    const intents = {
      close_foo: {
        particles: { entities: ["foo: Foo"], conditions: [], effects: [{ α: "replace", target: "foo.status", value: "closed" }], witnesses: [], confirmation: "click" },
      },
    };
    const report = auditDomain("test", ontology, intents);
    expect(report.domain).toBe("test");
    expect(report.gaps.some((g) => g.kind === "fields-array-form")).toBe(true);
    expect(report.gaps.some((g) => g.kind === "empty-conditions")).toBe(true);
    expect(report.gaps.some((g) => g.kind === "irreversibility-missing")).toBe(true);
    expect(typeof report.summary.total).toBe("number");
  });
});
