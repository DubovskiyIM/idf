import { describe, it, expect } from "vitest";
import {
  extractJSON,
  buildPrompt,
  parseArgs,
  collectExplicitOverrides,
  classifyOverride,
  validateCandidate,
} from "./pattern-researcher.mjs";

describe("extractJSON", () => {
  it("extracts JSON from markdown code block", () => {
    const text = 'Some text\n```json\n{"id": "test"}\n```\nMore text';
    expect(extractJSON(text)).toEqual({ id: "test" });
  });

  it("extracts JSON from multiline block", () => {
    const text = '```json\n{\n  "source": "linear",\n  "entities": []\n}\n```';
    expect(extractJSON(text)).toEqual({ source: "linear", entities: [] });
  });

  it("throws when no JSON block found", () => {
    expect(() => extractJSON("no json here")).toThrow("No JSON block");
  });

  it("throws on invalid JSON", () => {
    expect(() => extractJSON("```json\n{bad json}\n```")).toThrow();
  });
});

describe("buildPrompt", () => {
  it("replaces placeholders", () => {
    const template = "Hello {{NAME}}, you have {{COUNT}} items";
    expect(buildPrompt(template, { NAME: "World", COUNT: "5" })).toBe("Hello World, you have 5 items");
  });

  it("leaves unknown placeholders as-is", () => {
    expect(buildPrompt("{{KNOWN}} and {{UNKNOWN}}", { KNOWN: "yes" })).toBe("yes and {{UNKNOWN}}");
  });
});

describe("parseArgs", () => {
  it("parses extract mode", () => {
    const args = parseArgs(["--source", "linear", "--url", "https://example.com"]);
    expect(args.mode).toBe("extract");
    expect(args.source).toBe("linear");
    expect(args.url).toBe("https://example.com");
  });

  it("parses analyze mode", () => {
    const args = parseArgs(["--analyze"]);
    expect(args.mode).toBe("analyze");
  });

  it("parses dry-run", () => {
    const args = parseArgs(["--source", "test", "--description", "todo list", "--dry-run"]);
    expect(args.dryRun).toBe(true);
    expect(args.source).toBe("test");
  });

  it("parses image and archetype", () => {
    const args = parseArgs(["--source", "x", "--image", "./img.png", "--archetype", "detail"]);
    expect(args.image).toBe("./img.png");
    expect(args.archetype).toBe("detail");
  });

  it("throws when no source and no analyze", () => {
    expect(() => parseArgs([])).toThrow();
  });

  it("throws when source but no input (non dry-run)", () => {
    expect(() => parseArgs(["--source", "test"])).toThrow("at least one");
  });

  it("allows source without input in dry-run", () => {
    const args = parseArgs(["--source", "test", "--dry-run"]);
    expect(args.mode).toBe("extract");
    expect(args.dryRun).toBe(true);
  });
});

describe("collectExplicitOverrides", () => {
  it("returns array", () => {
    const result = collectExplicitOverrides();
    expect(Array.isArray(result)).toBe(true);
  });

  it("finds overrides in real domains", () => {
    const result = collectExplicitOverrides();
    // planning/poll_overview has subCollections, progress, voterSelector, footerIntents
    const planningOverrides = result.filter(o => o.domain === "planning");
    expect(planningOverrides.length).toBeGreaterThan(0);
  });

  it("each override has required fields", () => {
    const result = collectExplicitOverrides();
    for (const o of result) {
      expect(o.domain).toBeTruthy();
      expect(o.projection).toBeTruthy();
      expect(o.type).toBeTruthy();
      expect(o.kind).toBeTruthy();
      expect(o.mainEntity).toBeTruthy();
    }
  });
});

describe("classifyOverride", () => {
  it("subCollections → covered by subcollections", () => {
    const result = classifyOverride({ type: "subCollections" });
    expect(result.covered).toBe(true);
    expect(result.coveredBy).toBe("subcollections");
  });

  it("layout → covered by grid-card-layout", () => {
    const result = classifyOverride({ type: "layout" });
    expect(result.covered).toBe(true);
    expect(result.coveredBy).toBe("grid-card-layout");
  });

  it("progress → not covered", () => {
    const result = classifyOverride({ type: "progress" });
    expect(result.covered).toBe(false);
  });

  it("voterSelector → not covered", () => {
    const result = classifyOverride({ type: "voterSelector" });
    expect(result.covered).toBe(false);
  });
});

describe("validateCandidate", () => {
  it("valid candidate passes", () => {
    const c = {
      id: "test", trigger: { requires: [] }, structure: { slot: "hero" },
      rationale: { hypothesis: "x" },
      falsification: {
        shouldMatch: [{ domain: "a", projection: "b", reason: "c" }],
        shouldNotMatch: [{ domain: "d", projection: "e", reason: "f" }],
      },
    };
    const report = validateCandidate(c);
    expect(report.formatValid).toBe(true);
    expect(report.overlaps).toEqual([]);
  });

  it("missing id fails", () => {
    const report = validateCandidate({});
    expect(report.formatValid).toBe(false);
    expect(report.formatError).toContain("id");
  });

  it("overlapping id detected", () => {
    const c = {
      id: "hero-create", trigger: { requires: [] }, structure: { slot: "hero" },
      rationale: { hypothesis: "x" },
      falsification: {
        shouldMatch: [{ domain: "a", projection: "b", reason: "c" }],
        shouldNotMatch: [{ domain: "d", projection: "e", reason: "f" }],
      },
    };
    const report = validateCandidate(c);
    expect(report.overlaps).toContain("hero-create");
  });
});
