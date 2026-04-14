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

    // Assignment — many-to-many relationship между advisor и client.
    // ⚠ Серверный filterWorld пока не поддерживает via-assignment
    //   ownership — это §26.1 open item (see docs/field-test-10.md).
    //   Клиентские projections используют виртуальный фильтр по assignment.
    Assignment: {
      ownerField: "advisorId",
      fields: {
        id: { type: "text" },
        advisorId: { type: "text", required: true },
        clientId: { type: "text", required: true },
        status: { type: "select", options: ["active", "paused", "ended"] },
        createdAt: { type: "datetime" },
        notes: { type: "textarea" },
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
      // human consultant. Many-to-many клиенты через Assignment entity.
      // §26.1 ЗАКРЫТ: role.scope поддерживается в server/schema/filterWorld.cjs.
      canExecute: [
        "assign_client", "unassign_client", "pause_assignment", "resume_assignment",
        "create_recommendation_for_client", "send_client_message",
      ],
      visibleFields: {
        User: ["id", "name", "email"],
        Assignment: ["id", "clientId", "status", "createdAt", "notes"],
        Portfolio: ["id", "userId", "name", "baseCurrency", "totalValue", "pnl", "riskProfile"],
        Goal: ["id", "userId", "name", "targetAmount", "progress", "deadline"],
        Recommendation: ["id", "userId", "source", "type", "status", "createdAt"],
        Alert: ["id", "userId", "severity", "message", "triggeredAt"],
        RiskProfile: ["id", "userId", "level", "computedScore"],
      },
      // M2M scope: advisor видит entity X, где X[localField] ∈ { a[joinField] | a ∈ assignments, a.advisorId === viewer.id, a.status === "active" }.
      // Assignment сама фильтруется по entity.ownerField (advisorId).
      scope: {
        User: {
          via: "assignments", viewerField: "advisorId",
          joinField: "clientId", localField: "id",
          statusField: "status", statusAllowed: ["active", "paused"],
        },
        Portfolio: {
          via: "assignments", viewerField: "advisorId",
          joinField: "clientId", localField: "userId",
          statusField: "status", statusAllowed: ["active"],
        },
        Goal: {
          via: "assignments", viewerField: "advisorId",
          joinField: "clientId", localField: "userId",
          statusField: "status", statusAllowed: ["active"],
        },
        Recommendation: {
          via: "assignments", viewerField: "advisorId",
          joinField: "clientId", localField: "userId",
          statusField: "status", statusAllowed: ["active"],
        },
        Alert: {
          via: "assignments", viewerField: "advisorId",
          joinField: "clientId", localField: "userId",
          statusField: "status", statusAllowed: ["active"],
        },
        RiskProfile: {
          via: "assignments", viewerField: "advisorId",
          joinField: "clientId", localField: "userId",
          statusField: "status", statusAllowed: ["active"],
        },
      },
    },

    agent: {
      // робо-эдвайзер с JWT-scope (§17). Все канонические агентские
      // intents покрыты server/schema/buildInvestEffects.cjs.
      canExecute: [
        "agent_propose_rebalance", "agent_execute_preapproved_order",
        "agent_flag_anomaly", "agent_fetch_market_signal",
        "agent_recompute_risk_score", "agent_generate_report",
      ],
      visibleFields: {
        User: ["id", "name", "email"],
        Portfolio: ["id", "userId", "name", "baseCurrency", "riskProfile",
                    "targetStocks", "targetBonds", "targetCrypto", "targetExotic",
                    "totalValue", "pnl"],
        Position: ["id", "portfolioId", "userId", "assetId", "quantity",
                   "avgPrice", "currentPrice", "unrealizedPnL", "stopLoss", "takeProfit"],
        Asset: "all",
        MarketSignal: "all",
        Recommendation: ["id", "userId", "source", "type", "status", "confidence", "createdAt"],
        Alert: ["id", "userId", "severity", "message", "triggeredAt"],
        RiskProfile: ["id", "userId", "level", "computedScore", "updatedAt"],
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

  // ─── Reactive Rules Engine §22 v1.5 ───
  // Все 4 extensions задействованы: aggregation / threshold / schedule / condition.
  rules: [
    // 1. AGGREGATION: каждая 10-я сделка → запрос на ребаланс
    {
      id: "rebalance_every_10_trades",
      trigger: "buy_asset",
      action: "drift_rebalance_proposal",
      aggregation: { everyN: 10 },
      context: {
        userId: "effect.userId",
        source: "agent",
        type: "rebalance",
        rationale: "После 10 сделок пора проверить целевую аллокацию.",
        confidence: 70,
        status: "pending",
      },
    },

    // 2. THRESHOLD: последние 5 market signals имеют kind="fuzzy_risk" >= 0.8 → алерт
    //    lookback проверяет недавние события
    {
      id: "high_risk_exotic_alert",
      trigger: "agent_fetch_market_signal",
      action: "volatility_spike_alert",
      threshold: { lookback: 3, field: "kind", condition: "all_equal:fuzzy_risk" },
      context: {
        userId: "effect.userId",
        severity: "warning",
        message: "3 подряд высоких fuzzy-risk сигнала по экзотическим активам",
        acknowledged: false,
      },
    },

    // 3. SCHEDULE: еженедельный отчёт в вс 18:00
    {
      id: "weekly_portfolio_report_rule",
      trigger: "*",
      action: "weekly_portfolio_report",
      schedule: "weekly:sun:18:00",
      context: {
        userId: "effect.userId",
        source: "agent",
        type: "hold",
        rationale: "Еженедельный отчёт: пересмотри portfolio и обнови цели.",
        confidence: 100,
        status: "pending",
      },
    },

    // 4. SCHEDULE ежедневный: проверка stop-loss каждый день 09:00
    {
      id: "daily_stop_loss_check",
      trigger: "*",
      action: "auto_stop_loss",
      schedule: "daily:09:00",
      context: {
        userId: null,
        severity: "info",
        message: "Ежедневная проверка stop-loss уровней",
        acknowledged: false,
      },
    },

    // 5. CONDITION: если sell_asset с qty > 100 → предложение ребаланса
    {
      id: "large_sell_triggers_rebalance",
      trigger: "sell_asset",
      action: "drift_rebalance_proposal",
      condition: "effect.quantity > 100",
      context: {
        userId: "effect.userId",
        source: "agent",
        type: "rebalance",
        rationale: "Крупная продажа изменила вес позиций — нужен ребаланс.",
        confidence: 85,
        status: "pending",
      },
    },

    // 6. CONDITION: market signal с value > некий threshold → volatility alert
    {
      id: "volatility_threshold_alert",
      trigger: "agent_fetch_market_signal",
      action: "volatility_spike_alert",
      condition: "effect.kind === 'sentiment' && Math.abs(effect.value) > 0.7",
      context: {
        userId: null,
        severity: "info",
        message: "Сильный sentiment-сигнал: возможна повышенная волатильность",
        acknowledged: false,
      },
    },

    // 7. AGGREGATION: каждые 5 новых recommendations → напомнить пользователю
    {
      id: "recommendations_overflow_alert",
      trigger: "agent_propose_rebalance",
      action: "volatility_spike_alert",
      aggregation: { everyN: 5 },
      context: {
        userId: "effect.userId",
        severity: "info",
        message: "Накопилось 5 необработанных рекомендаций — стоит просмотреть.",
        acknowledged: false,
      },
    },
  ],
};
