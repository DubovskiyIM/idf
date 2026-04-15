/**
 * geocoder — мок address-to-coords сервис (:3009).
 *
 * POST /geocode { address } → { lat, lng, placeId }
 * Статичный словарь 10 адресов для демо.
 *
 * После успешного geocode также пушит foreign_geocode_ready → Address mirror.
 */

const express = require("express");
const cors = require("cors");
const { randomUUID } = require("node:crypto");

const PORT = 3009;
const MAIN_SERVER = process.env.IDF_MAIN_SERVER || "http://localhost:3001";

// Статический dictionary для демо — реальный geocoder заменим на Mapbox/Yandex.
const ADDRESS_DB = {
  "тверская 1": { lat: 55.7571, lng: 37.6128, placeId: "pl_tv1" },
  "тверская 10": { lat: 55.7648, lng: 37.6053, placeId: "pl_tv10" },
  "арбат 5": { lat: 55.7522, lng: 37.5936, placeId: "pl_ar5" },
  "арбат 20": { lat: 55.7490, lng: 37.5850, placeId: "pl_ar20" },
  "пушкинская 4": { lat: 55.7656, lng: 37.6060, placeId: "pl_pu4" },
  "неглинная 12": { lat: 55.7632, lng: 37.6199, placeId: "pl_ne12" },
  "маросейка 3": { lat: 55.7570, lng: 37.6342, placeId: "pl_ma3" },
  "сретенка 7": { lat: 55.7672, lng: 37.6311, placeId: "pl_sr7" },
  "большая никитская 15": { lat: 55.7602, lng: 37.6012, placeId: "pl_bn15" },
  "покровка 22": { lat: 55.7628, lng: 37.6468, placeId: "pl_po22" },
};

async function pushAddressMirror(address, coords) {
  const now = Date.now();
  const effect = {
    id: randomUUID(),
    intent_id: "_foreign",
    alpha: "add",
    target: "Address",
    value: null,
    scope: "global",
    parent_id: null,
    status: "confirmed",
    ttl: null,
    context: {
      id: coords.placeId,
      text: address,
      lat: coords.lat,
      lng: coords.lng,
      placeId: coords.placeId,
      source: "geocoder",
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
  } catch (err) {
    console.warn(`  [geocoder] mirror push failed: ${err.message}`);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", addresses: Object.keys(ADDRESS_DB).length });
});

app.post("/geocode", async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: "address required" });

  const key = address.toLowerCase().trim();
  const match = ADDRESS_DB[key];

  // Симуляция network delay (200-800ms)
  const delay = 200 + Math.random() * 600;
  await new Promise(r => setTimeout(r, delay));

  if (!match) {
    return res.status(404).json({ error: "address_not_found", address });
  }

  // Опционально — push в mirror
  if (req.query.mirror !== "false") {
    await pushAddressMirror(address, match);
  }

  console.log(`  [geocoder] ${address} → ${match.lat},${match.lng} (${delay.toFixed(0)}ms)`);
  res.json(match);
});

app.listen(PORT, () => {
  console.log(`geocoder запущен на :${PORT}, ${Object.keys(ADDRESS_DB).length} адресов в dictionary → ${MAIN_SERVER}`);
});
