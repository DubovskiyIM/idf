/**
 * Шаблоны достижений (бейджей) для домена LifeQuest.
 * Бейджи выдаются при достижении определённых условий.
 */
export const BADGE_TEMPLATES = [
  // Серии (streak)
  { type: "streak_7", title: "Неделя огня", icon: "🔥", description: "7 дней подряд без пропуска" },
  { type: "streak_30", title: "Месяц дисциплины", icon: "💎", description: "30 дней подряд" },
  { type: "streak_100", title: "Легенда", icon: "👑", description: "100 дней подряд" },

  // Цели
  { type: "first_goal", title: "Первая вершина", icon: "⛰️", description: "Завершить первую цель" },
  { type: "five_goals", title: "Пять вершин", icon: "🏔️", description: "Завершить 5 целей" },
  { type: "ten_goals", title: "Покоритель", icon: "🗻", description: "Завершить 10 целей" },

  // Колесо жизни
  { type: "full_wheel", title: "Полное колесо", icon: "🧭", description: "Оценить все 12 сфер жизни" },
  { type: "vision_complete", title: "Мечтатель", icon: "🌈", description: "Добавить картинки во все 12 сфер" },
  { type: "wheel_balance", title: "Гармония", icon: "☯️", description: "Все сферы выше 7 баллов" },

  // Опыт (XP)
  { type: "xp_500", title: "Путь начат", icon: "✨", description: "Набрать 500 XP" },
  { type: "xp_1000", title: "Тысячник", icon: "🌟", description: "Набрать 1000 XP" },
  { type: "xp_5000", title: "Мастер привычек", icon: "🏅", description: "Набрать 5000 XP" },
  { type: "xp_10000", title: "Гуру", icon: "🏆", description: "Набрать 10 000 XP" },

  // Привычки
  { type: "first_habit", title: "Начало пути", icon: "🌱", description: "Создать первую привычку" },
  { type: "ten_habits", title: "Десять направлений", icon: "🎯", description: "Создать 10 привычек" },

  // Идеальное выполнение
  { type: "perfect_day", title: "Идеальный день", icon: "💯", description: "100% выполнение за день" },
  { type: "perfect_week", title: "Идеальная неделя", icon: "🌠", description: "100% выполнение за неделю" },
  { type: "perfect_month", title: "Идеальный месяц", icon: "🎆", description: "100% выполнение за месяц" },

  // Задачи
  { type: "first_task", title: "Первый шаг", icon: "👣", description: "Выполнить первую задачу" },
  { type: "fifty_tasks", title: "Полсотни дел", icon: "📋", description: "Выполнить 50 задач" },
  { type: "hundred_tasks", title: "Сотня свершений", icon: "💪", description: "Выполнить 100 задач" },

  // Уровни
  { type: "level_5", title: "Ученик", icon: "📖", description: "Достичь 5-го уровня" },
  { type: "level_10", title: "Мастер", icon: "🎓", description: "Достичь 10-го уровня" },
  { type: "level_25", title: "Сенсей", icon: "🥋", description: "Достичь 25-го уровня" },
];
