/**
 * courier-location-feed — мок GPS-feed курьеров (:3008).
 *
 * Каждые 3 секунды выбирает случайного курьера и двигает его позицию
 * на небольшой вектор. Push через foreign_ingest_location.
 */

const express = require("express");
const cors = require("cors");
const { randomUUID } = require("node:crypto");

const PORT = 3008;
const MAIN_SERVER = process.env.IDF_MAIN_SERVER || "http://localhost:3001";
const TICK_INTERVAL_MS = Number(process.env.COURIER_FEED_TICK || 3_000);

// Демо-курьеры (совпадает с seed delivery-домена)
const COURIERS = ["courier_1", "courier_2", "courier_3", "courier_4"];

// Начальные позиции в центре Москвы + разные зоны
const positions = {
  courier_1: { lat: 55.751, lng: 37.618, speed: 0 },
  courier_2: { lat: 55.758, lng: 37.602, speed: 0 },
  courier_3: { lat: 55.747, lng: 37.634, speed: 0 },
  courier_4: { lat: 55.755, lng: 37.615, speed: 0 },
};

async function tickLocation() {
  const courierId = COURIERS[Math.floor(Math.random() * COURIERS.length)];
  const prev = positions[courierId];

  // Random walk: ±0.001 градуса (~100м), speed 0-40 км/ч
  const dlat = (Math.random() - 0.5) * 0.002;
  const dlng = (Math.random() - 0.5) * 0.002;
  const speed = Math.random() * 40;
  const heading = Math.random() * 360;

  const newPos = {
    lat: +(prev.lat + dlat).toFixed(6),
    lng: +(prev.lng + dlng).toFixed(6),
    speed,
  };
  positions[courierId] = newPos;

  const now = Date.now();
  const effect = {
    id: randomUUID(),
    intent_id: "_foreign",
    alpha: "add",
    target: "CourierLocation",
    value: null,
    scope: "global",
    parent_id: null,
    status: "confirmed",
    ttl: null,
    context: {
      id: randomUUID(),
      courierId,
      lat: newPos.lat,
      lng: newPos.lng,
      speed,
      heading,
      recordedAt: now,
      source: "courier-location-feed",
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
      console.warn(`  [courier-feed] push failed: ${res.status}`);
      return;
    }
    console.log(`  [courier-feed] ${courierId}: ${newPos.lat},${newPos.lng} @ ${speed.toFixed(1)}km/h`);
  } catch (err) {
    console.warn(`  [courier-feed] error: ${err.message}`);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", couriers: COURIERS.length, tickInterval: TICK_INTERVAL_MS });
});

app.listen(PORT, () => {
  console.log(`courier-location-feed запущен на :${PORT}, tick каждые ${TICK_INTERVAL_MS}ms → ${MAIN_SERVER}`);
});

setInterval(tickLocation, TICK_INTERVAL_MS);
setTimeout(tickLocation, 3_000);
