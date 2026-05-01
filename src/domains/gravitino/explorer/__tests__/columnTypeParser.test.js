import { describe, it, expect } from "vitest";
import { parseColumnType, isComplex } from "../columnTypeParser.js";

describe("parseColumnType", () => {
  it("scalar", () => {
    expect(parseColumnType("bigint")).toEqual({ kind: "scalar", type: "bigint" });
    expect(parseColumnType("decimal(10,2)")).toEqual({ kind: "scalar", type: "decimal(10,2)" });
  });

  it("array<bigint>", () => {
    expect(parseColumnType("array<bigint>")).toEqual({
      kind: "array",
      element: { kind: "scalar", type: "bigint" },
    });
  });

  it("map<string, decimal(10,2)>", () => {
    const res = parseColumnType("map<string, decimal(10,2)>");
    expect(res.kind).toBe("map");
    expect(res.key.type).toBe("string");
    expect(res.value.type).toBe("decimal(10,2)");
  });

  it("struct<a:int, b:string>", () => {
    const res = parseColumnType("struct<a:int, b:string>");
    expect(res.kind).toBe("struct");
    expect(res.fields).toHaveLength(2);
    expect(res.fields[0]).toEqual({ name: "a", type: { kind: "scalar", type: "int" } });
  });

  it("nested struct<a:int, b:array<string>>", () => {
    const res = parseColumnType("struct<a:int, b:array<string>>");
    expect(res.fields[1].type.kind).toBe("array");
    expect(res.fields[1].type.element.type).toBe("string");
  });

  it("array<struct<x:int, y:string>>", () => {
    const res = parseColumnType("array<struct<x:int, y:string>>");
    expect(res.kind).toBe("array");
    expect(res.element.kind).toBe("struct");
    expect(res.element.fields).toHaveLength(2);
  });

  it("isComplex", () => {
    expect(isComplex(parseColumnType("int"))).toBe(false);
    expect(isComplex(parseColumnType("array<int>"))).toBe(true);
  });
});
