export const INTENTS = {
  add_task: {
    name: "Добавить задачу", particles: {
      entities: ["task: Task"], conditions: [],
      effects: [{ α: "add", target: "tasks", σ: "account" }],
      witnesses: ["tasks.count"], confirmation: "click"
    }, antagonist: null, creates: "Task"
  },
  complete_task: {
    name: "Завершить задачу", particles: {
      entities: ["task: Task"], conditions: ["task.status = 'pending'"],
      effects: [{ α: "replace", target: "task.status", value: "completed", σ: "account" }],
      witnesses: ["task.title"], confirmation: "click"
    }, antagonist: "uncomplete_task", creates: null
  },
  uncomplete_task: {
    name: "Вернуть в работу", particles: {
      entities: ["task: Task"], conditions: ["task.status = 'completed'"],
      effects: [{ α: "replace", target: "task.status", value: "pending", σ: "account" }],
      witnesses: ["task.title"], confirmation: "click"
    }, antagonist: "complete_task", creates: null
  },
  delete_task: {
    name: "Удалить задачу", particles: {
      entities: ["task: Task"], conditions: [],
      effects: [{ α: "remove", target: "tasks", σ: "account" }],
      witnesses: ["task.title"], confirmation: "click"
    }, antagonist: null, creates: null, irreversibility: "high"
  },
  edit_task: {
    name: "Переименовать", particles: {
      entities: ["task: Task"], conditions: [],
      effects: [{ α: "replace", target: "task.title", σ: "account" }],
      witnesses: ["task.title (текущее)"], confirmation: "click"
    }, antagonist: null, creates: null, phase: "investigation"
  },
  pin_task: {
    name: "Закрепить задачу", particles: {
      entities: ["task: Task"], conditions: ["task.pinned = false"],
      effects: [{ α: "replace", target: "task.pinned", value: true, σ: "account" }],
      witnesses: ["task.title"], confirmation: "click"
    }, antagonist: "unpin_task", creates: null
  },
  unpin_task: {
    name: "Открепить задачу", particles: {
      entities: ["task: Task"], conditions: ["task.pinned = true"],
      effects: [{ α: "replace", target: "task.pinned", value: false, σ: "account" }],
      witnesses: ["task.title"], confirmation: "click"
    }, antagonist: "pin_task", creates: null
  },
  set_priority: {
    name: "Установить приоритет", particles: {
      entities: ["task: Task"], conditions: [],
      effects: [{ α: "replace", target: "task.priority", σ: "account" }],
      witnesses: ["task.title", "task.priority (текущий)"], confirmation: "click"
    }, antagonist: null, creates: null, phase: "investigation"
  },
  duplicate_task: {
    name: "Дублировать задачу", particles: {
      entities: ["task: Task"], conditions: [],
      effects: [{ α: "add", target: "tasks", σ: "account" }],
      witnesses: ["task.title"], confirmation: "click"
    }, antagonist: null, creates: "Task"
  },
  archive_task: {
    name: "Архивировать задачу", particles: {
      entities: ["task: Task"], conditions: ["task.status = 'completed'"],
      effects: [{ α: "replace", target: "task.status", value: "archived", σ: "account" }],
      witnesses: ["task.title", "task.completedAt"], confirmation: "click"
    }, antagonist: null, creates: null, irreversibility: "medium"
  }
};
