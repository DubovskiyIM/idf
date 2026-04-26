/**
 * Smoke-тест Meta Studio shell (Task 11).
 */
import { describe, it, expect } from "vitest";
import { ONTOLOGY, INTENTS, PROJECTIONS, ROOT_PROJECTIONS } from "../domain.js";

describe("meta studio shell", () => {
  it("meta_studio projection задана как canvas-archetype", () => {
    expect(PROJECTIONS.meta_studio).toBeDefined();
    expect(PROJECTIONS.meta_studio.archetype).toBe("canvas");
    expect(PROJECTIONS.meta_studio.mainEntity).toBe("Domain");
    expect(PROJECTIONS.meta_studio.forRoles).toEqual(
      expect.arrayContaining(["formatAuthor", "domainAuthor", "patternCurator", "integrator"]),
    );
  });

  it("meta_studio первая item в первой section ROOT_PROJECTIONS (default landing)", () => {
    const firstSection = ROOT_PROJECTIONS[0];
    expect(firstSection.section).toBe("Studio");
    expect(firstSection.items[0]).toBe("meta_studio");
  });

  it("counts онтологии непустые (для SummaryCard)", () => {
    expect(Object.keys(ONTOLOGY.entities).length).toBeGreaterThanOrEqual(9);
    expect(Object.keys(ONTOLOGY.roles).length).toBe(4);
    expect(Object.keys(INTENTS).length).toBeGreaterThanOrEqual(4);
    expect((ONTOLOGY.invariants || []).length).toBeGreaterThanOrEqual(8);
  });
});
