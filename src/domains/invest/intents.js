/**
 * Invest intents — personal investing / робо-эдвайзер.
 *
 * ~40 намерений. Generic Effect Handler покрывает большинство через
 * intent.particles.effects — доменный код в domain.js только для
 * специальных случаев (register, risk calc, rebalance).
 */

export const INTENTS = {
  // ─── Профиль ───
  register: { name: "Регистрация", particles: { effects: [{ α: "add", target: "users", σ: "global" }] }, creates: "User" },
  update_profile: { name: "Обновить профиль", particles: { effects: [{ α: "replace", target: "user" }] } },

  // ─── Риск-профиль ───
  start_risk_questionnaire: { name: "Начать опросник", particles: { effects: [] } },
  // Wizard-шаги risk_questionnaire — side-effect-free, собираются в collected.
  set_risk_horizon: { name: "Шаг: горизонт", particles: { effects: [] } },
  set_risk_tolerance: { name: "Шаг: толерантность", particles: { effects: [] } },
  set_risk_goal: { name: "Шаг: цель", particles: { effects: [] } },
  // Wizard-шаги portfolio_onboarding.
  set_portfolio_profile: { name: "Шаг: профиль", particles: { effects: [] } },
  set_portfolio_currency: { name: "Шаг: валюта", particles: { effects: [] } },
  compute_risk_profile: { name: "Рассчитать профиль риска", particles: { effects: [{ α: "add", target: "riskProfiles", σ: "account" }] }, creates: "RiskProfile" },

  // ─── Цели ───
  create_goal: { name: "Создать цель", particles: { effects: [{ α: "add", target: "goals", σ: "account" }] }, creates: "Goal", heroCreate: true },
  edit_goal: { name: "Редактировать цель", particles: { effects: [{ α: "replace", target: "goal" }] } },
  close_goal: { name: "Закрыть цель", particles: { effects: [{ α: "remove", target: "goals" }] }, irreversibility: "high" },
  deposit_to_goal: { name: "Пополнить цель", particles: { effects: [{ α: "replace", target: "goal.currentAmount" }] } },

  // ─── Портфели ───
  create_portfolio: { name: "Новый портфель", particles: { effects: [{ α: "add", target: "portfolios", σ: "account" }] }, creates: "Portfolio", heroCreate: true },
  set_target_allocation: { name: "Настроить аллокацию", particles: { effects: [
    { α: "replace", target: "portfolio.targetStocks" },
    { α: "replace", target: "portfolio.targetBonds" },
    { α: "replace", target: "portfolio.targetCrypto" },
    { α: "replace", target: "portfolio.targetExotic" },
  ] } },
  rename_portfolio: { name: "Переименовать", particles: { effects: [{ α: "replace", target: "portfolio.name" }] } },
  archive_portfolio: { name: "Архивировать", particles: { effects: [{ α: "remove", target: "portfolios" }] }, irreversibility: "high" },
  clone_portfolio: { name: "Дублировать", particles: { effects: [{ α: "add", target: "portfolios", σ: "account" }] } },

  // ─── Торговля ───
  buy_asset: { name: "Купить", variant: "primary", particles: { effects: [{ α: "add", target: "transactions", σ: "account" }] } },
  sell_asset: { name: "Продать", variant: "danger", particles: { effects: [{ α: "add", target: "transactions", σ: "account" }] } },
  set_stop_loss: { name: "Stop-loss", particles: { effects: [{ α: "replace", target: "position.stopLoss" }] } },
  set_take_profit: { name: "Take-profit", particles: { effects: [{ α: "replace", target: "position.takeProfit" }] } },
  clear_stop_loss: { name: "Снять stop-loss", particles: { effects: [{ α: "replace", target: "position.stopLoss", value: null }] } },

  // ─── Watchlist ───
  create_watchlist: { name: "Новый список", particles: { effects: [{ α: "add", target: "watchlists", σ: "account" }] }, creates: "Watchlist" },
  add_to_watchlist: { name: "Добавить", particles: { effects: [{ α: "replace", target: "watchlist.assetIds" }] } },
  remove_from_watchlist: { name: "Убрать", particles: { effects: [{ α: "replace", target: "watchlist.assetIds" }] } },
  set_price_alert: { name: "Alert на цену", particles: { effects: [{ α: "add", target: "alerts", σ: "account" }] } },
  rename_watchlist: { name: "Переименовать", particles: { effects: [{ α: "replace", target: "watchlist.name" }] } },
  delete_watchlist: { name: "Удалить список", particles: { effects: [{ α: "remove", target: "watchlists" }] }, irreversibility: "high" },

  // ─── Recommendations ───
  accept_recommendation: { name: "Принять", variant: "primary", particles: { effects: [{ α: "replace", target: "recommendation.status", value: "accepted" }] } },
  reject_recommendation: { name: "Отклонить", particles: { effects: [{ α: "replace", target: "recommendation.status", value: "rejected" }] } },
  snooze_recommendation: { name: "Отложить", particles: { effects: [{ α: "replace", target: "recommendation.status", value: "snoozed" }] } },
  request_recommendation: { name: "Запросить совет", particles: { effects: [{ α: "add", target: "recommendations", σ: "account" }] } },

  delegate_to_agent: { name: "Доверить агенту", particles: { effects: [{ α: "add", target: "agentpreapprovals", σ: "account" }] }, creates: "AgentPreapproval" },
  revoke_agent_preapproval: { name: "Отозвать полномочия", particles: { effects: [{ α: "replace", target: "agentpreapproval.active", value: false }] }, irreversibility: "medium" },
  update_agent_preapproval: { name: "Изменить лимиты", particles: { effects: [{ α: "replace", target: "agentpreapproval" }] } },
  extend_agent_preapproval: { name: "Продлить полномочия", particles: { effects: [{ α: "replace", target: "agentpreapproval.expiresAt" }] } },

  // ─── Alerts ───
  acknowledge_alert: { name: "Прочитано", particles: { effects: [{ α: "replace", target: "alert.acknowledged", value: true }] } },
  dismiss_alert: { name: "Скрыть", particles: { effects: [{ α: "remove", target: "alerts" }] } },
  escalate_alert: { name: "Эскалировать", particles: { effects: [{ α: "replace", target: "alert.severity", value: "critical" }] } },

  // ─── Rules ───
  create_rebalance_rule: { name: "Правило ребаланса", particles: { effects: [{ α: "add", target: "rules", σ: "account" }] } },
  pause_rule: { name: "Пауза", particles: { effects: [{ α: "replace", target: "rule.active", value: false }] } },
  resume_rule: { name: "Запустить", particles: { effects: [{ α: "replace", target: "rule.active", value: true }] } },
  delete_rule: { name: "Удалить", particles: { effects: [{ α: "remove", target: "rules" }] }, irreversibility: "high" },

  // ─── Agent-intents ───
  agent_propose_rebalance: {
    name: "Agent: propose rebalance",
    description: "Robo-advisor proposes a portfolio rebalance with a confidence score and rationale.",
    parameters: [
      { name: "portfolioId", type: "entityRef", entity: "Portfolio", required: true },
      { name: "confidence", type: "number", required: true },
      { name: "rationale", type: "text", required: false },
    ],
    particles: { effects: [{ α: "add", target: "recommendations", σ: "account" }] },
  },
  agent_flag_anomaly: {
    name: "Agent: flag anomaly",
    description: "Robo-advisor raises a portfolio-level alert with severity.",
    parameters: [
      { name: "severity", type: "select", required: true },
      { name: "message", type: "text", required: true },
    ],
    particles: { effects: [{ α: "add", target: "alerts", σ: "account" }] },
  },
  agent_fetch_market_signal: {
    name: "Agent: fetch market signal",
    description: "Robo-advisor records a market signal (price / volume / news) for an asset.",
    parameters: [
      { name: "assetId", type: "entityRef", entity: "Asset", required: true },
      { name: "kind", type: "select", required: true },
      { name: "value", type: "number", required: true },
      { name: "source", type: "text", required: false },
    ],
    particles: { effects: [{ α: "add", target: "marketSignals", σ: "global" }] },
  },
  agent_execute_preapproved_order: {
    name: "Agent: execute preapproved order",
    description: "Robo-advisor executes a market order. Subject to AgentPreapproval guard (active / notExpired / maxOrderAmount / allowedAssetTypes / dailyLimit / dailySum).",
    parameters: [
      { name: "portfolioId", type: "entityRef", entity: "Portfolio", required: true },
      { name: "assetId", type: "entityRef", entity: "Asset", required: true },
      { name: "α", type: "select", required: true },
      { name: "quantity", type: "number", required: true },
      { name: "price", type: "number", required: true },
      { name: "total", type: "number", required: true },
      { name: "assetType", type: "select", required: true },
    ],
    particles: { effects: [{ α: "add", target: "transactions", σ: "account" }] },
  },
  agent_recompute_risk_score: {
    name: "Agent: recompute risk score",
    description: "Robo-advisor recomputes the risk profile for a portfolio (or all portfolios if portfolioId omitted).",
    parameters: [
      { name: "portfolioId", type: "entityRef", entity: "Portfolio", required: false },
    ],
    particles: { effects: [{ α: "replace", target: "riskProfiles", σ: "account" }] },
  },
  agent_generate_report: {
    name: "Agent: generate report",
    description: "Robo-advisor generates a portfolio-level performance / risk report as a recommendation.",
    parameters: [
      { name: "portfolioId", type: "entityRef", entity: "Portfolio", required: false },
      { name: "reportType", type: "select", required: false },
    ],
    particles: { effects: [{ α: "add", target: "recommendations", σ: "account" }] },
  },

  // ─── Advisor intents ───
  assign_client: { name: "Взять клиента", particles: { effects: [{ α: "add", target: "assignments", σ: "account" }] }, creates: "Assignment", heroCreate: true },
  unassign_client: { name: "Завершить работу с клиентом", particles: { effects: [{ α: "replace", target: "assignment.status", value: "ended" }] }, irreversibility: "medium" },
  pause_assignment: { name: "Приостановить", particles: { effects: [{ α: "replace", target: "assignment.status", value: "paused" }] } },
  resume_assignment: { name: "Возобновить", particles: { effects: [{ α: "replace", target: "assignment.status", value: "active" }] } },
  create_recommendation_for_client: { name: "Рекомендация клиенту", particles: { effects: [{ α: "add", target: "recommendations", σ: "account" }] }, creates: "Recommendation" },
  send_client_message: { name: "Написать клиенту", particles: { effects: [{ α: "add", target: "alerts", σ: "account" }] } },
  add_assignment_note: { name: "Заметка по клиенту", particles: { effects: [{ α: "replace", target: "assignment.notes" }] } },

  // ─── Rule-triggered actions (вызываются из ruleEngine) ───
  weekly_portfolio_report: { name: "Недельный отчёт", particles: { effects: [{ α: "add", target: "recommendations", σ: "account" }] } },
  auto_stop_loss: { name: "Авто stop-loss", particles: { effects: [{ α: "add", target: "alerts", σ: "account" }] } },
  volatility_spike_alert: { name: "Всплеск волатильности", particles: { effects: [{ α: "add", target: "alerts", σ: "account" }] } },
  drift_rebalance_proposal: { name: "Дрейф аллокации", particles: { effects: [{ α: "add", target: "recommendations", σ: "account" }] } },
};
