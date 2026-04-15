export const PROJECTIONS = {
  listing_feed: {
    name: "Лента лотов",
    kind: "catalog",
    layout: "grid",
    query: "активные лоты, сортировка по дате завершения",
    entities: ["Listing", "Category", "User"],
    mainEntity: "Listing",
    routeEntities: ["Category"],
    filter: "status === 'active'",
    sort: "auctionEnd",
    witnesses: ["title", "currentPrice", { field: "bidCount", compute: "count(bids, listingId=target.id)" }, "auctionEnd", "images", "shippingFrom", "condition"],
  },

  listing_detail: {
    name: "Лот",
    kind: "detail",
    query: "детали одного лота с историей ставок",
    entities: ["Listing", "Bid"],
    mainEntity: "Listing",
    idParam: "listingId",
    routeEntities: ["Bid"],
    witnesses: ["title", "description", "currentPrice", "startPrice", "buyNowPrice", { field: "bidCount", compute: "count(bids, listingId=target.id)" }, "auctionEnd", "condition", "images", "shippingCost", "shippingFrom", "status"],
    subCollections: [
      { entity: "Bid", foreignKey: "listingId", sort: "-amount", label: "Ставки" },
    ],
  },

  listing_detail_edit: {
    name: "Редактирование лота",
    kind: "form",
    query: "редактирование полей лота",
    entities: ["Listing", "Category"],
    mainEntity: "Listing",
    idParam: "listingId",
    routeEntities: ["Category"],
    sourceProjection: "listing_detail",
    editIntents: [
      "edit_listing", "set_buy_now_price", "set_reserve_price",
      "set_listing_condition", "add_listing_image",
      "set_shipping_cost", "set_shipping_from", "extend_auction",
      "set_listing_category",
    ],
  },

  my_listings: {
    name: "Мои лоты",
    kind: "catalog",
    query: "лоты текущего пользователя",
    entities: ["Listing"],
    mainEntity: "Listing",
    routeEntities: [],
    filter: "sellerId === (viewer && viewer.id)",
    sort: "-createdAt",
    witnesses: ["title", "currentPrice", "bidCount", "status", "auctionEnd"],
    onItemClick: {
      action: "navigate",
      to: "listing_detail",
      params: { listingId: "item.id" },
    },
  },

  my_bids: {
    name: "Мои ставки",
    kind: "catalog",
    query: "ставки текущего пользователя",
    entities: ["Bid", "Listing"],
    mainEntity: "Bid",
    routeEntities: ["Listing"],
    filter: "bidderId === (viewer && viewer.id)",
    sort: "-createdAt",
    witnesses: ["amount", "status", "listing.title", "listing.currentPrice", "listing.auctionEnd"],
    onItemClick: {
      action: "navigate",
      to: "listing_detail",
      params: { listingId: "item.listingId" },
    },
  },

  order_list: {
    name: "Заказы",
    kind: "catalog",
    query: "заказы пользователя (покупки и продажи)",
    entities: ["Order", "Listing", "User"],
    mainEntity: "Order",
    routeEntities: ["Listing", "User"],
    filter: "buyerId === (viewer && viewer.id) || sellerId === (viewer && viewer.id)",
    sort: "-createdAt",
    witnesses: ["totalAmount", "status", "listing.title", "trackingNumber", "createdAt"],
    onItemClick: {
      action: "navigate",
      to: "order_detail",
      params: { orderId: "item.id" },
    },
  },

  order_detail: {
    name: "Заказ",
    kind: "detail",
    query: "детали одного заказа",
    entities: ["Order", "Listing", "User", "Dispute"],
    mainEntity: "Order",
    idParam: "orderId",
    routeEntities: ["Listing", "Dispute"],
    witnesses: ["totalAmount", "finalPrice", "shippingCost", "status", "trackingNumber", "shippingAddress", "paidAt", "shippedAt", "deliveredAt", "listing.title"],
  },

  watchlist: {
    name: "Избранное",
    kind: "catalog",
    query: "отслеживаемые лоты",
    entities: ["Watchlist", "Listing"],
    mainEntity: "Watchlist",
    routeEntities: ["Listing"],
    filter: "userId === (viewer && viewer.id)",
    sort: "-createdAt",
    witnesses: ["listing.title", "listing.currentPrice", "listing.auctionEnd", "listing.bidCount"],
    onItemClick: {
      action: "navigate",
      to: "listing_detail",
      params: { listingId: "item.listingId" },
    },
  },

  inbox: {
    name: "Сообщения",
    kind: "feed",
    query: "входящие и исходящие сообщения",
    entities: ["Message"],
    mainEntity: "Message",
    routeEntities: [],
    filter: "senderId === (viewer && viewer.id) || recipientId === (viewer && viewer.id)",
    sort: "-createdAt",
    witnesses: ["content", "read", "createdAt"],
  },

  seller_profile: {
    name: "Профиль продавца",
    kind: "detail",
    query: "профиль продавца с отзывами и активными лотами",
    entities: ["User", "Review", "Listing"],
    mainEntity: "User",
    idParam: "userId",
    routeEntities: ["Review", "Listing"],
    witnesses: ["name", "avatar", "bio", "rating", "salesCount", "location", "verified", "registeredAt"],
    subCollections: [
      { entity: "Listing", foreignKey: "sellerId", filter: "status === 'active'", label: "Активные лоты" },
      { entity: "Review", foreignKey: "targetUserId", sort: "-createdAt", label: "Отзывы" },
    ],
  },

  category_browse: {
    name: "Категории",
    kind: "catalog",
    query: "дерево категорий",
    entities: ["Category"],
    mainEntity: "Category",
    routeEntities: [],
    sort: "sortOrder",
    witnesses: ["name", "icon", "listingCount"],
  },

  dispute_detail: {
    name: "Спор",
    kind: "detail",
    query: "детали спора по заказу",
    entities: ["Dispute", "Order"],
    mainEntity: "Dispute",
    idParam: "disputeId",
    routeEntities: ["Order"],
    witnesses: ["reason", "description", "status", "resolution", "createdAt", "resolvedAt", "order.totalAmount"],
  },

  notifications: {
    name: "Уведомления",
    kind: "catalog",
    query: "уведомления пользователя",
    entities: ["Notification"],
    mainEntity: "Notification",
    routeEntities: [],
    filter: "userId === (viewer && viewer.id)",
    sort: "-createdAt",
    witnesses: ["title", "body", "type", "read", "createdAt"],
  },

  saved_searches: {
    name: "Сохранённые поиски",
    kind: "catalog",
    query: "сохранённые поисковые запросы",
    entities: ["SavedSearch"],
    mainEntity: "SavedSearch",
    routeEntities: [],
    filter: "userId === (viewer && viewer.id)",
    sort: "-createdAt",
    witnesses: ["query", "minPrice", "maxPrice", "notifyOnNew"],
  },
  sales_home: {
    name: "Главная",
    kind: "dashboard",
    query: "сводка активности",
    entities: [],
    widgets: [
      { projection: "listing_feed", title: "Новые лоты", size: "full" },
      { projection: "my_bids", title: "Мои ставки", size: "half" },
      { projection: "order_list", title: "Заказы", size: "half" },
    ],
  },
};

export const ROOT_PROJECTIONS = [
  { section: "Главная", icon: "🏠", items: [
    "sales_home",
  ]},
  { section: "Покупаю", icon: "🛒", items: [
    "listing_feed", "my_bids", "watchlist", "saved_searches",
  ]},
  { section: "Продаю", icon: "🏷️", items: [
    "my_listings", "order_list",
  ]},
  { section: "Общение", icon: "💬", items: [
    "inbox", "notifications",
  ]},
  { section: "Справочник", icon: "📂", items: [
    "category_browse", "seller_profile",
  ]},
];
