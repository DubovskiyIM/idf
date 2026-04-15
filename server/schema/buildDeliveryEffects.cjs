/**
 * Delivery — server-side build effects для agent layer (§17) и fallback
 * в effect-pipeline.
 *
 * Специфика: 4 intents с нетривиальной логикой. Остальные ~41 — через
 * Generic Effect Handler (возврат null → runtime применит intent.particles.effects).
 *
 *   place_order    — batch: Order.status → placed + Payment add (hold)
 *   capture_payment — Payment.status → captured + __irr high+at (Plan 4)
 *   cancel_order   — compensating: Order.status → cancelled
 *   request_refund — forward-correction: Payment.status → refunded
 */

const { v4: uuid } = require("uuid");
const { mergeIntoContext, IRR_POINT_HIGH } = require("../irreversibility.cjs");

function makeEffect(intentId, p) {
  return {
    id: uuid(),
    intent_id: intentId,
    parent_id: null,
    status: "proposed",
    ttl: null,
    created_at: Date.now(),
    ...p,
  };
}

function buildDeliveryEffects(intentId, params, viewer, world) {
  switch (intentId) {
    case "place_order": {
      // batch: Order.status → placed + Payment add с status="pending"
      const now = Date.now();
      const paymentId = uuid();
      return [
        makeEffect("place_order", {
          alpha: "replace",
          target: "order.status",
          value: "placed",
          scope: "account",
          context: { id: params.id },
        }),
        makeEffect("place_order", {
          alpha: "add",
          target: "Payment",
          scope: "account",
          context: {
            id: paymentId,
            orderId: params.id,
            customerId: viewer?.id || params.customerId,
            amount: params.totalAmount,
            status: "pending",
            createdAt: now,
          },
        }),
      ];
    }

    case "capture_payment": {
      // Irreversibility — point high + at (Plan 4)
      const now = Date.now();
      const baseCtx = { id: params.id, status: "captured", capturedAt: now };
      const ctxWithIrr = mergeIntoContext(baseCtx, {
        point: IRR_POINT_HIGH,
        at: now,
        reason: "payment.captured",
      });
      return [
        makeEffect("capture_payment", {
          alpha: "replace",
          target: "Payment.status",
          value: "captured",
          scope: "account",
          context: ctxWithIrr,
        }),
      ];
    }

    case "cancel_order": {
      // Compensating: Order.status → cancelled
      return [
        makeEffect("cancel_order", {
          alpha: "replace",
          target: "order.status",
          value: "cancelled",
          scope: "account",
          context: { id: params.id },
        }),
      ];
    }

    case "request_refund": {
      // Forward-correction — даже после capture_payment (Plan 4 §6 docstring).
      return [
        makeEffect("request_refund", {
          alpha: "replace",
          target: "Payment.status",
          value: "refunded",
          scope: "account",
          context: { id: params.id, refundedAt: Date.now() },
        }),
      ];
    }

    default:
      return null; // сигнал для Generic Effect Handler
  }
}

module.exports = { buildDeliveryEffects };
