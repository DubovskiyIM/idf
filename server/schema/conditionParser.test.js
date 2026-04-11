import { describe, it, expect } from "vitest";
import { parseCondition, parseConditions } from "./conditionParser.cjs";

describe("parseCondition", () => {
  it("парсит equality с string-значением", () => {
    expect(parseCondition("slot.status = 'free'")).toEqual({
      entity: "slot", field: "status", op: "=", value: "free"
    });
  });

  it("парсит inequality", () => {
    expect(parseCondition("draft.slotId != null")).toEqual({
      entity: "draft", field: "slotId", op: "!=", value: null
    });
  });

  it("парсит IN с массивом", () => {
    expect(parseCondition("booking.status IN ('completed','cancelled','no_show')")).toEqual({
      entity: "booking", field: "status", op: "IN",
      value: ["completed", "cancelled", "no_show"]
    });
  });

  it("парсит = null", () => {
    expect(parseCondition("review.response = null")).toEqual({
      entity: "review", field: "response", op: "=", value: null
    });
  });

  it("парсит = true / = false", () => {
    expect(parseCondition("service.active = true")).toEqual({
      entity: "service", field: "active", op: "=", value: true
    });
  });

  it("парсит = me.id как ref", () => {
    expect(parseCondition("message.senderId = me.id")).toEqual({
      entity: "message", field: "senderId", op: "=",
      value: { ref: "viewer.id" }
    });
  });

  it("толерантен к whitespace", () => {
    expect(parseCondition("  slot.status  =  'free'  ")).toEqual({
      entity: "slot", field: "status", op: "=", value: "free"
    });
  });

  it("возвращает null для невалидной строки", () => {
    expect(parseCondition("это не условие")).toBeNull();
  });

  it("возвращает null для пустой строки", () => {
    expect(parseCondition("")).toBeNull();
  });
});

describe("parseConditions", () => {
  it("парсит массив условий", () => {
    const result = parseConditions([
      "slot.status = 'free'",
      "draft.slotId != null"
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].op).toBe("=");
    expect(result[1].op).toBe("!=");
  });

  it("фильтрует невалидные, не падая", () => {
    const result = parseConditions(["slot.status = 'free'", "garbage"]);
    expect(result).toHaveLength(1);
  });
});
