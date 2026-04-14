/**
 * invest-ml — мок внешнего ML-сервиса (:3003).
 *
 * Источник foreign-эффектов для invest-домена (§13 граница).
 * Каждые 30 секунд push'ит новый MarketSignal (price|volume|sentiment)
 * по случайному активу в Φ главного сервера через POST /api/effects/seed.
 *
 * Запуск: `npm run invest-ml`
 * Требует: главный сервер на :3001 должен быть запущен.
 */

const express = require("express");
const cors = require("cors");
const { randomUUID } = require("node:crypto");

const PORT = 3003;
const MAIN_SERVER = process.env.IDF_MAIN_SERVER || "http://localhost:3001";
const TICK_INTERVAL_MS = Number(process.env.INVEST_ML_TICK || 30_000);

const ASSETS = [
  "ast_sber", "ast_gazp", "ast_yndx", "ast_lkoh",
  "ast_aapl", "ast_msft", "ast_nvda",
  "ast_btc", "ast_eth",
  "ast_tmos", "ast_sbmx", "ast_ofz26238",
];

const KINDS = ["price", "volume", "sentiment"];

function randomSignal() {
  const assetId = ASSETS[Math.floor(Math.random() * ASSETS.length)];
  const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
  let value;
  switch (kind) {
    case "price":
      // симуляция дрейфа вокруг произвольного base-price
      value = +(Math.random() * 1000 + 100).toFixed(2);
      break;
    case "volume":
      value = Math.floor(Math.random() * 1e9);
      break;
    case "sentiment":
      // от -1 до 1
      value = +(Math.random() * 2 - 1).toFixed(3);
      break;
  }
  return { assetId, kind, value };
}

async function pushForeignEffect() {
  const sig = randomSignal();
  const now = Date.now();
  const effect = {
    id: randomUUID(),
    intent_id: "_foreign",
    alpha: "add",
    target: "marketSignals",
    value: null,
    scope: "global",
    parent_id: null,
    status: "confirmed",
    ttl: null,
    context: {
      id: `sig_${now}_${Math.random().toString(36).slice(2, 6)}`,
      source: "invest-ml",
      ...sig,
      timestamp: now,
    },
    created_at: now,
    resolved_at: now,
  };

  try {
    const res = await fetch(`${MAIN_SERVER}/api/effects/seed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([effect]),
    });
    if (!res.ok) {
      console.warn(`  [invest-ml] push failed: ${res.status}`);
      return;
    }
    console.log(`  [invest-ml] ${sig.kind}(${sig.assetId}) = ${sig.value}`);
  } catch (err) {
    console.warn(`  [invest-ml] error: ${err.message}`);
  }
}

// ─── REST API (on-demand) ───

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/signal", (_req, res) => {
  res.json(randomSignal());
});

app.post("/api/push", async (_req, res) => {
  await pushForeignEffect();
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", tickInterval: TICK_INTERVAL_MS });
});

app.listen(PORT, () => {
  console.log(`invest-ml mock запущен на :${PORT}, push каждые ${TICK_INTERVAL_MS}ms → ${MAIN_SERVER}`);
});

// ─── Periodic push ───

setInterval(pushForeignEffect, TICK_INTERVAL_MS);
// Первый push через 10 секунд после старта (чтобы главный сервер успел подняться)
setTimeout(pushForeignEffect, 10_000);
