/**
 * Онтология delivery-домена — еда / продукты last-mile.
 *
 * Полевой тест 11. 14 доменных сущностей (15-я ScheduledTimer — системная,
 * не объявляется доменом). 5 ролей (§5 base taxonomy). 8 правил Rules Engine
 * (5 temporal scheduleV2 after/revokeOn, 1 threshold, 1 condition, 1 aggregation).
 * 3 инварианта §14 (transition, role-capability, referential).
 */

export const ONTOLOGY = {
  domain: "delivery",

  // ─── Сущности ────────────────────────────────────────────────────────────
  entities: {
    // 1. Пользователь системы — dual-write от auth_users, ownerField не нужен
    //    (id совпадает с auth userId). Все роли наследуются из JWT.
    User: {
      ownerField: "id",
      fields: {
        id: { type: "text" },
        name: { type: "text", required: true, label: "Имя" },
        email: { type: "email" },
        role: { type: "select", options: ["customer", "courier", "merchant", "dispatcher", "agent"] },
        rating: { type: "number", label: "Рейтинг" },
        createdAt: { type: "datetime" },
      },
    },

    // 2. Ресторан / магазин — принадлежит merchant-пользователю
    Merchant: {
      ownerField: "ownerId",
      fields: {
        id: { type: "text" },
        ownerId: { type: "text", required: true },
        name: { type: "text", required: true, label: "Название" },
        type: { type: "select", options: ["restaurant", "grocery", "pharmacy", "other"], label: "Тип" },
        rating: { type: "number", label: "Рейтинг" },
        status: { type: "select", options: ["active", "paused", "closed"], label: "Статус" },
        createdAt: { type: "datetime" },
      },
    },

    // 3. Позиция меню — принадлежит ресторану через merchantId
    MenuItem: {
      ownerField: "merchantId",
      fields: {
        id: { type: "text" },
        merchantId: { type: "entityRef", required: true },
        name: { type: "text", required: true, label: "Наименование" },
        price: { type: "number", fieldRole: "money", required: true, label: "Цена" },
        category: { type: "text", label: "Категория" },
        available: { type: "boolean", label: "Доступно" },
        imageUrl: { type: "url", label: "Фото" },
      },
    },

    // 4. Зона доставки — общий справочник, без owner
    Zone: {
      fields: {
        id: { type: "text" },
        name: { type: "text", required: true, label: "Зона" },
        polygon: { type: "polygon", label: "Полигон зоны" },
        city: { type: "text", label: "Город" },
      },
    },

    // 5. Назначение диспетчера на зону — kind: "assignment" (m2m)
    DispatcherAssignment: {
      kind: "assignment",
      ownerField: "dispatcherId",
      fields: {
        id: { type: "text" },
        dispatcherId: { type: "text", required: true },
        zoneId: { type: "entityRef", required: true },
        status: { type: "select", options: ["active", "ended"], required: true, label: "Статус" },
        shiftStart: { type: "datetime", label: "Начало смены" },
        shiftEnd: { type: "datetime", label: "Конец смены" },
      },
    },

    // 6. Заказ — ключевая агрегирующая сущность
    Order: {
      ownerField: "customerId",
      fields: {
        id: { type: "text" },
        customerId: { type: "text", required: true },
        merchantId: { type: "entityRef", required: true },
        assignedCourierId: { type: "text", label: "Курьер" },
        status: {
          type: "select",
          options: [
            "draft", "placed", "accepted_by_merchant", "cooking",
            "ready", "picked_up", "delivering", "delivered",
            "cancelled", "failed", "reassigned",
          ],
          label: "Статус",
        },
        totalAmount: { type: "number", fieldRole: "money", label: "Сумма" },
        tip: { type: "number", fieldRole: "money", label: "Чаевые" },
        addressId: { type: "entityRef", required: true },
        zoneId: { type: "entityRef", label: "Зона доставки" },
        createdAt: { type: "datetime" },
        etaCook: { type: "datetime", label: "ETA приготовление" },
        etaDelivery: { type: "datetime", label: "ETA доставка" },
      },
    },

    // 7. Позиция заказа — принадлежит заказу через orderId
    OrderItem: {
      ownerField: "orderId",
      fields: {
        id: { type: "text" },
        orderId: { type: "entityRef", required: true },
        menuItemId: { type: "entityRef", required: true },
        quantity: { type: "number", required: true, label: "Количество" },
        price: { type: "number", fieldRole: "money", label: "Цена за ед." },
      },
    },

    // 8. Доставка — факт вручения. Scope через order.customerId
    Delivery: {
      ownerField: "courierId",
      fields: {
        id: { type: "text" },
        orderId: { type: "entityRef", required: true },
        courierId: { type: "text", required: true },
        pickupAt: { type: "datetime", label: "Принято у ресторана" },
        deliveredAt: { type: "datetime", label: "Вручено" },
        status: {
          type: "select",
          options: ["assigned", "accepted", "picked_up", "delivered", "failed"],
          label: "Статус",
        },
      },
    },

    // 9. Адрес — kind: "reference" (mirror от geocoder-сервиса)
    Address: {
      kind: "reference",
      fields: {
        id: { type: "text" },
        text: { type: "text", required: true, label: "Адрес" },
        lat: { type: "number", label: "Широта" },
        lng: { type: "number", label: "Долгота" },
        placeId: { type: "text", label: "Place ID" },
      },
    },

    // 10. Геопозиция курьера — real-time поток
    CourierLocation: {
      ownerField: "courierId",
      fields: {
        id: { type: "text" },
        courierId: { type: "text", required: true },
        lat: { type: "number", label: "Широта" },
        lng: { type: "number", label: "Долгота" },
        speed: { type: "number", label: "Скорость (м/с)" },
        heading: { type: "number", label: "Курс (°)" },
        recordedAt: { type: "datetime" },
      },
    },

    // 11. Платёж — принадлежит покупателю
    Payment: {
      ownerField: "customerId",
      fields: {
        id: { type: "text" },
        orderId: { type: "entityRef", required: true },
        customerId: { type: "text", required: true },
        amount: { type: "number", fieldRole: "money", required: true, label: "Сумма" },
        status: {
          type: "select",
          options: ["pending", "on_hold", "captured", "refunded", "failed"],
          label: "Статус",
        },
        holdAt: { type: "datetime", label: "Холд поставлен" },
        capturedAt: { type: "datetime", label: "Списано" },
      },
    },

    // 12. Нотификация — принадлежит получателю
    Notification: {
      ownerField: "recipientUserId",
      fields: {
        id: { type: "text" },
        recipientUserId: { type: "text", required: true },
        channel: { type: "select", options: ["push", "sms", "email"], label: "Канал" },
        template: { type: "text", label: "Шаблон" },
        sentAt: { type: "datetime" },
        status: { type: "select", options: ["queued", "sent", "failed"], label: "Статус" },
      },
    },

    // 13. Отзыв — покупатель оставляет после доставки
    Review: {
      ownerField: "customerId",
      fields: {
        id: { type: "text" },
        customerId: { type: "text", required: true },
        orderId: { type: "entityRef", required: true },
        rating: { type: "number", required: true, label: "Оценка (1–5)" },
        comment: { type: "textarea", label: "Комментарий" },
        createdAt: { type: "datetime" },
      },
    },

    // 14. Preapproval агента — декларативные лимиты для автоназначения (§26.2)
    AgentPreapproval: {
      ownerField: "userId",
      fields: {
        id: { type: "text" },
        userId: { type: "entityRef", required: true },
        active: { type: "boolean", label: "Активен" },
        expiresAt: { type: "datetime", label: "Действует до" },
        allowedZones: { type: "text", label: "Допустимые зоны (CSV)" },
        maxConcurrent: { type: "number", label: "Макс. параллельных назначений" },
        createdAt: { type: "datetime" },
      },
    },
  },

  // ─── Роли (§5 base taxonomy) ─────────────────────────────────────────────
  roles: {
    // Покупатель — видит собственные заказы, платежи, отзывы
    customer: {
      base: "owner", // §5 — self-acting CRUD
      canExecute: [
        "register", "login", "update_profile",
        "create_order", "add_order_item", "place_order", "cancel_order",
        "track_order", "confirm_delivery",
        "rate_delivery", "add_review",
        "save_address",
      ],
      visibleFields: {
        Order: "own",
        OrderItem: "own",
        Delivery: ["id", "orderId", "status", "pickupAt", "deliveredAt"],
        Payment: "own",
        Review: "own",
        Notification: "own",
        Merchant: ["id", "name", "type", "rating", "status"],
        MenuItem: ["id", "merchantId", "name", "price", "category", "available", "imageUrl"],
        CourierLocation: ["id", "courierId", "lat", "lng", "heading"],
      },
    },

    // Курьер — видит свои назначения доставки и свою геопозицию
    courier: {
      base: "owner", // §5 — owner of own Delivery + CourierLocation
      canExecute: [
        "login", "update_profile",
        "accept_assignment", "reject_assignment",
        "confirm_pickup", "confirm_delivery",
        "report_delivery_failed",
        "update_location",
      ],
      visibleFields: {
        Delivery: "own",
        CourierLocation: "own",
        Order: ["id", "merchantId", "status", "totalAmount", "addressId", "etaDelivery"],
        Merchant: ["id", "name"],
        Address: "all",
        Notification: "own",
      },
    },

    // Ресторан — управляет меню и видит свои заказы
    merchant: {
      base: "owner", // §5 — owner of Merchant + MenuItem
      canExecute: [
        "login", "update_merchant_profile",
        "create_menu_item", "update_menu_item", "archive_menu_item",
        "accept_order", "reject_order",
        "mark_ready",
        "start_cooking",
      ],
      visibleFields: {
        Merchant: "own",
        MenuItem: "own",
        Order: ["id", "customerId", "status", "totalAmount", "createdAt", "etaCook", "etaDelivery"],
        OrderItem: ["id", "orderId", "menuItemId", "quantity", "price"],
      },
    },

    // Диспетчер — m2m scope через DispatcherAssignment: видит заказы своих зон
    dispatcher: {
      base: "owner", // §5 — owner of DispatcherAssignment
      canExecute: [
        "login",
        "assign_courier_manual",
        "reassign_courier",
        "escalate_order",
        "update_zone",
        "view_zone_map",
      ],
      visibleFields: {
        Order: [
          "id", "customerId", "merchantId", "assignedCourierId",
          "status", "totalAmount", "addressId", "zoneId",
          "createdAt", "etaCook", "etaDelivery",
        ],
        Delivery: ["id", "orderId", "courierId", "status", "pickupAt", "deliveredAt"],
        CourierLocation: ["id", "courierId", "lat", "lng", "speed", "heading", "recordedAt"],
        Zone: "all",
        DispatcherAssignment: "own",
        Merchant: ["id", "name", "type", "rating"],
      },
      // M2M scope: диспетчер видит сущности X, где X.zoneId ∈ { a.zoneId |
      // a ∈ dispatcherAssignments, a.dispatcherId === viewer.id, a.status === "active" }.
      // DispatcherAssignment сама фильтруется через ownerField (dispatcherId).
      scope: {
        Order: {
          via: "dispatcherAssignments",
          viewerField: "dispatcherId",
          joinField: "zoneId",
          localField: "zoneId",
          statusField: "status",
          statusAllowed: ["active"],
        },
        Delivery: {
          via: "dispatcherAssignments",
          viewerField: "dispatcherId",
          joinField: "zoneId",
          localField: "zoneId",  // через Order.zoneId — упрощённый вариант
          statusField: "status",
          statusAllowed: ["active"],
        },
        CourierLocation: {
          via: "dispatcherAssignments",
          viewerField: "dispatcherId",
          joinField: "zoneId",
          localField: "zoneId",  // courier зоны определяются через активные заказы
          statusField: "status",
          statusAllowed: ["active"],
        },
      },
    },

    // Агент — автоматизация назначений курьеров с preapproval guard
    agent: {
      base: "agent", // §5 — JWT-scoped automation + preapproval guard
      canExecute: [
        "agent_auto_assign_courier",
        "agent_auto_reassign",
        "agent_auto_notify_customer",
        "agent_auto_release_hold",
        "agent_flag_stationary",
      ],
      visibleFields: {
        User: ["id", "name", "rating"],
        Order: [
          "id", "customerId", "merchantId", "assignedCourierId",
          "status", "totalAmount", "addressId", "zoneId",
          "etaCook", "etaDelivery",
        ],
        Delivery: ["id", "orderId", "courierId", "status"],
        CourierLocation: ["id", "courierId", "lat", "lng", "speed", "recordedAt"],
        AgentPreapproval: ["id", "userId", "active", "expiresAt", "allowedZones", "maxConcurrent"],
        Payment: ["id", "orderId", "status", "holdAt"],
        Notification: ["id", "recipientUserId", "channel", "template", "status"],
      },
      // Preapproval guard (§26.2) — декларативные лимиты для критичных intents
      preapproval: {
        entity: "AgentPreapproval",
        ownerField: "userId",
        requiredFor: [
          "agent_auto_assign_courier",
          "agent_auto_reassign",
        ],
        checks: [
          { kind: "active", field: "active" },
          { kind: "notExpired", field: "expiresAt" },
          { kind: "csvInclude",
            paramField: "zoneId",
            limitField: "allowedZones" },
        ],
      },
    },
  },

  // ─── Глобальные инварианты (§14, v1.6.1) ─────────────────────────────────
  // ∀-свойства world(t) проверяются после каждой fold(Φ) в
  // server/validator.js::checkInvariantsForDomain. Errors откатывают
  // эффект через cascadeReject + SSE effect:rejected.
  invariants: [
    // 1. Конечный автомат статусов заказа — строго детерминированный граф.
    //    Переходы вне allowed матрицы → rollback (severity: "error").
    {
      name: "order_status_transition",
      kind: "transition",
      entity: "Order",
      field: "status",
      allowed: [
        ["draft", "placed"],
        ["placed", "accepted_by_merchant"],
        ["placed", "cancelled"],
        ["accepted_by_merchant", "cooking"],
        ["accepted_by_merchant", "cancelled"],
        ["cooking", "ready"],
        ["cooking", "cancelled"],
        ["ready", "picked_up"],
        ["ready", "cancelled"],
        ["picked_up", "delivering"],
        ["delivering", "delivered"],
        ["delivering", "failed"],
        ["failed", "reassigned"],
        ["reassigned", "ready"],
      ],
      severity: "error",
    },

    // 2. Покупатель не может подтверждать/назначать заказы — защита от
    //    эскалации привилегий. Moderator-паттерн §5.
    {
      name: "customer_cannot_accept_own_order",
      kind: "role-capability",
      role: "customer",
      cannot: [
        "accept_order",
        "reject_order",
        "assign_courier_manual",
        "agent_auto_assign_courier",
        "mark_ready",
      ],
      severity: "error",
    },

    // 3. FK: OrderItem → Order — удалённый заказ не должен оставлять
    //    висящих позиций (ссылочная целостность).
    {
      name: "order_item_references_order",
      kind: "referential",
      entity: "OrderItem",
      field: "orderId",
      references: "orders",
      severity: "error",
    },
  ],

  // ─── Rules Engine §22 v1.5 ────────────────────────────────────────────────
  // Extensions: temporal (scheduleV2 after/revokeOn), threshold, condition,
  // aggregation. scheduleV2 merged в main (Plan 2).
  rules: [
    // ── Temporal: scheduleV2 after/revokeOn ───────────────────────────────

    // 1. Авто-отмена заказа если merchant не принял за 5 минут
    {
      id: "auto_cancel_pending_order",
      trigger: "place_order",
      after: "5min",
      revokeOn: ["accept_order", "reject_order", "cancel_order"],
      fireIntent: "rule_cancel_stale_order",
      params: { id: "$.id" },
    },

    // 2. Переназначение курьера если не принял задание за 2 минуты
    {
      id: "reassign_on_noaccept",
      trigger: "assign_courier_manual",
      after: "2min",
      revokeOn: ["accept_assignment", "reject_assignment"],
      fireIntent: "rule_reassign_delivery",
      params: { id: "$.id" },
    },

    // 3. Эскалация диспетчеру если заказ готов, но курьер не забирает 15 мин
    {
      id: "escalate_ready_no_pickup",
      trigger: "mark_ready",
      after: "15min",
      revokeOn: ["confirm_pickup"],
      fireIntent: "rule_escalate_order",
      params: { id: "$.id" },
    },

    // 4. Напоминание об отзыве спустя 48 часов после доставки
    {
      id: "review_reminder",
      trigger: "confirm_delivery",
      after: "48h",
      revokeOn: ["rate_delivery"],
      fireIntent: "rule_send_review_reminder",
      params: { id: "$.id" },
    },

    // 5. Автоматическое освобождение холда платежа через 24 часа
    //    (safety net если webhook платёжной системы не пришёл)
    {
      id: "release_expired_hold",
      trigger: "foreign_payment_webhook",
      after: "24h",
      fireIntent: "rule_release_expired_hold",
      params: { id: "$.id" },
    },

    // ── Threshold ────────────────────────────────────────────────────────

    // 6. Курьер стоит на месте: последние 5 локаций speed < 1 м/с → флаг агенту
    {
      id: "stuck_courier_alert",
      trigger: "foreign_ingest_location",
      action: "agent_flag_stationary",
      threshold: {
        lookback: 5,
        field: "speed",
        condition: "lt:1",
        collection: "courierLocations",
      },
    },

    // ── Condition ────────────────────────────────────────────────────────

    // 7. Если приготовление затянулось более 10 минут → уведомить покупателя
    {
      id: "notify_cooking_delay",
      trigger: "start_cooking",
      action: "rule_notify_cooking_delay",
      condition: "effect.cookingElapsed > 600000",
    },

    // ── Aggregation ──────────────────────────────────────────────────────

    // 8. Каждые 10 успешных доставок → запросить развёрнутый отзыв у ресторана
    {
      id: "feedback_prompt",
      trigger: "confirm_delivery",
      action: "rule_prompt_merchant_feedback",
      aggregation: { everyN: 10 },
    },
  ],
};
