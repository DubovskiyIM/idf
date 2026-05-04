import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Loader использует path.join(__dirname, "..", "refs", "candidates"). Чтобы
// тестировать на изолированной dir, копируем модуль в tmpRoot/server/ и
// require'им оттуда — __dirname резолвится в tmpRoot/server.

describe("loadCandidatesFromRefs (side-channel)", () => {
  let tmpRoot;
  let candidatesDir;
  let mod;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "load-cand-"));
    const serverDir = path.join(tmpRoot, "server");
    candidatesDir = path.join(tmpRoot, "refs", "candidates");
    fs.mkdirSync(serverDir, { recursive: true });
    fs.mkdirSync(candidatesDir, { recursive: true });
    const realModulePath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "loadCandidatesFromRefs.cjs",
    );
    const src = fs.readFileSync(realModulePath, "utf8");
    fs.writeFileSync(path.join(serverDir, "loadCandidatesFromRefs.cjs"), src);
    delete require.cache[path.join(serverDir, "loadCandidatesFromRefs.cjs")];
    mod = require(path.join(serverDir, "loadCandidatesFromRefs.cjs"));
    mod.resetLoadedFlag();
  });

  afterAll(() => {
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  function writeCandidate(slug, body) {
    fs.writeFileSync(
      path.join(candidatesDir, `${slug}.json`),
      JSON.stringify(body, null, 2),
    );
  }

  it("читает все .json файлы и заполняет side-channel", () => {
    writeCandidate("p-one", { id: "p-one", archetype: "detail" });
    writeCandidate("p-two", { id: "p-two", archetype: "catalog" });
    const stats = mod.loadCandidatesFromRefs();
    expect(stats.loaded).toBe(2);
    expect(stats.total).toBe(2);
    expect(mod.getRefCandidates().map((p) => p.id).sort()).toEqual([
      "p-one",
      "p-two",
    ]);
  });

  it("default status=candidate если не указан в JSON", () => {
    writeCandidate("no-status", { id: "no-status" });
    mod.loadCandidatesFromRefs();
    expect(mod.getRefCandidates()[0].status).toBe("candidate");
  });

  it("аннотирует refSource (имя файла) — для curator UI", () => {
    writeCandidate("source-tagged", { id: "source-tagged" });
    mod.loadCandidatesFromRefs();
    expect(mod.getRefCandidates()[0].refSource).toBe("source-tagged.json");
  });

  it("file без id (analyze-*.json manifest) — silently skip", () => {
    writeCandidate("manifest-noid", { archetype: "detail", description: "no id" });
    writeCandidate("good", { id: "good" });
    mod.loadCandidatesFromRefs();
    const all = mod.getRefCandidates();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe("good");
  });

  it("второй вызов кэшируется (cached=true), force перезагружает", () => {
    writeCandidate("c1", { id: "c1" });
    mod.loadCandidatesFromRefs();
    writeCandidate("c2", { id: "c2" });
    const second = mod.loadCandidatesFromRefs();
    expect(second.cached).toBe(true);
    expect(mod.getRefCandidates()).toHaveLength(1);
    const third = mod.loadCandidatesFromRefs({ force: true });
    expect(third.loaded).toBe(2);
    expect(mod.getRefCandidates()).toHaveLength(2);
  });

  it("ENOENT на refs/candidates → 0 без throw", () => {
    fs.rmSync(candidatesDir, { recursive: true });
    const stats = mod.loadCandidatesFromRefs();
    expect(stats.loaded).toBe(0);
    expect(mod.getRefCandidates()).toEqual([]);
  });

  it("serializeRefCandidate — оставляет ключевые поля для UI, hasApply=false", () => {
    const ref = {
      id: "hero-x",
      version: 2,
      archetype: "detail",
      trigger: { requires: [{ kind: "mirror" }] },
      structure: { slot: "hero", description: "rich hero" },
      rationale: { hypothesis: "evidence" },
      falsification: { shouldMatch: [] },
      refSource: "x.json",
    };
    const s = mod.serializeRefCandidate(ref);
    expect(s.id).toBe("hero-x");
    expect(s.archetype).toBe("detail");
    expect(s.trigger.requires[0].kind).toBe("mirror");
    expect(s.structure.slot).toBe("hero");
    expect(s.refSource).toBe("x.json");
    expect(s.hasApply).toBe(false);
    expect(s.status).toBe("candidate");
  });
});
