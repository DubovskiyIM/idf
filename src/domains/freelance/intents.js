/**
 * Freelance intents — 29 намерений в Cycle 1.
 * Полный список (55) добавляется в Cycle 2-4.
 */

export const INTENTS = {
  // ─── Auth (5) ────────────────────────────────────────────────────────────

  register_by_email: {
    name: "Регистрация по email",
    description: "Создать пользователя с подтверждением email'а",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "email", type: "email", required: true },
        { name: "name", type: "text", required: true },
        { name: "password", type: "text", required: true, sensitive: true },
      ],
      effects: [
        { α: "add", target: "users", σ: "account" },
      ],
    },
    creates: "User",
    confirmation: "auto",
  },

  verify_email: {
    name: "Подтвердить email",
    description: "Активировать учётную запись по коду из письма",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "code", type: "text", required: true },
      ],
      effects: [
        { α: "replace", target: "user.emailVerified", value: true },
      ],
    },
    confirmation: "auto",
  },

  login: {
    name: "Войти",
    description: "Сессия пользователя (возвращает JWT)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "email", type: "email", required: true },
        { name: "password", type: "text", required: true, sensitive: true },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  logout: {
    name: "Выйти",
    description: "Завершить текущую сессию",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [],
      effects: [],
    },
    confirmation: "auto",
  },

  reset_password: {
    name: "Сбросить пароль",
    description: "Отправить ссылку для сброса",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "email", type: "email", required: true },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  // ─── System (3) ───────────────────────────────────────────────────────────

  schedule_timer: {
    name: "Поставить таймер",
    description: "Системный intent: отложенный fire другого intent через δt",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "fireIntent", type: "text", required: true },
        { name: "afterMs", type: "number" },
        { name: "atISO", type: "datetime" },
        { name: "target", type: "text", required: true },
        { name: "revokeOn", type: "text" },
      ],
      effects: [
        { α: "add", target: "scheduledTimers", σ: "account" },
      ],
    },
    creates: "ScheduledTimer",
    confirmation: "auto",
  },

  revoke_timer: {
    name: "Отменить таймер",
    description: "Системный intent: отменить ранее поставленный timer",
    α: "remove",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "remove", target: "scheduledTimers" },
      ],
    },
    confirmation: "auto",
  },

  session_set_active_role: {
    name: "Переключить активную роль",
    description: "Для universal-пользователя — переключить customer ↔ executor; не пишет в Φ, только session",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "role", type: "select", options: ["customer", "executor"], required: true },
      ],
      effects: [
        { α: "replace", target: "session.activeRole", σ: "session" },
      ],
    },
    confirmation: "auto",
  },
};
