// server/schema/buildGravitinoEffects.test.js
import { describe, it, expect } from "vitest";
import { buildGravitinoEffects } from "./buildGravitinoEffects.cjs";

describe("buildGravitinoEffects", () => {
  const VIEWER = { id: "u1" };
  const WORLD = { metalakes: [], catalogs: [], schemas: [], tables: [] };

  it("unknown intent → null (generic fallback в validator)", () => {
    const r = buildGravitinoEffects("unknown_intent", {}, VIEWER, WORLD);
    expect(r).toBeNull();
  });

  it("создаётся корректная module-структура (CJS export)", () => {
    expect(typeof buildGravitinoEffects).toBe("function");
  });
});
