import { describe, it, expect } from "vitest";
import { collectRecords, groupByPattern, rankGroups, normalizeFieldNames } from "./zazor3-candidates.mjs";

describe("zazor3-candidates analyzer", () => {
  it("normalizeFieldNames работает с object-form", () => {
    const entity = { fields: { id: { type: "string" }, title: { type: "text" } } };
    const result = normalizeFieldNames(entity);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "id", def: { type: "string" } });
    expect(result[1]).toEqual({ name: "title", def: { type: "text" } });
  });

  it("normalizeFieldNames работает с legacy array-form", () => {
    const entity = { fields: ["id", "name"] };
    const result = normalizeFieldNames(entity);
    expect(result).toEqual([
      { name: "id", def: {} },
      { name: "name", def: {} },
    ]);
  });

  it("collectRecords собирает heuristic records из in-memory домена", async () => {
    const mod = {
      INTENTS: {},
      ONTOLOGY: {
        entities: {
          Item: { fields: { title: { type: "text" }, price: { type: "number" } } },
        },
      },
    };
    const records = await collectRecords("test", mod);
    expect(records.length).toBeGreaterThanOrEqual(2);
    const patterns = records.map(r => r.pattern);
    expect(patterns).toContain("name:title-synonym");
    expect(patterns).toContain("name:price-substring");
  });

  it("groupByPattern группирует правильно", () => {
    const records = [
      { pattern: "A", location: "x" },
      { pattern: "A", location: "y" },
      { pattern: "B", location: "z" },
    ];
    const groups = groupByPattern(records);
    expect(groups.A).toHaveLength(2);
    expect(groups.B).toHaveLength(1);
  });

  it("rankGroups сортирует по count desc", () => {
    const groups = {
      A: [1, 2, 3],
      B: [1],
      C: [1, 2],
    };
    const sorted = rankGroups(groups);
    expect(sorted.map(([p]) => p)).toEqual(["A", "C", "B"]);
  });

  it("collectRecords собирает antagonist-declared pattern", async () => {
    const mod = {
      INTENTS: {
        accept_req: { antagonist: "reject_req", particles: { effects: [{ α: "add", target: "accepts" }] } },
        reject_req: { particles: { effects: [{ α: "add", target: "rejects" }] } },
      },
      ONTOLOGY: {},
    };
    const records = await collectRecords("test", mod);
    const antagonistRecords = records.filter(r => r.pattern === "antagonist-declared");
    expect(antagonistRecords.length).toBeGreaterThanOrEqual(1);
  });
});
