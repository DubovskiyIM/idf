import { describe, it, expect } from "vitest";
import { checkFieldsTyped, checkEnumValues } from "./domain-audit.mjs";

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
