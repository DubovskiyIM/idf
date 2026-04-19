import { describe, it, expect } from "vitest";
import { buildEffects } from "./domain.js";

describe("escrow / buildEffects", () => {
  describe("top_up_wallet_by_card", () => {
    it("emit'ит add Transaction(topup) + replace wallet.balance с новым значением", () => {
      const world = {
        wallets: [
          { id: "w_1", userId: "u_1", balance: 1000, reserved: 0, currency: "RUB" },
        ],
        transactions: [],
      };
      const ctx = {
        userId: "u_1",
        walletId: "w_1",
        amount: 5000,
        cardLastFour: "1234",
      };
      const effects = buildEffects("top_up_wallet_by_card", ctx, world, []);
      expect(effects).toHaveLength(2);

      const tx = effects.find((e) => e.alpha === "add" && e.target === "transactions");
      expect(tx).toBeDefined();
      expect(tx.context.walletId).toBe("w_1");
      expect(tx.context.amount).toBe(5000);
      expect(tx.context.kind).toBe("topup");
      expect(tx.context.status).toBe("posted");

      const balance = effects.find((e) => e.alpha === "replace" && e.target === "wallet.balance");
      expect(balance).toBeDefined();
      expect(balance.value).toBe(6000);
      expect(balance.context.id).toBe("w_1");
    });

    it("возвращает null если кошелёк не найден", () => {
      const world = { wallets: [], transactions: [] };
      const ctx = { userId: "u_1", walletId: "w_999", amount: 1000 };
      const effects = buildEffects("top_up_wallet_by_card", ctx, world, []);
      expect(effects).toBeNull();
    });
  });

  describe("confirm_deal", () => {
    // Новый контракт: ctx.id = response.id (per-item call на Response.status=selected).
    // Все остальные поля (customerId, executorId, taskId, amount, deadline)
    // derive'ятся в buildCustomEffects из responses + tasks в world.
    const baseWorld = () => ({
      tasks: [
        { id: "t_1", customerId: "u_customer", status: "published", deadline: "2026-05-01T00:00:00Z" },
      ],
      responses: [
        { id: "r_1", taskId: "t_1", executorId: "u_executor", price: 25000, status: "selected" },
      ],
      wallets: [
        { id: "w_1", userId: "u_customer", balance: 100000, reserved: 0, currency: "RUB" },
      ],
      transactions: [],
      deals: [],
    });

    it("создаёт Deal(in_progress), reserves escrow, decrements balance, commission 10%", () => {
      const ctx = { userId: "u_customer", id: "r_1" };
      const effects = buildEffects("confirm_deal", ctx, baseWorld(), []);
      expect(effects).toHaveLength(4);

      const deal = effects.find((e) => e.alpha === "add" && e.target === "deals");
      expect(deal).toBeDefined();
      expect(deal.context.customerId).toBe("u_customer");
      expect(deal.context.executorId).toBe("u_executor");
      expect(deal.context.amount).toBe(25000);
      expect(deal.context.status).toBe("in_progress");
      expect(deal.context.commission).toBe(2500);
      // __irr с at — IrreversibleBadge найдёт его в world.deals.
      expect(deal.context.__irr).toMatchObject({ point: "high", reason: expect.any(String) });
      expect(deal.context.__irr.at).toBeGreaterThan(0);

      const tx = effects.find((e) => e.alpha === "add" && e.target === "transactions");
      expect(tx.context.kind).toBe("escrow-hold");
      expect(tx.context.status).toBe("posted");
      expect(tx.context.amount).toBe(25000);
      expect(tx.context.walletId).toBe("w_1");
      expect(tx.context.dealId).toBe(deal.context.id);

      const balance = effects.find((e) => e.target === "wallet.balance");
      expect(balance.value).toBe(75000);
      const reserved = effects.find((e) => e.target === "wallet.reserved");
      expect(reserved.value).toBe(25000);
    });

    it("null если баланс недостаточен", () => {
      const world = baseWorld();
      world.wallets[0].balance = 10000; // 10k < 25k
      const ctx = { userId: "u_customer", id: "r_1" };
      const effects = buildEffects("confirm_deal", ctx, world, []);
      expect(effects).toBeNull();
    });

    it("null если response.status !== 'selected' (guard против вызова без select_executor)", () => {
      const world = baseWorld();
      world.responses[0].status = "pending";
      const effects = buildEffects("confirm_deal", { userId: "u_customer", id: "r_1" }, world, []);
      expect(effects).toBeNull();
    });

    it("null если viewer не customer этой task (ownership guard)", () => {
      const effects = buildEffects("confirm_deal", { userId: "u_stranger", id: "r_1" }, baseWorld(), []);
      expect(effects).toBeNull();
    });

    it("null если уже есть Deal на эту task в активной фазе (no double-confirm)", () => {
      const world = baseWorld();
      world.deals.push({ id: "deal_existing", taskId: "t_1", status: "in_progress", customerId: "u_customer", executorId: "u_executor", amount: 25000 });
      const effects = buildEffects("confirm_deal", { userId: "u_customer", id: "r_1" }, world, []);
      expect(effects).toBeNull();
    });
  });

  describe("accept_result", () => {
    it("releases escrow, crediting executor wallet, minus commission", () => {
      const world = {
        deals: [{
          id: "deal_1", customerId: "u_cust", executorId: "u_exe", taskId: "t_1",
          responseId: "r_1", amount: 20000, commission: 2000, status: "on_review",
        }],
        wallets: [
          { id: "w_cust", userId: "u_cust", balance: 80000, reserved: 20000 },
          { id: "w_exe",  userId: "u_exe",  balance: 0,      reserved: 0 },
        ],
        transactions: [
          { id: "tx_1", walletId: "w_cust", dealId: "deal_1", amount: 20000, kind: "escrow-hold", status: "posted" },
        ],
      };
      const ctx = { userId: "u_cust", id: "deal_1" };
      const effects = buildEffects("accept_result", ctx, world, []);
      expect(effects).toHaveLength(5);

      const status = effects.find((e) => e.target === "deal.status");
      expect(status.value).toBe("completed");

      const release = effects.find((e) => e.alpha === "add" && e.target === "transactions" && e.context.kind === "release");
      expect(release.context.walletId).toBe("w_exe");
      expect(release.context.amount).toBe(18000);
      expect(release.context.status).toBe("posted");

      const commTx = effects.find((e) => e.alpha === "add" && e.target === "transactions" && e.context.kind === "commission");
      expect(commTx.context.amount).toBe(2000);

      const exeBalance = effects.find((e) => e.target === "wallet.balance" && e.context.id === "w_exe");
      expect(exeBalance.value).toBe(18000);

      const custReserved = effects.find((e) => e.target === "wallet.reserved" && e.context.id === "w_cust");
      expect(custReserved.value).toBe(0);
    });

    it("null если сделка не on_review / in_progress", () => {
      const world = {
        deals: [{ id: "deal_1", status: "cancelled", amount: 20000, commission: 2000, customerId: "u", executorId: "e" }],
        wallets: [], transactions: [],
      };
      const effects = buildEffects("accept_result", { id: "deal_1" }, world, []);
      expect(effects).toBeNull();
    });
  });

  describe("cancel_deal_mutual", () => {
    it("refunds escrow to customer, cancels deal", () => {
      const world = {
        deals: [{ id: "deal_1", customerId: "u_cust", executorId: "u_exe", amount: 15000, commission: 1500, status: "in_progress" }],
        wallets: [
          { id: "w_cust", userId: "u_cust", balance: 85000, reserved: 15000 },
          { id: "w_exe", userId: "u_exe", balance: 0, reserved: 0 },
        ],
        transactions: [],
      };
      const ctx = { userId: "u_cust", id: "deal_1", reason: "Обоюдная отмена" };
      const effects = buildEffects("cancel_deal_mutual", ctx, world, []);
      expect(effects).toHaveLength(4);

      const status = effects.find((e) => e.target === "deal.status");
      expect(status.value).toBe("cancelled");

      const refund = effects.find((e) => e.target === "transactions");
      expect(refund.context.kind).toBe("refund");
      expect(refund.context.amount).toBe(15000);
      expect(refund.context.walletId).toBe("w_cust");

      const balance = effects.find((e) => e.target === "wallet.balance");
      expect(balance.value).toBe(100000);

      const reserved = effects.find((e) => e.target === "wallet.reserved");
      expect(reserved.value).toBe(0);
    });
  });

  describe("select_executor", () => {
    const selectWorld = () => ({
      tasks: [
        { id: "t_1", customerId: "u_customer", status: "published" },
        { id: "t_2", customerId: "u_customer", status: "published" },
      ],
      responses: [
        { id: "r_1", taskId: "t_1", executorId: "e_1", status: "pending" },
        { id: "r_2", taskId: "t_1", executorId: "e_2", status: "pending" },
        { id: "r_3", taskId: "t_1", executorId: "e_3", status: "pending" },
        { id: "r_other", taskId: "t_2", executorId: "e_4", status: "pending" },
      ],
    });

    it("selected + не выбранные отклики становятся not_chosen (3 effects: 2 demote + 1 promote)", () => {
      const ctx = { userId: "u_customer", id: "r_2", taskId: "t_1" };
      const effects = buildEffects("select_executor", ctx, selectWorld(), []);
      expect(effects).toHaveLength(3);

      // Критический порядок: siblings демотируются ПЕРВЫМИ, promote — последним
      expect(effects[effects.length - 1].context.id).toBe("r_2");
      expect(effects[effects.length - 1].value).toBe("selected");

      const demoted = effects.slice(0, -1);
      expect(demoted).toHaveLength(2);
      demoted.forEach((e) => expect(e.value).toBe("not_chosen"));

      const touchesOther = effects.find((e) => e.context.id === "r_other");
      expect(touchesOther).toBeUndefined();
    });

    it("ownership guard: не-customer не может выбирать — returns null", () => {
      const ctx = { userId: "u_stranger", id: "r_2", taskId: "t_1" };
      const effects = buildEffects("select_executor", ctx, selectWorld(), []);
      expect(effects).toBeNull();
    });

    it("re-select при смене решения: previously-selected демотируется, invariant не ловит транзитную 2-selected", () => {
      const world = {
        tasks: [{ id: "t_1", customerId: "u_customer", status: "published" }],
        responses: [
          { id: "r_1", taskId: "t_1", executorId: "e_1", status: "selected" }, // уже выбран
          { id: "r_2", taskId: "t_1", executorId: "e_2", status: "pending" },  // хочет выбрать этого
        ],
      };
      const ctx = { userId: "u_customer", id: "r_2", taskId: "t_1" };
      const effects = buildEffects("select_executor", ctx, world, []);
      expect(effects).toHaveLength(2);
      // r_1 демотируется первым (status: selected → not_chosen)
      expect(effects[0].context.id).toBe("r_1");
      expect(effects[0].value).toBe("not_chosen");
      // r_2 повышается вторым (pending → selected)
      expect(effects[1].context.id).toBe("r_2");
      expect(effects[1].value).toBe("selected");
    });

    it("guard на status: повторный выбор уже-selected отклика — null", () => {
      const world = {
        tasks: [{ id: "t_1", customerId: "u_customer", status: "published" }],
        responses: [{ id: "r_1", taskId: "t_1", executorId: "e_1", status: "selected" }],
      };
      const ctx = { userId: "u_customer", id: "r_1", taskId: "t_1" };
      const effects = buildEffects("select_executor", ctx, world, []);
      expect(effects).toBeNull();
    });
  });

  describe("leave_review", () => {
    const baseWorld = () => ({
      deals: [
        { id: "deal_completed", customerId: "u_cust", executorId: "u_exe", status: "completed" },
        { id: "deal_in_progress", customerId: "u_cust", executorId: "u_exe", status: "in_progress" },
      ],
      reviews: [],
    });

    it("proceeds if deal.status=completed and viewer is participant", () => {
      const ctx = {
        userId: "u_cust", authorId: "u_cust",
        dealId: "deal_completed", targetUserId: "u_exe",
        role: "customer", rating: 5, comment: "Отлично",
      };
      const effects = buildEffects("leave_review", ctx, baseWorld(), []);
      expect(effects).toBeTruthy();
      expect(effects.length).toBeGreaterThanOrEqual(1);
      expect(effects[0].target).toBe("reviews");
    });

    it("null if deal.status !== completed", () => {
      const ctx = {
        userId: "u_cust", authorId: "u_cust",
        dealId: "deal_in_progress", targetUserId: "u_exe",
        role: "customer", rating: 5,
      };
      const effects = buildEffects("leave_review", ctx, baseWorld(), []);
      expect(effects).toBeNull();
    });

    it("null if author не участник deal", () => {
      const ctx = {
        userId: "u_stranger", authorId: "u_stranger",
        dealId: "deal_completed", targetUserId: "u_exe",
        role: "customer", rating: 5,
      };
      const effects = buildEffects("leave_review", ctx, baseWorld(), []);
      expect(effects).toBeNull();
    });
  });
});
