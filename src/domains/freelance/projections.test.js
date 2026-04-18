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

describe("freelance projections — my_tasks + my_deals (Cycle 2)", () => {
  it("my_tasks — catalog mainEntity Task с фильтром по customerId (own)", () => {
    const p = PROJECTIONS.my_tasks;
    expect(p.kind).toBe("catalog");
    expect(p.mainEntity).toBe("Task");
    expect(p.filter).toContain("customerId");
  });

  it("my_deals — catalog mainEntity Deal, роль-agnostic (customer + executor видят свои)", () => {
    const p = PROJECTIONS.my_deals;
    expect(p.kind).toBe("catalog");
    expect(p.mainEntity).toBe("Deal");
    expect(p.witnesses).toEqual(expect.arrayContaining(["amount", "status", "deadline"]));
  });

  it("ROOT_PROJECTIONS содержит my_tasks и my_deals", () => {
    expect(ROOT_PROJECTIONS).toEqual(expect.arrayContaining(["my_tasks", "my_deals"]));
  });

  it("обе кристаллизуются как catalog", () => {
    const artifacts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, "freelance");
    expect(artifacts.my_tasks.archetype).toBe("catalog");
    expect(artifacts.my_deals.archetype).toBe("catalog");
  });
});

describe("freelance projections — detail (customer + executor)", () => {
  it("task_detail_customer содержит subCollection Response + toolbar action select_executor", () => {
    const p = PROJECTIONS.task_detail_customer;
    expect(p.kind).toBe("detail");
    expect(p.mainEntity).toBe("Task");
    expect(p.subCollections.find(s => s.entity === "Response")).toBeDefined();
  });

  it("deal_detail_customer — detail mainEntity Deal с subCollection Transaction", () => {
    const p = PROJECTIONS.deal_detail_customer;
    expect(p.kind).toBe("detail");
    expect(p.mainEntity).toBe("Deal");
    expect(p.subCollections.find(s => s.entity === "Transaction")).toBeDefined();
  });

  it("deal_detail_executor — detail mainEntity Deal, тот же subCollection но другой idParam scope", () => {
    const p = PROJECTIONS.deal_detail_executor;
    expect(p.kind).toBe("detail");
    expect(p.mainEntity).toBe("Deal");
  });

  it("все 3 кристаллизуются как detail", () => {
    const arts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, "freelance");
    expect(arts.task_detail_customer.archetype).toBe("detail");
    expect(arts.deal_detail_customer.archetype).toBe("detail");
    expect(arts.deal_detail_executor.archetype).toBe("detail");
  });
});

describe("freelance seed", () => {
  const getSeed = () => import("./seed.js").then(m => m.getSeedEffects());

  it("возвращает ≥ 35 эффектов (5 users + 10 tasks + 20 responses)", async () => {
    const seed = await getSeed();
    expect(seed.length).toBeGreaterThanOrEqual(35);
  });

  it("все эффекты confirmed (не proposed)", async () => {
    const seed = await getSeed();
    expect(seed.every(e => e.status === "confirmed")).toBe(true);
  });

  it("хотя бы один User имеет customerVerified && executorVerified (универсал)", async () => {
    const seed = await getSeed();
    const users = seed.filter(e => e.target === "User");
    expect(users.some(u => u.context.customerVerified && u.context.executorVerified)).toBe(true);
  });

  it("все Task имеют customerId, ссылающийся на существующего User", async () => {
    const seed = await getSeed();
    const userIds = new Set(seed.filter(e => e.target === "User").map(e => e.context.id));
    const tasks = seed.filter(e => e.target === "Task");
    expect(tasks.length).toBeGreaterThanOrEqual(10);
    for (const t of tasks) {
      expect(userIds.has(t.context.customerId)).toBe(true);
    }
  });

  it("все Response.taskId → Task.id референтны", async () => {
    const seed = await getSeed();
    const taskIds = new Set(seed.filter(e => e.target === "Task").map(e => e.context.id));
    const responses = seed.filter(e => e.target === "Response");
    expect(responses.length).toBeGreaterThanOrEqual(20);
    for (const r of responses) {
      expect(taskIds.has(r.context.taskId)).toBe(true);
    }
  });
});
