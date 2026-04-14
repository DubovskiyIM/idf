export const ONTOLOGY = {
  entities: {
    User: {
      fields: {
        id: { type: "id" },
        name: { type: "text", read: ["*"], write: ["self"], required: true, label: "Имя" },
        email: { type: "email", read: ["*"], write: ["self"], required: true, label: "Email" },
        avatar: { type: "text", read: ["*"], write: ["self"], label: "Аватар" },
        streakCurrent: { type: "number", read: ["*"], label: "Текущая серия" },
        entryCount: { type: "number", read: ["*"], label: "Количество записей" },
      },
      statuses: ["active"],
      type: "internal",
      searchConfig: {
        fields: ["name"],
        returnFields: ["id", "name", "avatar", "streakCurrent", "entryCount"],
        minQueryLength: 2,
        limit: 20,
      },
    },

    MoodEntry: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        pleasantness: { type: "number", read: ["*"], write: ["self"], required: true, min: -5, max: 5, label: "Приятность" },
        energy: { type: "number", read: ["*"], write: ["self"], required: true, min: -5, max: 5, label: "Энергия" },
        quadrant: { type: "enum", read: ["*"], label: "Квадрант",
          values: ["HEP", "HEU", "LEP", "LEU"],
          valueLabels: {
            HEP: "Энергично + приятно",
            HEU: "Энергично + неприятно",
            LEP: "Спокойно + приятно",
            LEU: "Спокойно + неприятно",
          },
        },
        emotion: { type: "text", read: ["*"], write: ["self"], required: true, label: "Эмоция" },
        note: { type: "textarea", read: ["*"], write: ["self"], label: "Заметка" },
        loggedAt: { type: "datetime", read: ["*"], required: true, label: "Время" },
      },
      ownerField: "userId",
      type: "internal",
    },

    Activity: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        name: { type: "text", read: ["*"], write: ["self"], required: true, label: "Название" },
        icon: { type: "text", read: ["*"], write: ["self"], label: "Иконка" },
        category: { type: "enum", read: ["*"], write: ["self"], label: "Категория",
          values: ["work", "health", "social", "leisure", "mind", "other"],
          valueLabels: {
            work: "Работа",
            health: "Здоровье",
            social: "Социальное",
            leisure: "Отдых",
            mind: "Разум",
            other: "Другое",
          },
        },
        archived: { type: "boolean", read: ["*"], write: ["self"], label: "Архивирован" },
      },
      ownerField: "userId",
      type: "internal",
      searchConfig: {
        fields: ["name"],
        minQueryLength: 2,
      },
    },

    EntryActivity: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        entryId: { type: "entityRef", read: ["*"], label: "Запись" },
        activityId: { type: "entityRef", read: ["*"], label: "Активность" },
      },
      ownerField: "userId",
      type: "internal",
    },

    Hypothesis: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        title: { type: "text", read: ["*"], write: ["self"], required: true, label: "Название" },
        whenActivity: { type: "entityRef", read: ["*"], write: ["self"], required: true, label: "При активности" },
        expectedEffect: { type: "enum", read: ["*"], write: ["self"], label: "Ожидаемый эффект",
          values: ["more_energy", "less_stress", "more_pleasantness", "less_pleasantness", "more_calm", "more_focus"],
          valueLabels: {
            more_energy: "Больше энергии",
            less_stress: "Меньше стресса",
            more_pleasantness: "Больше радости",
            less_pleasantness: "Меньше радости",
            more_calm: "Больше спокойствия",
            more_focus: "Больше фокуса",
          },
        },
        status: { type: "enum", read: ["*"], label: "Статус",
          values: ["testing", "confirmed", "rejected", "archived"],
          valueLabels: {
            testing: "Тестируется",
            confirmed: "Подтверждена",
            rejected: "Опровергнута",
            archived: "Архивирована",
          },
        },
        confidence: { type: "number", read: ["*"], label: "Уверенность" },
        createdAt: { type: "datetime", read: ["*"], label: "Создана" },
        resolvedAt: { type: "datetime", read: ["*"], label: "Разрешена" },
      },
      ownerField: "userId",
      type: "internal",
    },

    HypothesisEvidence: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        hypothesisId: { type: "entityRef", read: ["*"], label: "Гипотеза" },
        entryId: { type: "entityRef", read: ["*"], label: "Запись" },
        supports: { type: "boolean", read: ["*"], label: "Поддерживает" },
        delta: { type: "number", read: ["*"], label: "Разница" },
        createdAt: { type: "datetime", read: ["*"], label: "Создано" },
      },
      ownerField: "userId",
      type: "internal",
    },

    Insight: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        title: { type: "text", read: ["*"], label: "Заголовок" },
        description: { type: "textarea", read: ["*"], label: "Описание" },
        kind: { type: "enum", read: ["*"], label: "Тип",
          values: ["correlation", "pattern", "streak", "milestone", "drift_alert"],
          valueLabels: {
            correlation: "Корреляция",
            pattern: "Паттерн",
            streak: "Серия",
            milestone: "Майлстоун",
            drift_alert: "Сигнал дрейфа",
          },
        },
        data: { type: "text", read: ["*"], label: "Данные" },
        pinned: { type: "boolean", read: ["*"], write: ["self"], label: "Закреплён" },
        seenAt: { type: "datetime", read: ["*"], label: "Просмотрен" },
        createdAt: { type: "datetime", read: ["*"], label: "Создан" },
      },
      ownerField: "userId",
      type: "internal",
    },

    Reminder: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        text: { type: "text", read: ["*"], write: ["self"], required: true, label: "Текст" },
        triggerKind: { type: "enum", read: ["*"], write: ["self"], label: "Тип триггера",
          values: ["time", "frequency"],
          valueLabels: {
            time: "Время",
            frequency: "Частота",
          },
        },
        active: { type: "boolean", read: ["*"], write: ["self"], label: "Активно" },
      },
      ownerField: "userId",
      type: "internal",
    },

    Tag: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        name: { type: "text", read: ["*"], write: ["self"], required: true, label: "Название" },
        color: { type: "text", read: ["*"], write: ["self"], label: "Цвет" },
      },
      ownerField: "userId",
      type: "internal",
    },

    EntryTag: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        entryId: { type: "entityRef", read: ["*"], label: "Запись" },
        tagId: { type: "entityRef", read: ["*"], label: "Тег" },
      },
      ownerField: "userId",
      type: "internal",
    },
  },

  roles: {
    agent: {
      canExecute: [
        "quick_checkin", "detailed_checkin", "create_activity",
        "propose_hypothesis", "create_tag", "create_reminder",
      ],
      visibleFields: {
        MoodEntry: ["id", "pleasantness", "energy", "quadrant", "emotion", "loggedAt"],
        Activity: ["id", "name", "icon", "category"],
        Hypothesis: ["id", "title", "status", "confidence"],
        Insight: ["id", "title", "kind", "createdAt"],
      },
    },
  },

  rules: [
    { id: "streak_update", trigger: "quick_checkin", action: "update_streak",
      context: { userId: "effect.userId" } },
    { id: "correlation_update", trigger: "quick_checkin", action: "compute_correlation",
      aggregation: { everyN: 5 },
      context: { userId: "effect.userId" } },
    { id: "mood_drift", trigger: "quick_checkin", action: "mood_drift_alert",
      threshold: { lookback: 5, field: "quadrant", condition: "all_equal:LEU" },
      context: { userId: "effect.userId" } },
    { id: "weekly_summary_rule", trigger: "*", action: "weekly_summary",
      schedule: "weekly:sun:20:00",
      context: {} },
    { id: "insight_correlation", trigger: "compute_correlation", action: "generate_insight",
      condition: "Math.abs(effect.correlation) > 0.6",
      context: { kind: "correlation", data: "effect.data", userId: "effect.userId" } },
    { id: "milestone_7", trigger: "quick_checkin", action: "award_milestone",
      threshold: { lookback: 1, field: "entryCount", condition: "equals:7" },
      context: { milestone: "first_week", userId: "effect.userId" } },
    { id: "milestone_30", trigger: "quick_checkin", action: "award_milestone",
      threshold: { lookback: 1, field: "entryCount", condition: "equals:30" },
      context: { milestone: "first_month", userId: "effect.userId" } },
    { id: "hypothesis_eval", trigger: "quick_checkin", action: "evaluate_hypothesis",
      aggregation: { everyN: 1 },
      context: { userId: "effect.userId", entryId: "effect.id" } },
  ],
};
