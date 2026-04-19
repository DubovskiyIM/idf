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

  // ─── Response (5) ─────────────────────────────────────────────────────────

  submit_response: {
    name: "Откликнуться на задачу",
    description: "Executor публикует Response на Task в статусе published",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "executorId", type: "id", required: true },
        { name: "taskId", type: "id", required: true },
        { name: "price", type: "number", required: true },
        { name: "deliveryDays", type: "number", required: true },
        { name: "message", type: "text" },
      ],
      effects: [
        { α: "add", target: "responses", σ: "account" },
      ],
    },
    creates: "Response",
    confirmation: "auto",
  },

  edit_response: {
    name: "Изменить отклик",
    description: "Правка цены / срока / сообщения — пока status=pending",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "price", type: "number" },
        { name: "deliveryDays", type: "number" },
        { name: "message", type: "text" },
      ],
      effects: [
        { α: "replace", target: "response" },
      ],
    },
    confirmation: "auto",
  },

  withdraw_response: {
    name: "Отозвать отклик",
    description: "Удалить Response до select_executor",
    α: "remove",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "remove", target: "responses" },
      ],
    },
    confirmation: "auto",
  },

  select_executor: {
    name: "Выбрать исполнителя",
    description: "Customer выбирает Response → status=selected; остальные Response этой задачи → not_chosen",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true, label: "ID выбранного отклика" },
        { name: "taskId", type: "id", required: true, label: "ID задачи" },
      ],
      effects: [
        { α: "replace", target: "response.status", value: "selected" },
      ],
    },
    confirmation: "auto",
  },

  view_responses: {
    name: "Посмотреть отклики",
    description: "Customer смотрит Response к своей задаче (read-only)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "taskId", type: "id", required: true },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  // ─── Task (8) ─────────────────────────────────────────────────────────────

  create_task_draft: {
    name: "Опубликовать задачу",
    description: "Customer создаёт Task в статусе draft через form modal (customerId auto-injected из viewer)",
    α: "add",
    irreversibility: "low",
    confirmation: "form",
    particles: {
      entities: ["task: Task"],
      parameters: [
        { name: "title", type: "text", required: true, label: "Заголовок" },
        { name: "description", type: "textarea", label: "Описание" },
        { name: "categoryId", type: "entityRef", required: true, label: "Категория", entity: "Category" },
        { name: "budget", type: "number", required: true, label: "Бюджет, ₽" },
        { name: "deadline", type: "datetime", label: "Срок" },
        { name: "type", type: "select", options: ["remote", "on-site"], required: true, label: "Формат" },
        { name: "city", type: "text", label: "Город" },
      ],
      effects: [
        { α: "add", target: "tasks", σ: "account" },
      ],
    },
    creates: "Task",
  },

  submit_task_for_moderation: {
    name: "Отправить на модерацию",
    description: "Перевод Task.status draft → moderation",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "task.status", value: "moderation" },
      ],
    },
    confirmation: "auto",
  },

  edit_task: {
    name: "Редактировать задачу",
    description: "Правка полей Task (только в draft / moderation)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "title", type: "text" },
        { name: "description", type: "text" },
        { name: "budget", type: "number" },
        { name: "deadline", type: "datetime" },
      ],
      effects: [
        { α: "replace", target: "task" },
      ],
    },
    confirmation: "auto",
  },

  publish_task: {
    name: "Опубликовать задачу",
    description: "Переход Task.status moderation → published (выполняется модератором в Cycle 3; в Cycle 1 — placeholder для customer-flow)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "task.status", value: "published" },
      ],
    },
    confirmation: "auto",
  },

  cancel_task_before_deal: {
    name: "Отменить задачу",
    description: "Закрыть Task (status → closed) до выбора исполнителя",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "task.status", value: "closed" },
      ],
    },
    confirmation: "auto",
  },

  search_tasks: {
    name: "Поиск задач",
    description: "Полнотекстовый поиск по Task (read-only, session-scope)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "query", type: "text" },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  filter_by_category: {
    name: "Фильтр по категории",
    description: "UI-фильтр (session-scope)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "categoryId", type: "id" },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  sort_tasks: {
    name: "Сортировка задач",
    description: "UI-сортировка (session-scope)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        {
          name: "sortBy",
          type: "select",
          options: ["newest", "budget_desc", "budget_asc", "deadline"],
        },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  // ─── Profile (8) ──────────────────────────────────────────────────────────

  update_profile: {
    name: "Обновить профиль",
    description: "Имя / телефон / город в User",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "name", type: "text" },
        { name: "phone", type: "text" },
        { name: "city", type: "text" },
      ],
      effects: [
        { α: "replace", target: "user" },
      ],
    },
    confirmation: "auto",
  },

  update_bio: {
    name: "Изменить bio",
    description: "Описание исполнителя в ExecutorProfile",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "bio", type: "text", required: true },
      ],
      effects: [
        { α: "replace", target: "executorProfile.bio" },
      ],
    },
    confirmation: "auto",
  },

  add_skill: {
    name: "Добавить навык",
    description: "m2m ExecutorSkill: исполнитель ↔ справочник навыков",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "executorId", type: "id", required: true },
        { name: "skillId", type: "id", required: true },
      ],
      effects: [
        { α: "add", target: "executorSkills", σ: "account" },
      ],
    },
    creates: "ExecutorSkill",
    confirmation: "auto",
  },

  remove_skill: {
    name: "Убрать навык",
    description: "Удалить запись ExecutorSkill",
    α: "remove",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "remove", target: "executorSkills" },
      ],
    },
    confirmation: "auto",
  },

  add_portfolio_item: {
    name: "Добавить работу в портфолио",
    description: "Запись портфолио будет полноценной сущностью в Cycle 3; в Cycle 1 — no-op placeholder для UI-polish",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "executorId", type: "id", required: true },
        { name: "title", type: "text", required: true },
        { name: "url", type: "url" },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  update_rates: {
    name: "Обновить ставки",
    description: "Минимальная цена и средний срок у исполнителя",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "minPrice", type: "number" },
        { name: "avgDeliveryHours", type: "number" },
      ],
      effects: [
        { α: "replace", target: "executorProfile" },
      ],
    },
    confirmation: "auto",
  },

  toggle_availability: {
    name: "Сменить доступность",
    description: "available / busy / unavailable",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        {
          name: "availability",
          type: "select",
          options: ["available", "busy", "unavailable"],
          required: true,
        },
      ],
      effects: [
        { α: "replace", target: "executorProfile.availability" },
      ],
    },
    confirmation: "auto",
  },

  activate_executor_profile: {
    name: "Активировать профиль исполнителя",
    description: "Создать ExecutorProfile + выставить User.executorVerified=true",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "userId", type: "id", required: true },
        { name: "bio", type: "text" },
      ],
      effects: [
        { α: "add", target: "executorProfiles", σ: "account" },
      ],
    },
    creates: "ExecutorProfile",
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

  // ─── Review (3) ──────────────────────────────────────────────────────────

  leave_review: {
    name: "Оставить отзыв",
    description: "После Deal.completed одна сторона оставляет Review о другой",
    α: "add",
    irreversibility: "medium",
    particles: {
      parameters: [
        { name: "authorId", type: "id", required: true },
        { name: "dealId", type: "id", required: true },
        { name: "targetUserId", type: "id", required: true },
        { name: "role", type: "select", options: ["customer", "executor"], required: true },
        { name: "rating", type: "number", required: true },
        { name: "comment", type: "text" },
      ],
      effects: [
        { α: "add", target: "reviews", σ: "account" },
      ],
    },
    creates: "Review",
    confirmation: "auto",
  },

  reply_to_review: {
    name: "Ответить на отзыв",
    description: "Адресат Review может оставить один reply",
    α: "replace",
    irreversibility: "medium",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "reply", type: "text", required: true },
      ],
      effects: [
        { α: "replace", target: "review.reply" },
      ],
    },
    confirmation: "auto",
  },

  view_reviews_for_user: {
    name: "Посмотреть отзывы",
    description: "Read-only — публичные Review о targetUserId",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "targetUserId", type: "id", required: true },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  // ─── Wallet (7) ───────────────────────────────────────────────────────────

  top_up_wallet_by_card: {
    name: "Пополнить баланс картой",
    description: "Mock-gateway — создаёт Transaction.kind=topup, увеличивает Wallet.balance",
    α: "add",
    irreversibility: "medium",
    particles: {
      parameters: [
        { name: "walletId", type: "id", required: true },
        { name: "amount", type: "number", required: true },
        { name: "cardLastFour", type: "text" },
      ],
      effects: [
        { α: "add", target: "transactions", σ: "account" },
        { α: "replace", target: "wallet.balance" },
      ],
    },
    creates: "Transaction",
    confirmation: "auto",
  },

  view_transaction_history: {
    name: "История операций",
    description: "Read-only выборка Transaction по walletId",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "walletId", type: "id", required: true },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  charge_commission: {
    name: "Списать комиссию",
    description: "Internal — при accept_result платформенная комиссия (%)",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "dealId", type: "id", required: true },
        { name: "walletId", type: "id", required: true },
        { name: "amount", type: "number", required: true },
      ],
      effects: [
        { α: "add", target: "transactions", σ: "account" },
      ],
    },
    creates: "Transaction",
    confirmation: "auto",
  },

  reserve_escrow: {
    name: "Резервировать escrow",
    description: "Internal — при confirm_deal: создаёт Transaction.kind=escrow-hold",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "dealId", type: "id", required: true },
        { name: "walletId", type: "id", required: true },
        { name: "amount", type: "number", required: true },
      ],
      effects: [
        { α: "add", target: "transactions", σ: "account" },
        { α: "replace", target: "wallet.reserved" },
      ],
    },
    creates: "Transaction",
    confirmation: "auto",
  },

  release_escrow: {
    name: "Высвободить escrow",
    description: "Internal — при accept_result: Transaction.kind=release + перевод исполнителю",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "dealId", type: "id", required: true },
        { name: "walletId", type: "id", required: true },
        { name: "amount", type: "number", required: true },
      ],
      effects: [
        { α: "add", target: "transactions", σ: "account" },
        { α: "replace", target: "wallet.reserved" },
        { α: "replace", target: "wallet.balance" },
      ],
    },
    creates: "Transaction",
    confirmation: "auto",
  },

  refund_escrow: {
    name: "Вернуть escrow",
    description: "Internal — при cancel_deal_mutual: Transaction.kind=refund",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "dealId", type: "id", required: true },
        { name: "walletId", type: "id", required: true },
        { name: "amount", type: "number", required: true },
      ],
      effects: [
        { α: "add", target: "transactions", σ: "account" },
        { α: "replace", target: "wallet.reserved" },
      ],
    },
    creates: "Transaction",
    confirmation: "auto",
  },

  view_wallet_balance: {
    name: "Посмотреть баланс",
    description: "Read-only — возвращает Wallet balance + reserved",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "userId", type: "id", required: true },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  // ─── Deal (7) ─────────────────────────────────────────────────────────────

  confirm_deal: {
    name: "Подтвердить сделку",
    description: "Customer выбирает исполнителя и резервирует escrow — деньги замораживаются",
    α: "add",
    irreversibility: "high",
    __irr: {
      point: "high",
      reason: "Сумма резервируется в escrow — отмена возможна только через спор или mutual-cancel",
    },
    particles: {
      entities: ["deal: Deal"],
      parameters: [
        { name: "customerId", type: "id", required: true },
        { name: "executorId", type: "id", required: true },
        { name: "taskId", type: "id", required: true },
        { name: "responseId", type: "id", required: true },
        { name: "amount", type: "number", required: true },
        { name: "deadline", type: "datetime" },
      ],
      effects: [
        { α: "add", target: "deals", σ: "account" },
        { α: "add", target: "transactions", σ: "account" },
        { α: "replace", target: "wallet.reserved" },
      ],
    },
    creates: "Deal",
    confirmation: "auto",
  },

  submit_work_result: {
    name: "Сдать работу",
    description: "Executor передаёт результат — Deal.status переходит в on_review",
    α: "replace",
    irreversibility: "low",
    particles: {
      entities: ["deal: Deal"],
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "result", type: "text", required: true },
        { name: "links", type: "text" },
      ],
      effects: [
        { α: "replace", target: "deal.status", value: "on_review" },
      ],
    },
    confirmation: "auto",
  },

  accept_result: {
    name: "Принять работу",
    description: "Customer принимает результат — escrow-перевод исполнителю",
    α: "replace",
    irreversibility: "high",
    __irr: {
      point: "high",
      reason: "Escrow-перевод исполнителю — откат только через chargeback поддержки",
    },
    particles: {
      entities: ["deal: Deal"],
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "deal.status", value: "completed" },
        { α: "add", target: "transactions", σ: "account" },
      ],
    },
    confirmation: "auto",
  },

  auto_accept_result: {
    name: "Авто-приёмка (72h)",
    description: "Scheduler-fired: если customer не принял за 72h, результат auto-accept с теми же последствиями",
    α: "replace",
    irreversibility: "high",
    __irr: {
      point: "high",
      reason: "Автоматическая приёмка через 72h после on_review — та же finality что и ручная",
    },
    particles: {
      entities: ["deal: Deal"],
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "deal.status", value: "completed" },
        { α: "add", target: "transactions", σ: "account" },
      ],
    },
    confirmation: "auto",
  },

  request_revision: {
    name: "Запросить доработку",
    description: "Customer возвращает deal из on_review в in_progress с комментарием",
    α: "replace",
    irreversibility: "low",
    particles: {
      entities: ["deal: Deal"],
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "comment", type: "text", required: true },
      ],
      effects: [
        { α: "replace", target: "deal.status", value: "in_progress" },
      ],
    },
    confirmation: "auto",
  },

  submit_revision: {
    name: "Сдать правки",
    description: "Executor сдаёт версию после revision — Deal возвращается в on_review",
    α: "replace",
    irreversibility: "low",
    particles: {
      entities: ["deal: Deal"],
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "result", type: "text", required: true },
      ],
      effects: [
        { α: "replace", target: "deal.status", value: "on_review" },
      ],
    },
    confirmation: "auto",
  },

  cancel_deal_mutual: {
    name: "Отменить сделку (обоюдно)",
    description: "Обе стороны согласны — escrow refund customer'у",
    α: "replace",
    irreversibility: "medium",
    particles: {
      entities: ["deal: Deal"],
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "reason", type: "text", required: true },
      ],
      effects: [
        { α: "replace", target: "deal.status", value: "cancelled" },
        { α: "add", target: "transactions", σ: "account" },
      ],
    },
    confirmation: "auto",
  },
};
