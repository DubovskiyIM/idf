export const PROJECTIONS = {
  dashboard: {
    name: "Главная",
    kind: "dashboard",
    query: "сводка дня: задачи, привычки, цели",
    entities: [],
    widgets: [
      { projection: "today", title: "Сегодня", size: "full" },
      { projection: "habit_list", title: "Привычки", size: "half" },
      { projection: "goal_list", title: "Цели", size: "half" },
    ],
  },

  today: {
    name: "Планировщик дня",
    kind: "canvas",
    query: "задачи и привычки на текущий день",
    entities: ["Task", "HabitLog", "Habit", "Sphere"],
  },

  week_progress: {
    name: "Прогресс недели",
    kind: "canvas",
    query: "аналитика по всем целям и привычкам за неделю",
    entities: ["HabitLog", "Habit", "Goal", "Task"],
  },

  habit_list: {
    name: "Привычки",
    kind: "catalog",
    query: "список привычек пользователя",
    entities: ["Habit", "Sphere"],
    mainEntity: "Habit",
    filter: "userId === viewer.id && status !== 'archived'",
    witnesses: ["title", "sphereId", "type", "streakCurrent", "streakBest", "status", "frequency"],
  },

  habit_detail: {
    name: "Привычка",
    kind: "detail",
    query: "детали привычки с историей отметок",
    entities: ["Habit", "HabitLog", "Sphere"],
    mainEntity: "Habit",
    idParam: "habitId",
    witnesses: ["title", "sphereId", "type", "targetValue", "unit", "frequency", "streakCurrent", "streakBest", "status"],
  },

  goal_list: {
    name: "Цели",
    kind: "catalog",
    query: "список целей пользователя",
    entities: ["Goal", "Sphere"],
    mainEntity: "Goal",
    filter: "userId === viewer.id",
    witnesses: ["title", "sphereId", "deadline", "status", "progress", "description"],
  },

  calendar: {
    name: "Календарь",
    kind: "canvas",
    query: "календарь привычек, задач и целей",
    entities: ["HabitLog", "Task", "Habit"],
  },

  point_a: {
    name: "Точка А — колесо жизни",
    kind: "canvas",
    query: "текущая оценка сфер жизни и целевые значения",
    entities: ["SphereAssessment", "Sphere"],
  },

  vision_board: {
    name: "Карта желаний",
    kind: "canvas",
    query: "визуальная карта желаний по сферам",
    entities: ["VisionItem", "Sphere"],
  },

  goal_detail: {
    name: "Цель",
    kind: "detail",
    query: "детали цели с задачами",
    entities: ["Goal", "Task", "Sphere"],
    mainEntity: "Goal",
    idParam: "goalId",
    witnesses: ["title", "description", "sphereId", "deadline", "status", "progress"],
    subCollections: [
      { collection: "tasks", entity: "Task", foreignKey: "goalId", title: "Задачи", addable: true },
    ],
  },

  all_time_stats: {
    name: "Статистика",
    kind: "detail",
    query: "общая статистика: уровень, опыт, бейджи, прогресс",
    entities: ["Badge", "Goal", "Habit", "HabitLog"],
    mainEntity: "User",
    idParam: "userId",
    witnesses: ["xp", "level", "streak", "title", "earnedAt", "type", "icon", "done", "status", "progress"],
  },

  badge_list: {
    name: "Бейджи",
    kind: "catalog",
    layout: "grid",
    query: "заработанные бейджи пользователя",
    entities: ["Badge"],
    mainEntity: "Badge",
    filter: "userId === viewer.id",
    witnesses: ["type", "title", "description", "icon", "earnedAt"],
  },
};

export const ROOT_PROJECTIONS = [
  { section: "Главная", icon: "🏠", items: ["dashboard"] },
  { section: "Трекер", icon: "✅", items: ["today", "week_progress", "habit_list", "goal_list"] },
  { section: "Календарь", icon: "📅", items: ["calendar"] },
  { section: "Карта жизни", icon: "🧭", items: ["point_a", "vision_board"] },
  { section: "Достижения", icon: "🏆", items: ["all_time_stats", "badge_list"] },
];
