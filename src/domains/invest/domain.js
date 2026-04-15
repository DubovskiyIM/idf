/**
 * Invest domain — personal investing / робо-эдвайзер.
 *
 * Тонкий buildEffects: большинство намерений через Generic Effect Handler
 * (как в sales). Специальные случаи: register, compute_risk_profile.
 */

import { v4 as uuid } from "uuid";
export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
import { INTENTS } from "./intents.js";

export const DOMAIN_ID = "invest";
export const DOMAIN_NAME = "Invest";

export function describeEffect(intentId, alpha, ctx, target) {
  switch (intentId) {
    case "create_portfolio": return `💼 Портфель: ${ctx.name || "?"}`;
    case "create_goal": return `🎯 Цель: ${ctx.name || "?"}`;
    case "buy_asset": return `🟢 Купить ${ctx.quantity} × ${ctx.assetId}`;
    case "sell_asset": return `🔴 Продать ${ctx.quantity} × ${ctx.assetId}`;
    case "accept_recommendation": return `✓ Рекомендация принята`;
    case "reject_recommendation": return `✗ Рекомендация отклонена`;
    case "agent_propose_rebalance": return `🤖 Агент: предложение ребаланса`;
    case "agent_flag_anomaly": return `⚠ Агент: аномалия`;
    case "_seed": return `seed: ${alpha} ${ctx.id || ""}`;
    default: {
      const intent = INTENTS[intentId];
      return `${intent?.name || intentId}: ${alpha} ${target || ""}`;
    }
  }
}

export function signalForIntent(intentId) {
  switch (intentId) {
    case "agent_flag_anomaly": return { κ: "notification", desc: "Аномалия" };
    case "agent_propose_rebalance": return { κ: "notification", desc: "Предложение ребаланса" };
    case "set_price_alert": return { κ: "notification", desc: "Alert настроен" };
    default: return null;
  }
}

export function buildEffects(intentId, ctx, world, drafts) {
  const now = Date.now();
  const effects = [];
  const ef = (props) => effects.push({
    id: uuid(), intent_id: intentId, parent_id: null, status: "proposed",
    ttl: null, created_at: now, ...props,
  });

  switch (intentId) {
    case "buy_asset":
    case "sell_asset": {
      const α = intentId === "buy_asset" ? "buy" : "sell";
      const qty = Number(ctx.quantity) || 0;
      const price = Number(ctx.price) || 0;
      const fee = Number(ctx.fee) || 0;
      const total = qty * price + fee;
      ef({
        alpha: "add", target: "transactions", scope: "account", value: null,
        context: {
          id: `tx_${now}_${Math.random().toString(36).slice(2, 6)}`,
          portfolioId: ctx.portfolioId,
          userId: ctx.userId || ctx.clientId,
          assetId: ctx.assetId,
          α, quantity: qty, price, fee, total,
          initiatedBy: ctx.initiatedBy || "user",
          ruleId: ctx.ruleId || null,
          timestamp: now,
        },
        desc: describeEffect(intentId, "add", ctx),
      });
      return effects;
    }

    case "compute_risk_profile": {
      const score = Number(ctx.computedScore) ?? 50;
      const level = score < 33 ? "conservative" : score < 67 ? "balanced" : "aggressive";
      ef({
        alpha: "add", target: "riskProfiles", scope: "account", value: null,
        context: {
          id: `risk_${now}`,
          userId: ctx.userId || ctx.clientId,
          horizonYears: Number(ctx.horizonYears) || 5,
          lossTolerancePct: Number(ctx.lossTolerancePct) || 10,
          computedScore: score, level,
          updatedAt: now,
        },
      });
      return effects;
    }
  }

  // Generic handler
  const intent = INTENTS[intentId];
  if (!intent) return null;
  const intentEffects = intent.particles.effects || [];
  if (intentEffects.length === 0) return null;
  for (const iEf of intentEffects) {
    const alpha = iEf.α;
    const target = iEf.target;
    const scope = iEf.σ || "account";
    switch (alpha) {
      case "add": {
        const id = ctx.id || `${target.slice(0, 4)}_${now}_${Math.random().toString(36).slice(2, 6)}`;
        ef({ alpha: "add", target, scope, value: null,
          context: { id, ...ctx, createdAt: now, userId: ctx.userId || ctx.clientId } });
        break;
      }
      case "replace": {
        const eid = ctx.id || ctx.entityId;
        const field = target.includes(".") ? target.split(".").pop() : target;
        const val = iEf.value !== undefined ? iEf.value
                  : ctx[field] !== undefined ? ctx[field]
                  : ctx.value;
        if (eid && val !== undefined) {
          ef({ alpha: "replace", target, scope, value: val,
            context: { id: eid, userId: ctx.userId || ctx.clientId } });
        }
        break;
      }
      case "remove": {
        const eid = ctx.id || ctx.entityId;
        if (eid) {
          ef({ alpha: "remove", target, scope, value: null,
            context: { id: eid, userId: ctx.userId || ctx.clientId } });
        }
        break;
      }
    }
  }
  return effects.length > 0 ? effects : null;
}

export function getSeedEffects() {
  const now = Date.now();
  const effects = [];
  const add = (target, context) => effects.push({
    id: uuid(), intent_id: "_seed", alpha: "add", target, value: null,
    scope: "global", parent_id: null, status: "confirmed", ttl: null,
    context, created_at: now, resolved_at: now,
  });

  const day = 24 * 60 * 60 * 1000;

  // ─── Assets — справочник ───
  const seedAssets = [
    { id: "ast_sber", ticker: "SBER", name: "Сбербанк", type: "stock", exchange: "MOEX", currency: "RUB" },
    { id: "ast_gazp", ticker: "GAZP", name: "Газпром", type: "stock", exchange: "MOEX", currency: "RUB" },
    { id: "ast_yndx", ticker: "YNDX", name: "Яндекс", type: "stock", exchange: "MOEX", currency: "RUB" },
    { id: "ast_lkoh", ticker: "LKOH", name: "Лукойл", type: "stock", exchange: "MOEX", currency: "RUB" },
    { id: "ast_aapl", ticker: "AAPL", name: "Apple", type: "stock", exchange: "NASDAQ", currency: "USD" },
    { id: "ast_msft", ticker: "MSFT", name: "Microsoft", type: "stock", exchange: "NASDAQ", currency: "USD" },
    { id: "ast_nvda", ticker: "NVDA", name: "NVIDIA", type: "stock", exchange: "NASDAQ", currency: "USD" },
    { id: "ast_btc", ticker: "BTC", name: "Bitcoin", type: "crypto", exchange: "—", currency: "USD" },
    { id: "ast_eth", ticker: "ETH", name: "Ethereum", type: "crypto", exchange: "—", currency: "USD" },
    { id: "ast_ofz26238", ticker: "OFZ-26238", name: "ОФЗ 26238", type: "bond", exchange: "MOEX", currency: "RUB" },
    { id: "ast_tmos", ticker: "TMOS", name: "Тинькофф Индекс МосБиржи", type: "etf", exchange: "MOEX", currency: "RUB" },
    { id: "ast_sbmx", ticker: "SBMX", name: "Сбер — Индекс МосБиржи", type: "etf", exchange: "MOEX", currency: "RUB" },
    { id: "ast_art_monet", ticker: "MONET-2019", name: "Моне, эскиз 1919", type: "art", exchange: "Sotheby's", currency: "USD" },
    { id: "ast_wine_rom2015", ticker: "ROM-2015", name: "Romanée-Conti 2015", type: "wine", exchange: "Liv-ex", currency: "EUR" },
  ];
  for (const a of seedAssets) add("assets", a);

  // ─── Portfolios — 3 демо-портфеля (userId: null = shared/demo) ───
  const portfolios = [
    {
      id: "pf_balanced", userId: null,
      name: "Сбалансированный", baseCurrency: "RUB", riskProfile: "balanced",
      targetStocks: 50, targetBonds: 35, targetCrypto: 10, targetExotic: 5,
      totalValue: 2_487_340, pnl: 187_340,
      createdAt: now - 180 * day,
    },
    {
      id: "pf_growth", userId: null,
      name: "Рост (агрессивный)", baseCurrency: "USD", riskProfile: "aggressive",
      targetStocks: 70, targetBonds: 5, targetCrypto: 20, targetExotic: 5,
      totalValue: 48_920, pnl: -2_180,
      createdAt: now - 90 * day,
    },
    {
      id: "pf_safe", userId: null,
      name: "Пенсия-2045", baseCurrency: "RUB", riskProfile: "conservative",
      targetStocks: 20, targetBonds: 75, targetCrypto: 0, targetExotic: 5,
      totalValue: 1_156_200, pnl: 56_200,
      createdAt: now - 365 * day,
    },
  ];
  for (const p of portfolios) add("portfolios", p);

  // ─── Positions ───
  const positions = [
    { id: "pos_1", portfolioId: "pf_balanced", userId: null, assetId: "ast_sber", quantity: 500, avgPrice: 270, currentPrice: 312, unrealizedPnL: 21_000, stopLoss: 245, takeProfit: 380 },
    { id: "pos_2", portfolioId: "pf_balanced", userId: null, assetId: "ast_yndx", quantity: 45, avgPrice: 3_250, currentPrice: 3_710, unrealizedPnL: 20_700, stopLoss: 2_900, takeProfit: null },
    { id: "pos_3", portfolioId: "pf_balanced", userId: null, assetId: "ast_tmos", quantity: 80, avgPrice: 7_120, currentPrice: 7_840, unrealizedPnL: 57_600, stopLoss: null, takeProfit: null },
    { id: "pos_4", portfolioId: "pf_balanced", userId: null, assetId: "ast_ofz26238", quantity: 800, avgPrice: 880, currentPrice: 905, unrealizedPnL: 20_000, stopLoss: null, takeProfit: null },
    { id: "pos_5", portfolioId: "pf_growth", userId: null, assetId: "ast_aapl", quantity: 30, avgPrice: 178, currentPrice: 195, unrealizedPnL: 510, stopLoss: 160, takeProfit: 230 },
    { id: "pos_6", portfolioId: "pf_growth", userId: null, assetId: "ast_nvda", quantity: 12, avgPrice: 620, currentPrice: 890, unrealizedPnL: 3_240, stopLoss: 540, takeProfit: null },
    { id: "pos_7", portfolioId: "pf_growth", userId: null, assetId: "ast_btc", quantity: 0.25, avgPrice: 67_000, currentPrice: 62_100, unrealizedPnL: -1_225, stopLoss: 55_000, takeProfit: 85_000 },
    { id: "pos_8", portfolioId: "pf_growth", userId: null, assetId: "ast_eth", quantity: 4.5, avgPrice: 3_200, currentPrice: 3_090, unrealizedPnL: -495, stopLoss: null, takeProfit: null },
    { id: "pos_9", portfolioId: "pf_safe", userId: null, assetId: "ast_ofz26238", quantity: 950, avgPrice: 875, currentPrice: 905, unrealizedPnL: 28_500, stopLoss: null, takeProfit: null },
    { id: "pos_10", portfolioId: "pf_safe", userId: null, assetId: "ast_sbmx", quantity: 120, avgPrice: 1_640, currentPrice: 1_728, unrealizedPnL: 10_560, stopLoss: null, takeProfit: null },
  ];
  for (const p of positions) add("positions", p);

  // ─── Transactions — 14 сделок разных инициаторов ───
  const transactions = [
    { id: "tx_1", portfolioId: "pf_balanced", userId: null, assetId: "ast_sber", α: "buy", quantity: 300, price: 265, fee: 120, total: 79_620, initiatedBy: "user", timestamp: now - 180 * day },
    { id: "tx_2", portfolioId: "pf_balanced", userId: null, assetId: "ast_sber", α: "buy", quantity: 200, price: 278, fee: 85, total: 55_685, initiatedBy: "user", timestamp: now - 150 * day },
    { id: "tx_3", portfolioId: "pf_balanced", userId: null, assetId: "ast_yndx", α: "buy", quantity: 45, price: 3_250, fee: 220, total: 146_470, initiatedBy: "agent", ruleId: "rule_rebal_1", timestamp: now - 120 * day },
    { id: "tx_4", portfolioId: "pf_balanced", userId: null, assetId: "ast_tmos", α: "buy", quantity: 80, price: 7_120, fee: 280, total: 569_880, initiatedBy: "user", timestamp: now - 100 * day },
    { id: "tx_5", portfolioId: "pf_balanced", userId: null, assetId: "ast_ofz26238", α: "buy", quantity: 800, price: 880, fee: 340, total: 704_340, initiatedBy: "user", timestamp: now - 90 * day },
    { id: "tx_6", portfolioId: "pf_growth", userId: null, assetId: "ast_aapl", α: "buy", quantity: 30, price: 178, fee: 4.5, total: 5_344.5, initiatedBy: "user", timestamp: now - 85 * day },
    { id: "tx_7", portfolioId: "pf_growth", userId: null, assetId: "ast_nvda", α: "buy", quantity: 12, price: 620, fee: 5.8, total: 7_445.8, initiatedBy: "agent", ruleId: "rule_ai_signal", timestamp: now - 60 * day },
    { id: "tx_8", portfolioId: "pf_growth", userId: null, assetId: "ast_btc", α: "buy", quantity: 0.25, price: 67_000, fee: 25, total: 16_775, initiatedBy: "user", timestamp: now - 45 * day },
    { id: "tx_9", portfolioId: "pf_growth", userId: null, assetId: "ast_eth", α: "buy", quantity: 4.5, price: 3_200, fee: 18, total: 14_418, initiatedBy: "user", timestamp: now - 40 * day },
    { id: "tx_10", portfolioId: "pf_balanced", userId: null, assetId: "ast_gazp", α: "sell", quantity: 100, price: 156, fee: 45, total: 15_555, initiatedBy: "rule", ruleId: "rule_stop_loss", timestamp: now - 35 * day },
    { id: "tx_11", portfolioId: "pf_safe", userId: null, assetId: "ast_ofz26238", α: "buy", quantity: 950, price: 875, fee: 400, total: 831_650, initiatedBy: "user", timestamp: now - 365 * day },
    { id: "tx_12", portfolioId: "pf_safe", userId: null, assetId: "ast_sbmx", α: "buy", quantity: 120, price: 1_640, fee: 90, total: 196_890, initiatedBy: "agent", ruleId: "rule_rebal_2", timestamp: now - 200 * day },
    { id: "tx_13", portfolioId: "pf_growth", userId: null, assetId: "ast_nvda", α: "sell", quantity: 3, price: 890, fee: 2.7, total: 2_667.3, initiatedBy: "user", timestamp: now - 7 * day },
    { id: "tx_14", portfolioId: "pf_balanced", userId: null, assetId: "ast_lkoh", α: "buy", quantity: 25, price: 6_820, fee: 170, total: 170_670, initiatedBy: "user", timestamp: now - 3 * day },
  ];
  for (const t of transactions) add("transactions", t);

  // ─── Goals ───
  const goals = [
    { id: "goal_flat", userId: null, name: "Первый взнос за квартиру", targetAmount: 3_500_000, deadline: now + 540 * day, priority: "high", linkedPortfolioId: "pf_balanced", currentAmount: 2_487_340, progress: 71 },
    { id: "goal_pension", userId: null, name: "Пенсионный фонд 2045", targetAmount: 15_000_000, deadline: now + 20 * 365 * day, priority: "medium", linkedPortfolioId: "pf_safe", currentAmount: 1_156_200, progress: 7.7 },
    { id: "goal_vacation", userId: null, name: "Круиз по Средиземному", targetAmount: 450_000, deadline: now + 180 * day, priority: "low", linkedPortfolioId: null, currentAmount: 120_000, progress: 26.7 },
  ];
  for (const g of goals) add("goals", g);

  // ─── RiskProfile — один для demo ───
  add("riskProfiles", {
    id: "risk_demo", userId: null,
    horizonYears: 7, lossTolerancePct: 25,
    computedScore: 58, level: "balanced",
    updatedAt: now - 30 * day,
  });

  // ─── AgentPreapproval — demo scope для робо-эдвайзера (§26.2) ───
  // userId=null → shared demo. Agent с JWT любого пользователя получает
  // эти лимиты. Для production — preapproval per viewer.id.
  add("agentpreapprovals", {
    id: "pa_demo", userId: null, active: true,
    maxOrderAmount: 50_000,
    allowedAssetTypes: "stock,bond,etf",
    allowedPortfolioIds: "", // пустое + allowEmpty → все портфели
    dailyLimit: 200_000,
    expiresAt: now + 180 * day,
    createdAt: now - 1 * day,
  });

  // ─── Recommendations — пачка от робо-эдвайзера ───
  const recommendations = [
    {
      id: "rec_1", userId: null, source: "agent", type: "rebalance",
      payload: JSON.stringify({ portfolioId: "pf_balanced", action: "sell SBER 50, buy TMOS 10" }),
      status: "pending", confidence: 82,
      rationale: "Доля SBER выросла до 14% (цель 10%). Ребаланс приблизит к target-аллокации.",
      createdAt: now - 2 * day,
    },
    {
      id: "rec_2", userId: null, source: "model", type: "buy",
      payload: JSON.stringify({ assetId: "ast_lkoh", quantity: 10 }),
      status: "pending", confidence: 67,
      rationale: "LSTM-модель: сильный momentum на 30-дневном горизонте + рост дивидендной доходности.",
      createdAt: now - 1 * day,
    },
    {
      id: "rec_3", userId: null, source: "advisor", type: "hold",
      payload: JSON.stringify({ message: "Не паниковать" }),
      status: "pending", confidence: 95,
      rationale: "Коррекция BTC в пределах обычной волатильности, фундаментал без изменений.",
      createdAt: now - 6 * 60 * 60 * 1000,
    },
    {
      id: "rec_4", userId: null, source: "agent", type: "sell",
      payload: JSON.stringify({ assetId: "ast_gazp" }),
      status: "accepted", confidence: 74,
      rationale: "Стоп-лосс сработал — падение ниже 160₽.",
      createdAt: now - 36 * day,
    },
  ];
  for (const r of recommendations) add("recommendations", r);

  // ─── Alerts ───
  const alerts = [
    { id: "al_1", userId: null, ruleId: "rule_drift_1", severity: "warning", message: "Отклонение аллокации портфеля 'Сбалансированный' > 5%", acknowledged: false, triggeredAt: now - 3 * 60 * 60 * 1000 },
    { id: "al_2", userId: null, ruleId: "rule_vol_btc", severity: "info", message: "Волатильность BTC за 24ч: 6.8% (порог 5%)", acknowledged: false, triggeredAt: now - 8 * 60 * 60 * 1000 },
    { id: "al_3", userId: null, ruleId: "rule_news_aapl", severity: "info", message: "Новость: Apple объявил buyback на $110B", acknowledged: true, triggeredAt: now - 2 * day },
    { id: "al_4", userId: null, ruleId: "rule_stop_loss", severity: "critical", message: "Stop-loss: GAZP ниже 160₽, проведена автопродажа 100 шт.", acknowledged: true, triggeredAt: now - 35 * day },
  ];
  for (const a of alerts) add("alerts", a);

  // ─── Watchlists ───
  add("watchlists", {
    id: "wl_tech", userId: null, name: "Tech — watchlist",
    assetIds: "ast_aapl,ast_msft,ast_nvda,ast_yndx",
  });
  add("watchlists", {
    id: "wl_div", userId: null, name: "Дивидендные",
    assetIds: "ast_sber,ast_lkoh,ast_gazp",
  });

  // ─── MarketSignals — из внешних ML/sentiment-сервисов ───
  const signals = [
    { id: "sig_1", source: "invest-ml", assetId: "ast_nvda", kind: "price", value: 890, timestamp: now - 60 * 1000 },
    { id: "sig_2", source: "invest-fuzzy", assetId: "ast_art_monet", kind: "fuzzy_risk", value: 0.68, timestamp: now - 10 * 60 * 1000 },
    { id: "sig_3", source: "invest-news", assetId: "ast_aapl", kind: "sentiment", value: 0.74, timestamp: now - 2 * day },
    { id: "sig_4", source: "invest-ml", assetId: "ast_btc", kind: "volume", value: 28_400_000_000, timestamp: now - 30 * 60 * 1000 },
    { id: "sig_5", source: "invest-news", assetId: "ast_sber", kind: "sentiment", value: 0.52, timestamp: now - 4 * 60 * 60 * 1000 },
  ];
  for (const s of signals) add("marketSignals", s);

  // ─── Demo-клиенты для advisor-режима ───
  // У каждого свой userId + портфель (чтобы advisor dashboard показывал
  // реалистичные данные). userId=demo_cl_* — явный marker demo.
  const demoClients = [
    { id: "demo_cl_1", email: "anna@example.com", name: "Анна Смирнова", avatar: null, accreditation: "qualified" },
    { id: "demo_cl_2", email: "boris@example.com", name: "Борис Петров", avatar: null, accreditation: "retail" },
    { id: "demo_cl_3", email: "elena@example.com", name: "Елена Кузнецова", avatar: null, accreditation: "qualified" },
  ];
  for (const u of demoClients) add("users", u);

  // Портфели клиентов (свои для каждого, кроме demo_cl_3)
  const clientPortfolios = [
    { id: "pf_anna_1", userId: "demo_cl_1", name: "Анна — основной", baseCurrency: "RUB", riskProfile: "balanced",
      targetStocks: 50, targetBonds: 40, targetCrypto: 5, targetExotic: 5, totalValue: 820_000, pnl: 45_000, createdAt: now - 100 * day },
    { id: "pf_boris_1", userId: "demo_cl_2", name: "Борис — ИИС", baseCurrency: "RUB", riskProfile: "conservative",
      targetStocks: 20, targetBonds: 75, targetCrypto: 0, targetExotic: 5, totalValue: 310_000, pnl: -8_000, createdAt: now - 200 * day },
    { id: "pf_elena_1", userId: "demo_cl_3", name: "Елена — Growth", baseCurrency: "USD", riskProfile: "aggressive",
      targetStocks: 65, targetBonds: 5, targetCrypto: 25, targetExotic: 5, totalValue: 78_000, pnl: 12_400, createdAt: now - 50 * day },
  ];
  for (const p of clientPortfolios) add("portfolios", p);

  // Risk profiles клиентов
  add("riskProfiles", { id: "risk_anna", userId: "demo_cl_1", horizonYears: 5, lossTolerancePct: 20, computedScore: 55, level: "balanced", updatedAt: now - 20 * day });
  add("riskProfiles", { id: "risk_boris", userId: "demo_cl_2", horizonYears: 10, lossTolerancePct: 10, computedScore: 25, level: "conservative", updatedAt: now - 40 * day });
  add("riskProfiles", { id: "risk_elena", userId: "demo_cl_3", horizonYears: 3, lossTolerancePct: 50, computedScore: 82, level: "aggressive", updatedAt: now - 10 * day });

  // Goals клиентов
  add("goals", { id: "goal_anna_house", userId: "demo_cl_1", name: "Загородный дом", targetAmount: 5_000_000, deadline: now + 1000 * day, priority: "high", linkedPortfolioId: "pf_anna_1", currentAmount: 820_000, progress: 16 });
  add("goals", { id: "goal_elena_car", userId: "demo_cl_3", name: "Tesla Model S", targetAmount: 120_000, deadline: now + 400 * day, priority: "medium", linkedPortfolioId: "pf_elena_1", currentAmount: 78_000, progress: 65 });

  // Assignments: demo-advisor (userId=null = видит всем) связан со всеми 3 клиентами.
  // Клиентский фильтр в проекциях — advisorId === viewer.id. Для demo-режима:
  // используем advisorId:null + клиентский filter "advisorId === viewer.id || !advisorId".
  // Это даёт любому залогиненному пользователю роль demo-advisor.
  const assignments = [
    { id: "asg_1", advisorId: null, clientId: "demo_cl_1", status: "active", createdAt: now - 90 * day, notes: "Новая клиентка, рекомендован сбалансированный профиль." },
    { id: "asg_2", advisorId: null, clientId: "demo_cl_2", status: "active", createdAt: now - 180 * day, notes: "Консервативный инвестор, ИИС в приоритете." },
    { id: "asg_3", advisorId: null, clientId: "demo_cl_3", status: "paused", createdAt: now - 40 * day, notes: "Пауза до июля — путешествует." },
  ];
  for (const a of assignments) add("assignments", a);

  return effects;
}
