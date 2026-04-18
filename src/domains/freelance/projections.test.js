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

describe("freelance projections — task_detail_public", () => {
  it("зарегистрирована как detail", () => {
    const p = PROJECTIONS.task_detail_public;
    expect(p).toBeDefined();
    expect(p.kind).toBe("detail");
    expect(p.mainEntity).toBe("Task");
  });

  it("idParam = 'taskId'", () => {
    expect(PROJECTIONS.task_detail_public.idParam).toBe("taskId");
  });

  it("witnesses содержат полное описание", () => {
    const w = PROJECTIONS.task_detail_public.witnesses;
    expect(w).toEqual(expect.arrayContaining([
      "title", "description", "budget", "deadline", "city", "type",
    ]));
  });

  it("subCollections объявляет responses (FK taskId)", () => {
    const sc = PROJECTIONS.task_detail_public.subCollections;
    expect(sc).toBeDefined();
    const resp = sc.find(s => s.entity === "Response");
    expect(resp).toBeDefined();
    expect(resp.foreignKey).toBe("taskId");
  });

  it("кристаллизуется как detail", () => {
    const artifacts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, "freelance");
    expect(artifacts.task_detail_public.archetype).toBe("detail");
  });
});

describe("freelance projections — create_task_wizard", () => {
  it("зарегистрирована как wizard", () => {
    const p = PROJECTIONS.create_task_wizard;
    expect(p).toBeDefined();
    expect(p.kind).toBe("wizard");
    expect(p.mainEntity).toBe("Task");
  });

  it("steps описывают 3 шага минимум (категория / детали / подтверждение)", () => {
    const steps = PROJECTIONS.create_task_wizard.steps;
    expect(steps.length).toBeGreaterThanOrEqual(3);
    const ids = steps.map(s => s.id);
    expect(ids).toContain("category");
    expect(ids).toContain("details");
    expect(ids).toContain("confirm");
  });

  it("финальный шаг вызывает create_task_draft", () => {
    const confirm = PROJECTIONS.create_task_wizard.steps.find(s => s.id === "confirm");
    expect(confirm.intent).toBe("create_task_draft");
  });

  it("кристаллизуется как wizard", () => {
    const artifacts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, "freelance");
    expect(artifacts.create_task_wizard.archetype).toBe("wizard");
  });

  it("ROOT_PROJECTIONS включает catalog и wizard", () => {
    expect(ROOT_PROJECTIONS).toEqual(expect.arrayContaining([
      "task_catalog_public", "create_task_wizard",
    ]));
  });
});
