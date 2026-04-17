import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { writePatternPreference } from "./patternPreferenceWriter.js";

function makeTempFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pattern-pref-"));
  const file = path.join(dir, "projections.js");
  fs.writeFileSync(file, content);
  return file;
}

describe("writePatternPreference", () => {
  it("adds patterns.enabled for projection when missing", () => {
    const src = `export const projections = {
  my_proj: { mainEntity: "Portfolio", kind: "detail" },
};
`;
    const file = makeTempFile(src);
    writePatternPreference(file, "my_proj", "grid-card-layout", "enable");
    const after = fs.readFileSync(file, "utf8");
    expect(after).toMatch(/patterns:\s*\{\s*enabled:\s*\[\s*"grid-card-layout"\s*\]/);
  });

  it("moves pattern from disabled to enabled", () => {
    const src = `export const projections = {
  my_proj: { mainEntity: "X", patterns: { enabled: [], disabled: ["grid-card-layout"] } },
};
`;
    const file = makeTempFile(src);
    writePatternPreference(file, "my_proj", "grid-card-layout", "enable");
    const after = fs.readFileSync(file, "utf8");
    expect(after).toMatch(/enabled:\s*\[\s*"grid-card-layout"\s*\]/);
    expect(after).toMatch(/disabled:\s*\[\s*\]/);
  });

  it("clear removes from both lists", () => {
    const src = `export const projections = {
  my_proj: { mainEntity: "X", patterns: { enabled: ["p1"], disabled: [] } },
};
`;
    const file = makeTempFile(src);
    writePatternPreference(file, "my_proj", "p1", "clear");
    const after = fs.readFileSync(file, "utf8");
    expect(after).not.toMatch(/"p1"/);
  });

  it("throws on missing projection", () => {
    const file = makeTempFile(`export const projections = {};`);
    expect(() => writePatternPreference(file, "missing", "p1", "enable")).toThrow();
  });
});
