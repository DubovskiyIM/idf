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
});
