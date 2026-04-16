/**
 * Delivery projections — 25 проекций по 5 ролям.
 * 3 canvas с map-primitive (Plan 3): order_tracker, active_delivery, dispatcher_map.
 * order_detail содержит irreversibleBadge (Plan 4).
 */
export const PROJECTIONS = {

  // ─── CUSTOMER (8) ───────────────────────────────────────────────

  customer_home: {
    name: "Рестораны",
    kind: "catalog",
    mainEntity: "Merchant",
    entities: ["Merchant"],
    filter: "item.status === 'active'",
    sort: "rating:desc",
    witnesses: ["name", "type", "rating", "deliveryTime", "minOrder"],
    clickNavigate: "merchant_catalog",
  },

  merchant_catalog: {
    name: "Меню",
    kind: "catalog",
    mainEntity: "MenuItem",
    entities: ["MenuItem", "Merchant"],
    idParam: "merchantId",
    filter: "item.merchantId === viewState.merchantId && item.available",
    sort: "category",
    witnesses: ["name", "price", "category", "description"],
    layout: "grid",
  },

  menu_detail: {
    name: "Блюдо",
    kind: "detail",
    mainEntity: "MenuItem",
    entities: ["MenuItem"],
    idParam: "menuItemId",
    witnesses: ["name", "price", "category", "description", "available"],
    actions: ["add_to_cart"],
  },

  cart: {
    name: "Корзина",
    kind: "detail",
    mainEntity: "Order",
    entities: ["Order", "OrderItem", "MenuItem"],
    filter: "item.status === 'draft' && item.customerId === viewer.id",
    witnesses: ["totalAmount", "status", "deliveryAddress"],
    subCollections: [
      { entity: "OrderItem", foreignKey: "orderId", title: "Позиции", addable: true },
    ],
  },

  checkout: {
    name: "Оформление заказа",
    kind: "wizard",
    mainEntity: "Order",
    steps: [
      {
        id: "address",
        label: "Адрес доставки",
        intent: "set_delivery_address",
        pick: ["deliveryAddress", "deliveryLat", "deliveryLon"],
      },
      {
        id: "confirm",
        label: "Подтверждение",
        intent: "place_order",
        summary: true,
      },
    ],
  },

  order_tracker: {
    name: "Отслеживание заказа",
    kind: "canvas",
    primitive: "map",
    mainEntity: "Order",
    entities: ["Order", "Delivery", "CourierLocation"],
    idParam: "orderId",
    roleVisibility: ["customer"],
    data: {
      layers: [
        {
          kind: "marker",
          source: "world.courierLocations",
          iconField: "status",
          label: "Курьер",
        },
        {
          kind: "route",
          source: "world.deliveries",
          filter: "item.orderId === viewState.orderId",
          label: "Маршрут",
        },
        {
          kind: "marker",
          source: "world.orders",
          filter: "item.id === viewState.orderId",
          iconField: "status",
          label: "Точка доставки",
        },
      ],
    },
    height: 500,
  },

  order_history: {
    name: "История заказов",
    kind: "catalog",
    mainEntity: "Order",
    entities: ["Order", "Merchant"],
    filter: "item.customerId === viewer.id && item.status !== 'draft'",
    sort: "createdAt:desc",
    witnesses: ["totalAmount", "status", "createdAt", "merchantId"],
    clickNavigate: "order_detail",
  },

  order_detail: {
    name: "Заказ",
    kind: "detail",
    mainEntity: "Order",
    entities: ["Order", "OrderItem", "Delivery"],
    idParam: "orderId",
    witnesses: ["totalAmount", "status", "deliveryAddress", "createdAt", "estimatedDelivery"],
    body: [
      { type: "heading", bind: "$.id" },
      { type: "irreversibleBadge" },
      { type: "badge", bind: "$.status" },
      { type: "field", bind: "$.totalAmount" },
      { type: "field", bind: "$.deliveryAddress" },
      { type: "field", bind: "$.createdAt" },
    ],
    subCollections: [
      { entity: "OrderItem", foreignKey: "orderId", title: "Состав заказа", addable: false },
    ],
  },

  // ─── COURIER (4) ────────────────────────────────────────────────

  courier_lobby: {
    name: "Доступные доставки",
    kind: "catalog",
    mainEntity: "Delivery",
    entities: ["Delivery", "Order"],
    filter: "item.status === 'pending' && !item.courierId",
    sort: "createdAt:desc",
    witnesses: ["orderId", "pickupAddress", "deliveryAddress", "estimatedDistance"],
    roleVisibility: ["courier"],
  },

  active_delivery: {
    name: "Текущая доставка",
    kind: "canvas",
    primitive: "map",
    mainEntity: "Delivery",
    entities: ["Delivery", "Order", "CourierLocation"],
    filter: "item.courierId === viewer.id && item.status === 'in_progress'",
    roleVisibility: ["courier"],
    data: {
      layers: [
        {
          kind: "marker",
          source: "world.courierLocations",
          filter: "item.courierId === viewer.id",
          iconField: "status",
          label: "Моя позиция",
        },
        {
          kind: "marker",
          source: "world.deliveries",
          filter: "item.courierId === viewer.id && item.status === 'in_progress'",
          coordsField: "pickupLat,pickupLon",
          label: "Точка забора",
        },
        {
          kind: "route",
          source: "world.deliveries",
          filter: "item.courierId === viewer.id && item.status === 'in_progress'",
          label: "Маршрут",
        },
      ],
    },
    height: 550,
  },

  delivery_history: {
    name: "История доставок",
    kind: "catalog",
    mainEntity: "Delivery",
    entities: ["Delivery"],
    filter: "item.courierId === viewer.id && (item.status === 'delivered' || item.status === 'cancelled')",
    sort: "actualDelivery:desc",
    witnesses: ["orderId", "status", "actualDelivery", "tip"],
    roleVisibility: ["courier"],
  },

  earnings_dashboard: {
    name: "Заработок",
    kind: "dashboard",
    mainEntity: "Delivery",
    entities: ["Delivery"],
    roleVisibility: ["courier"],
    filter: "item.courierId === viewer.id",
    widgets: [
      { projection: "delivery_history", title: "Всего доставок", size: "half" },
      { key: "total_earnings", title: "Общий заработок", size: "half", aggregate: "sum(deliveries, tip, courierId=viewer.id)" },
    ],
  },

  // ─── MERCHANT (4) ───────────────────────────────────────────────

  kds_board: {
    name: "Очередь заказов (KDS)",
    kind: "dashboard",
    mainEntity: "Order",
    entities: ["Order", "OrderItem"],
    roleVisibility: ["merchant"],
    filter: "item.merchantId === viewer.merchantId",
    widgets: [
      {
        key: "orders_pending",
        title: "Ожидают подтверждения",
        size: "full",
        inline: { entity: "Order", filter: "item.status === 'placed' && item.merchantId === viewer.merchantId", sort: "createdAt:asc" },
      },
      {
        key: "orders_cooking",
        title: "Готовятся",
        size: "full",
        inline: { entity: "Order", filter: "item.status === 'accepted' && item.merchantId === viewer.merchantId", sort: "createdAt:asc" },
      },
    ],
  },

  menu_management: {
    name: "Управление меню",
    kind: "catalog",
    mainEntity: "MenuItem",
    entities: ["MenuItem"],
    filter: "item.merchantId === viewer.merchantId",
    sort: "category",
    witnesses: ["name", "price", "category", "available"],
    roleVisibility: ["merchant"],
    actions: ["create_menu_item", "update_menu_item", "toggle_menu_item_availability"],
  },

  stop_list: {
    name: "Стоп-лист",
    kind: "catalog",
    mainEntity: "MenuItem",
    entities: ["MenuItem"],
    filter: "item.merchantId === viewer.merchantId && !item.available",
    sort: "name",
    witnesses: ["name", "price", "category"],
    roleVisibility: ["merchant"],
    actions: ["toggle_menu_item_availability"],
  },

  merchant_analytics: {
    name: "Аналитика мерчанта",
    kind: "dashboard",
    mainEntity: "Order",
    entities: ["Order", "MenuItem"],
    roleVisibility: ["merchant"],
    filter: "item.merchantId === viewer.merchantId",
    widgets: [
      {
        key: "orders_today",
        title: "Заказов сегодня",
        size: "half",
        aggregate: "count(orders, merchantId=viewer.merchantId, createdAt>=today)",
      },
      {
        key: "revenue_today",
        title: "Выручка сегодня",
        size: "half",
        aggregate: "sum(orders, totalAmount, merchantId=viewer.merchantId, createdAt>=today)",
      },
      {
        key: "avg_rating",
        title: "Средний рейтинг",
        size: "half",
        aggregate: "avg(reviews, rating, merchantId=viewer.merchantId)",
      },
    ],
  },

  // ─── DISPATCHER (5) ─────────────────────────────────────────────

  dispatcher_map: {
    name: "Карта диспетчера",
    kind: "canvas",
    primitive: "map",
    entities: ["Zone", "CourierLocation", "Order", "Delivery"],
    roleVisibility: ["dispatcher"],
    data: {
      layers: [
        {
          kind: "polygon",
          source: "world.zones",
          coordsField: "polygon",
          style: "zone",
          label: "Зоны доставки",
        },
        {
          kind: "marker",
          source: "world.courierLocations",
          iconField: "status",
          label: "Курьеры",
        },
        {
          kind: "marker",
          source: "world.orders",
          iconField: "status",
          filter: "item.status === 'ready' || item.status === 'picked_up'",
          label: "Заказы",
        },
      ],
    },
    height: 600,
  },

  orders_feed: {
    name: "Все заказы",
    kind: "catalog",
    mainEntity: "Order",
    entities: ["Order", "Merchant"],
    filter: "item.status !== 'draft'",
    sort: "createdAt:desc",
    witnesses: ["totalAmount", "status", "merchantId", "customerId", "createdAt"],
    roleVisibility: ["dispatcher"],
  },

  couriers_list: {
    name: "Курьеры",
    kind: "catalog",
    mainEntity: "Courier",
    entities: ["Courier"],
    sort: "name",
    witnesses: ["name", "status", "phone", "currentZoneId", "activeDeliveries"],
    roleVisibility: ["dispatcher"],
    layout: "table",
  },

  zones_catalog: {
    name: "Зоны доставки",
    kind: "catalog",
    mainEntity: "Zone",
    entities: ["Zone"],
    sort: "name",
    witnesses: ["name", "status", "deliveryFee", "estimatedTime"],
    roleVisibility: ["dispatcher"],
    actions: ["create_zone", "update_zone"],
  },

  assignments_form: {
    name: "Назначение курьера",
    kind: "wizard",
    mainEntity: "Delivery",
    roleVisibility: ["dispatcher"],
    steps: [
      {
        id: "select_order",
        label: "Выбор заказа",
        intent: "create_dispatcher_assignment",
        pick: ["orderId"],
        source: {
          collection: "orders",
          filter: "item.status === 'ready'",
        },
        display: ["id", "merchantId", "totalAmount"],
      },
      {
        id: "select_courier",
        label: "Выбор курьера",
        intent: "create_dispatcher_assignment",
        pick: ["courierId"],
        source: {
          collection: "couriers",
          filter: "item.status === 'available'",
        },
        display: ["name", "currentZoneId"],
      },
      {
        id: "confirm",
        label: "Подтвердить назначение",
        intent: "create_dispatcher_assignment",
        summary: true,
      },
    ],
  },

  // ─── SHARED / СИСТЕМНЫЕ (4) ─────────────────────────────────────

  settings: {
    name: "Настройки",
    kind: "form",
    mainEntity: "User",
    entities: ["User"],
    witnesses: ["name", "phone", "email", "defaultAddress", "notificationsEnabled"],
    editIntents: ["update_profile", "set_default_address"],
  },

  preapprovals_list: {
    name: "Пре-апрувы агента",
    kind: "catalog",
    mainEntity: "AgentPreapproval",
    entities: ["AgentPreapproval"],
    filter: "item.userId === viewer.id",
    sort: "createdAt:desc",
    witnesses: ["agentId", "intentPattern", "maxAmount", "expiresAt", "active"],
  },

  preapproval_form: {
    name: "Новый пре-апрув",
    kind: "wizard",
    mainEntity: "AgentPreapproval",
    steps: [
      {
        id: "intent",
        label: "Паттерн намерения",
        intent: "create_preapproval",
        pick: ["intentPattern", "agentId"],
      },
      {
        id: "limits",
        label: "Лимиты",
        intent: "create_preapproval",
        pick: ["maxAmount", "dailyLimit", "expiresAt"],
      },
      {
        id: "confirm",
        label: "Создать",
        intent: "create_preapproval",
        summary: true,
      },
    ],
  },

  scheduled_timers_debug: {
    name: "Scheduled Timers (debug)",
    kind: "catalog",
    mainEntity: "ScheduledTimer",
    entities: ["ScheduledTimer"],
    sort: "nextFireAt:asc",
    witnesses: ["ruleId", "userId", "nextFireAt", "lastFiredAt", "active"],
    filter: "item.active",
    // observability-проекция для Plan 2 (temporal scheduler);
    // ScheduledTimer — виртуальная сущность из rule_state (§4).
  },
};

export const ROOT_PROJECTIONS = [
  {
    section: "Клиент",
    icon: "🛒",
    items: ["customer_home", "merchant_catalog", "cart", "checkout", "order_tracker", "order_history", "order_detail"],
  },
  {
    section: "Курьер",
    icon: "🚴",
    items: ["courier_lobby", "active_delivery", "delivery_history", "earnings_dashboard"],
  },
  {
    section: "Мерчант",
    icon: "🏪",
    items: ["kds_board", "menu_management", "stop_list", "merchant_analytics"],
  },
  {
    section: "Диспетчер",
    icon: "🗺",
    items: ["dispatcher_map", "orders_feed", "couriers_list", "zones_catalog", "assignments_form"],
  },
  {
    section: "Настройки",
    icon: "⚙",
    items: ["settings", "preapprovals_list", "preapproval_form", "scheduled_timers_debug"],
  },
];
