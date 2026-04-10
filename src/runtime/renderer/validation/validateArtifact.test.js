import { describe, it, expect } from "vitest";
import { validateArtifact } from "./validateArtifact.js";

const validFeed = {
  projection: "chat_view",
  domain: "messenger",
  layer: "canonical",
  archetype: "feed",
  version: 2,
  generatedAt: 1712750000000,
  generatedBy: "rules",
  inputsHash: "abc",
  slots: {
    header: [],
    toolbar: [],
    body: { type: "list", source: "messages", item: { type: "text", bind: "item.content" } },
    context: [],
    fab: [],
    overlay: [],
    composer: { type: "composer", primaryIntent: "send_message", primaryParameter: "text" },
  },
  nav: { outgoing: [], incoming: [] },
};

describe("validateArtifact", () => {
  it("принимает минимальный валидный feed", () => {
    const r = validateArtifact(validFeed);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("отклоняет артефакт без version", () => {
    const bad = { ...validFeed, version: undefined };
    const r = validateArtifact(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes("version"))).toBe(true);
  });

  it("отклоняет неизвестный archetype", () => {
    const bad = { ...validFeed, archetype: "pyramid" };
    const r = validateArtifact(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes("archetype"))).toBe(true);
  });

  it("требует composer для feed", () => {
    const bad = { ...validFeed, slots: { ...validFeed.slots, composer: undefined } };
    const r = validateArtifact(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes("composer"))).toBe(true);
  });

  it("требует body для любого архетипа", () => {
    const bad = { ...validFeed, slots: { ...validFeed.slots, body: undefined } };
    const r = validateArtifact(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes("body"))).toBe(true);
  });

  it("отклоняет дубликаты key в overlay", () => {
    const bad = {
      ...validFeed,
      slots: { ...validFeed.slots, overlay: [
        { type: "formModal", key: "k1", intentId: "x", parameters: [] },
        { type: "formModal", key: "k1", intentId: "y", parameters: [] },
      ]},
    };
    const r = validateArtifact(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes("duplicate"))).toBe(true);
  });

  it("накапливает несколько ошибок сразу (не early-return)", () => {
    const bad = {
      // ни версии, ни archetype, ни slots
      projection: "foo",
    };
    const r = validateArtifact(bad);
    expect(r.ok).toBe(false);
    // Должны накопиться минимум 3 ошибки: version, archetype, slots
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
    expect(r.errors.some(e => e.includes("version"))).toBe(true);
    expect(r.errors.some(e => e.includes("archetype"))).toBe(true);
    expect(r.errors.some(e => e.includes("slots"))).toBe(true);
  });

  it("отклоняет неизвестный parameter.control", () => {
    const bad = {
      ...validFeed,
      slots: {
        ...validFeed.slots,
        overlay: [
          { type: "formModal", key: "k1", intentId: "x",
            parameters: [{ name: "foo", control: "hologram" }] },
        ],
      },
    };
    const r = validateArtifact(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes("hologram") || e.includes("control"))).toBe(true);
  });

  it("отклоняет overlay без key", () => {
    const bad = {
      ...validFeed,
      slots: {
        ...validFeed.slots,
        overlay: [
          { type: "formModal", intentId: "x", parameters: [] },
        ],
      },
    };
    const r = validateArtifact(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.some(e => e.includes("key"))).toBe(true);
  });
});
