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
    it("создаёт Deal(in_progress), reserves escrow, decrements balance", () => {
      const world = {
        wallets: [
          { id: "w_1", userId: "u_customer", balance: 100000, reserved: 0, currency: "RUB" },
        ],
        transactions: [],
        deals: [],
      };
      const ctx = {
        userId: "u_customer",
        customerId: "u_customer",
        executorId: "u_executor",
        taskId: "t_1",
        responseId: "r_1",
        amount: 25000,
        deadline: "2026-05-01T00:00:00Z",
      };
      const effects = buildEffects("confirm_deal", ctx, world, []);
      expect(effects).toHaveLength(4);

      const deal = effects.find((e) => e.alpha === "add" && e.target === "deals");
      expect(deal).toBeDefined();
      expect(deal.context.customerId).toBe("u_customer");
      expect(deal.context.executorId).toBe("u_executor");
      expect(deal.context.amount).toBe(25000);
      expect(deal.context.status).toBe("in_progress");
      expect(deal.context.commission).toBe(2500);

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

    it("возвращает null если баланс недостаточен", () => {
      const world = {
        wallets: [{ id: "w_1", userId: "u_customer", balance: 10000, reserved: 0 }],
        transactions: [], deals: [],
      };
      const ctx = {
        userId: "u_customer", customerId: "u_customer",
        executorId: "u_exe", taskId: "t_1", responseId: "r_1", amount: 25000,
      };
      const effects = buildEffects("confirm_deal", ctx, world, []);
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
});
