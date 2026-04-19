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
});
