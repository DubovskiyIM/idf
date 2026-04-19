/**
 * Онтология freelance-домена — биржа услуг (12-й полевой тест).
 *
 * Cycle 1: skeleton — 8 entities + 3 роли (customer/executor/guest) +
 * 3 invariants. Escrow / Wallet / Deal / Dispute приходят в Cycle 2-3.
 */
export const ONTOLOGY = {
  domain: "freelance",

  entities: {
    User: {
      ownerField: "id",
      fields: {
        id: { type: "text" },
        name: { type: "text", required: true, label: "Имя" },
        email: { type: "email", required: true },
        phone: { type: "text", label: "Телефон" },
        city: { type: "text", label: "Город" },
        customerVerified: { type: "boolean", label: "Заказчик подтверждён" },
        executorVerified: { type: "boolean", label: "Исполнитель подтверждён" },
        createdAt: { type: "datetime" },
      },
    },

    CustomerProfile: {
      ownerField: "userId",
      fields: {
        id: { type: "text" },
        userId: { type: "text", required: true },
        displayName: { type: "text", label: "Отображаемое имя" },
        city: { type: "text", label: "Город" },
        createdAt: { type: "datetime" },
      },
    },

    ExecutorProfile: {
      ownerField: "userId",
      fields: {
        id: { type: "text" },
        userId: { type: "text", required: true },
        bio: { type: "text", label: "О себе" },
        avgDeliveryHours: { type: "number", label: "Средний срок, ч" },
        minPrice: { type: "number", fieldRole: "money", label: "Мин. ставка" },
        rating: { type: "number", label: "Рейтинг" },
        level: {
          type: "select",
          options: ["Новичок", "Специалист", "Эксперт", "Мастер"],
          label: "Уровень",
        },
        completedDeals: { type: "number", label: "Завершённых сделок" },
        availability: {
          type: "select",
          options: ["available", "busy", "unavailable"],
          label: "Доступность",
        },
        createdAt: { type: "datetime" },
      },
    },

    Skill: {
      kind: "reference",
      fields: {
        id: { type: "text" },
        name: { type: "text", required: true, label: "Навык" },
        categoryId: { type: "text", label: "Категория" },
      },
    },

    ExecutorSkill: {
      kind: "assignment",
      ownerField: "executorId",
      fields: {
        id: { type: "text" },
        executorId: { type: "text", required: true },
        skillId: { type: "text", required: true },
        createdAt: { type: "datetime" },
      },
    },

    Category: {
      kind: "reference",
      fields: {
        id: { type: "text" },
        name: { type: "text", required: true, label: "Категория" },
        slug: { type: "text", label: "Slug" },
        icon: { type: "text", label: "Иконка" },
      },
    },

    Task: {
      ownerField: "customerId",
      fields: {
        id: { type: "text" },
        customerId: { type: "text", required: true },
        title: { type: "text", required: true, label: "Заголовок" },
        description: { type: "text", label: "Описание" },
        categoryId: { type: "text", required: true, label: "Категория" },
        budget: { type: "number", fieldRole: "money", label: "Бюджет" },
        deadline: { type: "datetime", label: "Срок" },
        city: { type: "text", label: "Город" },
        type: {
          type: "select",
          options: ["remote", "on-site"],
          label: "Формат работы",
        },
        status: {
          type: "select",
          options: ["draft", "moderation", "published", "closed"],
          required: true,
          label: "Статус",
        },
        responsesCount: { type: "number", label: "Откликов" },
        createdAt: { type: "datetime" },
      },
    },

    Response: {
      ownerField: "executorId",
      fields: {
        id: { type: "text" },
        executorId: { type: "text", required: true },
        taskId: { type: "text", required: true },
        price: { type: "number", fieldRole: "money", required: true, label: "Цена" },
        deliveryDays: { type: "number", required: true, label: "Срок, дней" },
        message: { type: "text", label: "Сообщение" },
        status: {
          type: "select",
          options: ["pending", "withdrawn", "selected", "not_chosen"],
          label: "Статус",
        },
        createdAt: { type: "datetime" },
      },
    },

    Deal: {
      ownerField: "customerId",
      fields: {
        id: { type: "text" },
        customerId: { type: "text", required: true },
        executorId: { type: "text", required: true },
        taskId: { type: "text", required: true },
        responseId: { type: "text" },
        amount: { type: "number", fieldRole: "money", required: true, label: "Сумма сделки" },
        commission: { type: "number", fieldRole: "money", label: "Комиссия" },
        status: {
          type: "select",
          options: [
            "new", "awaiting_payment", "in_progress", "on_review",
            "completed", "cancelled",
          ],
          required: true,
          label: "Статус",
        },
        deadline: { type: "datetime", label: "Срок" },
        completedAt: { type: "datetime", label: "Завершено" },
        createdAt: { type: "datetime" },
      },
    },

    Wallet: {
      ownerField: "userId",
      fields: {
        id: { type: "text" },
        userId: { type: "text", required: true },
        balance: { type: "number", fieldRole: "money", label: "Баланс" },
        reserved: { type: "number", fieldRole: "money", label: "В резерве" },
        currency: { type: "text", label: "Валюта" },
        createdAt: { type: "datetime" },
      },
    },

    Transaction: {
      ownerField: "walletId",
      fields: {
        id: { type: "text" },
        walletId: { type: "text", required: true },
        dealId: { type: "text", label: "Сделка" },
        amount: { type: "number", fieldRole: "money", required: true, label: "Сумма" },
        kind: {
          type: "select",
          options: ["topup", "escrow-hold", "release", "commission", "refund", "withdrawal"],
          required: true,
          label: "Тип операции",
        },
        status: {
          type: "select",
          options: ["pending", "posted", "reverted"],
          required: true,
          label: "Статус",
        },
        note: { type: "text", label: "Комментарий" },
        createdAt: { type: "datetime" },
      },
    },

    Review: {
      ownerField: "authorId",
      fields: {
        id: { type: "text" },
        authorId: { type: "text", required: true },
        dealId: { type: "text", required: true },
        targetUserId: { type: "text", required: true },
        role: {
          type: "select",
          options: ["customer", "executor"],
          required: true,
          label: "Сторона",
        },
        rating: { type: "number", required: true, label: "Оценка" },
        comment: { type: "text", label: "Комментарий" },
        createdAt: { type: "datetime" },
      },
    },
  },

  roles: {
    guest: {
      base: "viewer",
      canExecute: [
        "search_tasks",
        "filter_by_category",
        "sort_tasks",
        "register_by_email",
        "login",
      ],
      visibleFields: {
        Task: [
          "id", "title", "description", "categoryId", "budget",
          "deadline", "city", "type", "status", "responsesCount", "createdAt",
        ],
        Category: ["id", "name", "slug", "icon"],
        Skill: ["id", "name", "categoryId"],
        ExecutorProfile: [
          "id", "bio", "minPrice", "avgDeliveryHours", "rating", "level",
          "completedDeals", "availability",
        ],
      },
    },

    customer: {
      base: "owner",
      canExecute: [
        "update_profile", "logout",
        "create_task_draft", "submit_task_for_moderation", "edit_task",
        "publish_task", "cancel_task_before_deal",
        "search_tasks", "filter_by_category", "sort_tasks",
        "view_responses",
        "session_set_active_role",
        "select_executor",
        "confirm_deal",
        "accept_result",
        "request_revision",
        "cancel_deal_mutual",
        "top_up_wallet_by_card",
        "view_wallet_balance",
        "view_transaction_history",
        "leave_review",
        "reply_to_review",
        "view_reviews_for_user",
      ],
      visibleFields: {
        Task: "own",
        CustomerProfile: "own",
        User: "own",
        Category: ["id", "name", "slug", "icon"],
        Skill: ["id", "name", "categoryId"],
        ExecutorProfile: [
          "id", "userId", "bio", "minPrice", "avgDeliveryHours",
          "rating", "level", "completedDeals", "availability",
        ],
        Response: [
          "id", "executorId", "taskId", "price", "deliveryDays",
          "message", "status", "createdAt",
        ],
        ExecutorSkill: ["id", "executorId", "skillId"],
        Deal: "own",
        Wallet: "own",
        Transaction: [
          "id", "walletId", "dealId", "amount", "kind", "status",
          "note", "createdAt",
        ],
        Review: [
          "id", "authorId", "dealId", "targetUserId", "role",
          "rating", "comment", "createdAt",
        ],
      },
    },

    executor: {
      base: "owner",
      canExecute: [
        "update_profile", "update_bio", "update_rates", "toggle_availability",
        "logout",
        "add_skill", "remove_skill", "add_portfolio_item", "activate_executor_profile",
        "search_tasks", "filter_by_category", "sort_tasks",
        "submit_response", "edit_response", "withdraw_response",
        "session_set_active_role",
        "submit_work_result",
        "submit_revision",
        "cancel_deal_mutual",
        "top_up_wallet_by_card",
        "view_wallet_balance",
        "view_transaction_history",
        "leave_review",
        "reply_to_review",
        "view_reviews_for_user",
      ],
      visibleFields: {
        Response: "own",
        ExecutorProfile: "own",
        ExecutorSkill: "own",
        User: "own",
        Task: [
          "id", "customerId", "title", "description", "categoryId", "budget",
          "deadline", "city", "type", "status", "responsesCount", "createdAt",
        ],
        Category: ["id", "name", "slug", "icon"],
        Skill: ["id", "name", "categoryId"],
        CustomerProfile: ["id", "userId", "displayName", "city"],
        Deal: "own",
        Wallet: "own",
        Transaction: [
          "id", "walletId", "dealId", "amount", "kind", "status",
          "note", "createdAt",
        ],
        Review: "own",
      },
    },
  },

  invariants: [
    // 1. Конечный автомат статусов задачи: draft → moderation → published → closed.
    //    Из moderation возможен откат в draft (правка автором). Rollback при
    //    нарушении — через cascadeReject + SSE.
    {
      name: "task_status_transition",
      kind: "transition",
      entity: "Task",
      field: "status",
      allowed: [
        ["draft", "moderation"],
        ["moderation", "published"],
        ["moderation", "draft"],
        ["published", "closed"],
      ],
      severity: "error",
    },

    // 2. Отклик ссылается на существующую Task: FK Response.taskId → tasks.
    {
      name: "response_references_task",
      kind: "referential",
      entity: "Response",
      field: "taskId",
      references: "tasks",
      severity: "error",
    },

    // 3. На одну задачу — не более одного выбранного отклика (status=selected).
    //    Остальные отклики получают not_chosen при select_executor.
    {
      name: "task_has_at_most_one_selected_response",
      kind: "cardinality",
      entity: "Response",
      groupBy: "taskId",
      max: 1,
      where: { status: "selected" },
      severity: "error",
    },

    // 4. Конечный автомат статусов сделки (escrow lifecycle).
    {
      name: "deal_status_transition",
      kind: "transition",
      entity: "Deal",
      field: "status",
      allowed: [
        ["new", "awaiting_payment"],
        ["awaiting_payment", "in_progress"],
        ["awaiting_payment", "cancelled"],
        ["in_progress", "on_review"],
        ["in_progress", "cancelled"],
        ["on_review", "completed"],
        ["on_review", "in_progress"],
        ["new", "cancelled"],
      ],
      severity: "error",
    },

    // 5. Wallet.reserved = Σ Transaction[kind=escrow-hold, status=posted] по одному кошельку.
    //    Проверка bookkeeping: реальная сумма в escrow-hold всегда совпадает с reserved-полем.
    {
      name: "wallet_reserved_equals_escrow_sum",
      kind: "aggregate",
      entity: "Wallet",
      field: "reserved",
      formula: {
        op: "sum",
        of: "Transaction.amount",
        where: { kind: "escrow-hold", status: "posted" },
        groupBy: "walletId",
      },
      severity: "error",
    },

    // 6. Заказчик не может взять в работу собственную задачу.
    {
      name: "deal_customer_differs_from_executor",
      kind: "referential",
      entity: "Deal",
      check: "customerId !== executorId",
      severity: "error",
    },
  ],
};
