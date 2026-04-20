/**
 * Домен «Reflect» — дневник эмоций и гипотез.
 * 47 намерений в 8 категориях.
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

  // ===== ЧЕК-ИН (8) =====

  quick_checkin: intent("Быстрый чек-ин", ["entry: MoodEntry"],
    [], [ef("add", "moodEntries")],
    ["pleasantness", "energy"],
    "drag", { creates: "MoodEntry" }),

  detailed_checkin: intent("Подробный чек-ин", ["entry: MoodEntry"],
    [], [ef("add", "moodEntries")],
    ["pleasantness", "energy", "emotion", "note"],
    "form", { creates: "MoodEntry(detailed)" }),

  add_activity_to_entry: intent("Добавить активность", ["entry: MoodEntry", "activity: Activity"],
    ["entry.userId = me.id"],
    [ef("add", "entryActivities")],
    [],
    "click"),

  remove_activity_from_entry: intent("Убрать активность", ["link: EntryActivity"],
    ["link.userId = me.id"],
    [ef("remove", "entryActivities")],
    [],
    "click"),

  edit_entry_note: intent("Изменить заметку", ["entry: MoodEntry"],
    ["entry.userId = me.id"],
    [ef("replace", "moodEntry.note")],
    ["note"],
    "form", { salience: "primary" }),

  delete_entry: intent("Удалить запись", ["entry: MoodEntry"],
    ["entry.userId = me.id"],
    [ef("remove", "moodEntries")],
    [],
    "click", { irreversibility: "medium" }),

  duplicate_entry: intent("Повторить чек-ин", ["entry: MoodEntry"],
    ["entry.userId = me.id"],
    [],
    [],
    "click"),

  move_entry_time: intent("Изменить время", ["entry: MoodEntry"],
    ["entry.userId = me.id"],
    [ef("replace", "moodEntry.loggedAt")],
    ["loggedAt"],
    "form"),

  // ===== АКТИВНОСТИ (5) =====

  create_activity: intent("Создать активность", ["activity: Activity"],
    [], [ef("add", "activities")],
    ["name", "icon", "category"],
    "form", { creates: "Activity" }),

  edit_activity: intent("Редактировать активность", ["activity: Activity"],
    ["activity.userId = me.id"],
    [ef("replace", "activity.name"), ef("replace", "activity.icon"), ef("replace", "activity.category")],
    ["name", "icon", "category"],
    "form"),

  delete_activity: intent("Удалить активность", ["activity: Activity"],
    ["activity.userId = me.id"],
    [ef("remove", "activities")],
    [],
    "click", { irreversibility: "medium" }),

  merge_activities: intent("Объединить активности", ["source: Activity", "target: Activity"],
    ["source.userId = me.id", "target.userId = me.id"],
    [],
    [],
    "form"),

  archive_activity: intent("Архивировать", ["activity: Activity"],
    ["activity.userId = me.id"],
    [ef("replace", "activity.archived", "account", { value: true })],
    [],
    "click"),

  // ===== ГИПОТЕЗЫ (8) =====

  propose_hypothesis: intent("Предложить гипотезу", ["hypothesis: Hypothesis"],
    [], [ef("add", "hypotheses")],
    ["title", "whenActivity", "expectedEffect"],
    "form", { creates: "Hypothesis(testing)" }),

  start_testing: intent("Начать тестирование", ["hypothesis: Hypothesis"],
    ["hypothesis.userId = me.id"],
    [ef("replace", "hypothesis.status", "account", { value: "testing" })],
    [],
    "click"),

  confirm_hypothesis: intent("Подтвердить", ["hypothesis: Hypothesis"],
    ["hypothesis.userId = me.id"],
    [ef("replace", "hypothesis.status", "account", { value: "confirmed" })],
    [],
    "click"),

  reject_hypothesis: intent("Опровергнуть", ["hypothesis: Hypothesis"],
    ["hypothesis.userId = me.id"],
    [ef("replace", "hypothesis.status", "account", { value: "rejected" })],
    [],
    "click"),

  archive_hypothesis: intent("Архивировать", ["hypothesis: Hypothesis"],
    ["hypothesis.userId = me.id"],
    [ef("replace", "hypothesis.status", "account", { value: "archived" })],
    [],
    "click"),

  delete_hypothesis: intent("Удалить", ["hypothesis: Hypothesis"],
    ["hypothesis.userId = me.id"],
    [ef("remove", "hypotheses")],
    [],
    "click", { irreversibility: "medium" }),

  edit_hypothesis: intent("Редактировать", ["hypothesis: Hypothesis"],
    ["hypothesis.userId = me.id"],
    [ef("replace", "hypothesis.title"), ef("replace", "hypothesis.whenActivity"), ef("replace", "hypothesis.expectedEffect")],
    ["title", "whenActivity", "expectedEffect"],
    "form"),

  auto_resolve_hypothesis: intent("Автозакрытие гипотезы", ["hypothesis: Hypothesis"],
    [],
    [],
    [],
    "auto"),

  // ===== TAGS (6) =====

  create_tag: intent("Создать тег", ["tag: Tag"],
    [], [ef("add", "tags")],
    ["name", "color"],
    "form", { creates: "Tag" }),

  edit_tag: intent("Редактировать тег", ["tag: Tag"],
    ["tag.userId = me.id"],
    [ef("replace", "tag.name"), ef("replace", "tag.color")],
    ["name", "color"],
    "form"),

  delete_tag: intent("Удалить тег", ["tag: Tag"],
    ["tag.userId = me.id"],
    [ef("remove", "tags")],
    [],
    "click"),

  add_tag_to_entry: intent("Прикрепить тег", ["entry: MoodEntry", "tag: Tag"],
    ["entry.userId = me.id"],
    [ef("add", "entryTags")],
    [],
    "click", { salience: "primary" }),

  remove_tag_from_entry: intent("Открепить тег", ["link: EntryTag"],
    ["link.userId = me.id"],
    [ef("remove", "entryTags")],
    [],
    "click"),

  merge_tags: intent("Объединить теги", ["source: Tag", "target: Tag"],
    ["source.userId = me.id", "target.userId = me.id"],
    [],
    [],
    "form"),

  // ===== REMINDERS (4) =====

  create_reminder: intent("Создать напоминание", ["reminder: Reminder"],
    [], [ef("add", "reminders")],
    ["text", "triggerKind"],
    "form", { creates: "Reminder" }),

  edit_reminder: intent("Редактировать", ["reminder: Reminder"],
    ["reminder.userId = me.id"],
    [ef("replace", "reminder.text")],
    ["text"],
    "form"),

  toggle_reminder: intent("Переключить", ["reminder: Reminder"],
    ["reminder.userId = me.id"],
    [ef("replace", "reminder.active")],
    [],
    "click"),

  delete_reminder: intent("Удалить", ["reminder: Reminder"],
    ["reminder.userId = me.id"],
    [ef("remove", "reminders")],
    [],
    "click"),

  // ===== INSIGHTS (3) =====

  mark_insight_seen: intent("Отметить как прочитанный", ["insight: Insight"],
    ["insight.userId = me.id"],
    [ef("replace", "insight.seenAt")],
    [],
    "click"),

  dismiss_insight: intent("Скрыть", ["insight: Insight"],
    ["insight.userId = me.id"],
    [ef("remove", "insights")],
    [],
    "click"),

  pin_insight: intent("Закрепить", ["insight: Insight"],
    ["insight.userId = me.id"],
    [ef("replace", "insight.pinned", "account", { value: true })],
    [],
    "click"),

  // ===== AUTO через rules (8) =====

  compute_correlation: intent("Пересчёт корреляций", [],
    [], [], [], "auto"),

  detect_pattern: intent("Поиск паттернов", [],
    [], [], [], "auto"),

  generate_insight: intent("Создать открытие", ["insight: Insight"],
    [], [ef("add", "insights")], [], "auto", { creates: "Insight" }),

  update_streak: intent("Обновить серию", [],
    [], [], [], "auto"),

  evaluate_hypothesis: intent("Проверить гипотезу", ["hypothesis: Hypothesis"],
    [], [], [], "auto"),

  award_milestone: intent("Майлстоун", ["insight: Insight"],
    [], [ef("add", "insights")], [], "auto", { creates: "Insight(milestone)" }),

  weekly_summary: intent("Итоги недели", [],
    [], [], [], "auto"),

  mood_drift_alert: intent("Сигнал дрейфа", ["insight: Insight"],
    [], [ef("add", "insights")], [], "auto", { creates: "Insight(drift_alert)" }),

  // ===== ПРОФИЛЬ (5) =====

  update_profile: intent("Обновить профиль", ["user: User"],
    ["user.id = me.id"],
    [ef("replace", "user.name")],
    ["name"],
    "form"),

  set_avatar: intent("Установить аватар", ["user: User"],
    ["user.id = me.id"],
    [ef("replace", "user.avatar")],
    ["avatar"],
    "file"),

  export_data: intent("Экспорт данных", [],
    [], [], [], "click"),

  reset_progress: intent("Сбросить прогресс", [],
    [], [], [], "click", { irreversibility: "high" }),

  delete_account: intent("Удалить аккаунт", ["user: User"],
    ["user.id = me.id"],
    [], [], "click", { irreversibility: "high" }),

};
