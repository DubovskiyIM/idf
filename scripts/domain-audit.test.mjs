import { describe, it, expect } from "vitest";
import { checkFieldsTyped } from "./domain-audit.mjs";

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
