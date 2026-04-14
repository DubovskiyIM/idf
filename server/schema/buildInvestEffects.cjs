/**
 * Серверный builder эффектов для agent-разрешённых invest-intent'ов.
 * Покрывает роль agent: agent_propose_rebalance / agent_execute_preapproved_order /
 * agent_flag_anomaly / agent_fetch_market_signal / agent_recompute_risk_score /
 * agent_generate_report.
 *
 * Parallel к src/domains/invest/domain.js buildEffects — серверная версия
 * для §17 agent layer.
 */

const { v4: uuid } = require("uuid");

function makeEffect(intentId, props) {
  return {
    id: uuid(), intent_id: intentId, parent_id: null,
    status: "proposed", ttl: null, created_at: Date.now(),
    ...props,
  };
}

function buildInvestEffects(intentId, params, viewer, world) {
  const now = Date.now();

  switch (intentId) {
    case "agent_propose_rebalance": {
      if (!params.portfolioId) return null;
      return [makeEffect(intentId, {
        alpha: "add", target: "recommendations", scope: "account", value: null,
        context: {
          id: `rec_${now}_${Math.random().toString(36).slice(2, 6)}`,
          userId: viewer.id,
          source: "agent",
          type: "rebalance",
          payload: JSON.stringify({ portfolioId: params.portfolioId, details: params.details || {} }),
          status: "pending",
          confidence: Number(params.confidence) || 75,
          rationale: params.rationale || "Отклонение аллокации превысило порог.",
          createdAt: now,
        },
        desc: `🤖 Ребаланс: ${params.portfolioId}`,
      })];
    }

    case "agent_execute_preapproved_order": {
      if (!params.portfolioId || !params.assetId || !params.quantity || !params.α) return null;
      const qty = Number(params.quantity) || 0;
      const price = Number(params.price) || 0;
      const fee = Number(params.fee) || 0;
      const total = qty * price + fee;
      return [makeEffect(intentId, {
        alpha: "add", target: "transactions", scope: "account", value: null,
        context: {
          id: `tx_${now}_${Math.random().toString(36).slice(2, 6)}`,
          portfolioId: params.portfolioId,
          userId: viewer.id,
          assetId: params.assetId,
          α: params.α, quantity: qty, price, fee, total,
          initiatedBy: "agent",
          ruleId: params.ruleId || null,
          timestamp: now,
        },
        desc: `🤖 ${params.α === "buy" ? "Купил" : "Продал"} ${qty}×${params.assetId}`,
      })];
    }

    case "agent_flag_anomaly": {
      return [makeEffect(intentId, {
        alpha: "add", target: "alerts", scope: "account", value: null,
        context: {
          id: `al_${now}_${Math.random().toString(36).slice(2, 6)}`,
          userId: viewer.id,
          ruleId: params.ruleId || null,
          severity: params.severity || "warning",
          message: params.message || "Аномалия обнаружена агентом",
          acknowledged: false,
          triggeredAt: now,
        },
        desc: `⚠ ${params.message || "Аномалия"}`,
      })];
    }

    case "agent_fetch_market_signal": {
      if (!params.assetId || !params.kind || params.value == null) return null;
      return [makeEffect(intentId, {
        alpha: "add", target: "marketSignals", scope: "global", value: null,
        context: {
          id: `sig_${now}_${Math.random().toString(36).slice(2, 6)}`,
          source: params.source || "agent",
          assetId: params.assetId,
          kind: params.kind,
          value: Number(params.value),
          timestamp: now,
        },
        desc: `📡 Сигнал ${params.kind} по ${params.assetId}`,
      })];
    }

    case "agent_recompute_risk_score": {
      const score = Number(params.computedScore) || 50;
      const level = score < 33 ? "conservative" : score < 67 ? "balanced" : "aggressive";
      return [makeEffect(intentId, {
        alpha: "add", target: "riskProfiles", scope: "account", value: null,
        context: {
          id: `risk_${now}`,
          userId: viewer.id,
          horizonYears: Number(params.horizonYears) || 5,
          lossTolerancePct: Number(params.lossTolerancePct) || 10,
          computedScore: score, level,
          updatedAt: now,
        },
        desc: `🤖 Risk: ${level} (${score})`,
      })];
    }

    case "agent_generate_report": {
      return [makeEffect(intentId, {
        alpha: "add", target: "recommendations", scope: "account", value: null,
        context: {
          id: `rep_${now}`,
          userId: viewer.id,
          source: "agent",
          type: "hold",
          payload: JSON.stringify({ period: params.period || "weekly", summary: params.summary || "" }),
          status: "pending",
          confidence: 100,
          rationale: params.summary || "Отчёт агента",
          createdAt: now,
        },
        desc: `📊 Отчёт: ${params.period || "weekly"}`,
      })];
    }

    default:
      return null;
  }
}

module.exports = { buildInvestEffects };
