import { v4 as uuid } from "uuid";

export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
import { INTENTS } from "./intents.js";

export const DOMAIN_ID = "meshok";
export const DOMAIN_NAME = "Мешок";

const ts = () => new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 2 });

export function describeEffect(intentId, alpha, ctx, target) {
  const intent = INTENTS[intentId];
  const name = intent?.name || intentId;
  switch (intentId) {
    case "create_listing": return `📦 Новый лот: ${(ctx.title || "").slice(0, 30)}`;
    case "publish_listing": return `✓ Лот опубликован`;
    case "place_bid": return `💰 Ставка ${ctx.amount || "?"}₽`;
    case "buy_now": return `🛒 Купить сейчас`;
    case "pay_order": return `💳 Оплата ${ctx.totalAmount || "?"}₽`;
    case "ship_order": return `📮 Отправлено`;
    case "confirm_delivery": return `✓ Получено`;
    case "leave_review": return `⭐ Отзыв: ${"★".repeat(ctx.rating || 0)}`;
    case "open_dispute": return `⚠ Спор открыт`;
    case "send_message": case "send_listing_question": case "reply_to_message":
      return `💬 ${(ctx.content || "").slice(0, 30)}`;
    case "_seed": return `seed: ${alpha} ${ctx.id || ""}`;
    default: return `${name}: ${alpha} ${target || ""}`;
  }
}

export function signalForIntent(intentId) {
  switch (intentId) {
    case "place_bid": case "buy_now": return { κ: "notification", desc: "Новая ставка" };
    case "send_message": case "send_listing_question": case "reply_to_message":
      return { κ: "notification", desc: "Новое сообщение" };
    case "pay_order": return { κ: "notification", desc: "Оплата получена" };
    case "ship_order": return { κ: "notification", desc: "Заказ отправлен" };
    case "open_dispute": return { κ: "notification", desc: "Открыт спор" };
    default: return null;
  }
}

export function buildEffects(intentId, ctx, world, drafts) {
  const now = Date.now();
  const effects = [];
  const ef = (props) => effects.push({
    id: uuid(), intent_id: intentId, parent_id: null, status: "proposed",
    ttl: null, created_at: now, time: ts(), ...props,
  });

  switch (intentId) {
    case "create_listing": {
      if (!ctx.title?.trim()) return null;
      const id = `lot_${now}_${Math.random().toString(36).slice(2, 6)}`;
      ef({ alpha: "add", target: "listings", scope: "account", value: null,
        context: {
          id, sellerId: ctx.userId || ctx.clientId, title: ctx.title.trim(),
          description: ctx.description || "", startPrice: ctx.startPrice || 0,
          currentPrice: ctx.startPrice || 0, bidCount: 0, watcherCount: 0,
          viewCount: 0, status: "draft", createdAt: now,
          condition: ctx.condition || "used",
          shippingFrom: ctx.shippingFrom || "", shippingCost: ctx.shippingCost || 0,
          categoryId: ctx.categoryId || null,
          auctionEnd: ctx.auctionEnd || (now + 7 * 86400000),
        },
        desc: describeEffect(intentId, "add", ctx) });
      return effects;
    }

    case "place_bid": {
      const amount = Number(ctx.amount);
      const listingId = ctx.listingId || ctx.id;
      if (!amount || !listingId) return null;
      const listing = (world.listings || []).find(l => l.id === listingId);
      if (!listing || listing.status !== "active") return null;
      if (amount <= (listing.currentPrice || 0)) {
        alert(`Ставка должна быть выше текущей цены ${listing.currentPrice?.toLocaleString("ru")} ₽`);
        return null;
      }
      const bidId = `bid_${now}_${Math.random().toString(36).slice(2, 6)}`;
      ef({ alpha: "add", target: "bids", scope: "account", value: null,
        context: {
          id: bidId, listingId,
          bidderId: ctx.userId || ctx.clientId,
          amount, status: "active", createdAt: now,
        },
        desc: describeEffect(intentId, "add", ctx) });
      ef({ alpha: "replace", target: "listing.currentPrice", scope: "account",
        value: amount, context: { id: listingId },
        desc: `Цена → ${amount}₽` });
      ef({ alpha: "replace", target: "listing.bidCount", scope: "account",
        value: (listing.bidCount || 0) + 1, context: { id: listingId },
        desc: "bidCount++" });
      return effects;
    }

    case "buy_now": {
      const listing = (world.listings || []).find(l => l.id === ctx.id);
      if (!listing || listing.status !== "active" || !listing.buyNowPrice) return null;
      ef({ alpha: "replace", target: "listing.status", scope: "account",
        value: "sold", context: { id: listing.id }, desc: "Лот продан" });
      const orderId = `ord_${now}`;
      ef({ alpha: "add", target: "orders", scope: "account", value: null,
        context: {
          id: orderId, listingId: listing.id, sellerId: listing.sellerId,
          buyerId: ctx.userId || ctx.clientId,
          finalPrice: listing.buyNowPrice,
          shippingCost: listing.shippingCost || 0,
          totalAmount: listing.buyNowPrice + (listing.shippingCost || 0),
          status: "pending_payment", createdAt: now,
        },
        desc: describeEffect(intentId, "add", ctx) });
      return effects;
    }

    case "send_message": case "send_listing_question": case "reply_to_message": {
      if (!ctx.content?.trim()) return null;
      const msgId = `msg_${now}_${Math.random().toString(36).slice(2, 6)}`;
      ef({ alpha: "add", target: "messages", scope: "account", value: null,
        context: {
          id: msgId, senderId: ctx.userId || ctx.clientId,
          recipientId: ctx.recipientId || ctx.user || null,
          listingId: ctx.listingId || null, orderId: ctx.orderId || null,
          content: ctx.content.trim(), read: false, createdAt: now,
        },
        desc: describeEffect(intentId, "add", ctx) });
      return effects;
    }
  }

  // Generic handler
  const intent = INTENTS[intentId];
  if (!intent) return null;
  const intentEffects = intent.particles.effects || [];
  if (intentEffects.length === 0) return null;

  for (const iEf of intentEffects) {
    const alpha = iEf.α;
    const target = iEf.target;
    const scope = iEf.σ || "account";

    switch (alpha) {
      case "add": {
        const entityId = ctx.id || `${target.slice(0, 4)}_${now}_${Math.random().toString(36).slice(2, 6)}`;
        ef({ alpha: "add", target, scope, value: null,
          context: { id: entityId, ...ctx, createdAt: now },
          desc: describeEffect(intentId, "add", ctx, target) });
        break;
      }
      case "replace": {
        const entityId = ctx.id || ctx.entityId;
        const field = target.includes(".") ? target.split(".").pop() : target;
        const resolvedValue =
          iEf.value !== undefined ? iEf.value
          : ctx[field] !== undefined ? ctx[field]
          : ctx.value;
        // Пропускаем replace с undefined — при batch/form-сохранении
        // intent может покрывать несколько полей, но ctx содержит
        // только изменённые. Без этого фильтра незатронутые поля
        // затираются undefined'ом.
        if (entityId && resolvedValue !== undefined) {
          ef({ alpha: "replace", target, scope, value: resolvedValue,
            context: { id: entityId, userId: ctx.userId || ctx.clientId },
            desc: describeEffect(intentId, "replace", ctx, target) });
        }
        break;
      }
      case "remove": {
        const entityId = ctx.id || ctx.entityId;
        if (entityId) {
          ef({ alpha: "remove", target, scope, value: null,
            context: { id: entityId, userId: ctx.userId || ctx.clientId },
            desc: describeEffect(intentId, "remove", ctx, target) });
        }
        break;
      }
    }
  }

  return effects.length > 0 ? effects : null;
}

export function getSeedEffects() {
  const now = Date.now();
  const effects = [];
  const add = (target, context) => effects.push({
    id: uuid(), intent_id: "_seed", alpha: "add", target, value: null,
    scope: "account", parent_id: null, status: "confirmed", ttl: null,
    context, created_at: now, resolved_at: now,
  });

  // Категории
  add("categories", { id: "cat_electronics", name: "Электроника", icon: "💻", listingCount: 0, sortOrder: 1 });
  add("categories", { id: "cat_clothing", name: "Одежда и обувь", icon: "👕", listingCount: 0, sortOrder: 2 });
  add("categories", { id: "cat_collectibles", name: "Коллекционное", icon: "🏺", listingCount: 0, sortOrder: 3 });
  add("categories", { id: "cat_home", name: "Дом и сад", icon: "🏠", listingCount: 0, sortOrder: 4 });
  add("categories", { id: "cat_auto", name: "Авто и мото", icon: "🚗", listingCount: 0, sortOrder: 5 });
  add("categories", { id: "cat_sports", name: "Спорт", icon: "⚽", listingCount: 0, sortOrder: 6 });
  add("categories", { id: "cat_books", name: "Книги и хобби", icon: "📚", listingCount: 0, sortOrder: 7 });
  add("categories", { id: "cat_other", name: "Разное", icon: "📦", listingCount: 0, sortOrder: 8 });

  // Тестовые лоты
  const weekFromNow = now + 7 * 86400000;
  add("listings", {
    id: "lot_1", sellerId: "user_demo", title: "iPhone 14 Pro Max 256GB",
    description: "В идеальном состоянии, полный комплект, на гарантии.",
    categoryId: "cat_electronics", condition: "like_new",
    startPrice: 50000, currentPrice: 52000, buyNowPrice: 75000,
    bidCount: 3, watcherCount: 12, shippingCost: 500, shippingFrom: "Москва",
    auctionEnd: weekFromNow, status: "active", featured: true,
    viewCount: 145, createdAt: now - 2 * 86400000,
  });
  add("listings", {
    id: "lot_2", sellerId: "user_demo", title: "Коллекция монет СССР (50 шт.)",
    description: "Полный набор юбилейных рублей 1961-1991. Состояние XF-UNC.",
    categoryId: "cat_collectibles", condition: "used",
    startPrice: 15000, currentPrice: 18500, bidCount: 7,
    watcherCount: 23, shippingCost: 300, shippingFrom: "Санкт-Петербург",
    auctionEnd: weekFromNow - 86400000, status: "active",
    viewCount: 89, createdAt: now - 3 * 86400000,
  });
  add("listings", {
    id: "lot_3", sellerId: "user_demo", title: "Велосипед Trek Domane AL 5",
    description: "2023 год, пробег ~1000 км, все компоненты оригинальные.",
    categoryId: "cat_sports", condition: "used",
    startPrice: 80000, currentPrice: 80000, bidCount: 0,
    buyNowPrice: 95000, watcherCount: 5, shippingCost: 2000, shippingFrom: "Екатеринбург",
    auctionEnd: weekFromNow + 3 * 86400000, status: "active",
    viewCount: 34, createdAt: now - 86400000,
  });
  add("listings", {
    id: "lot_4", sellerId: "user_other", title: "Кожаная куртка Schott NYC",
    description: "Размер L, натуральная кожа, классическая модель.",
    categoryId: "cat_clothing", condition: "good",
    startPrice: 25000, currentPrice: 27000, bidCount: 2,
    watcherCount: 8, shippingCost: 600, shippingFrom: "Москва",
    auctionEnd: weekFromNow + 2 * 86400000, status: "active",
    viewCount: 67, createdAt: now - 4 * 86400000,
  });
  add("listings", {
    id: "lot_5", sellerId: "user_other", title: "Набор инструментов Bosch Professional",
    description: "118 предметов в кейсе. Новый, не вскрывался.",
    categoryId: "cat_home", condition: "new",
    startPrice: 12000, currentPrice: 12000, bidCount: 0,
    buyNowPrice: 15000, shippingCost: 800, shippingFrom: "Новосибирск",
    auctionEnd: weekFromNow + 5 * 86400000, status: "active",
    viewCount: 21, createdAt: now - 86400000,
  });

  // Тестовые пользователи (seed в Φ, чтобы sellerId резолвился)
  add("users", {
    id: "user_demo", name: "Иван Продавцов", email: "demo@meshok.ru",
    avatar: null, bio: "Продаю качественные вещи с 2020 года.",
    rating: 4.8, salesCount: 47, location: "Москва",
    verified: true, registeredAt: now - 365 * 86400000,
  });
  add("users", {
    id: "user_other", name: "Мария Торгова", email: "maria@meshok.ru",
    avatar: null, bio: "Домашний уют и стиль.",
    rating: 4.5, salesCount: 23, location: "Санкт-Петербург",
    verified: true, registeredAt: now - 200 * 86400000,
  });
  add("users", {
    id: "user_buyer", name: "Алексей Покупайкин", email: "buyer@meshok.ru",
    avatar: null, bio: "Коллекционер и охотник за скидками.",
    rating: 4.9, salesCount: 0, location: "Екатеринбург",
    verified: false, registeredAt: now - 30 * 86400000,
  });

  // Тестовые ставки
  add("bids", {
    id: "bid_1", listingId: "lot_1", bidderId: "user_buyer",
    amount: 51000, status: "active", createdAt: now - 86400000,
  });
  add("bids", {
    id: "bid_2", listingId: "lot_1", bidderId: "user_other",
    amount: 52000, status: "active", createdAt: now - 43200000,
  });
  add("bids", {
    id: "bid_3", listingId: "lot_1", bidderId: "user_buyer",
    amount: 52500, status: "active", createdAt: now - 3600000,
  });
  add("bids", {
    id: "bid_4", listingId: "lot_2", bidderId: "user_buyer",
    amount: 16000, status: "active", createdAt: now - 2 * 86400000,
  });
  add("bids", {
    id: "bid_5", listingId: "lot_4", bidderId: "user_buyer",
    amount: 26000, status: "active", createdAt: now - 86400000,
  });
  add("bids", {
    id: "bid_6", listingId: "lot_4", bidderId: "user_demo",
    amount: 27000, status: "active", createdAt: now - 43200000,
  });

  // Тестовый заказ (lot_5 куплен через buy_now)
  add("orders", {
    id: "ord_1", listingId: "lot_5", sellerId: "user_other", buyerId: "user_buyer",
    finalPrice: 15000, shippingCost: 800, totalAmount: 15800,
    status: "shipped", shippingAddress: "Екатеринбург, ул. Ленина 42",
    trackingNumber: "RU123456789",
    paidAt: now - 3 * 86400000, shippedAt: now - 86400000,
    createdAt: now - 4 * 86400000,
  });

  // Тестовые отзывы
  add("reviews", {
    id: "rev_1", listingId: "lot_5", reviewerId: "user_buyer", sellerId: "user_other",
    rating: 5, text: "Быстрая доставка, товар как в описании!",
    createdAt: now - 86400000,
  });

  // Тестовые сообщения
  add("messages", {
    id: "msg_1", senderId: "user_buyer", recipientId: "user_demo",
    listingId: "lot_1", content: "Здравствуйте! Есть ли царапины на экране?",
    read: true, createdAt: now - 2 * 86400000,
  });
  add("messages", {
    id: "msg_2", senderId: "user_demo", recipientId: "user_buyer",
    listingId: "lot_1", content: "Добрый день! Нет, экран идеальный, защитное стекло с момента покупки.",
    read: true, createdAt: now - 2 * 86400000 + 3600000,
  });
  add("messages", {
    id: "msg_3", senderId: "user_buyer", recipientId: "user_other",
    listingId: "lot_4", content: "Подскажите, куртка в размер или маломерит?",
    read: false, createdAt: now - 86400000,
  });

  // Тестовое избранное
  add("watchlists", {
    id: "wl_1", userId: "user_buyer", listingId: "lot_1", createdAt: now - 5 * 86400000,
  });
  add("watchlists", {
    id: "wl_2", userId: "user_buyer", listingId: "lot_3", createdAt: now - 3 * 86400000,
  });

  // Тестовые сохранённые поиски
  add("savedSearches", {
    id: "ss_1", userId: "user_buyer", query: "iPhone Pro Max",
    createdAt: now - 7 * 86400000,
  });

  // Тестовые уведомления
  add("notifications", {
    id: "notif_1", userId: "user_buyer", type: "bid_outbid",
    title: "Вашу ставку перебили", body: "Лот «iPhone 14 Pro Max» — новая цена 52 000 ₽",
    refId: "lot_1", read: false, createdAt: now - 43200000,
  });
  add("notifications", {
    id: "notif_2", userId: "user_demo", type: "new_bid",
    title: "Новая ставка", body: "На лот «iPhone 14 Pro Max» — 52 500 ₽",
    refId: "lot_1", read: false, createdAt: now - 3600000,
  });

  return effects;
}
