import { describe, it, expect } from "vitest";
import {
  getIrreversibility,
  hasIrreversiblePast,
  mergeIntoContext,
  IRR_POINT_HIGH,
} from "./irreversibility.cjs";

describe("getIrreversibility", () => {
  it("effect без __irr → null", () => {
    expect(getIrreversibility({ context: "{}" })).toBeNull();
    expect(getIrreversibility({ context: null })).toBeNull();
    expect(getIrreversibility({})).toBeNull();
  });

  it("effect с stringified context и __irr → объект", () => {
    const ef = { context: JSON.stringify({ id: "o1", __irr: { point: "high", at: 12345, reason: "SMS sent" } }) };
    expect(getIrreversibility(ef)).toEqual({ point: "high", at: 12345, reason: "SMS sent" });
  });

  it("effect с object context → объект (не double-parsed)", () => {
    const ef = { context: { id: "o1", __irr: { point: "low", at: null, reason: null } } };
    expect(getIrreversibility(ef)).toEqual({ point: "low", at: null, reason: null });
  });

  it("malformed context JSON → null (не бросает)", () => {
    expect(getIrreversibility({ context: "not-json" })).toBeNull();
  });
});

describe("hasIrreversiblePast", () => {
  it("пустая history → false", () => {
    expect(hasIrreversiblePast([])).toBe(false);
  });

  it("history без irreversibility → false", () => {
    const history = [
      { context: JSON.stringify({ id: "o1" }) },
      { context: JSON.stringify({ id: "o1" }) },
    ];
    expect(hasIrreversiblePast(history)).toBe(false);
  });

  it("history с point=high и at=null → false (ещё reversible)", () => {
    const history = [
      { context: JSON.stringify({ id: "o1", __irr: { point: "high", at: null } }) },
    ];
    expect(hasIrreversiblePast(history)).toBe(false);
  });

  it("history с point=high и at=timestamp → true", () => {
    const history = [
      { context: JSON.stringify({ id: "o1", __irr: { point: "high", at: 999 } }) },
    ];
    expect(hasIrreversiblePast(history)).toBe(true);
  });

  it("history с point=low и at=timestamp → false (low не блокирует)", () => {
    const history = [
      { context: JSON.stringify({ id: "o1", __irr: { point: "low", at: 999 } }) },
    ];
    expect(hasIrreversiblePast(history)).toBe(false);
  });

  it("mixed history — любой high+at → true", () => {
    const history = [
      { context: JSON.stringify({ id: "o1" }) },
      { context: JSON.stringify({ id: "o1", __irr: { point: "high", at: 100 } }) },
      { context: JSON.stringify({ id: "o1" }) },
    ];
    expect(hasIrreversiblePast(history)).toBe(true);
  });
});

describe("mergeIntoContext", () => {
  it("объектный ctx → вставка __irr в копию", () => {
    const ctx = { id: "o1", orderId: "42" };
    const out = mergeIntoContext(ctx, { point: "high", at: 555, reason: "paid" });
    expect(out).toEqual({ id: "o1", orderId: "42", __irr: { point: "high", at: 555, reason: "paid" } });
    expect(ctx.__irr).toBeUndefined();
  });

  it("stringified ctx → stringified output с __irr", () => {
    const ctx = JSON.stringify({ id: "o1" });
    const out = mergeIntoContext(ctx, { point: "high", at: 1, reason: null });
    expect(typeof out).toBe("string");
    expect(JSON.parse(out).__irr.point).toBe("high");
  });

  it("null ctx → новый объект с __irr", () => {
    const out = mergeIntoContext(null, { point: "high", at: 1, reason: null });
    expect(out.__irr.point).toBe("high");
  });
});

describe("constants", () => {
  it("IRR_POINT_HIGH === 'high'", () => {
    expect(IRR_POINT_HIGH).toBe("high");
  });
});
