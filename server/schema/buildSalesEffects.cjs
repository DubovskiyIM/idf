/**
 * Серверный builder эффектов для agent-разрешённых sales-intent'ов.
 *
 * Зеркалит client-side src/domains/sales/domain.js::buildEffects, но
 * только для 8 intent'ов из roles.agent.canExecute (search_listings — read-only,
 * не нуждается в buildEffects). Принимает (intentId, params, viewer, world),
 * возвращает массив effect-объектов или null.
 */

const { v4: uuid } = require("uuid");

function ts() {
  return new Date().toLocaleTimeString("ru", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function makeEffect(intentId, props) {
  return {
    id: uuid(),
    intent_id: intentId,
    parent_id: null,
    status: "proposed",
    ttl: null,
    created_at: Date.now(),
    time: ts(),
    ...props
  };
}

function buildSalesEffects(intentId, params, viewer, world) {
  const now = Date.now();

  switch (intentId) {
    case "create_listing": {
      if (!params.title?.trim()) return null;
      const id = `lot_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [makeEffect(intentId, {
        alpha: "add", target: "listings", scope: "account", value: null,
        context: {
          id, sellerId: viewer.id, title: params.title.trim(),
          description: params.description || "",
          startPrice: params.startPrice || 0,
          currentPrice: params.startPrice || 0,
          bidCount: 0, watcherCount: 0, viewCount: 0,
          status: "draft", createdAt: now,
          condition: params.condition || "used",
          shippingFrom: params.shippingFrom || "",
          shippingCost: params.shippingCost || 0,
          categoryId: params.categoryId || null,
          auctionEnd: params.auctionEnd || (now + 7 * 86400000),
        },
        desc: `📦 Новый лот: ${params.title.trim().slice(0, 30)}`
      })];
    }

    case "publish_listing": {
      const listing = (world.listings || []).find(l => l.id === params.listingId);
      if (!listing) return null;
      if (listing.status !== "draft") return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "listing.status", scope: "account",
        value: "active", context: { id: listing.id },
        desc: `✓ Лот опубликован`
      })];
    }

    case "place_bid": {
      if (!params.amount || !params.listingId) return null;
      const listing = (world.listings || []).find(l => l.id === params.listingId);
      if (!listing || listing.status !== "active") return null;
      if (params.amount <= (listing.currentPrice || 0)) return null;
      const bidId = `bid_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [
        makeEffect(intentId, {
          alpha: "add", target: "bids", scope: "account", value: null,
          context: {
            id: bidId, listingId: params.listingId,
            bidderId: viewer.id,
            amount: params.amount, status: "active", createdAt: now,
          },
          desc: `💰 Ставка ${params.amount}₽`
        }),
        makeEffect(intentId, {
          alpha: "replace", target: "listing.currentPrice", scope: "account",
          value: params.amount, context: { id: params.listingId },
          desc: `Цена → ${params.amount}₽`
        }),
        makeEffect(intentId, {
          alpha: "replace", target: "listing.bidCount", scope: "account",
          value: (listing.bidCount || 0) + 1, context: { id: params.listingId },
          desc: "bidCount++"
        }),
      ];
    }

    case "buy_now": {
      const listing = (world.listings || []).find(l => l.id === params.listingId);
      if (!listing || listing.status !== "active" || !listing.buyNowPrice) return null;
      const orderId = `ord_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [
        makeEffect(intentId, {
          alpha: "replace", target: "listing.status", scope: "account",
          value: "sold", context: { id: listing.id },
          desc: "Лот продан"
        }),
        makeEffect(intentId, {
          alpha: "add", target: "orders", scope: "account", value: null,
          context: {
            id: orderId, listingId: listing.id, sellerId: listing.sellerId,
            buyerId: viewer.id,
            finalPrice: listing.buyNowPrice,
            shippingCost: listing.shippingCost || 0,
            totalAmount: listing.buyNowPrice + (listing.shippingCost || 0),
            status: "pending_payment", createdAt: now,
          },
          desc: `🛒 Куплено за ${listing.buyNowPrice}₽`
        }),
      ];
    }

    case "pay_order": {
      const order = (world.orders || []).find(o => o.id === params.orderId);
      if (!order) return null;
      if (order.status !== "pending_payment") return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "order.status", scope: "account",
        value: "paid", context: { id: order.id },
        desc: `💳 Оплата ${order.totalAmount || "?"}₽`
      })];
    }

    case "confirm_delivery": {
      const order = (world.orders || []).find(o => o.id === params.orderId);
      if (!order) return null;
      if (order.status !== "shipped") return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "order.status", scope: "account",
        value: "delivered", context: { id: order.id },
        desc: `✓ Доставка подтверждена`
      })];
    }

    case "leave_review": {
      const order = (world.orders || []).find(o => o.id === params.orderId);
      if (!order) return null;
      if (order.status !== "delivered" && order.status !== "completed") return null;
      const reviewId = `rev_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [makeEffect(intentId, {
        alpha: "add", target: "reviews", scope: "account", value: null,
        context: {
          id: reviewId, orderId: order.id,
          authorId: viewer.id,
          targetUserId: order.sellerId,
          rating: params.rating,
          text: params.text || "",
          createdAt: now,
        },
        desc: `⭐ Отзыв: ${"★".repeat(params.rating || 0)}`
      })];
    }

    case "send_message": {
      if (!params.content?.trim()) return null;
      const msgId = `msg_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [makeEffect(intentId, {
        alpha: "add", target: "messages", scope: "account", value: null,
        context: {
          id: msgId, senderId: viewer.id,
          recipientId: params.recipientId || null,
          listingId: params.listingId || null,
          orderId: params.orderId || null,
          content: params.content.trim(),
          read: false, createdAt: now,
        },
        desc: `💬 ${params.content.trim().slice(0, 30)}`
      })];
    }

    default:
      return null;
  }
}

module.exports = { buildSalesEffects };
