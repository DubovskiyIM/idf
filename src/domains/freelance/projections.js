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
    onItemClick: {
      action: "navigate",
      to: "task_detail_public",
      params: { taskId: "item.id" },
    },
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

  my_tasks: {
    name: "Мои задачи",
    kind: "catalog",
    mainEntity: "Task",
    entities: ["Task"],
    filter: "item.customerId === viewer.id",
    sort: "createdAt:desc",
    witnesses: ["title", "status", "budget", "deadline", "responsesCount"],
    onItemClick: {
      action: "navigate",
      to: "task_detail_customer",
      params: { taskId: "item.id" },
    },
  },

  my_deals: {
    name: "Мои сделки",
    kind: "catalog",
    mainEntity: "Deal",
    entities: ["Deal", "Task"],
    filter: "item.customerId === viewer.id || item.executorId === viewer.id",
    sort: "createdAt:desc",
    witnesses: ["taskId", "amount", "status", "deadline"],
    onItemClick: {
      action: "navigate",
      to: "deal_detail_customer",
      params: { dealId: "item.id" },
    },
  },

  task_detail_customer: {
    name: "Задача (автор)",
    kind: "detail",
    mainEntity: "Task",
    entities: ["Task", "Response", "Category"],
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
        addable: false,
      },
    ],
    toolbar: ["edit_task", "publish_task", "cancel_task_before_deal", "select_executor"],
  },

  deal_detail_customer: {
    name: "Сделка (заказчик)",
    kind: "detail",
    mainEntity: "Deal",
    entities: ["Deal", "Transaction", "Task", "ExecutorProfile"],
    idParam: "dealId",
    witnesses: ["amount", "commission", "status", "deadline", "completedAt"],
    subCollections: [
      {
        entity: "Transaction",
        foreignKey: "dealId",
        title: "Операции",
        addable: false,
      },
    ],
    toolbar: ["accept_result", "request_revision", "cancel_deal_mutual"],
  },

  deal_detail_executor: {
    name: "Сделка (исполнитель)",
    kind: "detail",
    mainEntity: "Deal",
    entities: ["Deal", "Transaction", "Task"],
    idParam: "dealId",
    witnesses: ["amount", "status", "deadline", "completedAt"],
    subCollections: [
      {
        entity: "Transaction",
        foreignKey: "dealId",
        title: "Операции",
        addable: false,
      },
    ],
    toolbar: ["submit_work_result", "submit_revision", "cancel_deal_mutual"],
  },

  wallet: {
    name: "Кошелёк",
    kind: "detail",
    mainEntity: "Wallet",
    entities: ["Wallet", "Transaction"],
    filter: "item.userId === viewer.id",
    witnesses: ["balance", "reserved", "currency"],
    subCollections: [
      {
        entity: "Transaction",
        foreignKey: "walletId",
        title: "История операций",
        addable: false,
      },
    ],
    toolbar: ["top_up_wallet_by_card", "view_transaction_history"],
  },

  create_task_wizard: {
    name: "Опубликовать задачу",
    kind: "wizard",
    mainEntity: "Task",
    steps: [
      {
        id: "category",
        label: "Категория",
        intent: "filter_by_category",
        pick: ["categoryId"],
        source: { collection: "categories" },
        display: ["name", "slug"],
      },
      {
        id: "confirm",
        label: "Подтверждение",
        intent: "create_task_draft",
        summary: true,
      },
    ],
  },

};

export const ROOT_PROJECTIONS = [
  "task_catalog_public",
  "create_task_wizard",
  "my_tasks",
  "my_deals",
  "wallet",
];
