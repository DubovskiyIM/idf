/**
 * notification-gateway — мок SMS/push шлюз (:3011).
 *
 * POST /send { recipientUserId, channel, template, params } → { id, queued }
 * Через 100-400ms webhook → foreign_notification_sent.
 * irreversibility: SMS улетел = нельзя откатить (point:"high").
 */

const express = require("express");
const cors = require("cors");
const { randomUUID } = require("node:crypto");

const PORT = 3011;
const MAIN_SERVER = process.env.IDF_MAIN_SERVER || "http://localhost:3001";

async function sendWebhook(notification) {
  const now = Date.now();
  const effect = {
    id: randomUUID(),
    intent_id: "_foreign",
    alpha: "add",
    target: "Notification",
    value: null,
    scope: "global",
    parent_id: null,
    status: "confirmed",
    ttl: null,
    context: {
      id: notification.id,
      recipientUserId: notification.recipientUserId,
      channel: notification.channel,
      template: notification.template,
      sentAt: now,
      status: notification.failed ? "failed" : "delivered",
      source: "notification-gateway",
      __irr: notification.failed ? null : {
        point: "high",
        at: now,
        reason: `${notification.channel} sent`,
      },
    },
    created_at: now,
    resolved_at: now,
  };

  try {
    await fetch(`${MAIN_SERVER}/api/effects/seed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([effect]),
    });
    const status = notification.failed ? "FAILED" : "delivered";
    console.log(`  [notify-gw] ${notification.channel} → ${notification.recipientUserId}: ${status}`);
  } catch (err) {
    console.warn(`  [notify-gw] webhook failed: ${err.message}`);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/send", async (req, res) => {
  const { recipientUserId, channel = "push", template } = req.body;
  if (!recipientUserId || !template) {
    return res.status(400).json({ error: "recipientUserId_and_template_required" });
  }

  const id = randomUUID();
  res.json({ id, queued: true });

  // Fire-and-forget webhook
  setTimeout(async () => {
    const failed = Math.random() < 0.03; // 3% failure rate
    await sendWebhook({ id, recipientUserId, channel, template, failed });
  }, 100 + Math.random() * 300);
});

app.listen(PORT, () => {
  console.log(`notification-gateway запущен на :${PORT} → ${MAIN_SERVER}`);
});
