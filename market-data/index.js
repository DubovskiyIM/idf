/**
 * market-data — мок market data feed (:3006).
 *
 * Имитирует биржевой data-feed: каждые 15 секунд обновляет цены
 * топовых позиций через `replace` эффекты на Position.currentPrice.
 *
 * Отличается от invest-ml:
 *  - invest-ml пушит MarketSignal (информационные сигналы)
 *  - market-data меняет state позиций напрямую (simulates realtime ticks)
 */

const express = require("express");
const cors = require("cors");
const { randomUUID } = require("node:crypto");

const PORT = 3006;
const MAIN_SERVER = process.env.IDF_MAIN_SERVER || "http://localhost:3001";
const TICK_INTERVAL_MS = Number(process.env.MARKET_DATA_TICK || 15_000);

// Демо-позиции для тикинга (должны совпадать с seed в invest/domain.js)
const POSITIONS = [
  "pos_1", "pos_2", "pos_3", "pos_4",
  "pos_5", "pos_6", "pos_7", "pos_8",
  "pos_9", "pos_10",
];

async function tickPriceUpdate() {
  // random walk — 1 позиция, ±2% к цене
  const posId = POSITIONS[Math.floor(Math.random() * POSITIONS.length)];
  const delta = (Math.random() - 0.5) * 0.04; // ±2%
  const now = Date.now();

  // Мы не знаем текущую цену позиции — серверу можем только отправить
  // replace (value: newPrice). Для демо пушим абсолютную цену через
  // вычислимое из asset-type price range.
  const base = 100 + Math.random() * 10_000;
  const newPrice = +(base * (1 + delta)).toFixed(2);

  const effect = {
    id: randomUUID(),
    intent_id: "_foreign",
    alpha: "replace",
    target: "position.currentPrice",
    value: newPrice,
    scope: "global",
    parent_id: null,
    status: "confirmed",
    ttl: null,
    context: {
      id: posId,
      source: "market-data",
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
      console.warn(`  [market-data] push failed: ${res.status}`);
      return;
    }
    const arrow = delta >= 0 ? "▲" : "▼";
    console.log(`  [market-data] ${posId}: ${arrow} ${newPrice}`);
  } catch (err) {
    console.warn(`  [market-data] error: ${err.message}`);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", positions: POSITIONS.length, tickInterval: TICK_INTERVAL_MS });
});

app.listen(PORT, () => {
  console.log(`market-data mock запущен на :${PORT}, tick каждые ${TICK_INTERVAL_MS}ms → ${MAIN_SERVER}`);
});

setInterval(tickPriceUpdate, TICK_INTERVAL_MS);
setTimeout(tickPriceUpdate, 5_000);
