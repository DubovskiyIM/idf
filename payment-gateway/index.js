/**
 * payment-gateway — мок платежный шлюз (:3010).
 *
 * State machine: pending → held → (captured | refunded | expired)
 *
 * POST /holds { orderId, amount } → { id, status:"pending" }
 * Через 200-800ms webhook async → foreign_payment_webhook (status:"held")
 * POST /captures/:id → 200-800ms webhook → foreign_payment_webhook (status:"captured")
 *   с irreversibility.__irr = { point:"high", at:now, reason:"payment.captured" }
 * POST /refunds/:id → webhook (status:"refunded", forward correction)
 *
 * 5% failure rate simulates real-world.
 */

const express = require("express");
const cors = require("cors");
const { randomUUID } = require("node:crypto");

const PORT = 3010;
const MAIN_SERVER = process.env.IDF_MAIN_SERVER || "http://localhost:3001";

const payments = new Map(); // id → { orderId, amount, status }

function randomDelay() {
  return 200 + Math.random() * 600;
}

function shouldFail() {
  return Math.random() < 0.05; // 5%
}

async function sendWebhook(payment, finalStatus, irrMarker) {
  const now = Date.now();
  const ctx = {
    id: payment.id,
    orderId: payment.orderId,
    status: finalStatus,
    amount: payment.amount,
    source: "payment-gateway",
  };
  if (finalStatus === "held") ctx.holdAt = now;
  if (finalStatus === "captured") ctx.capturedAt = now;
  if (finalStatus === "refunded") ctx.refundedAt = now;
  if (irrMarker) ctx.__irr = irrMarker;

  const effect = {
    id: randomUUID(),
    intent_id: "_foreign",
    alpha: "replace",
    target: "Payment.status",
    value: finalStatus,
    scope: "global",
    parent_id: null,
    status: "confirmed",
    ttl: null,
    context: ctx,
    created_at: now,
    resolved_at: now,
  };

  try {
    const res = await fetch(`${MAIN_SERVER}/api/effects/seed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([effect]),
    });
    if (res.ok) {
      console.log(`  [payment-gw] ${payment.id} → ${finalStatus}${irrMarker ? " (irreversible)" : ""}`);
    }
  } catch (err) {
    console.warn(`  [payment-gw] webhook failed: ${err.message}`);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", payments: payments.size });
});

app.post("/holds", async (req, res) => {
  const { orderId, amount } = req.body;
  if (!orderId || !amount) return res.status(400).json({ error: "orderId_and_amount_required" });

  const id = randomUUID();
  const payment = { id, orderId, amount, status: "pending" };
  payments.set(id, payment);

  res.json({ id, status: "pending" });

  // Async webhook
  setTimeout(async () => {
    if (shouldFail()) {
      payment.status = "failed";
      console.warn(`  [payment-gw] ${id} hold FAILED (simulated)`);
      return;
    }
    payment.status = "held";
    await sendWebhook(payment, "held");
  }, randomDelay());
});

app.post("/captures/:id", async (req, res) => {
  const payment = payments.get(req.params.id);
  if (!payment) return res.status(404).json({ error: "payment_not_found" });
  if (payment.status !== "held") return res.status(400).json({ error: "must_be_held", current: payment.status });

  res.json({ id: payment.id, status: "capture_pending" });

  setTimeout(async () => {
    if (shouldFail()) {
      console.warn(`  [payment-gw] ${payment.id} capture FAILED`);
      return;
    }
    payment.status = "captured";
    // Irreversibility marker — payment capture = point of no return
    await sendWebhook(payment, "captured", {
      point: "high",
      at: Date.now(),
      reason: "payment.captured"
    });
  }, randomDelay());
});

app.post("/refunds/:id", async (req, res) => {
  const payment = payments.get(req.params.id);
  if (!payment) return res.status(404).json({ error: "payment_not_found" });

  res.json({ id: payment.id, status: "refund_pending" });

  setTimeout(async () => {
    payment.status = "refunded";
    // Forward correction — разрешён даже после captured
    await sendWebhook(payment, "refunded");
  }, randomDelay());
});

app.listen(PORT, () => {
  console.log(`payment-gateway запущен на :${PORT}, webhook → ${MAIN_SERVER}`);
});
