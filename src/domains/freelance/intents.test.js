import { describe, it, expect } from "vitest";
import { INTENTS } from "./intents.js";

const GROUPS = {
  auth: ["register_by_email", "verify_email", "login", "logout", "reset_password"],
  system: ["schedule_timer", "revoke_timer", "session_set_active_role"],
  profile: [
    "update_profile", "update_bio", "add_skill", "remove_skill",
    "add_portfolio_item", "update_rates", "toggle_availability",
    "activate_executor_profile",
  ],
  task: [
    "create_task_draft", "submit_task_for_moderation", "edit_task",
    "publish_task", "cancel_task_before_deal",
    "search_tasks", "filter_by_category", "sort_tasks",
  ],
  response: [
    "submit_response", "edit_response", "withdraw_response",
    "select_executor", "view_responses",
  ],
  deal: [
    "confirm_deal", "submit_work_result", "accept_result",
    "auto_accept_result", "request_revision", "submit_revision",
    "cancel_deal_mutual",
  ],
  wallet: [
    "top_up_wallet_by_card", "view_transaction_history", "charge_commission",
    "reserve_escrow", "release_escrow", "refund_escrow", "view_wallet_balance",
  ],
  review: ["leave_review", "reply_to_review", "view_reviews_for_user"],
};

describe("freelance intents — auth + system", () => {
  for (const [group, ids] of Object.entries(GROUPS)) {
    for (const id of ids) {
      it(`${group}: ${id} зарегистрирован с α и particles`, () => {
        const intent = INTENTS[id];
        expect(intent, `intent ${id}`).toBeDefined();
        expect(intent.α).toMatch(/^(add|replace|remove)$/);
        expect(intent.particles).toBeDefined();
      });
    }
  }

  it("session_set_active_role имеет σ: 'session' (не пишет в Φ)", () => {
    const effs = INTENTS.session_set_active_role.particles.effects;
    expect(effs.every(e => e.σ === "session")).toBe(true);
  });

  it("register_by_email создаёт User", () => {
    expect(INTENTS.register_by_email.creates).toBe("User");
  });
});

describe("freelance intents — profile details", () => {
  it("activate_executor_profile создаёт ExecutorProfile", () => {
    expect(INTENTS.activate_executor_profile.creates).toBe("ExecutorProfile");
  });

  it("add_skill создаёт ExecutorSkill (assignment)", () => {
    expect(INTENTS.add_skill.creates).toBe("ExecutorSkill");
  });

  it("toggle_availability — replace на ExecutorProfile.availability", () => {
    expect(INTENTS.toggle_availability.α).toBe("replace");
    const target = INTENTS.toggle_availability.particles.effects[0].target;
    expect(target).toMatch(/availability/);
  });
});

describe("freelance intents — task details", () => {
  it("create_task_draft создаёт Task в статусе draft (нотация creates: 'Task(draft)')", () => {
    expect(INTENTS.create_task_draft.creates).toBe("Task(draft)");
  });

  it("submit_task_for_moderation — replace task.status на moderation", () => {
    const e = INTENTS.submit_task_for_moderation.particles.effects[0];
    expect(e.α).toBe("replace");
    expect(e.target).toBe("task.status");
    expect(e.value).toBe("moderation");
  });

  it("publish_task — replace task.status на published", () => {
    const e = INTENTS.publish_task.particles.effects[0];
    expect(e.α).toBe("replace");
    expect(e.target).toBe("task.status");
    expect(e.value).toBe("published");
  });

  it("search_tasks / filter_by_category / sort_tasks — read-only, effects пустые", () => {
    expect(INTENTS.search_tasks.particles.effects).toEqual([]);
    expect(INTENTS.filter_by_category.particles.effects).toEqual([]);
    expect(INTENTS.sort_tasks.particles.effects).toEqual([]);
  });
});

describe("freelance intents — response details", () => {
  it("submit_response создаёт Response в статусе pending (нотация creates: 'Response(pending)')", () => {
    expect(INTENTS.submit_response.creates).toBe("Response(pending)");
  });

  it("withdraw_response — soft-delete через replace response.status на withdrawn (сохраняет историю)", () => {
    expect(INTENTS.withdraw_response.α).toBe("replace");
    const e = INTENTS.withdraw_response.particles.effects[0];
    expect(e.target).toBe("response.status");
    expect(e.value).toBe("withdrawn");
  });

  it("submit_response — guard task.status=published + entities task+response (для SDK buildSection)", () => {
    expect(INTENTS.submit_response.particles.conditions).toContain("task.status = 'published'");
    expect(INTENTS.submit_response.particles.entities).toEqual(
      expect.arrayContaining(["task: Task", "response: Response"])
    );
  });

  it("edit_response — guards response.status=pending + response.executorId=me.id", () => {
    const conds = INTENTS.edit_response.particles.conditions || [];
    expect(conds).toContain("response.status = 'pending'");
    expect(conds).toContain("response.executorId = me.id");
  });

  it("withdraw_response — те же guards", () => {
    const conds = INTENTS.withdraw_response.particles.conditions || [];
    expect(conds).toContain("response.status = 'pending'");
    expect(conds).toContain("response.executorId = me.id");
  });

  it("select_executor — replace response.status на selected", () => {
    const e = INTENTS.select_executor.particles.effects[0];
    expect(e.α).toBe("replace");
    expect(e.value).toBe("selected");
  });

  it("view_responses read-only", () => {
    expect(INTENTS.view_responses.particles.effects).toEqual([]);
  });
});

describe("freelance intents — deal details + __irr декларация", () => {
  const IRR_INTENTS = ["confirm_deal", "accept_result", "auto_accept_result"];

  for (const id of IRR_INTENTS) {
    it(`${id} имеет irreversibility: "high"`, () => {
      expect(INTENTS[id].irreversibility).toBe("high");
    });

    it(`${id} имеет декларативный __irr с point и reason`, () => {
      const irr = INTENTS[id].__irr;
      expect(irr).toBeDefined();
      expect(irr.point).toBe("high");
      expect(typeof irr.reason).toBe("string");
      expect(irr.reason.length).toBeGreaterThan(0);
    });
  }

  it("confirm_deal — particles.effects создают Deal + escrow Transaction + reserve wallet", () => {
    // `creates:"Deal"` снят осознанно — иначе my_deals-catalog получает
    // heroCreate-форму с 6 required-params (customerId/executorId/...),
    // которые должны derive'иться из selected Response. confirm_deal — это
    // per-item действие на task_detail_customer → Response section.
    expect(INTENTS.confirm_deal.creates).toBeUndefined();
    const effs = INTENTS.confirm_deal.particles.effects;
    expect(effs.some(e => e.α === "add" && e.target === "deals")).toBe(true);
    expect(effs.some(e => e.α === "add" && e.target === "transactions")).toBe(true);
    expect(effs.some(e => e.α === "replace" && e.target === "wallet.reserved")).toBe(true);
  });

  it("confirm_deal появляется как item intent на Response в task_detail_customer (Response в entities, Deal исключён во избежание дубля в Deal.toolbar)", () => {
    const entities = INTENTS.confirm_deal.particles.entities || [];
    const entityNames = entities.map(e => e.split(":").pop().trim());
    expect(entityNames).toContain("Response");
    expect(entityNames).toContain("Task");
    expect(entityNames).not.toContain("Deal");
    expect(INTENTS.confirm_deal.particles.conditions).toContain("response.status = 'selected'");
  });

  it("submit_work_result — form, medium-irr, guards: deal.status=in_progress + executor-ownership", () => {
    expect(INTENTS.submit_work_result.control).toBe("formModal");
    expect(INTENTS.submit_work_result.particles.confirmation).toBe("form");
    const conds = INTENTS.submit_work_result.particles.conditions || [];
    expect(conds).toContain("deal.status = 'in_progress'");
    expect(conds).toContain("deal.executorId = me.id");
  });

  it("accept_result — guards: deal.status=on_review + customer-ownership (после completed не доступен)", () => {
    const conds = INTENTS.accept_result.particles.conditions || [];
    expect(conds).toContain("deal.status = 'on_review'");
    expect(conds).toContain("deal.customerId = me.id");
  });

  it("auto_accept_result не показывается в UI (particles.entities пуст — scheduler-fired only)", () => {
    expect(INTENTS.auto_accept_result.particles.entities).toEqual([]);
  });

  it("cancel_deal_mutual guard: только pre-completion фазы (in_progress, on_review)", () => {
    const conds = INTENTS.cancel_deal_mutual.particles.conditions || [];
    expect(conds.some(c => /deal\.status.*in_progress.*on_review/i.test(c))).toBe(true);
  });

  it("accept_result → replace deal.status на completed", () => {
    const effs = INTENTS.accept_result.particles.effects;
    expect(effs.some(e => e.α === "replace" && e.target === "deal.status" && e.value === "completed")).toBe(true);
  });

  it("cancel_deal_mutual не имеет irreversibility high (no __irr)", () => {
    expect(INTENTS.cancel_deal_mutual.__irr).toBeUndefined();
    expect(INTENTS.cancel_deal_mutual.irreversibility).not.toBe("high");
  });
});

describe("freelance intents — review details", () => {
  it("leave_review создаёт Review", () => {
    expect(INTENTS.leave_review.creates).toBe("Review");
  });

  it("leave_review требует dealId + rating + role", () => {
    const params = INTENTS.leave_review.particles.parameters.map(p => p.name);
    expect(params).toEqual(expect.arrayContaining(["dealId", "rating", "role"]));
  });

  it("view_reviews_for_user read-only", () => {
    expect(INTENTS.view_reviews_for_user.particles.effects).toEqual([]);
  });
});

describe("freelance intents — общий счёт", () => {
  it("46 intents в Cycle 2 (29 Cycle 1 + 17 escrow)", () => {
    expect(Object.keys(INTENTS)).toHaveLength(46);
  });
});
