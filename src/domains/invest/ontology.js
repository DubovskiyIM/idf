/**
 * Онтология invest-домена — personal investing / робо-эдвайзер.
 *
 * 11 сущностей, 4 роли. Поддерживает финансовые fieldRole: money,
 * percentage, trend, ticker. ownerField для ownership-check.
 */

export const ONTOLOGY = {
  domain: "invest",
  entities: {
    User: {
      ownerField: "id",
      fields: {
        id: { type: "text" },
        email: { type: "email" },
        name: { type: "text", required: true },
        avatar: { type: "url" },
        accreditation: { type: "select", options: ["retail", "qualified"] },
      },
    },

    Portfolio: {
      ownerField: "userId",
      fields: {
        id: { type: "text" },
        userId: { type: "text" },
        name: { type: "text", required: true, label: "Название" },
        baseCurrency: { type: "select", options: ["RUB", "USD", "EUR"], required: true },
        riskProfile: { type: "select", options: ["conservative", "balanced", "aggressive"] },
        targetStocks: { type: "number", fieldRole: "percentage", label: "Акции, %" },
        targetBonds: { type: "number", fieldRole: "percentage", label: "Облигации, %" },
        targetCrypto: { type: "number", fieldRole: "percentage", label: "Крипто, %" },
        targetExotic: { type: "number", fieldRole: "percentage", label: "Экзотика, %" },
        totalValue: { type: "number", fieldRole: "money", label: "Стоимость" },
        pnl: { type: "number", fieldRole: "money", label: "P&L" },
        createdAt: { type: "datetime" },
      },
    },

    Position: {
      ownerField: "userId",
      fields: {
        id: { type: "text" },
        portfolioId: { type: "text" },
        userId: { type: "text" },
        assetId: { type: "text" },
        quantity: { type: "number" },
        avgPrice: { type: "number", fieldRole: "money" },
        currentPrice: { type: "number", fieldRole: "money" },
        unrealizedPnL: { type: "number", fieldRole: "money" },
        stopLoss: { type: "number", fieldRole: "money" },
        takeProfit: { type: "number", fieldRole: "money" },
      },
    },

    Asset: {
      fields: {
        id: { type: "text" },
        ticker: { type: "ticker", label: "Тикер" },
        name: { type: "text", required: true },
        type: { type: "select", options: ["stock", "bond", "etf", "crypto", "real_estate", "art", "wine"] },
        exchange: { type: "text" },
        currency: { type: "select", options: ["RUB", "USD", "EUR"] },
      },
    },

    Transaction: {
      ownerField: "userId",
      fields: {
        id: { type: "text" },
        portfolioId: { type: "text" },
        userId: { type: "text" },
        assetId: { type: "text" },
        α: { type: "select", options: ["buy", "sell"] },
        quantity: { type: "number" },
        price: { type: "number", fieldRole: "money" },
        fee: { type: "number", fieldRole: "money" },
        total: { type: "number", fieldRole: "money" },
        initiatedBy: { type: "select", options: ["user", "agent", "rule"] },
        ruleId: { type: "text" },
        timestamp: { type: "datetime" },
      },
    },

    Goal: {
      ownerField: "userId",
      fields: {
        id: { type: "text" },
        userId: { type: "text" },
        name: { type: "text", required: true, label: "Цель" },
        targetAmount: { type: "number", fieldRole: "money", required: true, label: "Сумма" },
        deadline: { type: "datetime", label: "Срок" },
        priority: { type: "select", options: ["low", "medium", "high"] },
        linkedPortfolioId: { type: "text" },
        currentAmount: { type: "number", fieldRole: "money" },
        progress: { type: "number", fieldRole: "percentage" },
      },
    },

    RiskProfile: {
      ownerField: "userId",
      fields: {
        id: { type: "text" },
        userId: { type: "text" },
        horizonYears: { type: "number" },
        lossTolerancePct: { type: "number", fieldRole: "percentage" },
        computedScore: { type: "number" },
        level: { type: "select", options: ["conservative", "balanced", "aggressive"] },
        updatedAt: { type: "datetime" },
      },
    },

    Recommendation: {
      ownerField: "userId",
      fields: {
        id: { type: "text" },
        userId: { type: "text" },
        source: { type: "select", options: ["agent", "advisor", "model"] },
        type: { type: "select", options: ["rebalance", "buy", "sell", "hold"] },
        payload: { type: "text" },
        status: { type: "select", options: ["pending", "accepted", "rejected", "expired"] },
        confidence: { type: "number", fieldRole: "percentage" },
        rationale: { type: "textarea" },
        createdAt: { type: "datetime" },
      },
    },

    Alert: {
      ownerField: "userId",
      fields: {
        id: { type: "text" },
        userId: { type: "text" },
        ruleId: { type: "text" },
        severity: { type: "select", options: ["info", "warning", "critical"] },
        message: { type: "text" },
        acknowledged: { type: "boolean" },
        triggeredAt: { type: "datetime" },
      },
    },

    Watchlist: {
      ownerField: "userId",
      fields: {
        id: { type: "text" },
        userId: { type: "text" },
        name: { type: "text", required: true, label: "Название" },
        assetIds: { type: "text" },
      },
    },

    MarketSignal: {
      fields: {
        id: { type: "text" },
        source: { type: "text" },
        assetId: { type: "text" },
        kind: { type: "select", options: ["price", "volume", "sentiment", "fuzzy_risk", "news"] },
        value: { type: "number" },
        timestamp: { type: "datetime" },
      },
    },
  },

  roles: {
    investor: {
      // self — клиент
      canExecute: [
        "register", "login", "update_profile", "set_preferences",
        "start_risk_questionnaire", "compute_risk_profile",
        "create_goal", "edit_goal", "close_goal",
        "create_portfolio", "set_target_allocation", "rename_portfolio", "archive_portfolio",
        "buy_asset", "sell_asset", "set_stop_loss", "set_take_profit",
        "create_watchlist", "add_to_watchlist", "remove_from_watchlist", "set_price_alert",
        "accept_recommendation", "reject_recommendation", "snooze_recommendation",
        "acknowledge_alert", "mute_alert_rule", "delegate_to_agent",
        "create_rebalance_rule", "pause_rule", "resume_rule", "delete_rule",
      ],
      visibleFields: {
        Portfolio: "own", Position: "own", Transaction: "own",
        Goal: "own", RiskProfile: "own", Recommendation: "own",
        Alert: "own", Watchlist: "own",
      },
    },

    advisor: {
      // human consultant
      canExecute: [
        "assign_client", "create_recommendation_for_client",
        "send_client_message", "review_client_activity",
      ],
      visibleFields: {
        User: ["id", "name", "email"],
        Portfolio: "assigned", Goal: "assigned",
      },
    },

    agent: {
      // робо-эдвайзер с JWT-scope
      canExecute: [
        "agent_propose_rebalance", "agent_execute_preapproved_order",
        "agent_flag_anomaly", "agent_fetch_market_signal",
        "agent_recompute_risk_score", "agent_generate_report",
      ],
      visibleFields: {
        Portfolio: "scoped", Position: "scoped", MarketSignal: "all",
      },
    },

    observer: {
      // read-only (аудит/регулятор)
      canExecute: [],
      visibleFields: {
        Transaction: "all", Portfolio: "aggregated", Alert: "all",
      },
    },
  },
};
