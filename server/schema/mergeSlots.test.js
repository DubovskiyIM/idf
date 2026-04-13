import { describe, it, expect } from "vitest";
import { mergeSlots } from "../routes/crystallize.js";

describe("mergeSlots", () => {
  it("добавляет label к существующему объекту", () => {
    const original = { toolbar: [{ intentId: "place_bid", type: "intent" }] };
    const enriched = { toolbar: [{ intentId: "place_bid", type: "intent", label: "Сделать ставку" }] };
    const result = mergeSlots(original, enriched);
    expect(result.toolbar[0].label).toBe("Сделать ставку");
    expect(result.toolbar[0].intentId).toBe("place_bid");
  });

  it("добавляет placeholder и hint как новые ключи", () => {
    const original = { body: { type: "list", items: [] } };
    const enriched = { body: { type: "list", items: [], emptyState: "Пока нет лотов" } };
    const result = mergeSlots(original, enriched);
    expect(result.body.emptyState).toBe("Пока нет лотов");
    expect(result.body.type).toBe("list");
  });

  it("не добавляет произвольные ключи", () => {
    const original = { toolbar: [] };
    const enriched = { toolbar: [], hackedField: "evil" };
    const result = mergeSlots(original, enriched);
    expect(result.hackedField).toBeUndefined();
  });

  it("сохраняет structure при несовпадении длины массивов", () => {
    const original = { toolbar: [{ id: "a" }, { id: "b" }] };
    const enriched = { toolbar: [{ id: "a", label: "А" }] }; // длина не совпадает
    const result = mergeSlots(original, enriched);
    expect(result.toolbar).toHaveLength(2);
    expect(result.toolbar[0].label).toBeUndefined(); // fallback на original
  });

  it("рекурсивно merge'ит вложенные объекты", () => {
    const original = {
      overlay: [{ type: "formModal", params: [{ name: "amount", type: "number" }] }]
    };
    const enriched = {
      overlay: [{ type: "formModal", params: [{ name: "amount", type: "number", placeholder: "Сумма в рублях", hint: "Мин. 100₽" }] }]
    };
    const result = mergeSlots(original, enriched);
    expect(result.overlay[0].params[0].placeholder).toBe("Сумма в рублях");
    expect(result.overlay[0].params[0].hint).toBe("Мин. 100₽");
    expect(result.overlay[0].params[0].type).toBe("number");
  });

  it("null enriched → возвращает original", () => {
    const original = { toolbar: [{ id: "a" }] };
    expect(mergeSlots(original, null)).toEqual(original);
  });

  it("обновляет существующие leaf-значения", () => {
    const original = { toolbar: [{ intentId: "x", icon: "📦" }] };
    const enriched = { toolbar: [{ intentId: "x", icon: "🎁" }] };
    const result = mergeSlots(original, enriched);
    expect(result.toolbar[0].icon).toBe("🎁");
  });
});
