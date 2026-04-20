/**
 * Freelance intents — 29 намерений в Cycle 1.
 * Полный список (55) добавляется в Cycle 2-4.
 */

export const INTENTS = {
  // ─── Auth (5) ────────────────────────────────────────────────────────────

  register_by_email: {
    name: "Регистрация по email",
    description: "Создать пользователя с подтверждением email'а",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "email", type: "email", required: true },
        { name: "name", type: "text", required: true },
        { name: "password", type: "text", required: true, sensitive: true },
      ],
      effects: [
        { α: "add", target: "users", σ: "account" },
      ],
    },
    creates: "User",
    confirmation: "auto",
  },

  verify_email: {
    name: "Подтвердить email",
    description: "Активировать учётную запись по коду из письма",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "code", type: "text", required: true },
      ],
      effects: [
        { α: "replace", target: "user.emailVerified", value: true },
      ],
    },
    confirmation: "auto",
  },

  login: {
    name: "Войти",
    description: "Сессия пользователя (возвращает JWT)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "email", type: "email", required: true },
        { name: "password", type: "text", required: true, sensitive: true },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  logout: {
    name: "Выйти",
    description: "Завершить текущую сессию",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [],
      effects: [],
    },
    confirmation: "auto",
  },

  reset_password: {
    name: "Сбросить пароль",
    description: "Отправить ссылку для сброса",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "email", type: "email", required: true },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  // ─── Response (5) ─────────────────────────────────────────────────────────

  submit_response: {
    name: "Откликнуться",
    description: "Executor публикует Response на Task в status=published; Response.status=pending; +1 в Task.responsesCount",
    α: "add",
    irreversibility: "low",
    // Top-level parameters короткозамыкают inferParameters. Только
    // пользовательский ввод; executorId инжектится через OWNERSHIP_INJECT,
    // taskId — через SubCollectionAdd из target.id родительской Task.
    parameters: [
      { name: "price", type: "number", fieldRole: "price", required: true, label: "Цена" },
      { name: "deliveryDays", type: "number", required: true, label: "Срок, дней" },
      { name: "message", type: "textarea", label: "Сообщение" },
    ],
    // entities: [task, response] — требуется SDK assignToSlotsDetail::buildSection
    // для генерации addControl в Task.subCollections.Response.
    // conditions task.status = 'published' — canAdd в SubCollectionSection
    // скрывает форму на draft/moderation/closed.
    particles: {
      entities: ["task: Task", "response: Response"],
      // customerId != me.id (семантический guard): customer не должен
      // откликаться на собственную задачу. Был filter-only в task_catalog_public,
      // теперь — intent-level condition (Stage 4), чтобы derived task_detail
      // не показывал Respond-форму customer'у его собственной задачи.
      conditions: ["task.status = 'published'", "task.customerId != me.id"],
      confirmation: "form",
      witnesses: ["price", "deliveryDays"],
      effects: [
        { α: "add", target: "responses", σ: "account" },
      ],
    },
    creates: "Response(pending)",
  },

  edit_response: {
    name: "Изменить отклик",
    description: "Правка price/deliveryDays/message; guard: response.status=pending И response.executorId=me.id",
    α: "replace",
    irreversibility: "low",
    parameters: [
      { name: "price", type: "number", fieldRole: "price", label: "Цена" },
      { name: "deliveryDays", type: "number", label: "Срок, дней" },
      { name: "message", type: "textarea", label: "Сообщение" },
    ],
    particles: {
      entities: ["response: Response"],
      conditions: ["response.status = 'pending'", "response.executorId = me.id"],
      confirmation: "form",
      witnesses: ["price", "deliveryDays"],
      effects: [
        { α: "replace", target: "response" },
      ],
    },
  },

  withdraw_response: {
    name: "Отозвать",
    description: "Response.status → withdrawn; guard: status=pending И executorId=me.id; −1 в Task.responsesCount",
    α: "replace",
    irreversibility: "low",
    // Без parameters — id берётся из per-item контекста (SubCollectionItem)
    particles: {
      entities: ["response: Response"],
      conditions: ["response.status = 'pending'", "response.executorId = me.id"],
      confirmation: "click",
      effects: [
        { α: "replace", target: "response.status", value: "withdrawn" },
      ],
    },
  },

  select_executor: {
    name: "Выбрать",
    description: "Customer выбирает Response → status=selected; siblings (pending/selected) → not_chosen. Реализация cascade в buildCustomEffects: демотирует siblings ПЕРВЫМ, затем повышает выбранного, чтобы инвариант task_has_at_most_one_selected_response не срабатывал на транзитном состоянии 2-selected.",
    α: "replace",
    irreversibility: "medium",
    // conditions на Response (item) — SDK SubCollectionItem скрывает
    // кнопку для не-pending откликов. taskId резолвится из response в
    // buildCustomEffects, customer-ownership — там же.
    particles: {
      entities: ["response: Response", "task: Task"],
      conditions: ["response.status = 'pending'"],
      confirmation: "click",
      effects: [
        { α: "replace", target: "response.status", value: "selected" },
      ],
    },
  },

  view_responses: {
    name: "Посмотреть отклики",
    description: "Customer смотрит Response к своей задаче (read-only)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "taskId", type: "id", required: true },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  // ─── Task (8) ─────────────────────────────────────────────────────────────

  create_task_draft: {
    name: "Опубликовать задачу",
    description: "Customer создаёт Task в статусе draft через form modal (customerId auto-injected из viewer)",
    α: "add",
    irreversibility: "low",
    // top-level `parameters` короткозамыкает SDK::inferParameters (который
    // смотрит именно сюда) — без него SDK добавил бы `responsesCount`
    // из Task.fields и другие auto-inferred поля. Эти же параметры
    // продублированы в particles.parameters для domain-internal-анализа
    // (intents.test, projections.test).
    //
    // categoryId — control:"select" + name endsWith "Id" → FormModal
    // (SDK renderer) автоматически подхватывает options из world.categories.
    // budget — fieldRole:"money" → AntdNumber добавляет префикс "₽" и
    // форматирование тысяч.
    parameters: [
      { name: "title", type: "text", required: true, label: "Заголовок" },
      { name: "categoryId", type: "select", required: true, label: "Категория", entity: "Category" },
      {
        name: "budget", type: "number", fieldRole: "price", required: true, label: "Бюджет",
        // UI-gap #3: quick-value chips под input'ом.
        presets: [
          { label: "500 ₽", value: 500 },
          { label: "1500 ₽", value: 1500 },
          { label: "5000 ₽", value: 5000 },
        ],
        // UI-gap #7: contextual hint (workzilla-стиль: «Какую стоимость поставить?»).
        help: {
          title: "Какую стоимость поставить?",
          text: "Укажите стоимость, которую готовы заплатить за задание. Важно, чтобы цена соответствовала объёму работы.",
          icon: "💰",
        },
      },
      { name: "type", type: "select", options: [
          { value: "remote", label: "Удалённо" },
          { value: "on-site", label: "На месте" },
        ], required: true, label: "Формат" },
      { name: "description", type: "textarea", label: "Описание",
        help: "Чем подробнее описано задание, тем легче исполнителю выполнить правильно." },
      {
        name: "deadline", type: "datetime", label: "Срок",
        // presets как функции-геттеры: host host-side compute перед submit.
        // Здесь — ISO-строки с offset'ами от момента crystallize; в runtime
        // обновляются dev-refresh'ем. Для демо ок; production — подключить
        // renderer-side compute через spec.presetsBuilder (future SDK API).
        presets: [
          { label: "Через 2 часа", value: new Date(Date.now() + 2 * 3600 * 1000).toISOString() },
          { label: "Через 6 часов", value: new Date(Date.now() + 6 * 3600 * 1000).toISOString() },
          { label: "Завтра 18:00", value: new Date(new Date().setHours(18, 0, 0, 0) + 24 * 3600 * 1000).toISOString() },
        ],
      },
      { name: "city", type: "text", label: "Город" },
    ],
    // particles.confirmation + witnesses ≥2 блокируют heroCreate-матчер
    // в SDK (controlArchetypes::heroCreate) и направляют интент в formModal.
    particles: {
      entities: ["task: Task"],
      confirmation: "form",
      witnesses: ["title", "categoryId", "budget", "type"],
      parameters: [
        { name: "title", type: "text", required: true, label: "Заголовок" },
        { name: "description", type: "textarea", label: "Описание" },
        { name: "categoryId", type: "entityRef", required: true, label: "Категория", entity: "Category" },
        { name: "budget", type: "number", fieldRole: "price", required: true, label: "Бюджет" },
        { name: "deadline", type: "datetime", label: "Срок" },
        { name: "type", type: "select", options: ["remote", "on-site"], required: true, label: "Формат" },
        { name: "city", type: "text", label: "Город" },
      ],
      effects: [
        { α: "add", target: "tasks", σ: "account" },
      ],
    },
    creates: "Task(draft)",
  },

  submit_task_for_moderation: {
    name: "Отправить на модерацию",
    description: "Перевод Task.status draft → moderation",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "task.status", value: "moderation" },
      ],
    },
    confirmation: "auto",
  },

  edit_task: {
    name: "Редактировать задачу",
    description: "Правка полей Task (только в draft / moderation)",
    α: "replace",
    irreversibility: "low",
    icon: "✎",
    particles: {
      entities: ["task: Task"],
      conditions: ["task.status = 'draft'"],
      // id — implicit из per-item context (target.id), не user-input.
      parameters: [
        { name: "title", type: "text" },
        { name: "description", type: "text" },
        { name: "budget", type: "number" },
        { name: "deadline", type: "datetime" },
      ],
      effects: [
        { α: "replace", target: "task.title" },
        { α: "replace", target: "task.description" },
        { α: "replace", target: "task.budget" },
        { α: "replace", target: "task.deadline" },
      ],
      confirmation: "form",
    },
  },

  publish_task: {
    name: "Опубликовать задачу",
    description: "Переход Task.status moderation → published (выполняется модератором в Cycle 3; в Cycle 1 — placeholder для customer-flow)",
    α: "replace",
    irreversibility: "low",
    icon: "📢",
    particles: {
      entities: ["task: Task"],
      conditions: ["task.status = 'draft'"],
      effects: [
        { α: "replace", target: "task.status", value: "published" },
      ],
      confirmation: "click",
    },
  },

  cancel_task_before_deal: {
    name: "Отменить задачу",
    description: "Закрыть Task (status → closed) до выбора исполнителя",
    α: "replace",
    irreversibility: "low",
    icon: "🗑",
    particles: {
      entities: ["task: Task"],
      conditions: ["task.status = 'published'"],
      effects: [
        { α: "replace", target: "task.status", value: "closed" },
      ],
      confirmation: "click",
    },
  },

  search_tasks: {
    name: "Поиск задач",
    description: "Полнотекстовый поиск по Task (read-only, session-scope)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "query", type: "text" },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  filter_by_category: {
    name: "Фильтр по категории",
    description: "UI-фильтр (session-scope)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "categoryId", type: "id" },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  sort_tasks: {
    name: "Сортировка задач",
    description: "UI-сортировка (session-scope)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        {
          name: "sortBy",
          type: "select",
          options: ["newest", "budget_desc", "budget_asc", "deadline"],
        },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  // ─── Profile (8) ──────────────────────────────────────────────────────────

  update_profile: {
    name: "Обновить профиль",
    description: "Имя / телефон / город в User",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "name", type: "text" },
        { name: "phone", type: "text" },
        { name: "city", type: "text" },
      ],
      effects: [
        { α: "replace", target: "user" },
      ],
    },
    confirmation: "auto",
  },

  update_bio: {
    name: "Изменить bio",
    description: "Описание исполнителя в ExecutorProfile",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "bio", type: "text", required: true },
      ],
      effects: [
        { α: "replace", target: "executorProfile.bio" },
      ],
    },
    confirmation: "auto",
  },

  add_skill: {
    name: "Добавить навык",
    description: "m2m ExecutorSkill: исполнитель ↔ справочник навыков",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "executorId", type: "id", required: true },
        { name: "skillId", type: "id", required: true },
      ],
      effects: [
        { α: "add", target: "executorSkills", σ: "account" },
      ],
    },
    creates: "ExecutorSkill",
    confirmation: "auto",
  },

  remove_skill: {
    name: "Убрать навык",
    description: "Удалить запись ExecutorSkill",
    α: "remove",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "remove", target: "executorSkills" },
      ],
    },
    confirmation: "auto",
  },

  add_portfolio_item: {
    name: "Добавить работу в портфолио",
    description: "Запись портфолио будет полноценной сущностью в Cycle 3; в Cycle 1 — no-op placeholder для UI-polish",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "executorId", type: "id", required: true },
        { name: "title", type: "text", required: true },
        { name: "url", type: "url" },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  update_rates: {
    name: "Обновить ставки",
    description: "Минимальная цена и средний срок у исполнителя",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "minPrice", type: "number" },
        { name: "avgDeliveryHours", type: "number" },
      ],
      effects: [
        { α: "replace", target: "executorProfile" },
      ],
    },
    confirmation: "auto",
  },

  toggle_availability: {
    name: "Сменить доступность",
    description: "available / busy / unavailable",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        {
          name: "availability",
          type: "select",
          options: ["available", "busy", "unavailable"],
          required: true,
        },
      ],
      effects: [
        { α: "replace", target: "executorProfile.availability" },
      ],
    },
    confirmation: "auto",
  },

  activate_executor_profile: {
    name: "Активировать профиль исполнителя",
    description: "Создать ExecutorProfile + выставить User.executorVerified=true",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "userId", type: "id", required: true },
        { name: "bio", type: "text" },
      ],
      effects: [
        { α: "add", target: "executorProfiles", σ: "account" },
      ],
    },
    creates: "ExecutorProfile",
    confirmation: "auto",
  },

  // ─── System (3) ───────────────────────────────────────────────────────────

  schedule_timer: {
    name: "Поставить таймер",
    description: "Системный intent: отложенный fire другого intent через δt",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "fireIntent", type: "text", required: true },
        { name: "afterMs", type: "number" },
        { name: "atISO", type: "datetime" },
        { name: "target", type: "text", required: true },
        { name: "revokeOn", type: "text" },
      ],
      effects: [
        { α: "add", target: "scheduledTimers", σ: "account" },
      ],
    },
    creates: "ScheduledTimer",
    confirmation: "auto",
  },

  revoke_timer: {
    name: "Отменить таймер",
    description: "Системный intent: отменить ранее поставленный timer",
    α: "remove",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "remove", target: "scheduledTimers" },
      ],
    },
    confirmation: "auto",
  },

  session_set_active_role: {
    name: "Переключить активную роль",
    description: "Для universal-пользователя — переключить customer ↔ executor; не пишет в Φ, только session",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "role", type: "select", options: ["customer", "executor"], required: true },
      ],
      effects: [
        { α: "replace", target: "session.activeRole", σ: "session" },
      ],
    },
    confirmation: "auto",
  },

  // ─── Review (3) ──────────────────────────────────────────────────────────

  leave_review: {
    name: "Оставить отзыв",
    description: "После Deal.completed одна сторона оставляет Review о другой",
    α: "add",
    irreversibility: "medium",
    particles: {
      parameters: [
        { name: "authorId", type: "id", required: true },
        { name: "dealId", type: "id", required: true },
        { name: "targetUserId", type: "id", required: true },
        { name: "role", type: "select", options: ["customer", "executor"], required: true },
        { name: "rating", type: "number", required: true },
        { name: "comment", type: "text" },
      ],
      effects: [
        { α: "add", target: "reviews", σ: "account" },
      ],
    },
    creates: "Review",
    confirmation: "auto",
  },

  reply_to_review: {
    name: "Ответить на отзыв",
    description: "Адресат Review может оставить один reply",
    α: "replace",
    irreversibility: "medium",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "reply", type: "text", required: true },
      ],
      effects: [
        { α: "replace", target: "review.reply" },
      ],
    },
    confirmation: "auto",
  },

  view_reviews_for_user: {
    name: "Посмотреть отзывы",
    description: "Read-only — публичные Review о targetUserId",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "targetUserId", type: "id", required: true },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  // ─── Wallet (7) ───────────────────────────────────────────────────────────

  top_up_wallet_by_card: {
    name: "Пополнить баланс",
    description: "Mock-gateway — Transaction(kind=topup,status=posted) + Wallet.balance += amount. walletId резолвится из viewer в buildCustomEffects.",
    α: "add",
    irreversibility: "medium",
    // Explicit control override: при irreversibility:"medium" SDK по дефолту
    // обернул бы в confirmDialog (раньше formModal по порядку регистрации
    // в controlArchetypes.js). Явно указываем formModal — после submit
    // параметры известны, confirm-dialog избыточен.
    control: "formModal",
    // Top-level parameters: только пользовательский ввод. walletId
    // auto-resolve'ится из viewer.userId в buildCustomEffects (один кошелёк
    // на пользователя в Cycle 1).
    parameters: [
      {
        name: "amount", type: "number", fieldRole: "price", required: true, min: 1,
        label: "Сумма пополнения",
        // UI-gap #3: quick-fill amounts (workzilla top-up: 700 / 1000 / 1500).
        presets: [
          { label: "700", value: 700 },
          { label: "1000", value: 1000 },
          { label: "1500", value: 1500 },
        ],
      },
      {
        // UI-gap #4: radio-card grid с группами (workzilla Банковская карта /
        // Электронные деньги / Другое).
        name: "method", control: "methodSelect", required: true,
        label: "Способ оплаты",
        options: [
          { id: "kassa",  label: "Мир/Visa/Mastercard", sublabel: "Kassa",
            icon: "💳", group: "Банковская карта" },
          { id: "sbp",    label: "СБП", sublabel: "Система быстрых платежей",
            icon: "⚡",  group: "Банковская карта" },
          { id: "paypal", label: "PayPal", icon: "💰",
            group: "Электронные деньги" },
          { id: "stripe", label: "Visa/Mastercard", sublabel: "Stripe",
            icon: "💳", group: "Другое" },
        ],
      },
      { name: "cardLastFour", type: "text", required: true, maxLength: 4, minLength: 4, pattern: "^\\d{4}$", placeholder: "1234", label: "Последние 4 цифры" },
    ],
    // creates опущен осознанно: основной эффект — Wallet.balance (replace),
    // Transaction создаётся как audit-trail side-effect. Если объявить
    // creates:"Transaction", SDK assignToSlotsDetail (line 100:
    // creates !== mainEntity) отсечёт intent от Wallet.toolbar.
    particles: {
      entities: ["wallet: Wallet"],
      conditions: ["wallet.userId = me.id"],
      confirmation: "form",
      witnesses: ["balance", "currency"],
      effects: [
        { α: "add", target: "transactions", σ: "account" },
        { α: "replace", target: "wallet.balance" },
      ],
    },
  },

  view_transaction_history: {
    name: "История операций",
    description: "Read-only выборка Transaction по walletId",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "walletId", type: "id", required: true },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  charge_commission: {
    name: "Списать комиссию",
    description: "Internal — при accept_result платформенная комиссия (%)",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "dealId", type: "id", required: true },
        { name: "walletId", type: "id", required: true },
        { name: "amount", type: "number", required: true },
      ],
      effects: [
        { α: "add", target: "transactions", σ: "account" },
      ],
    },
    creates: "Transaction",
    confirmation: "auto",
  },

  reserve_escrow: {
    name: "Резервировать escrow",
    description: "Internal — при confirm_deal: создаёт Transaction.kind=escrow-hold",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "dealId", type: "id", required: true },
        { name: "walletId", type: "id", required: true },
        { name: "amount", type: "number", required: true },
      ],
      effects: [
        { α: "add", target: "transactions", σ: "account" },
        { α: "replace", target: "wallet.reserved" },
      ],
    },
    creates: "Transaction",
    confirmation: "auto",
  },

  release_escrow: {
    name: "Высвободить escrow",
    description: "Internal — при accept_result: Transaction.kind=release + перевод исполнителю",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "dealId", type: "id", required: true },
        { name: "walletId", type: "id", required: true },
        { name: "amount", type: "number", required: true },
      ],
      effects: [
        { α: "add", target: "transactions", σ: "account" },
        { α: "replace", target: "wallet.reserved" },
        { α: "replace", target: "wallet.balance" },
      ],
    },
    creates: "Transaction",
    confirmation: "auto",
  },

  refund_escrow: {
    name: "Вернуть escrow",
    description: "Internal — при cancel_deal_mutual: Transaction.kind=refund",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "dealId", type: "id", required: true },
        { name: "walletId", type: "id", required: true },
        { name: "amount", type: "number", required: true },
      ],
      effects: [
        { α: "add", target: "transactions", σ: "account" },
        { α: "replace", target: "wallet.reserved" },
      ],
    },
    creates: "Transaction",
    confirmation: "auto",
  },

  view_wallet_balance: {
    name: "Посмотреть баланс",
    description: "Read-only — возвращает Wallet balance + reserved",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "userId", type: "id", required: true },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  // ─── Deal (7) ─────────────────────────────────────────────────────────────

  confirm_deal: {
    name: "Подтвердить сделку",
    description: "Customer резервирует escrow по выбранному отклику — создаётся Deal(in_progress), Transaction(escrow-hold), wallet.balance -= amount, wallet.reserved += amount. Вызывается per-item на Response.status=selected; id = response.id, всё остальное derive'ится в buildCustomEffects.",
    α: "add",
    creates: "Deal",
    irreversibility: "high",
    __irr: {
      point: "high",
      reason: "Сумма резервируется в escrow — отмена возможна только через спор или mutual-cancel",
    },
    particles: {
      // Deal исключён из entities — иначе SDK дублирует кнопку на
      // deal_detail (appliesToMainEntity=Deal). Per-item на Response
      // в task_detail — единственное корректное место.
      entities: ["response: Response", "task: Task"],
      conditions: ["response.status = 'selected'"],
      confirmation: "click",
      effects: [
        { α: "add", target: "deals", σ: "account" },
        { α: "add", target: "transactions", σ: "account" },
        { α: "replace", target: "wallet.reserved" },
      ],
    },
  },

  submit_work_result: {
    name: "Сдать работу",
    description: "Executor передаёт результат — Deal.status: in_progress → on_review.",
    α: "replace",
    // permittedFor: "executorId" — Deal multi-owner (customerId/executorId),
    // этот intent только для executor'а (backlog 3.2). SDK derived deal_detail
    // поместит в toolbar только когда viewer.id === deal.executorId.
    permittedFor: "executorId",
    // Medium семантически верно: submit_work_result обратим через revision-loop
    // (customer может request_revision → executor submit_revision).
    irreversibility: "medium",
    control: "formModal",
    icon: "⚡",
    parameters: [
      { name: "result", type: "textarea", required: true, label: "Описание результата" },
      { name: "links", type: "text", label: "Ссылки (репо, превью)" },
    ],
    particles: {
      entities: ["deal: Deal"],
      conditions: ["deal.status = 'in_progress'", "deal.executorId = me.id"],
      confirmation: "form",
      witnesses: ["result", "links"],
      effects: [
        { α: "replace", target: "deal.status", value: "on_review" },
      ],
    },
  },

  accept_result: {
    salience: "primary",
    name: "Принять работу",
    description: "Customer принимает результат — Deal.status → completed, escrow release executor'у (payout), commission платформе.",
    α: "replace",
    // permittedFor: "customerId" — customer-only action (backlog 3.2).
    permittedFor: "customerId",
    irreversibility: "high",
    __irr: {
      point: "high",
      reason: "Escrow-перевод исполнителю — откат только через chargeback поддержки",
    },
    particles: {
      entities: ["deal: Deal"],
      // Guard: только customer своей сделки, только из on_review (не из
      // completed/cancelled — чтобы toolbar исчезал после подтверждения).
      conditions: ["deal.status = 'on_review'", "deal.customerId = me.id"],
      confirmation: "click",
      effects: [
        { α: "replace", target: "deal.status", value: "completed" },
        { α: "add", target: "transactions", σ: "account" },
      ],
    },
  },

  auto_accept_result: {
    name: "Авто-приёмка (72h)",
    description: "Scheduler-fired: если customer не принял за 72h, результат auto-accept с теми же последствиями. Не user-invokable — particles.entities пуст, SDK не добавит в toolbar.",
    α: "replace",
    irreversibility: "high",
    __irr: {
      point: "high",
      reason: "Автоматическая приёмка через 72h после on_review — та же finality что и ручная",
    },
    particles: {
      // entities пуст → SDK assignToSlotsDetail::appliesToMainEntity = false →
      // auto_accept_result не появится в Deal.toolbar. Фаер через rules.js
      // (schedule v2: after 72h от submit_work_result → emit auto_accept_result
      // по intentId, не через UI).
      entities: [],
      conditions: ["deal.status = 'on_review'"],
      effects: [
        { α: "replace", target: "deal.status", value: "completed" },
        { α: "add", target: "transactions", σ: "account" },
      ],
    },
    confirmation: "auto",
  },

  request_revision: {
    name: "Вернуть на доработку",
    description: "Customer возвращает deal из on_review в revision_requested с комментарием (причиной). Revision-cycle: request_revision ↔ submit_revision может повторяться.",
    α: "replace",
    permittedFor: "customerId",
    // Medium: request_revision — часть revision-loop, полностью обратима.
    irreversibility: "medium",
    control: "formModal",
    // Explicit icon — иначе SDK getIntentIcon fallback'нёт на ⚡, и
    // collapseToolbar схлопнёт с submit_work_result/submit_revision в
    // overflow (dedup по иконке при >3 toolbar items).
    icon: "↩",
    parameters: [
      { name: "comment", type: "textarea", required: true, label: "Что доработать" },
    ],
    particles: {
      entities: ["deal: Deal"],
      conditions: ["deal.status = 'on_review'", "deal.customerId = me.id"],
      confirmation: "form",
      witnesses: ["comment"],
      effects: [
        { α: "replace", target: "deal.status", value: "revision_requested" },
      ],
    },
  },

  submit_revision: {
    name: "Сдать правки",
    description: "Executor сдаёт версию после revision — Deal возвращается в on_review. Доступно только из revision_requested.",
    α: "replace",
    permittedFor: "executorId",
    // Medium: submit_revision — часть revision-loop, обратим через request_revision.
    irreversibility: "medium",
    control: "formModal",
    icon: "📤",
    parameters: [
      { name: "result", type: "textarea", required: true, label: "Что изменено" },
      { name: "links", type: "text", label: "Обновлённые ссылки" },
    ],
    particles: {
      entities: ["deal: Deal"],
      conditions: ["deal.status = 'revision_requested'", "deal.executorId = me.id"],
      confirmation: "form",
      witnesses: ["result"],
      effects: [
        { α: "replace", target: "deal.status", value: "on_review" },
      ],
    },
    confirmation: "auto",
  },

  cancel_deal_mutual: {
    name: "Отменить сделку",
    description: "Обе стороны согласны — Deal.status → cancelled, escrow refund customer'у. Доступно до completed/cancelled.",
    α: "replace",
    irreversibility: "medium",
    control: "formModal",
    parameters: [
      { name: "reason", type: "textarea", required: true, label: "Причина отмены" },
    ],
    particles: {
      entities: ["deal: Deal"],
      conditions: ["deal.status IN ('in_progress', 'on_review')"],
      confirmation: "form",
      witnesses: ["reason"],
      effects: [
        { α: "replace", target: "deal.status", value: "cancelled" },
        { α: "add", target: "transactions", σ: "account" },
      ],
    },
  },
};
