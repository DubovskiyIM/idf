import { describe, it, expect } from "vitest";
import { checkFieldsTyped, checkEnumValues, checkEntityKind, checkRoleBase, checkOwnerField, checkEmptyConditions, checkEmptyWitnesses, checkAntagonistSymmetry, checkIrreversibility, checkCreatesConfirmation } from "./domain-audit.mjs";

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
  it("entity без type даёт gap", () => {
    const onto = { entities: { Foo: { fields: { id: { type: "id" } } } } };
    expect(checkEntityKind(onto)).toEqual([{ kind: "entity-no-type", entity: "Foo" }]);
  });
  it("entity с type=internal проходит", () => {
    const onto = { entities: { Foo: { fields: {}, type: "internal" } } };
    expect(checkEntityKind(onto)).toEqual([]);
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
        particles: { entities: [], conditions: ["goal.userId = me.id"], effects: [{ α: "replace", target: "goal.title" }], witnesses: [] },
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
