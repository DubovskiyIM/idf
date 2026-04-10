export const PROJECTIONS = {
  task_list: { name: "Список задач", query: "все задачи, сортировка по дате", witnesses: ["title", "status", "createdAt"] },
  task_stats: { name: "Статистика", query: "количество по статусам", witnesses: ["pending.count", "completed.count"] }
};
