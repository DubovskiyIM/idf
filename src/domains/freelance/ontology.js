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
      },
    },
  },

  invariants: [],
};
