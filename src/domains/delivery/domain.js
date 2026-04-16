/**
 * Delivery domain — food / groceries last-mile (field-test 11).
 * Большинство intents через Generic Effect Handler (client side — возвращает
 * [] → runtime применит intent.particles.effects). Специфика — для 4 intents:
 *   place_order    — batch: Order status + Payment add
 *   capture_payment — irreversibility (__irr high+at в context)
 *   cancel_order   — batch: Order status + маркер compensating
 *   request_refund — Payment status (forward correction)
 *
 * Server-side builder — в server/schema/buildDeliveryEffects.cjs (Task 6).
 */
import { v4 as uuid } from "uuid";
export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";

import { INTENTS } from "./intents.js";

export const DOMAIN_ID = "delivery";
export const DOMAIN_NAME = "Delivery";

export function describeEffect(intentId, alpha, ctx, target) {
  switch (intentId) {
    case "create_draft_order":      return `🛒 Черновик заказа`;
    case "add_to_cart":             return `+ ${ctx.quantity || 1} × ${ctx.menuItemId}`;
    case "place_order":             return `📦 Заказ размещён`;
    case "cancel_order":            return `✗ Отмена заказа`;
    case "accept_order":            return `✓ Мерчант принял`;
    case "reject_order":            return `✗ Мерчант отклонил`;
    case "start_cooking":           return `🔥 Готовится`;
    case "mark_ready":              return `✓ Готово к выдаче`;
    case "accept_assignment":       return `🚴 Курьер принял`;
    case "confirm_pickup":          return `📤 Передано курьеру`;
    case "start_delivery":          return `➡️ В пути`;
    case "confirm_delivery":        return `✓ Доставлено`;
    case "capture_payment":         return `💳 Оплата списана (необратимо)`;
    case "request_refund":          return `↩️ Запрос возврата`;
    case "rate_delivery":           return `⭐ Оценка ${ctx.rating || "?"}`;
    case "agent_auto_assign_courier": return `🤖 Агент: назначение курьера`;
    case "agent_auto_reassign":     return `🤖 Агент: переназначение`;
    case "foreign_ingest_location": return `📍 Courier tick`;
    case "foreign_payment_webhook": return `💳 Payment webhook`;
    case "_seed":                   return `seed: ${alpha} ${ctx.id || ""}`;
    default: {
      const intent = INTENTS[intentId];
      return `${intent?.name || intentId}: ${alpha} ${target || ""}`;
    }
  }
}

export function signalForIntent(intentId) {
  switch (intentId) {
    case "agent_auto_notify_customer": return { κ: "notification", desc: "Уведомление клиенту" };
    case "rule_send_review_reminder":  return { κ: "notification", desc: "Напоминание об отзыве" };
    case "rule_escalate_order":        return { κ: "notification", desc: "Эскалация заказа" };
    default: return null;
  }
}

/**
 * Клиентский buildEffects. Большинство intents → generic handler (return []).
 * Специфика — для 4 intents ниже.
 */
export function buildEffects(intentId, ctx, world, drafts) {
  const now = Date.now();
  const effects = [];
  const ef = (p) => effects.push({
    id: uuid(), intent_id: intentId, parent_id: null, status: "proposed",
    ttl: null, created_at: now, ...p,
  });

  switch (intentId) {
    case "place_order": {
      // batch: Order.status → placed + Payment add (hold)
      const paymentId = uuid();
      ef({
        alpha: "replace", target: "order.status", value: "placed",
        scope: "account", context: { id: ctx.id },
      });
      ef({
        alpha: "add", target: "Payment", scope: "account",
        context: {
          id: paymentId, orderId: ctx.id, customerId: ctx.customerId || ctx.userId,
          amount: ctx.totalAmount, status: "pending", createdAt: now,
        },
      });
      return effects;
    }

    case "capture_payment": {
      // Irreversibility marker — __irr.point high + at (Plan 4)
      ef({
        alpha: "replace", target: "Payment.status", value: "captured",
        scope: "account",
        context: {
          id: ctx.id, status: "captured", capturedAt: now,
          __irr: { point: "high", at: now, reason: "payment.captured" },
        },
      });
      return effects;
    }

    case "cancel_order": {
      // Compensating batch: Order cancelled.
      // Payment refund идёт через отдельный request_refund intent (может
      // быть forward-correction после captured).
      ef({
        alpha: "replace", target: "order.status", value: "cancelled",
        scope: "account", context: { id: ctx.id },
      });
      return effects;
    }

    case "request_refund": {
      // Forward correction — всегда разрешён, даже после capture_payment.
      ef({
        alpha: "replace", target: "Payment.status", value: "refunded",
        scope: "account",
        context: { id: ctx.id, refundedAt: now },
      });
      return effects;
    }

    default:
      return []; // generic handler применит intent.particles.effects
  }
}

/**
 * Seed — realistic demo-мир (~33 эффектов): курьеры, мерчанты, меню, зоны,
 * диспетчер, демо-заказ в статусе ready. Логика из scripts/delivery-seed.mjs.
 */
export function getSeedEffects() {
  const now = Date.now();
  const effects = [];
  const ef = (props) => effects.push({
    id: uuid(), intent_id: "_seed", alpha: "add", scope: "account",
    parent_id: null, status: "confirmed", ttl: null,
    created_at: now, resolved_at: now, ...props,
  });

  // Couriers (4)
  ["courier_1", "courier_2", "courier_3", "courier_4"].forEach((id, i) => {
    ef({ target: "User", context: {
      id, name: `Курьер ${i + 1}`, email: `${id}@delivery.local`,
      role: "courier", rating: 4.5 + (i * 0.1), createdAt: now,
    } });
  });

  // Merchants (3) + их owner-пользователи
  const MERCHANTS = [
    { id: "merch_1", ownerId: "m_user_1", name: "Пицца-бар", type: "restaurant" },
    { id: "merch_2", ownerId: "m_user_2", name: "Суши-мастер", type: "restaurant" },
    { id: "merch_3", ownerId: "m_user_3", name: "Бургер-кинг-фуд", type: "restaurant" },
  ];
  MERCHANTS.forEach(m => {
    ef({ target: "User", context: {
      id: m.ownerId, name: `Владелец ${m.name}`, email: `${m.ownerId}@delivery.local`,
      role: "merchant", createdAt: now,
    } });
    ef({ target: "Merchant", context: {
      id: m.id, ownerId: m.ownerId, name: m.name, type: m.type,
      rating: 4.5, status: "active", createdAt: now,
    } });
  });

  // MenuItem (10)
  const MENU = [
    { merch: "merch_1", name: "Маргарита", price: 590, category: "Пицца" },
    { merch: "merch_1", name: "Четыре сыра", price: 690, category: "Пицца" },
    { merch: "merch_1", name: "Пепперони", price: 650, category: "Пицца" },
    { merch: "merch_2", name: "Сет Филадельфия", price: 1290, category: "Сеты" },
    { merch: "merch_2", name: "Сет Калифорния", price: 990, category: "Сеты" },
    { merch: "merch_2", name: "Мисо-суп", price: 290, category: "Супы" },
    { merch: "merch_3", name: "Чизбургер", price: 390, category: "Бургеры" },
    { merch: "merch_3", name: "Двойной бургер", price: 590, category: "Бургеры" },
    { merch: "merch_3", name: "Картофель фри", price: 190, category: "Снеки" },
    { merch: "merch_3", name: "Милкшейк", price: 290, category: "Напитки" },
  ];
  MENU.forEach((item, i) => {
    ef({ target: "MenuItem", context: {
      id: `item_${i + 1}`, merchantId: item.merch, name: item.name,
      price: item.price, category: item.category, available: true,
    } });
  });

  // Zones (2)
  ef({ target: "Zone", context: {
    id: "zone_center", name: "Центр", city: "Москва",
    polygon: [
      { lat: 55.760, lng: 37.600 }, { lat: 55.760, lng: 37.640 },
      { lat: 55.745, lng: 37.640 }, { lat: 55.745, lng: 37.600 },
    ],
  } });
  ef({ target: "Zone", context: {
    id: "zone_east", name: "Восток", city: "Москва",
    polygon: [
      { lat: 55.760, lng: 37.640 }, { lat: 55.760, lng: 37.680 },
      { lat: 55.745, lng: 37.680 }, { lat: 55.745, lng: 37.640 },
    ],
  } });

  // Dispatcher + 2 assignments
  ef({ target: "User", context: {
    id: "disp_1", name: "Диспетчер Иван", email: "disp_1@delivery.local",
    role: "dispatcher", createdAt: now,
  } });
  ef({ target: "DispatcherAssignment", context: {
    id: "dassign_1", dispatcherId: "disp_1", zoneId: "zone_center",
    status: "active", shiftStart: now - 3600_000, shiftEnd: now + 18000_000,
  } });
  ef({ target: "DispatcherAssignment", context: {
    id: "dassign_2", dispatcherId: "disp_1", zoneId: "zone_east",
    status: "active", shiftStart: now - 3600_000, shiftEnd: now + 18000_000,
  } });

  // Customer + demo Order (ready, ждёт курьера)
  ef({ target: "User", context: {
    id: "cust_1", name: "Клиент Анна", email: "anna@delivery.local",
    role: "customer", createdAt: now,
  } });
  ef({ target: "Address", context: {
    id: "addr_demo", text: "Тверская 10", lat: 55.7648, lng: 37.6053,
    placeId: "pl_tv10", source: "seed",
  } });
  ef({ target: "Order", context: {
    id: "order_demo", customerId: "cust_1", merchantId: "merch_1",
    status: "ready", totalAmount: 1240, deliveryAddress: "Тверская 10",
    addressId: "addr_demo",
    createdAt: now - 1200_000,
  } });
  ef({ target: "OrderItem", context: {
    id: "oi_1", orderId: "order_demo", menuItemId: "item_1", quantity: 1, price: 590,
  } });
  ef({ target: "OrderItem", context: {
    id: "oi_2", orderId: "order_demo", menuItemId: "item_2", quantity: 1, price: 650,
  } });
  ef({ target: "Payment", context: {
    id: "pay_demo", orderId: "order_demo", customerId: "cust_1",
    amount: 1240, status: "pending", createdAt: now - 1200_000,
  } });

  // Courier-локации — для карты dispatcher_map
  ef({ target: "CourierLocation", context: {
    id: "cloc_1", courierId: "courier_1", lat: 55.755, lng: 37.620,
    status: "available", updatedAt: now,
  } });
  ef({ target: "CourierLocation", context: {
    id: "cloc_2", courierId: "courier_2", lat: 55.752, lng: 37.650,
    status: "busy", updatedAt: now,
  } });

  return effects;
}
