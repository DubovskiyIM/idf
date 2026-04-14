/**
 * invest-fuzzy — мок fuzzy-logic сервиса (:3004).
 *
 * Оценивает экзотические активы (недвижимость, искусство, вино, крипто)
 * через лингвистические переменные («высокий риск», «средняя доходность»).
 * Выдаёт fuzzy_risk_score от 0 до 1.
 *
 * Источник foreign-эффектов MarketSignal{kind:"fuzzy_risk"} — каждые 60с.
 */

const express = require("express");
const cors = require("cors");
const { randomUUID } = require("node:crypto");

const PORT = 3004;
const MAIN_SERVER = process.env.IDF_MAIN_SERVER || "http://localhost:3001";
const TICK_INTERVAL_MS = Number(process.env.INVEST_FUZZY_TICK || 60_000);

// Экзотические активы под fuzzy-оценку
const EXOTIC_ASSETS = [
  { id: "ast_btc", name: "Bitcoin", base: 0.65 },
  { id: "ast_eth", name: "Ethereum", base: 0.58 },
  { id: "ast_art_monet", name: "Monet 1919", base: 0.72 },
  { id: "ast_wine_rom2015", name: "Romanée-Conti 2015", base: 0.45 },
];

/**
 * Fuzzy-inference: base + лингвистическая коррекция.
 * Возвращает score ∈ [0, 1] с «средне-высоким» риском.
 */
function fuzzyRisk(asset) {
  const noise = (Math.random() - 0.5) * 0.2;
  const score = Math.max(0, Math.min(1, asset.base + noise));
  const label = score < 0.3 ? "низкий" : score < 0.6 ? "средний" : "высокий";
  return { score: +score.toFixed(3), label };
}

async function pushFuzzySignal() {
  const asset = EXOTIC_ASSETS[Math.floor(Math.random() * EXOTIC_ASSETS.length)];
  const { score, label } = fuzzyRisk(asset);
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
      id: `sig_fuzzy_${now}`,
      source: "invest-fuzzy",
      assetId: asset.id,
      kind: "fuzzy_risk",
      value: score,
      label,
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
      console.warn(`  [invest-fuzzy] push failed: ${res.status}`);
      return;
    }
    console.log(`  [invest-fuzzy] ${asset.name}: риск=${label} (${score})`);
  } catch (err) {
    console.warn(`  [invest-fuzzy] error: ${err.message}`);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/score/:assetId", (req, res) => {
  const asset = EXOTIC_ASSETS.find(a => a.id === req.params.assetId);
  if (!asset) return res.status(404).json({ error: "asset not found" });
  res.json({ ...fuzzyRisk(asset), assetId: asset.id });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", assets: EXOTIC_ASSETS.length, tickInterval: TICK_INTERVAL_MS });
});

app.listen(PORT, () => {
  console.log(`invest-fuzzy mock запущен на :${PORT}, push каждые ${TICK_INTERVAL_MS}ms → ${MAIN_SERVER}`);
});

setInterval(pushFuzzySignal, TICK_INTERVAL_MS);
setTimeout(pushFuzzySignal, 15_000);
