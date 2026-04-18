import { describe, it, expect } from "vitest";
import { checkFieldsTyped, checkEnumValues, checkEntityKind, checkRoleBase, checkOwnerField } from "./domain-audit.mjs";

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
