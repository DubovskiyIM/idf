import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadSpecFromFile, saveSpecToFile } from "./specSerializer.cjs";

describe("specSerializer", () => {
  let dir;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "specser-"));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("loadSpecFromFile возвращает {meta, INTENTS, ONTOLOGY, PROJECTIONS}", async () => {
    const file = path.join(dir, "domain.js");
    await fs.writeFile(file,
      `export const META = { id: "demo", description: "x" };\n` +
      `export const INTENTS = { create_x: { α: "create", target: "X" } };\n` +
      `export const ONTOLOGY = { entities: { X: { fields: {} } }, roles: {}, invariants: [] };\n` +
      `export const PROJECTIONS = {};\n` +
      `export default { META, INTENTS, ONTOLOGY, PROJECTIONS };\n`,
      "utf8"
    );
    const spec = await loadSpecFromFile(file);
    expect(spec.meta.id).toBe("demo");
    expect(spec.INTENTS.create_x.α).toBe("create");
    expect(spec.ONTOLOGY.entities.X).toBeDefined();
    expect(spec.PROJECTIONS).toEqual({});
  });

  it("loadSpecFromFile бросает на отсутствующем файле", async () => {
    await expect(loadSpecFromFile(path.join(dir, "nope.js"))).rejects.toThrow(/not found|ENOENT/i);
  });

  it("saveSpecToFile + loadSpecFromFile — round-trip", async () => {
    const file = path.join(dir, "domain.js");
    const spec = {
      meta: { id: "rt", description: "round-trip" },
      INTENTS: { foo: { α: "create", target: "Foo" } },
      ONTOLOGY: { entities: { Foo: { fields: {} } }, roles: {}, invariants: [] },
      PROJECTIONS: {},
    };
    await saveSpecToFile(spec, file);
    const back = await loadSpecFromFile(file);
    expect(back).toEqual(spec);
  });
});
