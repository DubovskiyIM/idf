/**
 * Freelance projections — 3 проекции в Cycle 1:
 *   task_catalog_public (guest/executor) — публичный каталог задач
 *   task_detail_public (guest/executor/customer) — деталка задачи
 *   create_task_wizard (customer) — wizard создания задачи
 * Остальные (my_tasks, wallet, deal_detail, etc.) — Cycle 2-4.
 */
export const PROJECTIONS = {

  task_catalog_public: {
    name: "Каталог задач",
    kind: "catalog",
    mainEntity: "Task",
    entities: ["Task", "Category"],
    filter: "item.status === 'published'",
    sort: "createdAt:desc",
    witnesses: ["title", "budget", "deadline", "city", "categoryId", "type"],
    clickNavigate: "task_detail_public",
    layout: "grid",
  },

  task_detail_public: {
    name: "Задача",
    kind: "detail",
    mainEntity: "Task",
    entities: ["Task", "Response", "Category", "CustomerProfile"],
    idParam: "taskId",
    witnesses: [
      "title", "description", "budget", "deadline", "city", "type",
      "categoryId", "responsesCount", "status", "createdAt",
    ],
    subCollections: [
      {
        entity: "Response",
        foreignKey: "taskId",
        title: "Отклики",
        addable: true,
        addIntent: "submit_response",
      },
    ],
  },

};

export const ROOT_PROJECTIONS = ["task_catalog_public"];
