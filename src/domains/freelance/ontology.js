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

  roles: {},

  invariants: [],
};
