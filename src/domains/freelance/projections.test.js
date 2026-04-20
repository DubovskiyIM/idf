import { describe, it, expect } from "vitest";
import { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
import { INTENTS } from "./intents.js";
import { ONTOLOGY } from "./ontology.js";
import { crystallizeV2, deriveProjections } from "@intent-driven/core";

// Merged как в V2Shell: derived задаёт каркас (kind/mainEntity/filter),
// authored field-level override'ит отдельные поля.
function mergedProjections() {
  const derived = deriveProjections(INTENTS, ONTOLOGY);
  const merged = { ...derived };
  for (const [id, authored] of Object.entries(PROJECTIONS)) {
    merged[id] = merged[id] ? { ...merged[id], ...authored } : authored;
  }
  return merged;
}

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

  it("onItemClick navigates → task_detail (derived, после Stage 5 консолидации)", () => {
    expect(PROJECTIONS.task_catalog_public.onItemClick).toMatchObject({
      action: "navigate",
      to: "task_detail",
    });
  });

  it("кристаллизуется через crystallizeV2 без exceptions", () => {
    const artifacts = crystallizeV2(INTENTS, PROJECTIONS, ONTOLOGY, "freelance");
    expect(artifacts.task_catalog_public).toBeDefined();
    expect(artifacts.task_catalog_public.archetype).toBe("catalog");
  });
});

describe("freelance projections — task_detail (derived + field-level override, Stage 5)", () => {
  it("task_detail consolidated (single projection для customer/guest/executor)", () => {
    // Role-specific wrapper'ы (task_detail_public/_customer) удалены —
    // derived task_detail с per-intent conditions фильтрует toolbar.
    expect(PROJECTIONS.task_detail_public).toBeUndefined();
    expect(PROJECTIONS.task_detail_customer).toBeUndefined();
  });

  it("task_detail authored override имеет display witnesses + toolbar whitelist", () => {
    const p = PROJECTIONS.task_detail;
    expect(p.witnesses).toEqual(expect.arrayContaining([
      "title", "description", "budget", "deadline", "city", "type",
      "status", "createdAt",
    ]));
    expect(p.toolbar).toEqual(["edit_task", "publish_task", "cancel_task_before_deal"]);
  });

  it("кристаллизуется как detail (merged derived + authored)", () => {
    const merged = mergedProjections();
    const artifacts = crystallizeV2(INTENTS, merged, ONTOLOGY, "freelance");
    expect(artifacts.task_detail.archetype).toBe("detail");
  });

  it("все 3 Task customer-intents в toolbar через whitelist + ownership cond", () => {
    const merged = mergedProjections();
    const artifacts = crystallizeV2(INTENTS, merged, ONTOLOGY, "freelance");
    const toolbar = artifacts.task_detail.slots.toolbar;
    const ids = toolbar.map(x => x.intentId).filter(Boolean);
    expect(ids).toEqual(expect.arrayContaining([
      "edit_task", "publish_task", "cancel_task_before_deal",
    ]));
    // Все три имеют customer-ownership condition (Task.ownerField="customerId").
    for (const id of ["edit_task", "publish_task", "cancel_task_before_deal"]) {
      const btn = toolbar.find(x => x.intentId === id);
      expect(btn.condition).toBe("customerId === viewer.id");
    }
  });
});

describe("freelance create_task_draft — formModal archetype (вместо wizard)", () => {
  it("particles.confirmation === 'form' (перенесено внутрь particles, чтобы SDK-матчер formModal его видел)", () => {
    expect(INTENTS.create_task_draft.particles.confirmation).toBe("form");
  });

  it("particles.witnesses length ≥ 2 — триггерит skip heroCreate в SDK controlArchetypes", () => {
    expect(INTENTS.create_task_draft.particles.witnesses?.length).toBeGreaterThanOrEqual(2);
  });

  it("creates === 'Task(draft)' — статусная нотация: новый Task инициализируется в status=draft", () => {
    expect(INTENTS.create_task_draft.creates).toBe("Task(draft)");
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

describe("freelance projections — my_* lists (Cycle 2, derived R7/R7b)", () => {
  it("my_task_list — derived R7 (customerId filter) + authored witnesses", () => {
    const merged = mergedProjections();
    const p = merged.my_task_list;
    expect(p.kind).toBe("catalog");
    expect(p.mainEntity).toBe("Task");
    // filter derived structurally: { field:"customerId", op:"=", value:"me.id" }
    expect(p.filter).toMatchObject({ field: "customerId" });
    // authored override: display-witnesses (не derivable из particles)
    expect(p.witnesses).toEqual(["title", "status", "budget", "deadline", "responsesCount"]);
  });

  it("my_deal_list — derived R7b (multi-owner disjunction customerId||executorId)", () => {
    const merged = mergedProjections();
    const p = merged.my_deal_list;
    expect(p.kind).toBe("catalog");
    expect(p.mainEntity).toBe("Deal");
    expect(p.filter).toMatchObject({ kind: "disjunction" });
    expect(p.filter.fields).toEqual(expect.arrayContaining(["customerId", "executorId"]));
    expect(p.witnesses).toEqual(expect.arrayContaining(["amount", "status", "deadline"]));
  });

  it("my_response_list — derived R7 + authored onItemClick (→ task_detail после Stage 5)", () => {
    const merged = mergedProjections();
    const p = merged.my_response_list;
    expect(p.kind).toBe("catalog");
    expect(p.mainEntity).toBe("Response");
    expect(p.onItemClick).toMatchObject({ to: "task_detail" });
  });

  it("ROOT_PROJECTIONS содержит my_task_list и my_deal_list", () => {
    expect(ROOT_PROJECTIONS).toEqual(expect.arrayContaining(["my_task_list", "my_deal_list"]));
  });

  it("все кристаллизуются как catalog через merged projections", () => {
    const merged = mergedProjections();
    const artifacts = crystallizeV2(INTENTS, merged, ONTOLOGY, "freelance");
    expect(artifacts.my_task_list.archetype).toBe("catalog");
    expect(artifacts.my_deal_list.archetype).toBe("catalog");
    expect(artifacts.my_response_list.archetype).toBe("catalog");
  });
});

describe("freelance projections — deal_detail (derived + whitelist)", () => {
  it("deal_detail — derived detail + authored field-level override", () => {
    const merged = mergedProjections();
    const p = merged.deal_detail;
    expect(p.kind).toBe("detail");
    expect(p.mainEntity).toBe("Deal");
    expect(p.witnesses).toEqual(expect.arrayContaining(["amount", "status", "completedAt"]));
    expect(p.toolbar).toEqual(expect.arrayContaining([
      "accept_result", "request_revision", "submit_work_result",
    ]));
  });

  it("кристаллизуется как detail через merged", () => {
    const merged = mergedProjections();
    const arts = crystallizeV2(INTENTS, merged, ONTOLOGY, "freelance");
    expect(arts.deal_detail.archetype).toBe("detail");
  });
});

describe("freelance projections — my_wallet_detail (derived R3b singleton)", () => {
  it("derived — detail mainEntity Wallet c userId filter + singleton", () => {
    const merged = mergedProjections();
    const p = merged.my_wallet_detail;
    expect(p.kind).toBe("detail");
    expect(p.mainEntity).toBe("Wallet");
    expect(p.singleton).toBe(true);
    expect(p.filter).toMatchObject({ field: "userId" });
  });

  it("доступен в ROOT_PROJECTIONS", () => {
    expect(ROOT_PROJECTIONS).toContain("my_wallet_detail");
  });

  it("authored override добавляет toolbar + reserved в witnesses", () => {
    const merged = mergedProjections();
    const p = merged.my_wallet_detail;
    expect(p.toolbar).toEqual(expect.arrayContaining(["top_up_wallet_by_card"]));
    expect(p.witnesses).toEqual(expect.arrayContaining(["balance", "reserved", "currency"]));
  });

  it("кристаллизуется как detail через merged", () => {
    const merged = mergedProjections();
    const arts = crystallizeV2(INTENTS, merged, ONTOLOGY, "freelance");
    expect(arts.my_wallet_detail.archetype).toBe("detail");
  });
});

describe("freelance intents — permittedFor (multi-owner Deal, backlog 3.2)", () => {
  it("accept_result / request_revision — permittedFor: 'customerId' → customer-only в derived deal_detail", () => {
    const merged = mergedProjections();
    const arts = crystallizeV2(INTENTS, merged, ONTOLOGY, "freelance");
    const toolbar = arts.deal_detail.slots.toolbar;
    const accept = toolbar.find(x => x.intentId === "accept_result");
    expect(accept?.condition).toBe("customerId === viewer.id");
  });

  it("submit_work_result / submit_revision — permittedFor: 'executorId' → executor-only", () => {
    const merged = mergedProjections();
    const arts = crystallizeV2(INTENTS, merged, ONTOLOGY, "freelance");
    // submit_revision уходит в overflow (irreversibility:"high" + >3 intents)
    const toolbarAll = [
      ...arts.deal_detail.slots.toolbar,
      ...(arts.deal_detail.slots.toolbar.find(x => x.type === "overflow")?.children || []),
    ];
    const submitRev = toolbarAll.find(x => x.intentId === "submit_revision");
    expect(submitRev?.condition).toBe("executorId === viewer.id");
  });

  it("cancel_deal_mutual — без permittedFor → both owners (OR-disjunction)", () => {
    const merged = mergedProjections();
    const arts = crystallizeV2(INTENTS, merged, ONTOLOGY, "freelance");
    const toolbar = arts.deal_detail.slots.toolbar;
    const cancel = toolbar.find(x => x.intentId === "cancel_deal_mutual");
    expect(cancel?.condition).toContain("customerId === viewer.id");
    expect(cancel?.condition).toContain("executorId === viewer.id");
  });

  it("Deal.owners — единственная декларация multi-owner (core@0.33.1+)", () => {
    expect(ONTOLOGY.entities.Deal.ownerField).toBeUndefined();
    expect(ONTOLOGY.entities.Deal.owners).toEqual(["customerId", "executorId"]);
  });
});

describe("freelance crystallize — irreversible-confirm matching (__irr intents)", () => {
  it("confirm_deal/accept_result/auto_accept_result имеют irreversibility=high — матчатся patternом", () => {
    const irrHigh = Object.values(INTENTS).filter(i => i.irreversibility === "high");
    expect(irrHigh.length).toBeGreaterThanOrEqual(3);
    const ids = irrHigh.map(i => i.id || Object.keys(INTENTS).find(k => INTENTS[k] === i));
    expect(ids).toEqual(expect.arrayContaining(["confirm_deal", "accept_result", "auto_accept_result"]));
  });

  it("deal_detail имеет toolbar с accept_result — overlay автоматически через confirmDialog archetype", () => {
    const merged = mergedProjections();
    const arts = crystallizeV2(INTENTS, merged, ONTOLOGY, "freelance");
    const dealArt = arts.deal_detail;
    expect(dealArt).toBeDefined();
    const overlayItems = dealArt.slots?.overlay || [];
    const acceptOverlay = overlayItems.find(o => o?.triggerIntentId === "accept_result");
    expect(acceptOverlay).toBeDefined();
    expect(acceptOverlay.type).toBe("confirmDialog");
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
