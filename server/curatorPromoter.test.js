import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  renderCandidateModule,
  renderChangeset,
  patchCuratedJs,
  slugify,
} = require("./curatorPromoter.cjs");

describe("curatorPromoter · pure helpers", () => {
  describe("slugify", () => {
    it("kebab-case + truncate", () => {
      expect(slugify("Pattern-X with weird _stuff!")).toBe("pattern-x-with-weird-stuff");
    });
    it("trims leading/trailing dashes", () => {
      expect(slugify("--abc--")).toBe("abc");
    });
  });

  describe("renderCandidateModule", () => {
    it("эмиттит export default JSON, удаляет refSource", () => {
      const out = renderCandidateModule({
        id: "x",
        archetype: "detail",
        refSource: "host-only.json",
        trigger: { requires: [] },
      });
      expect(out).toMatch(/export default/);
      expect(out).toMatch(/"id": "x"/);
      expect(out).toMatch(/"archetype": "detail"/);
      expect(out).not.toMatch(/refSource/);
    });
    it("комментарий с timestamp в header", () => {
      const out = renderCandidateModule({ id: "y" });
      expect(out).toMatch(/promoted from refs\/candidates\//);
      expect(out).toMatch(/curator workspace at \d{4}-/);
    });
  });

  describe("renderChangeset", () => {
    it("YAML-frontmatter с patch для @intent-driven/core", () => {
      const out = renderChangeset({ id: "z" }, "Custom summary");
      expect(out).toMatch(/^---\n"@intent-driven\/core": patch\n---\n/);
      expect(out).toMatch(/Custom summary/);
    });
    it("без summary — fallback к 'Promote candidate ...'", () => {
      const out = renderChangeset({ id: "z" }, null);
      expect(out).toMatch(/Promote candidate `z`/);
    });
  });

  describe("patchCuratedJs", () => {
    let tmp;
    let curatedPath;

    beforeEach(() => {
      tmp = mkdtempSync(join(tmpdir(), "curated-"));
      curatedPath = join(tmp, "curated.js");
      writeFileSync(
        curatedPath,
        `import existing from "./detail/existing.js";
import otherThing from "./catalog/other.js";

const CURATED_CANDIDATES = [
  existing,
  otherThing,
];

export { CURATED_CANDIDATES };
`,
        "utf8",
      );
    });

    it("вставляет import + entry в массив", () => {
      const result = patchCuratedJs(curatedPath, "detail", "new-pattern-id");
      expect(result.changed).toBe(true);
      const src = readFileSync(curatedPath, "utf8");
      expect(src).toMatch(/import new_pattern_id from "\.\/detail\/new-pattern-id\.js";/);
      expect(src).toMatch(/new_pattern_id,/);
      // Sanity — старые импорты не сломались
      expect(src).toMatch(/existing,/);
      expect(src).toMatch(/otherThing,/);
    });

    it("idempotent — повторный вызов skip'ит", () => {
      patchCuratedJs(curatedPath, "detail", "p");
      const second = patchCuratedJs(curatedPath, "detail", "p");
      expect(second.changed).toBe(false);
      expect(second.reason).toBe("already-imported");
    });

    it("id с дефисами → moduleVar c подчёркиваниями", () => {
      patchCuratedJs(curatedPath, "feed", "multi-word-pattern");
      const src = readFileSync(curatedPath, "utf8");
      expect(src).toMatch(/import multi_word_pattern from/);
      expect(src).toMatch(/multi_word_pattern,/);
    });
  });

  describe("patchAntiIndex (anti-bank scaffold)", () => {
    let tmp;
    let antiPath;
    let patchAntiIndex;

    beforeEach(() => {
      tmp = mkdtempSync(join(tmpdir(), "anti-"));
      antiPath = join(tmp, "index.js");
      writeFileSync(
        antiPath,
        `/**\n * Anti scaffold.\n */\nexport const ANTI_PATTERNS = [];\n\nexport function getAntiPatterns() {\n  return ANTI_PATTERNS.slice();\n}\n`,
        "utf8",
      );
      patchAntiIndex = require("./curatorPromoter.cjs").patchAntiIndex;
    });

    it("первый patch на пустой scaffold добавляет import + entry в массив", () => {
      const result = patchAntiIndex(antiPath, "detail", "modal-on-modal");
      expect(result.changed).toBe(true);
      const src = readFileSync(antiPath, "utf8");
      expect(src).toMatch(/import modal_on_modal from "\.\/detail\/modal-on-modal\.js";/);
      expect(src).toMatch(/modal_on_modal,/);
      // ANTI_PATTERNS массив не сломан
      expect(src).toMatch(/export const ANTI_PATTERNS = \[/);
      expect(src).toMatch(/getAntiPatterns/);
    });

    it("idempotent — повторный patch skip'ит", () => {
      patchAntiIndex(antiPath, "detail", "x");
      const second = patchAntiIndex(antiPath, "detail", "x");
      expect(second.changed).toBe(false);
      expect(second.reason).toBe("already-imported");
    });
  });
});

describe("promoteBatchToSdkPr · guards", () => {
  it("пустой patternIds → empty-batch", async () => {
    const { promoteBatchToSdkPr } = require("./curatorPromoter.cjs");
    const r = await promoteBatchToSdkPr({ patternIds: [] });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("empty-batch");
  });

  it("без CURATOR_PR_ENABLED → disabled", async () => {
    delete process.env.CURATOR_PR_ENABLED;
    const { promoteBatchToSdkPr } = require("./curatorPromoter.cjs");
    const r = await promoteBatchToSdkPr({ patternIds: ["p1"] });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("disabled");
  });

  it("CURATOR_PR_ENABLED=1 без IDF_SDK_PATH → sdk-path-missing", async () => {
    process.env.CURATOR_PR_ENABLED = "1";
    delete process.env.IDF_SDK_PATH;
    const { promoteBatchToSdkPr } = require("./curatorPromoter.cjs");
    const r = await promoteBatchToSdkPr({ patternIds: ["p1"] });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("sdk-path-missing");
    delete process.env.CURATOR_PR_ENABLED;
  });
});

describe("promoteToSdkPr · disabled-state guards", () => {
  it("без CURATOR_PR_ENABLED → ok=false, error=disabled", async () => {
    delete process.env.CURATOR_PR_ENABLED;
    const { promoteToSdkPr } = require("./curatorPromoter.cjs");
    const r = await promoteToSdkPr({ patternId: "any" });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("disabled");
  });

  it("с CURATOR_PR_ENABLED=1 но без IDF_SDK_PATH → ok=false, error=sdk-path-missing", async () => {
    process.env.CURATOR_PR_ENABLED = "1";
    delete process.env.IDF_SDK_PATH;
    const { promoteToSdkPr } = require("./curatorPromoter.cjs");
    const r = await promoteToSdkPr({ patternId: "any" });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("sdk-path-missing");
    delete process.env.CURATOR_PR_ENABLED;
  });
});
