import { describe, it, expect, afterEach } from "vitest";
const fs = require("fs");
const path = require("path");
const { createDomainSkeleton } = require("./domainCreator.js");

const TMP = path.resolve(__dirname, "..", "..", "src", "domains", "__test_tmp");

afterEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true });
});

describe("createDomainSkeleton", () => {
  it("creates 4 files with empty exports matching pattern", () => {
    createDomainSkeleton("__test_tmp", "Тестовый домен");
    expect(fs.existsSync(path.join(TMP, "domain.js"))).toBe(true);
    expect(fs.existsSync(path.join(TMP, "intents.js"))).toBe(true);
    expect(fs.existsSync(path.join(TMP, "ontology.js"))).toBe(true);
    expect(fs.existsSync(path.join(TMP, "projections.js"))).toBe(true);
    const intents = fs.readFileSync(path.join(TMP, "intents.js"), "utf8");
    expect(intents).toMatch(/export const INTENTS = \{/);
  });

  it("throws if domain already exists", () => {
    createDomainSkeleton("__test_tmp", "test");
    expect(() => createDomainSkeleton("__test_tmp", "test")).toThrow(/already exists/);
  });

  it("rejects unsafe names", () => {
    expect(() => createDomainSkeleton("../evil", "x")).toThrow(/invalid name/);
    expect(() => createDomainSkeleton("a/b", "x")).toThrow(/invalid name/);
  });
});
