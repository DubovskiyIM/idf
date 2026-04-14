/**
 * Invest domain — personal investing / робо-эдвайзер.
 *
 * Тонкий buildEffects: большинство намерений через Generic Effect Handler
 * (как в meshok). Специальные случаи: register, compute_risk_profile.
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

  // Demo assets — реальные тикеры
  const seedAssets = [
    { id: "ast_sber", ticker: "SBER", name: "Сбербанк", type: "stock", exchange: "MOEX", currency: "RUB" },
    { id: "ast_gazp", ticker: "GAZP", name: "Газпром", type: "stock", exchange: "MOEX", currency: "RUB" },
    { id: "ast_yndx", ticker: "YNDX", name: "Яндекс", type: "stock", exchange: "MOEX", currency: "RUB" },
    { id: "ast_lkoh", ticker: "LKOH", name: "Лукойл", type: "stock", exchange: "MOEX", currency: "RUB" },
    { id: "ast_aapl", ticker: "AAPL", name: "Apple", type: "stock", exchange: "NASDAQ", currency: "USD" },
    { id: "ast_msft", ticker: "MSFT", name: "Microsoft", type: "stock", exchange: "NASDAQ", currency: "USD" },
    { id: "ast_btc", ticker: "BTC", name: "Bitcoin", type: "crypto", exchange: "—", currency: "USD" },
    { id: "ast_eth", ticker: "ETH", name: "Ethereum", type: "crypto", exchange: "—", currency: "USD" },
    { id: "ast_ofz26238", ticker: "OFZ-26238", name: "ОФЗ 26238", type: "bond", exchange: "MOEX", currency: "RUB" },
    { id: "ast_tmos", ticker: "TMOS", name: "Тинькофф Индекс МосБиржи", type: "etf", exchange: "MOEX", currency: "RUB" },
  ];
  for (const a of seedAssets) add("assets", a);

  return effects;
}
