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
 *  - навигация onItemClick в derived detail (task_detail / deal_detail);
 *  - ROOT market-filter (task_catalog_public): exclude-self +
 *    exclude-already-selected — не derivable.
 *
 * Role-specific wrapper'ы deal_detail_customer/_executor удалены после
 * добавления intent.permittedFor на deal phase-transitions — derived
 * deal_detail фильтрует toolbar per-role автоматически.
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
      to: "deal_detail",
      params: { dealId: "item.id" },
    },
  },

  my_wallet_detail: {
    witnesses: ["balance", "reserved", "currency"],
    toolbar: ["top_up_wallet_by_card", "view_transaction_history"],
  },

  // ─── Field-level override на derived deal_detail ───
  // Role-specific wrapper'ы (deal_detail_customer/_executor) удалены: single
  // derived deal_detail с per-intent permittedFor фильтрует toolbar по роли
  // автоматически. Authored override добавляет display-witnesses (R6 union
  // подмешивает phase-params comment/reason/result, не подходящие для detail)
  // + disables footer-inline-setter-pattern (textarea-setter скрыл бы
  // request_revision из toolbar).

  deal_detail: {
    witnesses: ["amount", "commission", "status", "deadline", "completedAt", "result", "links", "revisionComment"],
    patterns: { disabled: ["footer-inline-setter"] },
  },

  // Task-detail для customer'а с пользовательским toolbar whitelist.
  // Не консолидируем с derived task_detail: authored toolbar жёстко задаёт
  // порядок edit_task/publish_task/cancel/select_executor + в derived
  // task_detail R6 union witnesses содержит price/deliveryDays из
  // submit_response (не нужны customer'у).
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

};

export const ROOT_PROJECTIONS = [
  "task_catalog_public",
  "my_task_list",
  "my_response_list",
  "my_deal_list",
  "my_wallet_detail",
];
