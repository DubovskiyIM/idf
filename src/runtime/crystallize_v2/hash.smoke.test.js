import { describe, it, expect } from "vitest";
import { hashInputs } from "./hash.js";

describe("hashInputs", () => {
  it("возвращает стабильный хэш для одних и тех же входов", () => {
    const a = hashInputs({ x: {}, y: {} }, { p: {} }, { entities: { E: {} } });
    const b = hashInputs({ y: {}, x: {} }, { p: {} }, { entities: { E: {} } });
    expect(a).toBe(b);
  });

  it("меняется при добавлении нового намерения", () => {
    const a = hashInputs({ x: {} }, { p: {} }, { entities: { E: {} } });
    const b = hashInputs({ x: {}, y: {} }, { p: {} }, { entities: { E: {} } });
    expect(a).not.toBe(b);
  });
});
