/**
 * Notion baseline smoke (18-й полевой тест).
 * Валидирует, что онтология собирается, кристаллизатор не падает,
 * seed разворачивается, ROOT_PROJECTIONS отфильтрован absorbed-children'ом.
 */
import { describe, it, expect } from "vitest";
import { crystallizeV2, deriveProjections, fold } from "@intent-driven/core";
import { ONTOLOGY, INTENTS, PROJECTIONS, ROOT_PROJECTIONS, getSeedEffects } from "../domain.js";

describe("notion baseline", () => {
  it("ontology imported: 12 сущностей, 5 ролей", () => {
    expect(Object.keys(ONTOLOGY.entities).length).toBe(12);
    expect(Object.keys(ONTOLOGY.roles).length).toBe(5);
  });

  it("polymorphic Block с 15 variant'ами", () => {
    const block = ONTOLOGY.entities.Block;
    expect(block.kind).toBe("polymorphic");
    expect(block.discriminator).toBe("kind");
    expect(Object.keys(block.variants).length).toBe(15);
    expect(block.variants.code.fields.language).toBeDefined();
    expect(block.variants.image.fields.src).toBeDefined();
  });

  it("self-referential Page (parentPageId → Page)", () => {
    const page = ONTOLOGY.entities.Page;
    expect(page.fields.parentPageId.entity).toBe("Page");
    // invariant page_no_self_parent
    const cycleInv = ONTOLOGY.invariants.find(i => i.name === "page_no_self_parent");
    expect(cycleInv).toBeDefined();
  });

  it("intents: ~60 в 8 категориях", () => {
    const ids = Object.keys(INTENTS);
    expect(ids.length).toBeGreaterThanOrEqual(55);
    expect(ids.length).toBeLessThanOrEqual(70);
    // sanity-checks
    expect(INTENTS.archive_page.context.__irr.point).toBe("medium");
    expect(INTENTS.unarchive_page.permittedFor).toContain("workspaceOwner");
  });

  it("seed разворачивается без коллизий", () => {
    const effects = getSeedEffects();
    expect(effects.length).toBeGreaterThanOrEqual(80);
    const ids = effects.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("crystallizeV2 не падает на наборе projections", () => {
    const artifacts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, "notion");
    expect(artifacts).toBeDefined();
    // Возвращает map projId → artifact
    expect(Object.keys(artifacts).length).toBeGreaterThanOrEqual(Object.keys(PROJECTIONS).length);
    // Каждый artifact должен иметь archetype
    for (const id of Object.keys(PROJECTIONS)) {
      expect(artifacts[id]).toBeDefined();
      expect(artifacts[id].archetype).toBeDefined();
    }
  });

  it("fold seed → world", () => {
    const effects = getSeedEffects();
    const world = fold(effects);
    expect(world).toBeDefined();
    expect(world.workspaces).toBeDefined();
    expect(world.pages).toBeDefined();
    expect(Object.keys(world.pages).length).toBeGreaterThanOrEqual(8);
  });

  it("ROOT_PROJECTIONS — 5 ролей", () => {
    expect(ROOT_PROJECTIONS.workspaceOwner).toBeDefined();
    expect(ROOT_PROJECTIONS.editor).toBeDefined();
    expect(ROOT_PROJECTIONS.commenter).toBeDefined();
    expect(ROOT_PROJECTIONS.viewer).toBeDefined();
    expect(ROOT_PROJECTIONS.agent).toBeDefined();
  });

  it("invariants: 19 referential + 4 cardinality + 7 expression", () => {
    const byKind = ONTOLOGY.invariants.reduce((acc, inv) => {
      acc[inv.kind] = (acc[inv.kind] || 0) + 1;
      return acc;
    }, {});
    expect(byKind.referential).toBe(19);
    expect(byKind.cardinality).toBe(4);
    expect(byKind.expression).toBe(7);
  });
});
