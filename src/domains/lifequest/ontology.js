export const ONTOLOGY = {
  entities: {
    User: {
      fields: {
        id: { type: "id" },
        name: { type: "text", read: ["*"], write: ["self"], required: true, label: "Имя" },
        email: { type: "email", read: ["self"], write: ["self"], label: "Email" },
        avatar: { type: "image", read: ["*"], write: ["self"], label: "Аватар" },
        level: { type: "number", read: ["*"], label: "Уровень" },
        xp: { type: "number", read: ["*"], label: "Опыт (XP)" },
        streak: { type: "number", read: ["*"], label: "Серия дней" },
      },
      statuses: ["active"],
      type: "internal",
      searchConfig: {
        fields: ["name"],
        returnFields: ["id", "name", "avatar", "level", "xp", "streak"],
        minQueryLength: 2,
        limit: 20,
      },
    },

    Sphere: {
      fields: {
        id: { type: "id" },
        name: { type: "text", read: ["*"], required: true, label: "Название" },
        icon: { type: "text", read: ["*"], label: "Иконка" },
        color: { type: "text", read: ["*"], label: "Цвет" },
        sortOrder: { type: "number", read: ["*"], label: "Порядок" },
      },
      type: "internal",
    },

    Goal: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        title: { type: "text", read: ["*"], write: ["self"], required: true, label: "Название" },
        description: { type: "textarea", read: ["*"], write: ["self"], label: "Описание" },
        sphereId: { type: "entityRef", read: ["*"], write: ["self"], label: "Сфера" },
        deadline: { type: "datetime", read: ["*"], write: ["self"], label: "Дедлайн" },
        status: { type: "enum", read: ["*"], label: "Статус",
          values: ["active", "completed", "abandoned"],
          valueLabels: { active: "Активная", completed: "Завершена", abandoned: "Заброшена" },
        },
        progress: { type: "number", read: ["*"], write: ["self"], label: "Прогресс (%)" },
        createdAt: { type: "datetime", read: ["*"], label: "Создана" },
      },
      statuses: ["active", "completed", "abandoned"],
      ownerField: "userId",
      type: "internal",
    },

    Habit: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        title: { type: "text", read: ["*"], write: ["self"], required: true, label: "Название" },
        sphereId: { type: "entityRef", read: ["*"], write: ["self"], label: "Сфера" },
        type: { type: "enum", read: ["*"], write: ["self"], label: "Тип",
          values: ["binary", "quantitative"],
          valueLabels: { binary: "Да/Нет", quantitative: "Количественная" },
        },
        targetValue: { type: "number", read: ["*"], write: ["self"], label: "Целевое значение" },
        unit: { type: "text", read: ["*"], write: ["self"], label: "Единица измерения" },
        frequency: { type: "enum", read: ["*"], write: ["self"], label: "Частота",
          values: ["daily", "weekdays", "custom"],
          valueLabels: { daily: "Ежедневно", weekdays: "По будням", custom: "Своя" },
        },
        status: { type: "enum", read: ["*"], label: "Статус",
          values: ["active", "paused", "archived"],
          valueLabels: { active: "Активная", paused: "На паузе", archived: "В архиве" },
        },
        streakCurrent: { type: "number", read: ["*"], label: "Текущая серия" },
        streakBest: { type: "number", read: ["*"], label: "Лучшая серия" },
        createdAt: { type: "datetime", read: ["*"], label: "Создана" },
      },
      statuses: ["active", "paused", "archived"],
      ownerField: "userId",
      type: "internal",
    },

    HabitLog: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        habitId: { type: "entityRef", read: ["*"], label: "Привычка" },
        date: { type: "text", read: ["*"], label: "Дата" },
        done: { type: "boolean", read: ["*"], label: "Выполнено" },
        value: { type: "number", read: ["*"], label: "Значение" },
        xpEarned: { type: "number", read: ["*"], label: "XP получено" },
      },
      ownerField: "userId",
      type: "internal",
    },

    Task: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        title: { type: "text", read: ["*"], write: ["self"], required: true, label: "Название" },
        date: { type: "text", read: ["*"], write: ["self"], label: "Дата" },
        goalId: { type: "entityRef", read: ["*"], write: ["self"], label: "Цель" },
        done: { type: "boolean", read: ["*"], label: "Выполнена" },
        priority: { type: "boolean", read: ["*"], write: ["self"], label: "Приоритет" },
        createdAt: { type: "datetime", read: ["*"], label: "Создана" },
      },
      ownerField: "userId",
      type: "internal",
    },

    SphereAssessment: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        sphereId: { type: "entityRef", read: ["*"], label: "Сфера" },
        score: { type: "number", read: ["*"], write: ["self"], label: "Оценка (1-10)" },
        description: { type: "textarea", read: ["*"], write: ["self"], label: "Комментарий" },
        targetScore: { type: "number", read: ["*"], write: ["self"], label: "Целевая оценка (1-10)" },
        assessedAt: { type: "datetime", read: ["*"], label: "Дата оценки" },
      },
      ownerField: "userId",
      type: "internal",
    },

    VisionItem: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        sphereId: { type: "entityRef", read: ["*"], write: ["self"], label: "Сфера" },
        imageUrl: { type: "text", read: ["*"], write: ["self"], label: "Изображение (URL)" },
        caption: { type: "text", read: ["*"], write: ["self"], label: "Подпись" },
        x: { type: "number", read: ["*"], write: ["self"], label: "X" },
        y: { type: "number", read: ["*"], write: ["self"], label: "Y" },
        width: { type: "number", read: ["*"], write: ["self"], label: "Ширина" },
        height: { type: "number", read: ["*"], write: ["self"], label: "Высота" },
      },
      ownerField: "userId",
      type: "internal",
    },

    Badge: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        type: { type: "text", read: ["*"], label: "Тип" },
        title: { type: "text", read: ["*"], label: "Название" },
        description: { type: "text", read: ["*"], label: "Описание" },
        icon: { type: "text", read: ["*"], label: "Иконка" },
        earnedAt: { type: "datetime", read: ["*"], label: "Получен" },
      },
      ownerField: "userId",
      type: "internal",
    },

    Quote: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        text: { type: "textarea", read: ["*"], write: ["self"], required: true, label: "Цитата" },
        author: { type: "text", read: ["*"], write: ["self"], label: "Автор" },
        setAt: { type: "datetime", read: ["*"], label: "Установлена" },
      },
      ownerField: "userId",
      type: "internal",
    },
  },

  rules: [
    { id: "xp_habit_check", trigger: "check_habit", action: "earn_xp", context: { amount: 10, reason: "habit" } },
    { id: "xp_habit_value", trigger: "log_habit_value", action: "earn_xp", context: { amount: 10, reason: "habit" } },
    { id: "xp_task", trigger: "complete_task", action: "earn_xp", context: { amount: 5, reason: "task" } },
    { id: "xp_goal", trigger: "complete_goal", action: "earn_xp", context: { amount: 50, reason: "goal" } },
    { id: "badge_streak_7", trigger: "check_habit", action: "earn_badge", context: { type: "streak_7", title: "Неделя огня 🔥", icon: "🔥", description: "7 дней подряд" } },
    { id: "badge_streak_30", trigger: "check_habit", action: "earn_badge", context: { type: "streak_30", title: "Месяц дисциплины 💎", icon: "💎", description: "30 дней подряд" } },
    { id: "badge_streak_100", trigger: "check_habit", action: "earn_badge", context: { type: "streak_100", title: "Легенда 👑", icon: "👑", description: "100 дней подряд" } },
    { id: "badge_first_goal", trigger: "complete_goal", action: "earn_badge", context: { type: "first_goal", title: "Первая вершина ⛰️", icon: "⛰️", description: "Завершить первую цель" } },
    { id: "badge_full_wheel", trigger: "assess_sphere", action: "earn_badge", context: { type: "full_wheel", title: "Полное колесо 🧭", icon: "🧭", description: "Оценить все 12 сфер" } },
    { id: "badge_xp_500", trigger: "earn_xp", action: "earn_badge", context: { type: "xp_500", title: "Путь начат ✨", icon: "✨", description: "Набрать 500 XP" } },
    { id: "badge_xp_5000", trigger: "earn_xp", action: "earn_badge", context: { type: "xp_5000", title: "Мастер привычек 🏅", icon: "🏅", description: "Набрать 5000 XP" } },
  ],

  roles: {
    agent: {
      label: "Агент (API)",
      canExecute: [
        "create_goal", "complete_goal", "update_goal_progress",
        "create_habit", "check_habit", "log_habit_value",
        "create_task", "complete_task", "assess_sphere", "set_quote",
      ],
      visibleFields: {
        Goal: ["id", "title", "sphereId", "deadline", "status", "progress"],
        Habit: ["id", "title", "sphereId", "type", "streakCurrent"],
        Task: ["id", "title", "date", "done"],
        SphereAssessment: ["id", "sphereId", "score"],
        Badge: ["id", "type", "title", "earnedAt"],
      },
    },
  },
};
