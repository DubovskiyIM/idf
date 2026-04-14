export const PROJECTIONS = {
  // ─── ROOT catalogs ───

  portfolios_root: {
    name: "Портфели", kind: "catalog", mainEntity: "Portfolio",
    entities: ["Portfolio"],
    witnesses: ["name", "baseCurrency", "totalValue", "pnl", "riskProfile"],
    filter: "userId === viewer.id",
    layout: "grid",
  },

  goals_root: {
    name: "Цели", kind: "catalog", mainEntity: "Goal",
    entities: ["Goal"],
    witnesses: ["name", "targetAmount", "currentAmount", "progress", "deadline", "priority"],
    filter: "userId === viewer.id",
  },

  watchlists_root: {
    name: "Наблюдение", kind: "catalog", mainEntity: "Watchlist",
    entities: ["Watchlist", "Asset"],
    witnesses: ["name", "assetIds"],
    filter: "userId === viewer.id",
  },

  // ─── FEED ───

  recommendations_inbox: {
    name: "Рекомендации", kind: "feed", mainEntity: "Recommendation",
    entities: ["Recommendation"],
    witnesses: ["type", "source", "confidence", "rationale", "status", "createdAt"],
    filter: "userId === viewer.id && status === 'pending'",
    sort: "createdAt:desc",
  },

  alerts_feed: {
    name: "Сигналы", kind: "feed", mainEntity: "Alert",
    entities: ["Alert"],
    witnesses: ["severity", "message", "triggeredAt", "acknowledged"],
    filter: "userId === viewer.id",
    sort: "triggeredAt:desc",
  },

  transactions_history: {
    name: "Сделки", kind: "feed", mainEntity: "Transaction",
    entities: ["Transaction", "Asset"],
    witnesses: ["α", "quantity", "price", "total", "fee", "initiatedBy", "timestamp"],
    filter: "userId === viewer.id",
    sort: "timestamp:desc",
  },

  // ─── DETAIL ───

  portfolio_detail: {
    name: "Портфель", kind: "detail", mainEntity: "Portfolio",
    idParam: "portfolioId",
    entities: ["Portfolio", "Position", "Transaction", "Recommendation", "Alert"],
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
    entities: ["Goal", "Portfolio"],
    witnesses: ["name", "targetAmount", "currentAmount", "progress", "deadline", "priority"],
  },

  // ─── DASHBOARD ───

  performance_dashboard: {
    name: "Обзор", kind: "dashboard",
    entities: ["Portfolio", "Position", "Transaction", "Alert"],
    filter: "userId === viewer.id",
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
    filter: "userId === viewer.id",
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
