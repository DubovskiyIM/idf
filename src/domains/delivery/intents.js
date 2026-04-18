/**
 * Delivery intents — еда / продукты last-mile.
 *
 * ~45 намерений по 7 группам. Generic Effect Handler покрывает большинство
 * через intent.particles.effects — декларативный подход по образцу invest.
 * Специальная логика (place_order, cancel_order, confirm_delivery,
 * request_refund) добавится в Task 5/6 через buildDeliveryEffects.
 */

export const INTENTS = {
  // ─── Покупатель (10) ──────────────────────────────────────────────────────

  create_draft_order: {
    name: "Создать черновик заказа",
    description: "Покупатель начинает новый заказ в статусе draft",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "merchantId", type: "id", required: true },
        { name: "addressId", type: "id", required: true },
      ],
      effects: [
        { α: "add", target: "orders", σ: "account" },
      ],
    },
    creates: "Order",
    confirmation: "auto",
  },

  add_to_cart: {
    name: "Добавить в корзину",
    description: "Добавить позицию меню в заказ",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "orderId", type: "id", required: true },
        { name: "menuItemId", type: "id", required: true },
        { name: "quantity", type: "number", required: true },
        { name: "price", type: "number", required: true },
      ],
      effects: [
        { α: "add", target: "orderItems", σ: "account" },
      ],
    },
    creates: "OrderItem",
    confirmation: "auto",
  },

  remove_from_cart: {
    name: "Убрать из корзины",
    description: "Удалить позицию из заказа",
    α: "remove",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "remove", target: "orderItems" },
      ],
    },
    confirmation: "auto",
  },

  update_cart_quantity: {
    name: "Изменить количество",
    description: "Обновить количество позиции в корзине",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "quantity", type: "number", required: true },
      ],
      effects: [
        { α: "replace", target: "orderItem.quantity" },
      ],
    },
    confirmation: "auto",
  },

  set_delivery_address: {
    name: "Задать адрес доставки",
    description: "Установить или сменить адрес доставки заказа",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "addressId", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "order.addressId" },
      ],
    },
    confirmation: "auto",
  },

  // Специальная логика через buildDeliveryEffects (Task 5/6):
  // draft→placed, создание Payment, триггер Rules Engine
  place_order: {
    name: "Оформить заказ",
    description: "Перевести черновик в статус placed и запустить обработку",
    α: "batch",
    irreversibility: "medium",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "totalAmount", type: "number", required: true },
      ],
      witnesses: ["order.totalAmount", "order.merchantId"],
      effects: [
        { α: "replace", target: "order.status", value: "placed" },
        { α: "add", target: "payments", σ: "account" },
      ],
    },
    confirmation: "confirm",
  },

  // Специальная логика через buildDeliveryEffects (Task 5/6):
  // проверка статуса, возврат Payment, освобождение Delivery
  cancel_order: {
    name: "Отменить заказ",
    description: "Покупатель отменяет заказ до передачи курьеру",
    α: "batch",
    irreversibility: "high",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      witnesses: ["order.totalAmount", "order.merchantId"],
      effects: [
        { α: "replace", target: "order.status", value: "cancelled" },
      ],
    },
    confirmation: "confirm",
  },

  rate_delivery: {
    name: "Оценить доставку",
    description: "Покупатель оставляет отзыв после получения заказа",
    α: "add",
    irreversibility: "medium",
    particles: {
      parameters: [
        { name: "orderId", type: "id", required: true },
        { name: "rating", type: "number", required: true },
        { name: "comment", type: "text", required: false },
      ],
      effects: [
        { α: "add", target: "reviews", σ: "account" },
      ],
    },
    creates: "Review",
    confirmation: "auto",
  },

  tip_courier: {
    name: "Добавить чаевые",
    description: "Покупатель добавляет чаевые к заказу",
    α: "replace",
    irreversibility: "medium",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "amount", type: "number", required: true },
      ],
      witnesses: ["order.totalAmount", "order.tip"],
      effects: [
        { α: "replace", target: "order.tip" },
      ],
    },
    confirmation: "confirm",
  },

  // Специальная логика через buildDeliveryEffects (Task 6):
  // инициирует возврат через payment-gateway webhook
  request_refund: {
    name: "Запросить возврат",
    description: "Покупатель инициирует возврат средств за заказ",
    α: "replace",
    irreversibility: "high",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "reason", type: "text", required: false },
      ],
      witnesses: ["payment.amount", "order.totalAmount"],
      effects: [
        { α: "replace", target: "payment.status", value: "refunded" },
      ],
    },
    confirmation: "confirm",
  },

  // ─── Мерчант (8) ──────────────────────────────────────────────────────────

  accept_order: {
    name: "Принять заказ",
    description: "Мерчант подтверждает получение заказа и начинает готовить",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      conditions: ["order.status = 'placed'"],
      effects: [
        { α: "replace", target: "order.status", value: "accepted_by_merchant" },
      ],
    },
    confirmation: "auto",
  },

  reject_order: {
    name: "Отклонить заказ",
    description: "Мерчант отклоняет заказ (нет ингредиентов, закрыт и т.д.)",
    α: "replace",
    irreversibility: "high",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "reason", type: "text", required: false },
      ],
      conditions: ["order.status = 'placed'"],
      witnesses: ["order.totalAmount", "order.customerId"],
      effects: [
        { α: "replace", target: "order.status", value: "cancelled" },
      ],
    },
    confirmation: "confirm",
  },

  start_cooking: {
    name: "Начать приготовление",
    description: "Мерчант отмечает, что кухня приступила к заказу",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "etaCook", type: "datetime", required: false },
      ],
      conditions: ["order.status = 'accepted_by_merchant'"],
      effects: [
        { α: "replace", target: "order.status", value: "cooking" },
      ],
    },
    confirmation: "auto",
  },

  mark_ready: {
    name: "Заказ готов",
    description: "Мерчант отмечает готовность заказа к выдаче курьеру",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      conditions: ["order.status = 'cooking'"],
      effects: [
        { α: "replace", target: "order.status", value: "ready" },
      ],
    },
    confirmation: "auto",
  },

  set_stop_list_item: {
    name: "Стоп-лист позиции",
    description: "Мерчант убирает позицию меню из доступных (нет в наличии)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "menuItem.available", value: false },
      ],
    },
    confirmation: "auto",
  },

  update_menu_item: {
    name: "Редактировать позицию меню",
    description: "Мерчант изменяет название, цену или категорию позиции",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "name", type: "text", required: false },
        { name: "price", type: "number", required: false },
        { name: "category", type: "text", required: false },
        { name: "available", type: "boolean", required: false },
      ],
      effects: [
        { α: "replace", target: "menuItem" },
      ],
    },
    confirmation: "auto",
  },

  pause_orders_reception: {
    name: "Приостановить приём заказов",
    description: "Мерчант временно переходит в режим паузы",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      witnesses: ["merchant.name", "merchant.status"],
      effects: [
        { α: "replace", target: "merchant.status", value: "paused" },
      ],
    },
    confirmation: "confirm",
  },

  resume_orders_reception: {
    name: "Возобновить приём заказов",
    description: "Мерчант выходит из режима паузы",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "merchant.status", value: "active" },
      ],
    },
    confirmation: "auto",
  },

  // ─── Курьер (7) ───────────────────────────────────────────────────────────

  accept_assignment: {
    name: "Принять задание",
    description: "Курьер принимает назначение на доставку",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      conditions: ["delivery.status = 'assigned'"],
      effects: [
        { α: "replace", target: "delivery.status", value: "accepted" },
      ],
    },
    confirmation: "auto",
  },

  reject_assignment: {
    name: "Отклонить задание",
    description: "Курьер отказывается от назначения, освобождает слот",
    α: "replace",
    irreversibility: "medium",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "reason", type: "text", required: false },
      ],
      conditions: ["delivery.status = 'assigned'"],
      witnesses: ["delivery.orderId"],
      effects: [
        { α: "replace", target: "delivery.status", value: "rejected" },
      ],
    },
    confirmation: "confirm",
  },

  // irreversibility hint — buildDeliveryEffects в Task 5 добавит __irr флаг
  confirm_pickup: {
    name: "Подтвердить получение у ресторана",
    description: "Курьер подтверждает, что забрал заказ от мерчанта",
    α: "replace",
    irreversibility: "high",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      conditions: ["order.status = 'ready'"],
      witnesses: ["order.merchantId", "order.totalAmount"],
      effects: [
        { α: "replace", target: "order.status", value: "picked_up" },
        { α: "replace", target: "delivery.pickupAt" },
      ],
    },
    confirmation: "confirm",
  },

  start_delivery: {
    name: "Начать доставку",
    description: "Курьер выехал к покупателю",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      conditions: ["delivery.status = 'accepted'"],
      effects: [
        { α: "replace", target: "delivery.status", value: "delivering" },
        { α: "replace", target: "order.status", value: "delivering" },
      ],
    },
    confirmation: "auto",
  },

  // Специальная логика через buildDeliveryEffects (Task 5/6):
  // Order.status → delivered + capture_payment hint
  confirm_delivery: {
    name: "Подтвердить доставку",
    description: "Курьер подтверждает вручение заказа покупателю",
    α: "batch",
    irreversibility: "high",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      conditions: ["delivery.status = 'delivering'"],
      witnesses: ["order.addressId", "order.totalAmount"],
      effects: [
        { α: "replace", target: "order.status", value: "delivered" },
        { α: "replace", target: "delivery.status", value: "delivered" },
        { α: "replace", target: "delivery.deliveredAt" },
      ],
    },
    confirmation: "confirm",
  },

  report_issue: {
    name: "Сообщить о проблеме",
    description: "Курьер фиксирует инцидент в процессе доставки",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "orderId", type: "id", required: true },
        { name: "issueType", type: "text", required: true },
        { name: "details", type: "text", required: false },
      ],
      effects: [
        { α: "add", target: "notifications", σ: "account" },
      ],
    },
    creates: "Notification",
    confirmation: "auto",
  },

  go_online: {
    name: "Выйти на линию",
    description: "Курьер меняет статус на online (доступен для назначений)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "user.status", value: "online" },
      ],
    },
    confirmation: "auto",
  },

  // ─── Диспетчер (6) ────────────────────────────────────────────────────────

  assign_courier_manual: {
    name: "Назначить курьера вручную",
    description: "Диспетчер вручную назначает курьера на заказ",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "orderId", type: "id", required: true },
        { name: "courierId", type: "id", required: true },
      ],
      effects: [
        { α: "add", target: "deliveries", σ: "account" },
      ],
    },
    creates: "Delivery",
    confirmation: "auto",
  },

  reassign_delivery: {
    name: "Переназначить доставку",
    description: "Диспетчер назначает другого курьера на уже созданную доставку",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "courierId", type: "id", required: true },
      ],
      witnesses: ["delivery.orderId", "delivery.courierId"],
      effects: [
        { α: "replace", target: "delivery.courierId" },
        { α: "replace", target: "delivery.status", value: "assigned" },
      ],
    },
    confirmation: "confirm",
  },

  escalate_order: {
    name: "Эскалировать заказ",
    description: "Диспетчер повышает приоритет заказа",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "priority", type: "text", required: false },
      ],
      effects: [
        { α: "replace", target: "order.priority" },
      ],
    },
    confirmation: "auto",
  },

  adjust_eta: {
    name: "Скорректировать ETA",
    description: "Диспетчер уточняет ожидаемое время доставки",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "etaDelivery", type: "datetime", required: true },
      ],
      effects: [
        { α: "replace", target: "order.etaDelivery" },
      ],
    },
    confirmation: "auto",
  },

  pause_zone: {
    name: "Поставить зону на паузу",
    description: "Диспетчер временно приостанавливает работу зоны доставки",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "reason", type: "text", required: false },
      ],
      witnesses: ["zone.name", "zone.city"],
      effects: [
        { α: "replace", target: "zone.active", value: false },
      ],
    },
    confirmation: "confirm",
  },

  create_dispatcher_assignment: {
    name: "Создать назначение диспетчера",
    description: "Закрепить диспетчера за зоной на смену",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "dispatcherId", type: "id", required: true },
        { name: "zoneId", type: "id", required: true },
        { name: "shiftStart", type: "datetime", required: true },
        { name: "shiftEnd", type: "datetime", required: true },
      ],
      effects: [
        { α: "add", target: "dispatcherAssignments", σ: "account" },
      ],
    },
    creates: "DispatcherAssignment",
    confirmation: "auto",
  },

  // ─── Агент (4) ────────────────────────────────────────────────────────────

  agent_auto_assign_courier: {
    name: "Агент: авто-назначение курьера",
    description: "Агент автоматически назначает ближайшего свободного курьера на заказ",
    α: "add",
    canBeCalledBy: ["agent"],
    confirmation: "none",
    particles: {
      parameters: [
        { name: "orderId", type: "id", required: true },
        { name: "courierId", type: "id", required: true },
        { name: "zoneId", type: "id", required: true },
      ],
      effects: [
        { α: "add", target: "deliveries", σ: "account" },
      ],
    },
    creates: "Delivery",
  },

  agent_auto_reassign: {
    name: "Агент: авто-переназначение",
    description: "Агент переназначает курьера при отказе или задержке",
    α: "replace",
    canBeCalledBy: ["agent"],
    confirmation: "none",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "courierId", type: "id", required: true },
        { name: "zoneId", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "delivery.courierId" },
        { α: "replace", target: "delivery.status", value: "assigned" },
      ],
    },
  },

  agent_auto_notify_customer: {
    name: "Агент: уведомить покупателя",
    description: "Агент отправляет автоматическое уведомление покупателю о статусе заказа",
    α: "add",
    canBeCalledBy: ["agent"],
    confirmation: "none",
    particles: {
      parameters: [
        { name: "recipientUserId", type: "id", required: true },
        { name: "template", type: "text", required: true },
        { name: "channel", type: "text", required: false },
      ],
      effects: [
        { α: "add", target: "notifications", σ: "account" },
      ],
    },
    creates: "Notification",
  },

  agent_auto_release_hold: {
    name: "Агент: освободить холд",
    description: "Агент снимает холд с платежа после истечения срока",
    α: "replace",
    canBeCalledBy: ["agent"],
    confirmation: "none",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "payment.status", value: "released" },
      ],
    },
  },

  // ─── Rule-triggered (6) ───────────────────────────────────────────────────
  // Вызываются из ruleEngine — category: "system", не показываются в UI

  rule_cancel_stale_order: {
    name: "Правило: авто-отмена зависшего заказа",
    description: "Отменяет заказ если merchant не ответил за 5 минут",
    α: "replace",
    category: "system",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "order.status", value: "cancelled" },
      ],
    },
  },

  rule_reassign_delivery: {
    name: "Правило: переназначение курьера",
    description: "Переназначает курьера если он не принял задание за 2 минуты",
    α: "replace",
    category: "system",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "delivery.courierId" },
        { α: "replace", target: "delivery.status", value: "assigned" },
      ],
    },
  },

  rule_escalate_order: {
    name: "Правило: эскалация заказа",
    description: "Эскалирует приоритет заказа если курьер не забрал за 15 минут",
    α: "replace",
    category: "system",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "order.priority", value: "escalated" },
      ],
    },
  },

  rule_release_expired_hold: {
    name: "Правило: снять просроченный холд",
    description: "Автоматически освобождает холд платежа через 24 часа",
    α: "replace",
    category: "system",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "replace", target: "payment.status", value: "released" },
      ],
    },
  },

  rule_send_review_reminder: {
    name: "Правило: напоминание об отзыве",
    description: "Отправляет напоминание покупателю оставить отзыв спустя 48 часов",
    α: "add",
    category: "system",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "add", target: "notifications", σ: "account" },
      ],
    },
    creates: "Notification",
  },

  rule_notify_cooking_delay: {
    name: "Правило: уведомить о задержке приготовления",
    description: "Уведомляет покупателя если приготовление затянулось более 10 минут",
    α: "add",
    category: "system",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
      ],
      effects: [
        { α: "add", target: "notifications", σ: "account" },
      ],
    },
    creates: "Notification",
  },

  // ─── Foreign / §19 (4) ────────────────────────────────────────────────────
  // Внешние системы пишут события через /api/effects — category: "system"

  foreign_ingest_location: {
    name: "Ingest: геопозиция курьера",
    description: "Периодический тик от courier-location-feed:3008",
    α: "add",
    category: "system",
    particles: {
      parameters: [
        { name: "courierId", type: "id", required: true },
        { name: "lat", type: "number", required: true },
        { name: "lng", type: "number", required: true },
        { name: "speed", type: "number", required: false },
        { name: "heading", type: "number", required: false },
      ],
      effects: [
        { α: "add", target: "courierLocations" },
      ],
    },
    creates: "CourierLocation",
  },

  foreign_geocode_ready: {
    name: "Ingest: геокод готов",
    description: "Geocoder-сервис вернул координаты для адреса",
    α: "add",
    category: "system",
    particles: {
      parameters: [
        { name: "text", type: "text", required: true },
        { name: "lat", type: "number", required: true },
        { name: "lng", type: "number", required: true },
        { name: "placeId", type: "text", required: false },
      ],
      effects: [
        { α: "add", target: "addresses" },
      ],
    },
    creates: "Address",
  },

  foreign_payment_webhook: {
    name: "Webhook: статус платежа",
    description: "Платёжная система присылает событие об изменении статуса платежа",
    α: "replace",
    category: "system",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "status", type: "text", required: true },
      ],
      effects: [
        { α: "replace", target: "payment.status" },
      ],
    },
  },

  foreign_notification_sent: {
    name: "Webhook: уведомление отправлено",
    description: "Notification-сервис подтверждает успешную отправку",
    α: "add",
    category: "system",
    particles: {
      parameters: [
        { name: "recipientUserId", type: "id", required: true },
        { name: "template", type: "text", required: true },
        { name: "channel", type: "text", required: true },
        { name: "sentAt", type: "datetime", required: false },
      ],
      effects: [
        { α: "add", target: "notifications" },
      ],
    },
    creates: "Notification",
  },
};
