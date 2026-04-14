/**
 * Invest intents — personal investing / робо-эдвайзер.
 *
 * ~30 намерений v1 (из плана шаг 1). Generic Effect Handler покрывает
 * большинство через intent.particles.effects — доменный код в domain.js
 * только для специальных случаев (register, risk calc, rebalance).
 */

export const INTENTS = {
  // ─── Профиль ───

  register: {
    name: "Регистрация",
    particles: { effects: [{ α: "add", target: "users", σ: "global" }] },
    creates: "User",
  },

  update_profile: {
    name: "Обновить профиль",
    particles: { effects: [{ α: "replace", target: "user" }] },
  },

  // ─── Риск-профиль ───

  start_risk_questionnaire: {
    name: "Начать опросник",
    particles: { effects: [] }, // wizard-start, эффектов нет до compute
  },

  // Wizard-шаги risk_questionnaire — side-effect-free, собираются в collected.
  set_risk_horizon: { name: "Шаг: горизонт", particles: { effects: [] } },
  set_risk_tolerance: { name: "Шаг: толерантность", particles: { effects: [] } },
  set_risk_goal: { name: "Шаг: цель", particles: { effects: [] } },

  // Wizard-шаги portfolio_onboarding.
  set_portfolio_profile: { name: "Шаг: профиль", particles: { effects: [] } },
  set_portfolio_currency: { name: "Шаг: валюта", particles: { effects: [] } },

  compute_risk_profile: {
    name: "Рассчитать профиль риска",
    particles: { effects: [{ α: "add", target: "riskProfiles", σ: "account" }] },
    creates: "RiskProfile",
  },

  // ─── Цели ───

  create_goal: {
    name: "Создать цель",
    particles: { effects: [{ α: "add", target: "goals", σ: "account" }] },
    creates: "Goal",
    heroCreate: true,
  },

  edit_goal: {
    name: "Редактировать цель",
    particles: { effects: [{ α: "replace", target: "goal" }] },
  },

  close_goal: {
    name: "Закрыть цель",
    particles: { effects: [{ α: "remove", target: "goals" }] },
    irreversibility: "high",
  },

  // ─── Портфели ───

  create_portfolio: {
    name: "Новый портфель",
    particles: { effects: [{ α: "add", target: "portfolios", σ: "account" }] },
    creates: "Portfolio",
    heroCreate: true,
  },

  set_target_allocation: {
    name: "Настроить аллокацию",
    particles: { effects: [{ α: "replace", target: "portfolio" }] },
  },

  rename_portfolio: {
    name: "Переименовать",
    particles: { effects: [{ α: "replace", target: "portfolio.name" }] },
  },

  archive_portfolio: {
    name: "Архивировать",
    particles: { effects: [{ α: "remove", target: "portfolios" }] },
    irreversibility: "high",
  },

  // ─── Торговля ───

  buy_asset: {
    name: "Купить",
    variant: "primary",
    particles: { effects: [{ α: "add", target: "transactions", σ: "account" }] },
  },

  sell_asset: {
    name: "Продать",
    variant: "danger",
    particles: { effects: [{ α: "add", target: "transactions", σ: "account" }] },
  },

  set_stop_loss: {
    name: "Stop-loss",
    particles: { effects: [{ α: "replace", target: "position.stopLoss" }] },
  },

  set_take_profit: {
    name: "Take-profit",
    particles: { effects: [{ α: "replace", target: "position.takeProfit" }] },
  },

  // ─── Watchlist ───

  create_watchlist: {
    name: "Новый список",
    particles: { effects: [{ α: "add", target: "watchlists", σ: "account" }] },
    creates: "Watchlist",
  },

  add_to_watchlist: {
    name: "Добавить",
    particles: { effects: [{ α: "replace", target: "watchlist.assetIds" }] },
  },

  remove_from_watchlist: {
    name: "Убрать",
    particles: { effects: [{ α: "replace", target: "watchlist.assetIds" }] },
  },

  set_price_alert: {
    name: "Alert на цену",
    particles: { effects: [{ α: "add", target: "alerts", σ: "account" }] },
  },

  // ─── Recommendations ───

  accept_recommendation: {
    name: "Принять",
    variant: "primary",
    particles: { effects: [{ α: "replace", target: "recommendation.status", value: "accepted" }] },
  },

  reject_recommendation: {
    name: "Отклонить",
    particles: { effects: [{ α: "replace", target: "recommendation.status", value: "rejected" }] },
  },

  snooze_recommendation: {
    name: "Отложить",
    particles: { effects: [{ α: "replace", target: "recommendation.ttl" }] },
  },

  delegate_to_agent: {
    name: "Доверить агенту",
    particles: { effects: [{ α: "replace", target: "user.agentPreapproval" }] },
  },

  // ─── Alerts ───

  acknowledge_alert: {
    name: "Прочитано",
    particles: { effects: [{ α: "replace", target: "alert.acknowledged", value: true }] },
  },

  mute_alert_rule: {
    name: "Отключить",
    particles: { effects: [{ α: "replace", target: "rule.active", value: false }] },
  },

  // ─── Rules ───

  create_rebalance_rule: {
    name: "Правило ребаланса",
    particles: { effects: [{ α: "add", target: "rules", σ: "account" }] },
  },

  pause_rule: {
    name: "Пауза",
    particles: { effects: [{ α: "replace", target: "rule.active", value: false }] },
  },

  resume_rule: {
    name: "Запустить",
    particles: { effects: [{ α: "replace", target: "rule.active", value: true }] },
  },

  delete_rule: {
    name: "Удалить",
    particles: { effects: [{ α: "remove", target: "rules" }] },
    irreversibility: "high",
  },

  // ─── Agent-intents ───

  agent_propose_rebalance: {
    name: "Агент: ребаланс",
    particles: { effects: [{ α: "add", target: "recommendations", σ: "account" }] },
  },

  agent_flag_anomaly: {
    name: "Агент: аномалия",
    particles: { effects: [{ α: "add", target: "alerts", σ: "account" }] },
  },

  agent_fetch_market_signal: {
    name: "Сигнал рынка",
    particles: { effects: [{ α: "add", target: "marketSignals", σ: "global" }] },
  },

  // ─── Rule-triggered actions (вызываются из ruleEngine) ───

  weekly_portfolio_report: {
    name: "Недельный отчёт",
    particles: { effects: [{ α: "add", target: "recommendations", σ: "account" }] },
  },

  auto_stop_loss: {
    name: "Авто stop-loss",
    particles: { effects: [{ α: "add", target: "alerts", σ: "account" }] },
  },

  volatility_spike_alert: {
    name: "Всплеск волатильности",
    particles: { effects: [{ α: "add", target: "alerts", σ: "account" }] },
  },

  drift_rebalance_proposal: {
    name: "Дрейф аллокации",
    particles: { effects: [{ α: "add", target: "recommendations", σ: "account" }] },
  },
};
