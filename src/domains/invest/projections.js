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
};

export const ROOT_PROJECTIONS = [
  { section: "Главная", icon: "📊", items: ["performance_dashboard"] },
  { section: "Портфели", icon: "💼", items: ["portfolios_root"] },
  { section: "Цели", icon: "🎯", items: ["goals_root"] },
  { section: "Рынок", icon: "🏦", items: ["assets_catalog", "watchlists_root"] },
  { section: "Уведомления", icon: "🔔", items: ["recommendations_inbox", "alerts_feed"] },
  { section: "История", icon: "🗂", items: ["transactions_history"] },
  { section: "Автоматизация", icon: "⚡", items: ["rules_list"] },
];
