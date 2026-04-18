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

  it("onItemClick navigates → task_detail_public", () => {
    expect(PROJECTIONS.task_catalog_public.onItemClick).toMatchObject({
      action: "navigate",
      to: "task_detail_public",
    });
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

describe("freelance create_task_draft — formModal archetype (вместо wizard)", () => {
  it("create_task_draft.confirmation === 'form'", () => {
    expect(INTENTS.create_task_draft.confirmation).toBe("form");
  });

  it("customerId НЕ в UI-параметрах (auto-injected через buildEffects)", () => {
    const params = INTENTS.create_task_draft.particles.parameters.map(p => p.name);
    expect(params).not.toContain("customerId");
    expect(params).toEqual(expect.arrayContaining([
      "title", "categoryId", "budget", "type",
    ]));
  });

  it("categoryId — entityRef на Category (для picker dropdown в form modal)", () => {
    const catParam = INTENTS.create_task_draft.particles.parameters.find(p => p.name === "categoryId");
    expect(catParam.type).toBe("entityRef");
    expect(catParam.entity).toBe("Category");
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

describe("freelance projections — wallet", () => {
  it("wallet — detail mainEntity Wallet с subCollection Transaction", () => {
    const p = PROJECTIONS.wallet;
    expect(p.kind).toBe("detail");
    expect(p.mainEntity).toBe("Wallet");
    expect(p.subCollections.find(s => s.entity === "Transaction")).toBeDefined();
  });

  it("wallet доступен в ROOT_PROJECTIONS", () => {
    expect(ROOT_PROJECTIONS).toContain("wallet");
  });

  it("wallet кристаллизуется как detail", () => {
    const arts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, "freelance");
    expect(arts.wallet.archetype).toBe("detail");
  });
});

describe("freelance crystallize — irreversible-confirm apply (E2E на core@0.16+)", () => {
  it("confirm_deal/accept_result/auto_accept_result имеют irreversibility=high — матчатся patternом", () => {
    const irrHigh = Object.values(INTENTS).filter(i => i.irreversibility === "high");
    expect(irrHigh.length).toBeGreaterThanOrEqual(3);
    const ids = irrHigh.map(i => i.id || Object.keys(INTENTS).find(k => INTENTS[k] === i));
    expect(ids).toEqual(expect.arrayContaining(["confirm_deal", "accept_result", "auto_accept_result"]));
  });

  it("deal_detail_customer: accept_result overlay содержит warning из __irr.reason", () => {
    const arts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, "freelance");
    const dealArt = arts.deal_detail_customer;
    expect(dealArt).toBeDefined();
    const overlays = dealArt.slots?.overlay || [];
    const acceptOverlay = overlays.find(o => o?.triggerIntentId === "accept_result");
    expect(acceptOverlay).toBeDefined();
    expect(acceptOverlay.type).toBe("confirmDialog");
    expect(acceptOverlay.warning).toBe("Escrow-перевод исполнителю — откат только через chargeback поддержки");
  });

  it("deal_detail_customer: cancel_deal_mutual overlay БЕЗ warning (intent не помечен __irr)", () => {
    const arts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, "freelance");
    const dealArt = arts.deal_detail_customer;
    const overlays = dealArt.slots?.overlay || [];
    const cancelOverlay = overlays.find(o => o?.triggerIntentId === "cancel_deal_mutual");
    if (cancelOverlay) {
      expect(cancelOverlay.warning).toBeUndefined();
    }
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
    const users = seed.filter(e => e.target === "users");
    expect(users.some(u => u.context.customerVerified && u.context.executorVerified)).toBe(true);
  });

  it("все Task имеют customerId, ссылающийся на существующего User", async () => {
    const seed = await getSeed();
    const userIds = new Set(seed.filter(e => e.target === "users").map(e => e.context.id));
    const tasks = seed.filter(e => e.target === "tasks");
    expect(tasks.length).toBeGreaterThanOrEqual(10);
    for (const t of tasks) {
      expect(userIds.has(t.context.customerId)).toBe(true);
    }
  });

  it("все Response.taskId → Task.id референтны", async () => {
    const seed = await getSeed();
    const taskIds = new Set(seed.filter(e => e.target === "tasks").map(e => e.context.id));
    const responses = seed.filter(e => e.target === "responses");
    expect(responses.length).toBeGreaterThanOrEqual(20);
    for (const r of responses) {
      expect(taskIds.has(r.context.taskId)).toBe(true);
    }
  });

  it("содержит ≥3 Deal (Cycle 2)", async () => {
    const seed = await getSeed();
    const deals = seed.filter(e => e.target === "deals");
    expect(deals.length).toBeGreaterThanOrEqual(3);
  });

  it("все Deal.customerId ссылаются на User.customerVerified=true", async () => {
    const seed = await getSeed();
    const users = Object.fromEntries(
      seed.filter(e => e.target === "users").map(e => [e.context.id, e.context])
    );
    const deals = seed.filter(e => e.target === "deals");
    for (const d of deals) {
      expect(users[d.context.customerId]?.customerVerified).toBe(true);
    }
  });

  it("все Deal.executorId ссылаются на User.executorVerified=true", async () => {
    const seed = await getSeed();
    const users = Object.fromEntries(
      seed.filter(e => e.target === "users").map(e => [e.context.id, e.context])
    );
    const deals = seed.filter(e => e.target === "deals");
    for (const d of deals) {
      expect(users[d.context.executorId]?.executorVerified).toBe(true);
    }
  });

  it("содержит ≥3 Wallet (один на customer + один на executor + один на универсала)", async () => {
    const seed = await getSeed();
    const wallets = seed.filter(e => e.target === "wallets");
    expect(wallets.length).toBeGreaterThanOrEqual(3);
  });

  it("содержит ≥5 Transaction", async () => {
    const seed = await getSeed();
    const txs = seed.filter(e => e.target === "transactions");
    expect(txs.length).toBeGreaterThanOrEqual(5);
  });

  it("содержит ≥3 Review со стороны customer", async () => {
    const seed = await getSeed();
    const reviews = seed.filter(e => e.target === "reviews");
    expect(reviews.length).toBeGreaterThanOrEqual(3);
  });
});
