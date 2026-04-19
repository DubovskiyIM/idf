import { describe, it, expect } from "vitest";
import { buildFreelanceEffects } from "./buildFreelanceEffects.cjs";

const VIEWER = { id: "u_agent", name: "agent" };

const WORLD_WITH_PUBLISHED_TASK = {
  tasks: [
    { id: "t1", customerId: "u_alice", title: "Сайт", status: "published", responsesCount: 0 },
    { id: "t2", customerId: "u_bob", title: "Draft", status: "draft", responsesCount: 0 },
    { id: "t3", customerId: "u_cc", status: "published", responsesCount: 5 },
  ],
  responses: [],
  deals: [],
  reviews: [],
};

describe("submit_response", () => {
  it("валидный → 2 эффекта: add responses + replace task.responsesCount", () => {
    const effects = buildFreelanceEffects(
      "submit_response",
      { taskId: "t1", price: 5000, deliveryDays: 3, message: "hi" },
      VIEWER,
      WORLD_WITH_PUBLISHED_TASK,
    );
    expect(effects).toHaveLength(2);
    const [add, replace] = effects;
    expect(add.alpha).toBe("add");
    expect(add.target).toBe("responses");
    expect(add.context.executorId).toBe("u_agent");
    expect(add.context.status).toBe("pending");
    expect(replace.alpha).toBe("replace");
    expect(replace.target).toBe("task.responsesCount");
    expect(replace.value).toBe(1);
  });

  it("task не найдена → null", () => {
    const r = buildFreelanceEffects(
      "submit_response",
      { taskId: "NOPE", price: 1000, deliveryDays: 1 },
      VIEWER,
      WORLD_WITH_PUBLISHED_TASK,
    );
    expect(r).toBeNull();
  });

  it("task не published → null (нельзя отвечать на draft)", () => {
    const r = buildFreelanceEffects(
      "submit_response",
      { taskId: "t2", price: 1000, deliveryDays: 1 },
      VIEWER,
      WORLD_WITH_PUBLISHED_TASK,
    );
    expect(r).toBeNull();
  });

  it("уже есть pending response от этого executor → null (no-dup)", () => {
    const world = {
      ...WORLD_WITH_PUBLISHED_TASK,
      responses: [
        { id: "r1", executorId: "u_agent", taskId: "t1", status: "pending" },
      ],
    };
    const r = buildFreelanceEffects(
      "submit_response",
      { taskId: "t1", price: 5000, deliveryDays: 3 },
      VIEWER,
      world,
    );
    expect(r).toBeNull();
  });

  it("withdrawn response другого executor не блокирует — 2 эффекта", () => {
    const world = {
      ...WORLD_WITH_PUBLISHED_TASK,
      responses: [
        { id: "r_old", executorId: "u_other", taskId: "t1", status: "withdrawn" },
      ],
    };
    const effects = buildFreelanceEffects(
      "submit_response",
      { taskId: "t1", price: 5000, deliveryDays: 3 },
      VIEWER,
      world,
    );
    expect(effects).toHaveLength(2);
  });

  it("price <= 0 или deliveryDays <= 0 → null", () => {
    expect(buildFreelanceEffects("submit_response", { taskId: "t1", price: 0, deliveryDays: 3 }, VIEWER, WORLD_WITH_PUBLISHED_TASK)).toBeNull();
    expect(buildFreelanceEffects("submit_response", { taskId: "t1", price: 1000, deliveryDays: 0 }, VIEWER, WORLD_WITH_PUBLISHED_TASK)).toBeNull();
    expect(buildFreelanceEffects("submit_response", { taskId: "t1", price: -100, deliveryDays: 3 }, VIEWER, WORLD_WITH_PUBLISHED_TASK)).toBeNull();
  });

  it("responsesCount инкрементится поверх существующего (t3: 5 → 6)", () => {
    const effects = buildFreelanceEffects(
      "submit_response",
      { taskId: "t3", price: 1000, deliveryDays: 1 },
      VIEWER,
      WORLD_WITH_PUBLISHED_TASK,
    );
    expect(effects[1].value).toBe(6);
  });
});

describe("leave_review", () => {
  const WORLD = {
    tasks: [],
    responses: [],
    deals: [
      { id: "d_done", customerId: "u_agent", executorId: "u_exec", status: "completed", amount: 5000 },
      { id: "d_progress", customerId: "u_agent", executorId: "u_exec", status: "in_progress" },
    ],
    reviews: [],
  };

  it("валидный отзыв от customer → add reviews", () => {
    const effects = buildFreelanceEffects(
      "leave_review",
      { dealId: "d_done", targetUserId: "u_exec", role: "customer", rating: 5, comment: "отл" },
      VIEWER,
      WORLD,
    );
    expect(effects).toHaveLength(1);
    const [eff] = effects;
    expect(eff.alpha).toBe("add");
    expect(eff.target).toBe("reviews");
    expect(eff.context.authorId).toBe("u_agent");
    expect(eff.context.rating).toBe(5);
    expect(eff.context.comment).toBe("отл");
  });

  it("deal не completed → null", () => {
    const r = buildFreelanceEffects(
      "leave_review",
      { dealId: "d_progress", targetUserId: "u_exec", role: "customer", rating: 5 },
      VIEWER,
      WORLD,
    );
    expect(r).toBeNull();
  });

  it("author не участник deal → null", () => {
    const r = buildFreelanceEffects(
      "leave_review",
      { dealId: "d_done", targetUserId: "u_exec", role: "customer", rating: 5 },
      { id: "u_outsider" },
      WORLD,
    );
    expect(r).toBeNull();
  });

  it("rating вне 1..5 → null", () => {
    const base = { dealId: "d_done", targetUserId: "u_exec", role: "customer" };
    expect(buildFreelanceEffects("leave_review", { ...base, rating: 0 }, VIEWER, WORLD)).toBeNull();
    expect(buildFreelanceEffects("leave_review", { ...base, rating: 6 }, VIEWER, WORLD)).toBeNull();
    expect(buildFreelanceEffects("leave_review", { ...base, rating: "abc" }, VIEWER, WORLD)).toBeNull();
  });
});

describe("reply_to_review", () => {
  const WORLD = {
    reviews: [
      { id: "rv1", authorId: "u_alice", targetUserId: "u_agent", reply: "" },
      { id: "rv2", authorId: "u_alice", targetUserId: "u_other", reply: "" },
      { id: "rv3", authorId: "u_alice", targetUserId: "u_agent", reply: "уже ответил" },
    ],
  };

  it("target может ответить один раз → replace review.reply", () => {
    const effects = buildFreelanceEffects(
      "reply_to_review",
      { id: "rv1", reply: "спасибо" },
      VIEWER,
      WORLD,
    );
    expect(effects).toHaveLength(1);
    expect(effects[0].alpha).toBe("replace");
    expect(effects[0].target).toBe("review.reply");
    expect(effects[0].value).toBe("спасибо");
  });

  it("не target — ответить нельзя → null", () => {
    const r = buildFreelanceEffects(
      "reply_to_review",
      { id: "rv2", reply: "hi" },
      VIEWER,
      WORLD,
    );
    expect(r).toBeNull();
  });

  it("уже есть reply → null (single reply)", () => {
    const r = buildFreelanceEffects(
      "reply_to_review",
      { id: "rv3", reply: "ещё" },
      VIEWER,
      WORLD,
    );
    expect(r).toBeNull();
  });

  it("пустой reply → null", () => {
    const r = buildFreelanceEffects(
      "reply_to_review",
      { id: "rv1", reply: "  " },
      VIEWER,
      WORLD,
    );
    expect(r).toBeNull();
  });
});

describe("неизвестные / read-only intents → null", () => {
  it("search_tasks", () => {
    expect(buildFreelanceEffects("search_tasks", {}, VIEWER, {})).toBeNull();
  });
  it("view_wallet_balance", () => {
    expect(buildFreelanceEffects("view_wallet_balance", {}, VIEWER, {})).toBeNull();
  });
  it("unknown intent", () => {
    expect(buildFreelanceEffects("i_do_not_exist", {}, VIEWER, {})).toBeNull();
  });
});
