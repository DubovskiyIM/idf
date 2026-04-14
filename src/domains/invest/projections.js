export const PROJECTIONS = {
  // ─── ROOT catalogs ───

  portfolios_root: {
    name: "Портфели", kind: "catalog", mainEntity: "Portfolio",
    entities: ["Portfolio"],
    witnesses: ["name", "baseCurrency", "totalValue", "pnl", "riskProfile"],
    filter: "userId === viewer.id || !userId",
    layout: "grid",
  },

  goals_root: {
    name: "Цели", kind: "catalog", mainEntity: "Goal",
    entities: ["Goal"],
    witnesses: ["name", "targetAmount", "currentAmount", "progress", "deadline", "priority"],
    filter: "userId === viewer.id || !userId",
  },

  watchlists_root: {
    name: "Наблюдение", kind: "catalog", mainEntity: "Watchlist",
    entities: ["Watchlist", "Asset"],
    witnesses: ["name", "assetIds"],
    filter: "userId === viewer.id || !userId",
  },

  // ─── CATALOG (списки с per-item действиями, без composer) ───

  recommendations_inbox: {
    name: "Рекомендации", kind: "catalog", mainEntity: "Recommendation",
    entities: ["Recommendation"],
    witnesses: ["type", "source", "confidence", "rationale", "status", "createdAt"],
    filter: "(userId === viewer.id || !userId) && status === 'pending'",
    sort: "createdAt:desc",
  },

  alerts_feed: {
    name: "Сигналы", kind: "catalog", mainEntity: "Alert",
    entities: ["Alert"],
    witnesses: ["severity", "message", "triggeredAt", "acknowledged"],
    filter: "userId === viewer.id || !userId",
    sort: "triggeredAt:desc",
  },

  transactions_history: {
    name: "Сделки", kind: "catalog", mainEntity: "Transaction",
    entities: ["Transaction"],
    witnesses: ["α", "quantity", "price", "total", "fee", "initiatedBy", "timestamp"],
    filter: "userId === viewer.id || !userId",
    sort: "timestamp:desc",
  },

  // ─── DETAIL ───

  portfolio_detail: {
    name: "Портфель", kind: "detail", mainEntity: "Portfolio",
    idParam: "portfolioId",
    entities: ["Portfolio"],
    witnesses: ["name", "baseCurrency", "totalValue", "pnl", "riskProfile",
                "targetStocks", "targetBonds", "targetCrypto", "targetExotic"],
    subCollections: [
      { collection: "positions", entity: "Position", foreignKey: "portfolioId", title: "Позиции", addable: false },
      { collection: "transactions", entity: "Transaction", foreignKey: "portfolioId", title: "Последние сделки", addable: false },
    ],
  },

  goal_detail: {
    name: "Цель", kind: "detail", mainEntity: "Goal",
    idParam: "goalId",
    entities: ["Goal"],
    witnesses: ["name", "targetAmount", "currentAmount", "progress", "deadline", "priority"],
  },

  transaction_detail: {
    name: "Сделка", kind: "detail", mainEntity: "Transaction",
    idParam: "transactionId",
    entities: ["Transaction"],
    witnesses: ["α", "quantity", "price", "fee", "total", "initiatedBy", "ruleId", "timestamp", "assetId", "portfolioId"],
  },

  recommendation_detail: {
    name: "Рекомендация", kind: "detail", mainEntity: "Recommendation",
    idParam: "recommendationId",
    entities: ["Recommendation"],
    witnesses: ["type", "source", "confidence", "status", "rationale", "payload", "createdAt"],
  },

  alert_detail: {
    name: "Сигнал", kind: "detail", mainEntity: "Alert",
    idParam: "alertId",
    entities: ["Alert"],
    witnesses: ["severity", "message", "triggeredAt", "acknowledged", "ruleId"],
  },

  asset_detail: {
    name: "Актив", kind: "detail", mainEntity: "Asset",
    idParam: "assetId",
    entities: ["Asset"],
    witnesses: ["ticker", "name", "type", "exchange", "currency"],
  },

  watchlist_detail: {
    name: "Список наблюдения", kind: "detail", mainEntity: "Watchlist",
    idParam: "watchlistId",
    entities: ["Watchlist"],
    witnesses: ["name", "assetIds"],
  },

  // ─── DASHBOARD ───

  performance_dashboard: {
    name: "Обзор", kind: "dashboard",
    entities: ["Portfolio", "Position", "Transaction", "Alert"],
    filter: "userId === viewer.id || !userId",
    embedded: [
      { projection: "portfolios_root", width: 12 },
      { projection: "recommendations_inbox", width: 6 },
      { projection: "alerts_feed", width: 6 },
    ],
  },

  // ─── CATALOG для advisor/observer (пока скрыты фильтром) ───

  assets_catalog: {
    name: "Активы", kind: "catalog", mainEntity: "Asset",
    entities: ["Asset"],
    witnesses: ["ticker", "name", "type", "exchange", "currency"],
  },

  rules_list: {
    name: "Правила", kind: "catalog", mainEntity: "Rule",
    entities: ["Rule"],
    witnesses: ["name", "trigger", "active"],
    filter: "userId === viewer.id || !userId",
  },

  // ─── WIZARD: risk questionnaire (4 шага) ───

  risk_questionnaire: {
    name: "Профиль риска",
    kind: "wizard",
    mainEntity: "RiskProfile",
    steps: [
      {
        id: "horizon",
        label: "Срок инвестирования",
        intent: "set_risk_horizon",
        pick: ["horizonYears"],
        source: {
          collection: "_static_horizon_options",
          inline: [
            { id: 1, label: "До 1 года", horizonYears: 1, scoreDelta: -20 },
            { id: 3, label: "1–3 года", horizonYears: 3, scoreDelta: -5 },
            { id: 7, label: "3–10 лет", horizonYears: 7, scoreDelta: 10 },
            { id: 15, label: "10+ лет", horizonYears: 15, scoreDelta: 25 },
          ],
        },
        display: ["label"],
      },
      {
        id: "tolerance",
        label: "Просадка, которую переживу",
        intent: "set_risk_tolerance",
        pick: ["lossTolerancePct"],
        source: {
          collection: "_static_tolerance_options",
          inline: [
            { id: 5, label: "До 5%", lossTolerancePct: 5, scoreDelta: -20 },
            { id: 15, label: "5–15%", lossTolerancePct: 15, scoreDelta: 0 },
            { id: 30, label: "15–30%", lossTolerancePct: 30, scoreDelta: 15 },
            { id: 50, label: "Готов к 50%+", lossTolerancePct: 50, scoreDelta: 30 },
          ],
        },
        display: ["label"],
      },
      {
        id: "goal_type",
        label: "Цель инвестирования",
        intent: "set_risk_goal",
        pick: ["goalType"],
        source: {
          collection: "_static_goal_options",
          inline: [
            { id: "safety", label: "Сохранить накопления", goalType: "safety", scoreDelta: -15 },
            { id: "income", label: "Регулярный доход", goalType: "income", scoreDelta: 0 },
            { id: "growth", label: "Приумножить капитал", goalType: "growth", scoreDelta: 15 },
            { id: "speculative", label: "Спекулировать / высокая доходность", goalType: "speculative", scoreDelta: 30 },
          ],
        },
        display: ["label"],
      },
      {
        id: "confirm",
        label: "Готово",
        intent: "compute_risk_profile",
        summary: true,
      },
    ],
  },

  // ─── WIZARD: onboarding нового портфеля (3 шага) ───

  portfolio_onboarding: {
    name: "Новый портфель",
    kind: "wizard",
    mainEntity: "Portfolio",
    steps: [
      {
        id: "profile",
        label: "Профиль",
        intent: "set_portfolio_profile",
        pick: ["riskProfile"],
        source: {
          collection: "_static_profile_options",
          inline: [
            { id: "conservative", label: "Консервативный (20% акций)", riskProfile: "conservative", targetStocks: 20, targetBonds: 75, targetCrypto: 0, targetExotic: 5 },
            { id: "balanced", label: "Сбалансированный (50/35/10/5)", riskProfile: "balanced", targetStocks: 50, targetBonds: 35, targetCrypto: 10, targetExotic: 5 },
            { id: "aggressive", label: "Агрессивный (70/5/20/5)", riskProfile: "aggressive", targetStocks: 70, targetBonds: 5, targetCrypto: 20, targetExotic: 5 },
          ],
        },
        display: ["label"],
      },
      {
        id: "currency",
        label: "Базовая валюта",
        intent: "set_portfolio_currency",
        pick: ["baseCurrency"],
        source: {
          collection: "_static_currency_options",
          inline: [
            { id: "RUB", label: "🇷🇺 Рубль (RUB)", baseCurrency: "RUB" },
            { id: "USD", label: "🇺🇸 Доллар (USD)", baseCurrency: "USD" },
            { id: "EUR", label: "🇪🇺 Евро (EUR)", baseCurrency: "EUR" },
          ],
        },
        display: ["label"],
      },
      {
        id: "confirm",
        label: "Создать портфель",
        intent: "create_portfolio",
        summary: true,
      },
    ],
  },
};

export const ROOT_PROJECTIONS = [
  { section: "Главная", icon: "📊", items: ["performance_dashboard"] },
  { section: "Онбординг", icon: "🚀", items: ["risk_questionnaire", "portfolio_onboarding"] },
  { section: "Портфели", icon: "💼", items: ["portfolios_root"] },
  { section: "Цели", icon: "🎯", items: ["goals_root"] },
  { section: "Рынок", icon: "🏦", items: ["assets_catalog", "watchlists_root"] },
  { section: "Уведомления", icon: "🔔", items: ["recommendations_inbox", "alerts_feed"] },
  { section: "История", icon: "🗂", items: ["transactions_history"] },
  { section: "Автоматизация", icon: "⚡", items: ["rules_list"] },
];
