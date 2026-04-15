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
