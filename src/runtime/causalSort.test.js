import { describe, it, expect } from "vitest";
import { causalSort } from "./causalSort.js";

// Хелпер: создать эффект с нужными полями
const ef = (id, parent_id, created_at) => ({ id, parent_id, created_at });

describe("causalSort", () => {
  it("пустой массив → пустой массив", () => {
    expect(causalSort([])).toEqual([]);
  });

  it("один effect без parent_id → он же", () => {
    const e = ef("a", null, 1);
    expect(causalSort([e])).toEqual([e]);
  });

  it("линейная цепочка a → b → c упорядочивается родитель-раньше-потомка", () => {
    const a = ef("a", null, 1);
    const b = ef("b", "a", 2);
    const c = ef("c", "b", 3);
    expect(causalSort([c, b, a])).toEqual([a, b, c]);
  });

  it("линейная цепочка сохраняется в input-порядке, если он уже правильный", () => {
    const a = ef("a", null, 1);
    const b = ef("b", "a", 2);
    const c = ef("c", "b", 3);
    expect(causalSort([a, b, c])).toEqual([a, b, c]);
  });

  it("parent идёт до child даже если created_at parent'а позже (foreign race)", () => {
    // Симулируем: parent пришёл с задержкой и имеет более поздний created_at,
    // но child ссылается на него через parent_id
    const a = ef("a", null, 10); // created_at позже
    const b = ef("b", "a", 5);  // created_at раньше, но child'а
    const result = causalSort([a, b]);
    expect(result.findIndex(e => e.id === "a"))
      .toBeLessThan(result.findIndex(e => e.id === "b"));
  });

  it("множественные roots сортируются по created_at", () => {
    const r1 = ef("r1", null, 3);
    const r2 = ef("r2", null, 1);
    const r3 = ef("r3", null, 2);
    expect(causalSort([r1, r2, r3]).map(e => e.id))
      .toEqual(["r2", "r3", "r1"]);
  });

  it("siblings одного parent сортируются по created_at", () => {
    const p  = ef("p",  null, 1);
    const c1 = ef("c1", "p",  3);
    const c2 = ef("c2", "p",  2);
    const result = causalSort([p, c1, c2]).map(e => e.id);
    expect(result).toEqual(["p", "c2", "c1"]);
  });

  it("ветвистое дерево: p → {c1 → gc1, c2}", () => {
    const p   = ef("p",   null, 1);
    const c1  = ef("c1",  "p",  2);
    const c2  = ef("c2",  "p",  3);
    const gc1 = ef("gc1", "c1", 4);
    const result = causalSort([gc1, c2, c1, p]).map(e => e.id);
    // p первый
    expect(result[0]).toBe("p");
    // gc1 после c1
    expect(result.indexOf("gc1")).toBeGreaterThan(result.indexOf("c1"));
    // c1 раньше c2 (tie-break по created_at)
    expect(result.indexOf("c1")).toBeLessThan(result.indexOf("c2"));
  });

  it("orphaned parent_id трактуется как root", () => {
    // b.parent_id ссылается на отсутствующий "ghost"
    const a = ef("a", null, 1);
    const b = ef("b", "ghost", 2);
    const result = causalSort([a, b]).map(e => e.id);
    // Оба считаются roots, сортируются по created_at
    expect(result).toEqual(["a", "b"]);
  });

  it("цикл (a → b → a) — fallback на created_at без падения", () => {
    const a = { id: "a", parent_id: "b", created_at: 1 };
    const b = { id: "b", parent_id: "a", created_at: 2 };
    // Не должно быть исключения; вернуть что-то детерминированное.
    const result = causalSort([a, b]);
    expect(result).toHaveLength(2);
    expect(new Set(result.map(e => e.id))).toEqual(new Set(["a", "b"]));
  });

  it("не мутирует input массив", () => {
    const a = ef("a", null, 1);
    const b = ef("b", "a", 2);
    const input = [b, a];
    const before = [...input];
    causalSort(input);
    expect(input).toEqual(before);
  });

  it("обрабатывает undefined created_at (treat as 0)", () => {
    const a = ef("a", null, undefined);
    const b = ef("b", null, 5);
    const result = causalSort([b, a]).map(e => e.id);
    expect(result).toEqual(["a", "b"]);
  });
});
