import { describe, it, expect } from "vitest";
import { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
import { INTENTS } from "./intents.js";
import { ONTOLOGY } from "./ontology.js";
import { crystallizeV2 } from "@intent-driven/core";

describe("freelance projections — task_catalog_public", () => {
  it("зарегистрирована как catalog", () => {
    const p = PROJECTIONS.task_catalog_public;
    expect(p).toBeDefined();
    expect(p.kind).toBe("catalog");
    expect(p.mainEntity).toBe("Task");
  });

  it("witnesses содержат title, budget, deadline, city", () => {
    const w = PROJECTIONS.task_catalog_public.witnesses;
    expect(w).toEqual(expect.arrayContaining(["title", "budget", "deadline", "city"]));
  });

  it("имеет filter по Task.status === 'published'", () => {
    expect(PROJECTIONS.task_catalog_public.filter).toContain("published");
  });

  it("clickNavigate → task_detail_public", () => {
    expect(PROJECTIONS.task_catalog_public.clickNavigate).toBe("task_detail_public");
  });

  it("кристаллизуется через crystallizeV2 без exceptions", () => {
    const artifacts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, "freelance");
    expect(artifacts.task_catalog_public).toBeDefined();
    expect(artifacts.task_catalog_public.archetype).toBe("catalog");
  });
});
