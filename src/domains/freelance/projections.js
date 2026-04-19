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
    // Guests / executor видят только опубликованные НЕ свои (универсальный
    // пользователь в роли executor'а не должен видеть свои задачи) и без
    // selected-отклика (customer уже выбрал исполнителя — новые отклики
    // не нужны; task факт-но out of market, пока не cancel/complete).
    filter: "item.status === 'published' && item.customerId !== viewer.id && !(world.responses || []).some(r => r.taskId === item.id && r.status === 'selected')",
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
    witnesses: ["amount", "commission", "status", "deadline", "completedAt", "result", "links", "revisionComment"],
    subCollections: [
      {
        entity: "Transaction",
        foreignKey: "dealId",
        title: "Операции",
        addable: false,
      },
    ],
    toolbar: ["accept_result", "request_revision", "cancel_deal_mutual"],
    // SDK footer-inline-setter-pattern матчит single-replace-effect intents
    // и переносит их из toolbar в footer как inline-setter'ы. Для наших
    // accept/request_revision/submit_work_result это неверно — там textarea-
    // параметры + confirm-dialog нужны. Отключаем на deal-детали.
    patterns: { disabled: ["footer-inline-setter"] },
  },

  deal_detail_executor: {
    name: "Сделка (исполнитель)",
    kind: "detail",
    mainEntity: "Deal",
    entities: ["Deal", "Transaction", "Task"],
    idParam: "dealId",
    witnesses: ["amount", "status", "deadline", "completedAt", "result", "links", "revisionComment"],
    subCollections: [
      {
        entity: "Transaction",
        foreignKey: "dealId",
        title: "Операции",
        addable: false,
      },
    ],
    toolbar: ["submit_work_result", "submit_revision", "cancel_deal_mutual"],
    patterns: { disabled: ["footer-inline-setter"] },
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

  my_responses: {
    name: "Мои отклики",
    kind: "catalog",
    mainEntity: "Response",
    entities: ["Response", "Task"],
    filter: "item.executorId === viewer.id",
    sort: "createdAt:desc",
    witnesses: ["taskId", "price", "deliveryDays", "status", "createdAt"],
    onItemClick: {
      action: "navigate",
      to: "task_detail_public",
      params: { taskId: "item.taskId" },
    },
  },

};

export const ROOT_PROJECTIONS = [
  "task_catalog_public",
  "my_tasks",
  "my_responses",
  "my_deals",
  "wallet",
];
