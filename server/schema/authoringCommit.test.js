import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { finalizeDomain } = req("./authoringCommit.cjs");

describe("authoringCommit.finalizeDomain", () => {
  let tmp;
  beforeEach(() => { tmp = mkdtempSync(path.join(tmpdir(), "idf-commit-")); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("пишет domain.js с META/INTENTS/ONTOLOGY/PROJECTIONS экспортами", async () => {
    const spec = {
      meta: { id: "retro-demo", description: "Retro tool" },
      INTENTS: {
        create_card: { α: "create", target: "Card" },
      },
      ONTOLOGY: {
        entities: { Card: { fields: { title: { type: "text", required: true } } } },
        roles: { participant: { base: "owner" } },
        invariants: [],
      },
      PROJECTIONS: {},
    };
    const result = await finalizeDomain(spec, { targetDir: tmp });
    expect(result.path).toBe(path.join(tmp, "domain.js"));
    expect(existsSync(result.path)).toBe(true);

    const body = readFileSync(result.path, "utf8");
    expect(body).toContain("export const META");
    expect(body).toContain("export const INTENTS");
    expect(body).toContain("export const ONTOLOGY");
    expect(body).toContain("export const PROJECTIONS");
    expect(body).toContain("create_card");
    expect(body).toContain("Card");
    expect(body).toContain("default");
  });

  it("откидывает spec без ни одного intent'а", async () => {
    await expect(finalizeDomain(
      { meta: { id: "x" }, INTENTS: {}, ONTOLOGY: { entities: {} } },
      { targetDir: tmp }
    )).rejects.toThrow(/intent/i);
  });

  it("откидывает spec без ни одной entity", async () => {
    await expect(finalizeDomain(
      { meta: { id: "x" }, INTENTS: { a: {} }, ONTOLOGY: { entities: {} } },
      { targetDir: tmp }
    )).rejects.toThrow(/entit/i);
  });

  it("создаёт targetDir если не существует", async () => {
    const newDir = path.join(tmp, "nested", "deep");
    const spec = {
      meta: { id: "x" },
      INTENTS: { a: { α: "create", target: "X" } },
      ONTOLOGY: { entities: { X: {} } },
    };
    await finalizeDomain(spec, { targetDir: newDir });
    expect(existsSync(path.join(newDir, "domain.js"))).toBe(true);
  });

  it("domain.js валидный ESM (парсится через dynamic import)", async () => {
    const spec = {
      meta: { id: "parse-test", description: "Parse test" },
      INTENTS: { create_x: { α: "create", target: "X" } },
      ONTOLOGY: { entities: { X: { fields: { name: { type: "text" } } } }, roles: {} },
    };
    const { path: filePath } = await finalizeDomain(spec, { targetDir: tmp });
    const url = "file://" + filePath;
    const mod = await import(url);
    expect(mod.META.id).toBe("parse-test");
    expect(mod.INTENTS.create_x).toBeDefined();
    expect(mod.ONTOLOGY.entities.X).toBeDefined();
    expect(mod.default).toBeDefined();
    expect(mod.default.META).toEqual(mod.META);
  });

  it("содержит timestamp в комментарии сверху", async () => {
    const spec = {
      meta: { id: "ts" },
      INTENTS: { a: { α: "create", target: "X" } },
      ONTOLOGY: { entities: { X: {} } },
    };
    const { path: filePath } = await finalizeDomain(spec, { targetDir: tmp });
    const body = readFileSync(filePath, "utf8");
    expect(body).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(body).toMatch(/Studio authoring/i);
  });
});
