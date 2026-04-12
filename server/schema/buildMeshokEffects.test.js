import { describe, it, expect } from "vitest";
import { buildMeshokEffects } from "./buildMeshokEffects.cjs";

const viewer = { id: "buyer_1", email: "buyer@test.com" };
const seller = { id: "seller_1", email: "seller@test.com" };

const baseListing = {
  id: "lot_1", sellerId: "seller_1", title: "iPhone",
  status: "active", currentPrice: 50000, buyNowPrice: 75000,
  bidCount: 2, shippingCost: 500, shippingFrom: "Москва",
  auctionEnd: Date.now() + 86400000,
};

const baseOrder = {
  id: "ord_1", listingId: "lot_1", sellerId: "seller_1", buyerId: "buyer_1",
  finalPrice: 75000, shippingCost: 500, totalAmount: 75500,
  status: "pending_payment",
};

describe("buildMeshokEffects", () => {
  // === create_listing ===
  describe("create_listing", () => {
    it("создаёт лот с draft статусом", () => {
      const effects = buildMeshokEffects("create_listing", { title: "Тест" }, seller, {});
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].target).toBe("listings");
      expect(effects[0].context.sellerId).toBe("seller_1");
      expect(effects[0].context.status).toBe("draft");
      expect(effects[0].context.title).toBe("Тест");
    });

    it("отклоняет пустой title", () => {
      expect(buildMeshokEffects("create_listing", { title: "" }, seller, {})).toBeNull();
      expect(buildMeshokEffects("create_listing", {}, seller, {})).toBeNull();
    });
  });

  // === publish_listing ===
  describe("publish_listing", () => {
    it("draft → active", () => {
      const world = { listings: [{ ...baseListing, status: "draft" }] };
      const effects = buildMeshokEffects("publish_listing", { listingId: "lot_1" }, seller, world);
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("replace");
      expect(effects[0].value).toBe("active");
    });

    it("не публикует уже активный", () => {
      const world = { listings: [baseListing] };
      expect(buildMeshokEffects("publish_listing", { listingId: "lot_1" }, seller, world)).toBeNull();
    });
  });

  // === place_bid ===
  describe("place_bid", () => {
    it("создаёт ставку и обновляет цену/count", () => {
      const world = { listings: [baseListing] };
      const effects = buildMeshokEffects("place_bid", { listingId: "lot_1", amount: 55000 }, viewer, world);
      expect(effects).toHaveLength(3);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].target).toBe("bids");
      expect(effects[0].context.bidderId).toBe("buyer_1");
      expect(effects[0].context.amount).toBe(55000);
      expect(effects[1].value).toBe(55000); // currentPrice
      expect(effects[2].value).toBe(3); // bidCount
    });

    it("отклоняет ставку ниже текущей цены", () => {
      const world = { listings: [baseListing] };
      expect(buildMeshokEffects("place_bid", { listingId: "lot_1", amount: 40000 }, viewer, world)).toBeNull();
    });

    it("отклоняет ставку на неактивный лот", () => {
      const world = { listings: [{ ...baseListing, status: "sold" }] };
      expect(buildMeshokEffects("place_bid", { listingId: "lot_1", amount: 55000 }, viewer, world)).toBeNull();
    });
  });

  // === buy_now ===
  describe("buy_now", () => {
    it("создаёт заказ и помечает лот sold", () => {
      const world = { listings: [baseListing] };
      const effects = buildMeshokEffects("buy_now", { listingId: "lot_1" }, viewer, world);
      expect(effects).toHaveLength(2);
      expect(effects[0].value).toBe("sold"); // listing.status
      expect(effects[1].alpha).toBe("add");
      expect(effects[1].target).toBe("orders");
      expect(effects[1].context.buyerId).toBe("buyer_1");
      expect(effects[1].context.totalAmount).toBe(75500);
    });

    it("отклоняет без buyNowPrice", () => {
      const world = { listings: [{ ...baseListing, buyNowPrice: null }] };
      expect(buildMeshokEffects("buy_now", { listingId: "lot_1" }, viewer, world)).toBeNull();
    });
  });

  // === pay_order ===
  describe("pay_order", () => {
    it("pending_payment → paid", () => {
      const world = { orders: [baseOrder] };
      const effects = buildMeshokEffects("pay_order", { orderId: "ord_1" }, viewer, world);
      expect(effects).toHaveLength(1);
      expect(effects[0].value).toBe("paid");
    });

    it("отклоняет уже оплаченный", () => {
      const world = { orders: [{ ...baseOrder, status: "paid" }] };
      expect(buildMeshokEffects("pay_order", { orderId: "ord_1" }, viewer, world)).toBeNull();
    });
  });

  // === confirm_delivery ===
  describe("confirm_delivery", () => {
    it("shipped → delivered", () => {
      const world = { orders: [{ ...baseOrder, status: "shipped" }] };
      const effects = buildMeshokEffects("confirm_delivery", { orderId: "ord_1" }, viewer, world);
      expect(effects).toHaveLength(1);
      expect(effects[0].value).toBe("delivered");
    });

    it("отклоняет не shipped", () => {
      const world = { orders: [{ ...baseOrder, status: "paid" }] };
      expect(buildMeshokEffects("confirm_delivery", { orderId: "ord_1" }, viewer, world)).toBeNull();
    });
  });

  // === leave_review ===
  describe("leave_review", () => {
    it("создаёт отзыв по доставленному заказу", () => {
      const world = { orders: [{ ...baseOrder, status: "delivered" }] };
      const effects = buildMeshokEffects("leave_review", { orderId: "ord_1", rating: 5, text: "Отлично!" }, viewer, world);
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].context.authorId).toBe("buyer_1");
      expect(effects[0].context.rating).toBe(5);
    });

    it("отклоняет отзыв на неоплаченный заказ", () => {
      const world = { orders: [baseOrder] };
      expect(buildMeshokEffects("leave_review", { orderId: "ord_1", rating: 5 }, viewer, world)).toBeNull();
    });
  });

  // === send_message ===
  describe("send_message", () => {
    it("создаёт сообщение", () => {
      const effects = buildMeshokEffects("send_message", { content: "Привет!", recipientId: "seller_1", listingId: "lot_1" }, viewer, {});
      expect(effects).toHaveLength(1);
      expect(effects[0].context.senderId).toBe("buyer_1");
      expect(effects[0].context.content).toBe("Привет!");
    });

    it("отклоняет пустое сообщение", () => {
      expect(buildMeshokEffects("send_message", { content: "" }, viewer, {})).toBeNull();
    });
  });

  // === unknown intent ===
  it("unknown intent → null", () => {
    expect(buildMeshokEffects("unknown_intent", {}, viewer, {})).toBeNull();
  });
});
