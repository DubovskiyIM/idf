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
 *    exclude-already-selected — не derivable;
 *  - toolbar whitelist на task_detail / deal_detail: принуждает phase-
 *    transition intents в toolbar (минуя primaryCTA / footer-inline-setter
 *    routing) — core@0.34.0+ Stage 5.
 *
 * Role-specific wrapper'ы (task_detail_public/_customer,
 * deal_detail_customer/_executor) удалены: single derived detail
 * с per-intent condition'ами (permittedFor + ownership) фильтрует
 * toolbar per-role автоматически.
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
      to: "task_detail",
      params: { taskId: "item.id" },
    },
    // UI-gap #8: rich empty-state — когда нет подходящих задач.
    emptyState: {
      title: "Нет подходящих задач",
      hint: "Попробуйте поменять фильтр или зайти позже — новые задания появляются каждую минуту.",
      icon: "📋",
    },
    // UI-gap #6: onboarding prerequisites — шаги до разблокировки для executor'а.
    gating: {
      title: "Необходимые шаги для доступа к заданиям",
      steps: [
        { id: "registration", label: "Регистрация", icon: "👤",
          done: "viewer.id !== null && viewer.id !== undefined" },
        { id: "verification", label: "Обязательное тестирование", icon: "📝",
          done: "viewer.executorVerified === true",
          cta: { label: "Пройти", intentId: "submit_response" } },
      ],
    },
    // UI-gap #2 + #5: sidebar — hero-carousel сверху + tutorial / promo /
    // examples. SDK slots.hero зарезервирован под heroCreate intent archetype,
    // авторский hero-node не рендерится — кладём carousel в начало sidebar.
    sidebar: [
      {
        type: "carousel",
        slides: [
          { eyebrow: "Наши преимущества", title: "Новое задание каждые 28 секунд",
            subtitle: "Исполнители подключаются моментально" },
          { eyebrow: "Безопасность", title: "Escrow на сумму сделки",
            subtitle: "Платёж замораживается до приёмки работы" },
          { eyebrow: "Тысячи задач", title: "Разные категории — от быта до IT" },
        ],
        intervalMs: 5000,
        height: 120,
      },
      {
        type: "card",
        children: [
          { type: "heading", content: "Как поручить задание?" },
          { type: "text", style: "muted",
            content: "Опишите задачу, выберите категорию, укажите бюджет — мы подберём подходящего исполнителя." },
        ],
      },
      {
        type: "card",
        children: [
          { type: "heading", content: "Подарите другу" },
          { type: "text", style: "muted", content: "И себе по 100 ₽ за первое задание." },
        ],
      },
      {
        type: "column",
        children: [
          { type: "heading", content: "Примеры заданий", size: "sm" },
          { type: "text", content: "Расчистить балкон — 3500 ₽, Москва" },
          { type: "text", content: "Заехать в магазин спортивного — 1200 ₽, Москва" },
          { type: "text", content: "Перевести 5 страниц RU→EN — 2000 ₽" },
        ],
      },
    ],
  },

  // ─── ROOT my_* lists — field-level overrides поверх derived R7/R7b/R3b ───

  my_task_list: {
    // Role-aware (§4.9): «Мои задания» — проекция customer'а (создатель задач).
    // У executor'а задач нет — tab-bar скрывает.
    forRoles: ["customer"],
    witnesses: ["title", "status", "budget", "deadline", "responsesCount"],
    onItemClick: {
      action: "navigate",
      to: "task_detail",
      params: { taskId: "item.id" },
    },
    // UI-gap #1: filter-tabs (workzilla «+ Новое / Открытые / История»).
    tabs: [
      { id: "draft",    label: "+ Новое",  filter: "item.status === 'draft'" },
      { id: "open",     label: "Открытые", filter: "item.status === 'published'" },
      { id: "history",  label: "История",
        filter: "item.status === 'closed' || item.status === 'completed'" },
    ],
    defaultTab: "open",
    // UI-gap #8: пустое состояние «У вас пока нет заданий» с CTA.
    emptyState: {
      title: "У вас пока нет заданий",
      hint: "Ваши открытые задания появятся здесь",
      icon: "📋",
      cta: { label: "Дать задание", intentId: "create_task_draft" },
    },
  },

  my_response_list: {
    // Role-aware (§4.9): отклики — только executor flow. Customer видит отклики
    // на свои задачи inline в task_detail, отдельный tab избыточен.
    forRoles: ["executor"],
    witnesses: ["taskId", "price", "deliveryDays", "status", "createdAt"],
    onItemClick: {
      action: "navigate",
      to: "task_detail",
      params: { taskId: "item.taskId" },
    },
    tabs: [
      { id: "active",  label: "Активные",  filter: "item.status === 'pending'" },
      { id: "won",     label: "Выбраны",   filter: "item.status === 'selected'" },
      { id: "history", label: "История",
        filter: "item.status === 'withdrawn' || item.status === 'not_chosen'" },
    ],
    defaultTab: "active",
    emptyState: {
      title: "Нет откликов",
      hint: "Откликайтесь на задания в каталоге — они появятся здесь.",
      icon: "💬",
    },
  },

  my_deal_list: {
    witnesses: ["taskId", "amount", "status", "deadline"],
    onItemClick: {
      action: "navigate",
      to: "deal_detail",
      params: { dealId: "item.id" },
    },
    tabs: [
      { id: "active", label: "Активные",
        filter: "item.status === 'in_progress' || item.status === 'on_review' || item.status === 'revision_requested'" },
      { id: "done",   label: "Завершённые", filter: "item.status === 'completed'" },
      { id: "cancel", label: "Отменённые",  filter: "item.status === 'cancelled'" },
    ],
    defaultTab: "active",
    emptyState: {
      title: "Сделок пока нет",
      hint: "Подтверждённые сделки появляются после выбора исполнителя.",
      icon: "🤝",
    },
  },

  my_wallet_detail: {
    witnesses: ["balance", "reserved", "currency"],
    toolbar: ["top_up_wallet_by_card", "view_transaction_history"],
  },

  // ─── Field-level overrides на derived detail'ях ───

  // task_detail: единый для customer / guest / executor. Per-intent
  // ownership condition (task.customerId = me.id) фильтрует edit/publish/
  // cancel для customer'а. submit_response (в subCollection Response)
  // активен для executor'а и guest'а — customer-exclude guard на
  // intent-level.
  //
  // toolbar whitelist (core@0.34.0+, SDK #102): принуждает Task
  // phase-transitions в toolbar, минуя primaryCTA routing (phase-
  // transition без params → обычно в primaryCTA). До whitelist
  // single-replace intents без inline-capable параметров уходили
  // в footer через footer-inline-setter pattern.
  //
  // select_executor — per-item на Response в subCollection Response
  // (не в toolbar parent'а), но в whitelist как nominal — SDK
  // игнорирует intents которые applicable только к sub-entity.
  task_detail: {
    witnesses: [
      "title", "description", "budget", "deadline", "city", "type",
      "categoryId", "responsesCount", "status", "createdAt",
    ],
    toolbar: ["edit_task", "publish_task", "cancel_task_before_deal"],
  },

  // deal_detail: single projection с per-intent permittedFor фильтрует
  // toolbar по роли (accept_result/request_revision → customer,
  // submit_work_result/submit_revision → executor, cancel_deal_mutual —
  // both).
  //
  // toolbar whitelist: принуждает phase-transitions в toolbar
  // (accept_result с irreversibility:"high" + confirmation:"click" —
  // обычно в primaryCTA). patterns:{disabled:[footer-inline-setter]}
  // больше не требуется после whitelist — сохраняем как dual-safety.
  deal_detail: {
    witnesses: ["amount", "commission", "status", "deadline", "completedAt", "result", "links", "revisionComment"],
    toolbar: [
      "accept_result", "request_revision", "cancel_deal_mutual",
      "submit_work_result", "submit_revision",
    ],
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
