/**
 * Домен «LifeQuest» — постановка целей + трекинг привычек.
 * 56 намерений в 8 категориях.
 */

const ef = (α, target, σ = "account", opts = {}) => ({ α, target, σ, ...opts });

function intent(name, entities, conditions, effects, witnesses, confirmation = "click", extra = {}) {
  return {
    name,
    particles: { entities, conditions, effects, witnesses, confirmation },
    antagonist: extra.antagonist || null,
    creates: extra.creates || null,
    ...(extra.parameters !== undefined ? { parameters: extra.parameters } : {}),
    ...(extra.irreversibility ? { irreversibility: extra.irreversibility } : {}),
    ...(extra.extended ? { extended: true } : {}),
    ...(extra.phase ? { phase: extra.phase } : {}),
    ...(extra.salience !== undefined ? { salience: extra.salience } : {}),
  };
}

export const INTENTS = {

  // ===== ЦЕЛИ (10) =====

  create_goal: intent("Создать цель", ["goal: Goal"],
    [], [ef("add", "goals")],
    ["goal.title", "goal.description", "goal.sphereId", "goal.deadline"],
    "form", { creates: "Goal(active)" }),

  edit_goal: intent("Редактировать цель", ["goal: Goal"],
    ["goal.userId = me.id"],
    [ef("replace", "goal.title"), ef("replace", "goal.description"), ef("replace", "goal.deadline")],
    ["goal.title", "goal.description", "goal.deadline"],
    "form", { salience: "primary" }),

  update_goal_progress: intent("Обновить прогресс", ["goal: Goal"],
    ["goal.status = 'active'", "goal.userId = me.id"],
    [ef("replace", "goal.progress")],
    ["goal.progress"],
    "click", { salience: "primary" }),

  complete_goal: intent("Завершить цель", ["goal: Goal"],
    ["goal.status = 'active'", "goal.userId = me.id"],
    [ef("replace", "goal.status", "account", { value: "completed" })],
    [],
    "click"),

  abandon_goal: intent("Отказаться от цели", ["goal: Goal"],
    ["goal.status = 'active'", "goal.userId = me.id"],
    [ef("replace", "goal.status", "account", { value: "abandoned" })],
    [],
    "click", { irreversibility: "medium", antagonist: "reactivate_goal" }),

  reactivate_goal: intent("Возобновить цель", ["goal: Goal"],
    ["goal.status = 'abandoned'", "goal.userId = me.id"],
    [ef("replace", "goal.status", "account", { value: "active" })],
    [],
    "click", { antagonist: "abandon_goal" }),

  delete_goal: intent("Удалить цель", ["goal: Goal"],
    ["goal.userId = me.id"],
    [ef("remove", "goals")],
    [],
    "click", { irreversibility: "medium" }),

  move_goal_sphere: intent("Перенести в сферу", ["goal: Goal"],
    ["goal.userId = me.id"],
    [ef("replace", "goal.sphereId")],
    ["goal.sphereId"],
    "click"),

  set_goal_deadline: intent("Установить дедлайн", ["goal: Goal"],
    ["goal.userId = me.id"],
    [ef("replace", "goal.deadline")],
    ["goal.deadline"],
    "click"),

  add_goal_note: intent("Добавить заметку", ["goal: Goal"],
    ["goal.userId = me.id"],
    [ef("replace", "goal.description")],
    ["goal.description"],
    "form"),

  // ===== ПРИВЫЧКИ (12) =====

  create_habit: intent("Создать привычку", ["habit: Habit"],
    [], [ef("add", "habits")],
    ["habit.title", "habit.sphereId", "habit.type", "habit.targetValue", "habit.unit", "habit.frequency"],
    "form", { creates: "Habit(active)" }),

  edit_habit: intent("Редактировать привычку", ["habit: Habit"],
    ["habit.userId = me.id"],
    [ef("replace", "habit.title"), ef("replace", "habit.targetValue"), ef("replace", "habit.unit"), ef("replace", "habit.frequency")],
    ["habit.title", "habit.targetValue", "habit.unit", "habit.frequency"],
    "form", { salience: "primary" }),

  delete_habit: intent("Удалить привычку", ["habit: Habit"],
    ["habit.userId = me.id"],
    [ef("remove", "habits")],
    [],
    "click", { irreversibility: "medium" }),

  check_habit: intent("Отметить привычку", ["habit: Habit"],
    ["habit.status = 'active'"],
    [ef("add", "habitLogs")],
    ["habit.id"],
    "click", { salience: "primary" }),

  uncheck_habit: intent("Снять отметку", ["habitLog: HabitLog"],
    ["habitLog.userId = me.id"],
    [ef("replace", "habitLog.done", "account", { value: false })],
    [],
    "click"),

  log_habit_value: intent("Записать значение", ["habit: Habit", "log: HabitLog"],
    ["habit.type = 'quantitative'", "habit.status = 'active'"],
    [ef("add", "habitLogs")],
    ["habit.id", "log.value"],
    "click"),

  pause_habit: intent("Приостановить", ["habit: Habit"],
    ["habit.status = 'active'", "habit.userId = me.id"],
    [ef("replace", "habit.status", "account", { value: "paused" })],
    [],
    "click", { antagonist: "resume_habit" }),

  resume_habit: intent("Возобновить", ["habit: Habit"],
    ["habit.status = 'paused'", "habit.userId = me.id"],
    [ef("replace", "habit.status", "account", { value: "active" })],
    [],
    "click", { antagonist: "pause_habit" }),

  reset_streak: intent("Сбросить серию", ["habit: Habit"],
    ["habit.userId = me.id"],
    [ef("replace", "habit.streakCurrent", "account", { value: 0 })],
    [],
    "click"),

  change_habit_frequency: intent("Изменить частоту", ["habit: Habit"],
    ["habit.userId = me.id"],
    [ef("replace", "habit.frequency")],
    ["habit.frequency"],
    "click"),

  move_habit_sphere: intent("Перенести в сферу", ["habit: Habit"],
    ["habit.userId = me.id"],
    [ef("replace", "habit.sphereId")],
    ["habit.sphereId"],
    "click"),

  archive_habit: intent("Архивировать", ["habit: Habit"],
    ["habit.userId = me.id", "habit.status != 'archived'"],
    [ef("replace", "habit.status", "account", { value: "archived" })],
    [],
    "click", { irreversibility: "medium" }),

  // ===== ЗАДАЧИ (8) =====

  create_task: intent("Создать задачу", ["task: Task"],
    [], [ef("add", "tasks")],
    ["task.title", "task.date"],
    "enter", { creates: "Task" }),

  complete_task: intent("Выполнить задачу", ["task: Task"],
    ["task.done = false", "task.userId = me.id"],
    [ef("replace", "task.done", "account", { value: true })],
    [],
    "click", { antagonist: "uncomplete_task" }),

  uncomplete_task: intent("Вернуть задачу", ["task: Task"],
    ["task.done = true", "task.userId = me.id"],
    [ef("replace", "task.done", "account", { value: false })],
    [],
    "click", { antagonist: "complete_task" }),

  delete_task: intent("Удалить задачу", ["task: Task"],
    ["task.userId = me.id"],
    [ef("remove", "tasks")],
    [],
    "click", { irreversibility: "medium" }),

  edit_task: intent("Редактировать задачу", ["task: Task"],
    ["task.userId = me.id"],
    [ef("replace", "task.title")],
    ["task.title"],
    "form"),

  move_task_date: intent("Перенести на другой день", ["task: Task"],
    ["task.userId = me.id"],
    [ef("replace", "task.date")],
    ["task.date"],
    "click"),

  link_task_goal: intent("Привязать к цели", ["task: Task"],
    ["task.userId = me.id"],
    [ef("replace", "task.goalId")],
    ["task.goalId"],
    "click"),

  toggle_task_priority: intent("Переключить приоритет", ["task: Task"],
    ["task.userId = me.id"],
    [ef("replace", "task.priority")],
    ["task.priority"],
    "click"),

  // ===== ТОЧКА А — ОЦЕНКА СФЕР (5) =====

  assess_sphere: intent("Оценить сферу", ["assessment: SphereAssessment"],
    [], [ef("add", "sphereAssessments")],
    ["assessment.sphereId", "assessment.score", "assessment.description"],
    "form", { creates: "SphereAssessment" }),

  update_assessment: intent("Обновить оценку", ["assessment: SphereAssessment"],
    ["assessment.userId = me.id"],
    [ef("replace", "assessment.score"), ef("replace", "assessment.description")],
    ["assessment.score", "assessment.description"],
    "form"),

  reassess_all: intent("Пересмотреть все сферы", [],
    [], [ef("add", "sphereAssessments")],
    [],
    "click", { extended: true, system: true }),

  set_sphere_target: intent("Установить цель сферы", ["assessment: SphereAssessment"],
    ["assessment.userId = me.id"],
    [ef("replace", "assessment.targetScore")],
    ["targetScore"],
    "click"),

  add_sphere_note: intent("Заметка к сфере", ["assessment: SphereAssessment"],
    ["assessment.userId = me.id"],
    [ef("replace", "assessment.description")],
    ["description"],
    "form"),

  // ===== ДОСКА ВИЗУАЛИЗАЦИИ (8) =====

  add_vision_image: intent("Добавить картинку", ["visionItem: VisionItem"],
    [], [ef("add", "visionItems")],
    ["sphereId", "caption"],
    "file", { creates: "VisionItem" }),

  move_vision_item: intent("Переместить", ["visionItem: VisionItem"],
    ["visionItem.userId = me.id"],
    [ef("replace", "visionItem.x"), ef("replace", "visionItem.y")],
    ["x", "y"],
    "click", { phase: "presentation" }),

  resize_vision_item: intent("Изменить размер", ["visionItem: VisionItem"],
    ["visionItem.userId = me.id"],
    [ef("replace", "visionItem.width"), ef("replace", "visionItem.height")],
    ["width", "height"],
    "click", { phase: "presentation" }),

  edit_vision_caption: intent("Изменить подпись", ["visionItem: VisionItem"],
    ["visionItem.userId = me.id"],
    [ef("replace", "visionItem.caption")],
    ["caption"],
    "form"),

  delete_vision_item: intent("Удалить картинку", ["visionItem: VisionItem"],
    ["visionItem.userId = me.id"],
    [ef("remove", "visionItems")],
    [],
    "click", { irreversibility: "medium" }),

  upload_vision_image: intent("Загрузить картинку", ["visionItem: VisionItem"],
    ["visionItem.userId = me.id"],
    [ef("replace", "visionItem.imageUrl")],
    ["imageUrl"],
    "file"),

  replace_vision_image: intent("Заменить картинку", ["visionItem: VisionItem"],
    ["visionItem.userId = me.id"],
    [ef("replace", "visionItem.imageUrl")],
    ["imageUrl"],
    "file"),

  clear_sphere_vision: intent("Очистить коллаж сферы", ["visionItem: VisionItem"],
    ["visionItem.userId = me.id"],
    [ef("remove", "visionItems")],
    [],
    "click", { irreversibility: "medium" }),

  // ===== ЦИТАТА (4) =====

  set_quote: intent("Установить цитату", ["quote: Quote"],
    [], [ef("add", "quotes")],
    ["text", "author"],
    "form", { creates: "Quote" }),

  edit_quote: intent("Редактировать цитату", ["quote: Quote"],
    ["quote.userId = me.id"],
    [ef("replace", "quote.text"), ef("replace", "quote.author")],
    ["quote.text", "quote.author"],
    "form"),

  random_quote: intent("Случайная цитата", [],
    [], [ef("add", "quotes")],
    [],
    "click", { system: true }),

  clear_quote: intent("Убрать цитату", ["quote: Quote"],
    ["quote.userId = me.id"],
    [ef("remove", "quotes")],
    [],
    "click", { irreversibility: "low" }),

  // ===== ГЕЙМИФИКАЦИЯ (4, auto) =====

  earn_xp: intent("Начислить XP", ["user: User"],
    [], [ef("replace", "user.xp")],
    ["xp"],
    "auto"),

  earn_badge: intent("Получить бейдж", ["badge: Badge"],
    [], [ef("add", "badges")],
    ["badgeId"],
    "auto"),

  update_streak: intent("Обновить серию", ["habit: Habit"],
    [], [ef("replace", "habit.streakCurrent")],
    ["streakCurrent"],
    "auto"),

  level_up: intent("Повысить уровень", ["user: User"],
    [], [ef("replace", "user.level")],
    ["level"],
    "auto"),

  // ===== ПРОФИЛЬ (5) =====

  update_profile: intent("Обновить профиль", ["user: User"],
    ["user.id = me.id"],
    [ef("replace", "user.name")],
    ["name"],
    "form", { salience: "primary" }),

  set_avatar: intent("Установить аватар", ["user: User"],
    ["user.id = me.id"],
    [ef("replace", "user.avatar")],
    ["avatar"],
    "file"),

  export_data: intent("Экспорт данных", [],
    [], [],
    [],
    "click"),

  reset_progress: intent("Сбросить прогресс", ["user: User"],
    ["user.id = me.id"],
    [ef("replace", "user.xp", "account", { value: 0 }), ef("replace", "user.level", "account", { value: 1 })],
    [],
    "click", { irreversibility: "high" }),

  delete_account: intent("Удалить аккаунт", ["user: User"],
    ["user.id = me.id"],
    [ef("remove", "users")],
    [],
    "click", { irreversibility: "high" }),
};
