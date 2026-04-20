/**
 * Freelance projections — authored overrides поверх derived.
 *
 * Derived SDK-правилами (V2Shell merge { ...derived, ...authored }):
 *   R7  → my_task_list / my_response_list (customerId / executorId filter)
 *   R7b → my_deal_list (multi-owner disjunction customerId||executorId)
 *   R3b → my_wallet_detail (singleton + userId filter)
 *   R3  → task_detail / deal_detail (detail из mutators)
 *   R4  → subCollections по FK-графу
 *   R6  → witnesses как union intent.particles.witnesses
 *
 * Авторские overrides ниже — только поля, где derivation недостаточна:
 *  - display witnesses списков (R6 подмешивает intent-параметры типа
 *    comment/reason/result, не подходящие для list-view);
 *  - навигация onItemClick в role-specific detail (deal_detail_customer);
 *  - ROOT market-filter (task_catalog_public): exclude-self +
 *    exclude-already-selected — не derivable.
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

  // ─── ROOT my_* lists — field-level overrides поверх derived R7/R7b/R3b ───

  my_task_list: {
    witnesses: ["title", "status", "budget", "deadline", "responsesCount"],
    onItemClick: {
      action: "navigate",
      to: "task_detail_customer",
      params: { taskId: "item.id" },
    },
  },

  my_response_list: {
    witnesses: ["taskId", "price", "deliveryDays", "status", "createdAt"],
    onItemClick: {
      action: "navigate",
      to: "task_detail_public",
      params: { taskId: "item.taskId" },
    },
  },

  my_deal_list: {
    witnesses: ["taskId", "amount", "status", "deadline"],
    onItemClick: {
      action: "navigate",
      to: "deal_detail_customer",
      params: { dealId: "item.id" },
    },
  },

  my_wallet_detail: {
    witnesses: ["balance", "reserved", "currency"],
    toolbar: ["top_up_wallet_by_card", "view_transaction_history"],
  },

  // ─── Role-specific detail overrides — toolbar whitelist ───
  // TODO (Stage 2): добавить intent.permittedFor: "customerId" | "executorId"
  // на deal-phase-transitions (accept_result, request_revision,
  // submit_work_result, submit_revision) → derived deal_detail даст per-role
  // toolbar автоматически, эти wrapper'ы можно удалить.

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

};

export const ROOT_PROJECTIONS = [
  "task_catalog_public",
  "my_task_list",
  "my_response_list",
  "my_deal_list",
  "my_wallet_detail",
];
