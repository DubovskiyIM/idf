/**
 * Домен «Мешок» — аукционная барахолка (eBay-style).
 * 225 намерений в 21 категории.
 */

const ef = (α, target, σ = "account", opts = {}) => ({ α, target, σ, ...opts });

function intent(name, entities, conditions, effects, witnesses, confirmation = "click", extra = {}) {
  return {
    name,
    particles: { entities, conditions, effects, witnesses, confirmation },
    antagonist: extra.antagonist || null,
    creates: extra.creates || null,
    ...(extra.parameters !== undefined ? { parameters: extra.parameters } : {}),
    ...(extra.irreversibility ? { irreversibility: extra.irreversibility } : {}),
    ...(extra.extended ? { extended: true } : {}),
    ...(extra.phase ? { phase: extra.phase } : {}),
  };
}

export const INTENTS = {

  // ===== ЛОТЫ / ЛИСТИНГИ (20) =====

  create_listing: intent("Создать лот", ["listing: Listing"],
    [], [ef("add", "listings")],
    ["title", "description", "startPrice"],
    "enter", { creates: "Listing(draft)" }),

  edit_listing: intent("Редактировать лот", ["listing: Listing"],
    ["listing.status = 'draft'", "listing.sellerId = me.id"],
    [ef("replace", "listing.title"), ef("replace", "listing.description"), ef("replace", "listing.startPrice")],
    ["title", "description", "startPrice", "condition"],
    "click", { phase: "investigation" }),

  publish_listing: intent("Опубликовать", ["listing: Listing"],
    ["listing.status = 'draft'", "listing.sellerId = me.id"],
    [ef("replace", "listing.status", "account", { value: "active" })],
    ["listing.title", "listing.startPrice", "listing.auctionEnd"],
    "click", { antagonist: "cancel_listing" }),

  cancel_listing: intent("Снять с продажи", ["listing: Listing"],
    ["listing.status = 'active'", "listing.sellerId = me.id", "count(bids, listingId=target.id) = 0"],
    [ef("replace", "listing.status", "account", { value: "cancelled" })],
    [], "click", { antagonist: "publish_listing", irreversibility: "medium" }),

  relist_item: intent("Выставить заново", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("add", "listings")],
    ["listing.title", "listing.startPrice"],
    "click", { creates: "Listing(draft)" }),

  set_buy_now_price: intent("Установить «Купить сейчас»", ["listing: Listing"],
    ["listing.status = 'active'", "listing.sellerId = me.id"],
    [ef("replace", "listing.buyNowPrice")],
    ["buyNowPrice", "listing.currentPrice"],
    "click"),

  set_reserve_price: intent("Установить резервную цену", ["listing: Listing"],
    ["listing.status = 'draft'", "listing.sellerId = me.id"],
    [ef("replace", "listing.reservePrice")],
    ["reservePrice"],
    "click"),

  lower_start_price: intent("Снизить начальную цену", ["listing: Listing"],
    ["listing.status = 'active'", "listing.sellerId = me.id", "count(bids, listingId=target.id) = 0"],
    [ef("replace", "listing.startPrice"), ef("replace", "listing.currentPrice")],
    ["startPrice"],
    "click"),

  extend_auction: intent("Продлить аукцион", ["listing: Listing"],
    ["listing.status = 'active'", "listing.sellerId = me.id"],
    [ef("replace", "listing.auctionEnd")],
    ["auctionEnd"],
    "click"),

  set_listing_condition: intent("Указать состояние", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.condition")],
    ["condition"],
    "click"),

  add_listing_image: intent("Добавить фото", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.images")],
    ["images"],
    "click"),

  set_shipping_cost: intent("Указать стоимость доставки", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.shippingCost")],
    ["shippingCost"],
    "click"),

  set_shipping_from: intent("Указать город отправки", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.shippingFrom")],
    ["shippingFrom"],
    "click"),

  set_listing_category: intent("Выбрать категорию", ["listing: Listing", "category: Category"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.categoryId")],
    ["categoryId", "category.name"],
    "click"),

  feature_listing: intent("В рекомендуемые", ["listing: Listing"],
    ["listing.status = 'active'", "listing.moderatorOnly = true"],
    [ef("replace", "listing.featured", "account", { value: true })],
    [], "click", { antagonist: "unfeature_listing" }),

  unfeature_listing: intent("Убрать из рекомендуемых", ["listing: Listing"],
    ["listing.featured = true", "listing.moderatorOnly = true"],
    [ef("replace", "listing.featured", "account", { value: false })],
    [], "click", { antagonist: "feature_listing" }),

  suspend_listing: intent("Заблокировать лот", ["listing: Listing"],
    ["listing.status = 'active'", "listing.moderatorOnly = true"],
    [ef("replace", "listing.status", "account", { value: "suspended" })],
    [], "click", { irreversibility: "medium" }),

  restore_listing: intent("Восстановить лот", ["listing: Listing"],
    ["listing.status = 'suspended'", "listing.moderatorOnly = true"],
    [ef("replace", "listing.status", "account", { value: "active" })],
    [], "click"),

  remove_listing: intent("Удалить лот", ["listing: Listing"],
    [],
    [ef("remove", "listings")],
    [], "click", { irreversibility: "high" }),

  duplicate_listing: intent("Дублировать лот", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("add", "listings")],
    ["listing.title", "listing.startPrice"],
    "click", { creates: "Listing(draft)" }),


  // ===== СТАВКИ / АУКЦИОН (12) =====

  place_bid: intent("Сделать ставку", ["bid: Bid", "listing: Listing"],
    ["listing.status = 'active'"],
    [ef("add", "bids"), ef("replace", "listing.currentPrice"), ef("replace", "listing.bidCount")],
    ["amount", "listing.currentPrice", "listing.title"],
    "click"),

  set_auto_bid: intent("Автоставка", ["bid: Bid", "listing: Listing"],
    ["listing.status = 'active'"],
    [ef("add", "bids"), ef("replace", "listing.currentPrice")],
    ["maxAmount", "listing.currentPrice"],
    "enter", { creates: "Bid(active)" }),

  retract_bid: intent("Отозвать ставку", ["bid: Bid"],
    ["bid.status = 'active'", "bid.bidderId = me.id"],
    [ef("replace", "bid.status", "account", { value: "retracted" })],
    [], "click", { irreversibility: "medium" }),

  buy_now: intent("Купить сейчас", ["listing: Listing"],
    ["listing.status = 'active'", "listing.buyNowPrice != null"],
    [ef("replace", "listing.status", "account", { value: "sold" }), ef("add", "orders")],
    ["listing.title", "listing.buyNowPrice"],
    "click", { creates: "Order(pending_payment)" }),

  accept_bid: intent("Принять ставку досрочно", ["bid: Bid", "listing: Listing"],
    ["listing.status = 'active'", "listing.sellerId = me.id", "bid.status = 'active'"],
    [ef("replace", "listing.status", "account", { value: "sold" }), ef("replace", "bid.status", "account", { value: "won" }), ef("add", "orders")],
    ["bid.amount"], "click", { creates: "Order(pending_payment)" }),

  block_bidder: intent("Заблокировать участника", ["listing: Listing", "user: User"],
    ["listing.sellerId = me.id"],
    [ef("add", "blockedBidders")],
    ["user.name"], "click"),

  unblock_bidder: intent("Разблокировать участника", ["listing: Listing", "user: User"],
    ["listing.sellerId = me.id"],
    [ef("remove", "blockedBidders")],
    ["user.name"], "click", { antagonist: "block_bidder" }),

  increase_bid: intent("Повысить ставку", ["bid: Bid", "listing: Listing"],
    ["bid.bidderId = me.id", "listing.status = 'active'"],
    [ef("replace", "bid.amount"), ef("replace", "listing.currentPrice")],
    ["amount", "listing.currentPrice"],
    "enter"),

  snipe_protect: intent("Антиснайпер", ["listing: Listing"],
    ["listing.status = 'active'", "listing.sellerId = me.id"],
    [ef("replace", "listing.auctionEnd")],
    [], "click"),

  view_bid_history: intent("История ставок", ["listing: Listing"],
    ["listing.status = 'active'"],
    [],
    ["listing.bidCount", "listing.currentPrice"],
    "click", { parameters: [] }),

  make_offer: intent("Предложить свою цену", ["listing: Listing"],
    ["listing.status = 'active'"],
    [ef("add", "offers")],
    ["listing.title", "listing.currentPrice"],
    "enter", { creates: "Offer" }),

  accept_offer: intent("Принять предложение", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.status", "account", { value: "sold" }), ef("add", "orders")],
    [], "click", { creates: "Order(pending_payment)", antagonist: "reject_offer" }),


  // ===== ЗАКАЗЫ / ОПЛАТА (15) =====

  pay_order: intent("Оплатить", ["order: Order"],
    ["order.status = 'pending_payment'", "order.buyerId = me.id"],
    [ef("replace", "order.status", "account", { value: "paid" }), ef("replace", "order.paidAt")],
    ["paymentMethod", "order.totalAmount"],
    "click"),

  ship_order: intent("Отправить", ["order: Order"],
    ["order.status = 'paid'", "order.sellerId = me.id"],
    [ef("replace", "order.status", "account", { value: "shipped" }), ef("replace", "order.shippedAt")],
    ["trackingNumber"],
    "click"),

  add_tracking: intent("Добавить трек-номер", ["order: Order"],
    ["order.sellerId = me.id"],
    [ef("replace", "order.trackingNumber")],
    ["trackingNumber"],
    "click"),

  confirm_delivery: intent("Подтвердить получение", ["order: Order"],
    ["order.status = 'shipped'", "order.buyerId = me.id"],
    [ef("replace", "order.status", "account", { value: "delivered" }), ef("replace", "order.deliveredAt")],
    [], "click"),

  complete_order: intent("Завершить сделку", ["order: Order"],
    ["order.status = 'delivered'"],
    [ef("replace", "order.status", "account", { value: "completed" })],
    [], "click"),

  cancel_order: intent("Отменить заказ", ["order: Order"],
    ["order.status = 'pending_payment'"],
    [ef("replace", "order.status", "account", { value: "cancelled" })],
    [], "click", { irreversibility: "medium" }),

  request_refund: intent("Запросить возврат", ["order: Order"],
    ["order.buyerId = me.id"],
    [ef("replace", "order.status", "account", { value: "refunded" })],
    ["order.totalAmount"],
    "click", { irreversibility: "medium" }),

  process_refund: intent("Оформить возврат", ["order: Order"],
    ["order.sellerId = me.id"],
    [ef("replace", "order.status", "account", { value: "refunded" })],
    ["order.totalAmount"],
    "click"),

  set_shipping_address: intent("Указать адрес доставки", ["order: Order"],
    ["order.buyerId = me.id"],
    [ef("replace", "order.shippingAddress")],
    ["shippingAddress"],
    "click"),

  choose_payment_method: intent("Выбрать способ оплаты", ["order: Order"],
    ["order.buyerId = me.id"],
    [ef("replace", "order.paymentMethod")],
    ["paymentMethod"],
    "click"),

  mark_as_gift: intent("Пометить как подарок", ["order: Order"],
    ["order.buyerId = me.id"],
    [ef("replace", "order.isGift", "account", { value: true })],
    [], "click"),

  add_order_note: intent("Добавить примечание", ["order: Order"],
    [],
    [ef("replace", "order.note")],
    ["note"],
    "click"),

  combine_shipping: intent("Объединить доставку", ["order: Order"],
    ["order.sellerId = me.id"],
    [ef("replace", "order.shippingCost")],
    ["shippingCost"],
    "click"),

  print_shipping_label: intent("Печать наклейки", ["order: Order"],
    ["order.status = 'paid'", "order.sellerId = me.id"],
    [],
    ["order.shippingAddress", "order.trackingNumber"],
    "click", { parameters: [] }),

  view_order_timeline: intent("Хронология заказа", ["order: Order"],
    [],
    [],
    ["order.status", "order.paidAt", "order.shippedAt", "order.deliveredAt"],
    "click", { parameters: [] }),


  // ===== ОТЗЫВЫ (8) =====

  leave_review: intent("Оставить отзыв", ["review: Review", "order: Order"],
    ["order.status = 'completed'"],
    [ef("add", "reviews")],
    ["review.rating", "review.text"],
    "enter", { creates: "Review" }),

  edit_review: intent("Редактировать отзыв", ["review: Review"],
    ["review.authorId = me.id"],
    [ef("replace", "review.text"), ef("replace", "review.rating")],
    ["review.text", "review.rating"],
    "click", { phase: "investigation" }),

  delete_review: intent("Удалить отзыв", ["review: Review"],
    ["review.authorId = me.id"],
    [ef("remove", "reviews")],
    [], "click", { irreversibility: "medium" }),

  respond_to_review: intent("Ответить на отзыв", ["review: Review"],
    [],
    [ef("replace", "review.response")],
    ["response", "review.text", "review.rating"],
    "click"),

  report_review: intent("Пожаловаться на отзыв", ["review: Review"],
    [],
    [ef("add", "reports")],
    ["review.text"],
    "click"),

  remove_review: intent("Удалить отзыв (модератор)", ["review: Review"],
    [],
    [ef("remove", "reviews")],
    [], "click", { irreversibility: "medium" }),

  thank_reviewer: intent("Поблагодарить за отзыв", ["review: Review"],
    [],
    [ef("replace", "review.thanked", "account", { value: true })],
    [], "click"),

  flag_review_helpful: intent("Отзыв полезен", ["review: Review"],
    [],
    [ef("replace", "review.helpfulCount")],
    [], "click"),


  // ===== СПОРЫ / ДИСПУТЫ (7) =====

  open_dispute: intent("Открыть спор", ["dispute: Dispute", "order: Order"],
    [],
    [ef("add", "disputes"), ef("replace", "order.status", "account", { value: "disputed" })],
    ["dispute.reason", "dispute.description"],
    "enter", { creates: "Dispute(open)" }),

  respond_to_dispute: intent("Ответить на спор", ["dispute: Dispute"],
    ["dispute.status = 'open'"],
    [ef("replace", "dispute.status", "account", { value: "under_review" })],
    ["dispute.description"],
    "click"),

  resolve_dispute: intent("Разрешить спор", ["dispute: Dispute"],
    ["dispute.status = 'under_review'"],
    [ef("replace", "dispute.status", "account", { value: "resolved" }), ef("replace", "dispute.resolution"), ef("replace", "dispute.resolvedAt")],
    ["resolution"],
    "click"),

  escalate_dispute: intent("Эскалировать спор", ["dispute: Dispute"],
    ["dispute.status = 'open'"],
    [ef("replace", "dispute.status", "account", { value: "escalated" })],
    [], "click"),

  close_dispute: intent("Закрыть спор", ["dispute: Dispute"],
    [],
    [ef("replace", "dispute.status", "account", { value: "closed" })],
    [], "click"),

  add_dispute_evidence: intent("Добавить доказательство", ["dispute: Dispute"],
    ["dispute.status != 'closed'"],
    [ef("add", "disputeEvidence")],
    ["dispute.description"],
    "click"),

  accept_resolution: intent("Принять решение", ["dispute: Dispute"],
    ["dispute.status = 'resolved'"],
    [ef("replace", "dispute.status", "account", { value: "closed" })],
    [], "click"),


  // ===== ИЗБРАННОЕ / НАБЛЮДЕНИЕ (5) =====

  add_to_watchlist: intent("В избранное", ["watchlist: Watchlist", "listing: Listing"],
    ["listing.status = 'active'"],
    [ef("add", "watchlists")],
    ["listing.title"], "click",
    { antagonist: "remove_from_watchlist", parameters: [] }),

  remove_from_watchlist: intent("Убрать из избранного", ["watchlist: Watchlist"],
    ["watchlist.userId = me.id"],
    [ef("remove", "watchlists")],
    [], "click", { antagonist: "add_to_watchlist", parameters: [] }),

  save_search: intent("Сохранить поиск", ["savedSearch: SavedSearch"],
    [],
    [ef("add", "savedSearches")],
    ["savedSearch.query", "savedSearch.categoryId", "savedSearch.minPrice", "savedSearch.maxPrice"],
    "enter", { creates: "SavedSearch" }),

  delete_saved_search: intent("Удалить сохранённый поиск", ["savedSearch: SavedSearch"],
    ["savedSearch.userId = me.id"],
    [ef("remove", "savedSearches")],
    [], "click"),

  toggle_search_notifications: intent("Уведомления по поиску", ["savedSearch: SavedSearch"],
    ["savedSearch.userId = me.id"],
    [ef("replace", "savedSearch.notifyOnNew")],
    ["notifyOnNew"],
    "click"),


  // ===== СООБЩЕНИЯ (8) =====

  send_message: intent("Написать сообщение", ["message: Message", "user: User"],
    [],
    [ef("add", "messages")],
    ["content"],
    "enter", { creates: "Message" }),

  send_listing_question: intent("Задать вопрос по лоту", ["message: Message", "listing: Listing"],
    ["listing.status = 'active'"],
    [ef("add", "messages")],
    ["content", "listing.title"],
    "enter", { creates: "Message" }),

  reply_to_message: intent("Ответить", ["message: Message"],
    [],
    [ef("add", "messages")],
    ["content"],
    "enter", { creates: "Message" }),

  mark_message_read: intent("Прочитано", ["message: Message"],
    ["message.read = false"],
    [ef("replace", "message.read", "account", { value: true })],
    [], "click", { parameters: [] }),

  delete_message: intent("Удалить сообщение", ["message: Message"],
    ["message.senderId = me.id"],
    [ef("remove", "messages")],
    [], "click"),

  report_message: intent("Пожаловаться", ["message: Message"],
    [],
    [ef("add", "reports")],
    ["message.content"],
    "click"),

  mark_all_read: intent("Всё прочитано", ["message: Message"],
    [],
    [ef("replace", "message.read", "account", { value: true })],
    [], "click", { extended: true }),

  send_order_message: intent("Сообщение по заказу", ["message: Message", "order: Order"],
    [],
    [ef("add", "messages")],
    ["message.content"],
    "enter", { creates: "Message" }),


  // ===== ПРОФИЛЬ / ПОЛЬЗОВАТЕЛИ (10) =====

  update_profile: intent("Редактировать профиль", ["user: User"],
    ["user.id = me.id"],
    [ef("replace", "user.name"), ef("replace", "user.bio"), ef("replace", "user.location")],
    ["user.name", "user.bio", "user.location"],
    "click", { phase: "investigation" }),

  set_avatar: intent("Установить аватар", ["user: User"],
    ["user.id = me.id"],
    [ef("replace", "user.avatar")],
    ["avatar"],
    "click"),

  verify_identity: intent("Верифицировать аккаунт", ["user: User"],
    ["user.id = me.id", "user.verified = false"],
    [ef("replace", "user.verified", "account", { value: true })],
    [], "click"),

  add_shipping_address: intent("Добавить адрес", ["user: User"],
    ["user.id = me.id"],
    [ef("add", "addresses")],
    [],
    "enter"),

  warn_user: intent("Предупредить пользователя", ["user: User"],
    [],
    [ef("add", "warnings")],
    ["user.name"],
    "click"),

  suspend_user: intent("Заблокировать пользователя", ["user: User"],
    ["user.status != 'banned'"],
    [ef("replace", "user.status", "account", { value: "suspended" })],
    ["user.name"],
    "click", { irreversibility: "high", antagonist: "unban_user" }),

  ban_user: intent("Забанить пользователя", ["user: User"],
    [],
    [ef("replace", "user.status", "account", { value: "banned" })],
    ["user.name"],
    "click", { irreversibility: "high" }),

  unban_user: intent("Разбанить", ["user: User"],
    ["user.status = 'banned'"],
    [ef("replace", "user.status", "account", { value: "active" })],
    ["user.name"],
    "click", { antagonist: "suspend_user" }),

  follow_seller: intent("Подписаться на продавца", ["user: User"],
    [],
    [ef("add", "follows")],
    ["user.name"],
    "click", { antagonist: "unfollow_seller", parameters: [] }),

  unfollow_seller: intent("Отписаться от продавца", ["user: User"],
    [],
    [ef("remove", "follows")],
    ["user.name"],
    "click", { antagonist: "follow_seller", parameters: [] }),


  // ===== ПОИСК / НАВИГАЦИЯ (8) =====

  search_listings: intent("Поиск лотов", [],
    [],
    [],
    ["query", "results"],
    "click"),

  filter_by_category: intent("Фильтр по категории", ["category: Category"],
    [],
    [],
    ["category.name", "category.listingCount"],
    "click", { parameters: [] }),

  filter_by_price: intent("Фильтр по цене", [],
    [],
    [],
    ["minPrice", "maxPrice"],
    "click"),

  filter_by_condition: intent("Фильтр по состоянию", [],
    [],
    [],
    ["condition"],
    "click"),

  sort_listings: intent("Сортировка", [],
    [],
    [],
    ["sortField", "sortDirection"],
    "click"),

  view_seller_profile: intent("Профиль продавца", ["user: User"],
    [],
    [],
    ["user.name", "user.rating", "user.salesCount"],
    "click", { parameters: [] }),

  view_similar_listings: intent("Похожие лоты", ["listing: Listing"],
    [],
    [],
    ["listing.title", "listing.categoryId"],
    "click", { parameters: [] }),

  view_category_tree: intent("Дерево категорий", [],
    [],
    [],
    ["results"],
    "click", { parameters: [] }),


  // ===== УВЕДОМЛЕНИЯ (5) =====

  mark_notification_read: intent("Прочитать уведомление", ["notification: Notification"],
    ["notification.read = false"],
    [ef("replace", "notification.read", "account", { value: true })],
    [], "click", { parameters: [] }),

  clear_all_notifications: intent("Очистить уведомления", ["notification: Notification"],
    [],
    [ef("remove", "notifications")],
    [], "click", { extended: true }),

  set_notification_preferences: intent("Настройки уведомлений", [],
    [],
    [],
    ["emailNotifications", "pushNotifications", "bidNotifications", "watchlistNotifications"],
    "click"),

  subscribe_to_listing: intent("Подписаться на лот", ["listing: Listing"],
    ["listing.status = 'active'"],
    [ef("add", "subscriptions")],
    ["listing.title"],
    "click", { parameters: [] }),

  unsubscribe_from_listing: intent("Отписаться от лота", ["listing: Listing"],
    ["listing.subscribed = true"],
    [ef("remove", "subscriptions")],
    [], "click", { antagonist: "subscribe_to_listing", parameters: [] }),


  // ===== ЖАЛОБЫ / МОДЕРАЦИЯ (7) =====

  report_listing: intent("Пожаловаться на лот", ["listing: Listing"],
    ["listing.status = 'active'"],
    [ef("add", "reports")],
    ["listing.title"],
    "click"),

  report_user: intent("Пожаловаться на пользователя", ["user: User"],
    [],
    [ef("add", "reports")],
    ["user.name"],
    "click"),

  reject_offer: intent("Отклонить предложение", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [],
    [], "click", { antagonist: "accept_offer" }),

  approve_listing: intent("Одобрить лот (модератор)", ["listing: Listing"],
    ["listing.status = 'draft'"],
    [ef("replace", "listing.status", "account", { value: "active" })],
    [], "click"),

  bulk_relist: intent("Массовое перевыставление", ["listing: Listing"],
    [],
    [ef("add", "listings")],
    [], "click", { extended: true, creates: "Listing(draft)" }),

  export_listings: intent("Экспорт лотов", [],
    [],
    [],
    ["results"],
    "click", { parameters: [] }),

  view_analytics: intent("Аналитика продаж", [],
    [],
    [],
    ["totalSales", "avgPrice", "viewCount"],
    "click", { parameters: [] }),


  // =====================================================================
  //  WAVE 2 — ещё 100 намерений (11 категорий)
  // =====================================================================

  // ===== ШАБЛОНЫ ЛОТОВ (8) =====

  create_template: intent("Создать шаблон", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("add", "templates")],
    ["title", "description"],
    "enter", { creates: "Template" }),

  apply_template: intent("Применить шаблон", ["listing: Listing"],
    ["listing.status = 'draft'", "listing.sellerId = me.id"],
    [ef("replace", "listing.title"), ef("replace", "listing.description"), ef("replace", "listing.startPrice")],
    ["title"],
    "click"),

  edit_template: intent("Редактировать шаблон", ["listing: Listing"],
    [],
    [ef("replace", "listing.title"), ef("replace", "listing.description")],
    ["title", "description"],
    "click", { phase: "investigation" }),

  delete_template: intent("Удалить шаблон", ["listing: Listing"],
    [],
    [ef("remove", "templates")],
    [], "click", { irreversibility: "medium" }),

  save_as_template: intent("Сохранить как шаблон", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("add", "templates")],
    ["listing.title"],
    "click", { creates: "Template" }),

  rename_template: intent("Переименовать шаблон", ["listing: Listing"],
    [],
    [ef("replace", "listing.title")],
    ["title"],
    "click"),

  set_template_defaults: intent("Настроить шаблон", ["listing: Listing"],
    [],
    [ef("replace", "listing.shippingCost"), ef("replace", "listing.condition")],
    ["shippingCost", "condition"],
    "click"),

  import_template: intent("Импорт шаблонов", [],
    [],
    [ef("add", "templates")],
    [],
    "click", { creates: "Template" }),


  // ===== ПРОМО И ПРОДВИЖЕНИЕ (10) =====

  promote_listing: intent("Продвинуть лот", ["listing: Listing"],
    ["listing.status = 'active'", "listing.sellerId = me.id"],
    [ef("replace", "listing.promoted", "account", { value: true })],
    ["listing.title"], "click"),

  cancel_promotion: intent("Отменить продвижение", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.promoted", "account", { value: false })],
    [], "click", { antagonist: "promote_listing" }),

  create_coupon: intent("Создать купон", [],
    [],
    [ef("add", "coupons")],
    ["code", "discountPercent", "expiresAt"],
    "enter", { creates: "Coupon" }),

  deactivate_coupon: intent("Деактивировать купон", [],
    [],
    [ef("replace", "coupon.active", "account", { value: false })],
    [], "click"),

  apply_coupon: intent("Применить купон", ["order: Order"],
    ["order.status = 'pending_payment'", "order.buyerId = me.id"],
    [ef("replace", "order.couponCode"), ef("replace", "order.totalAmount")],
    ["couponCode"],
    "click"),

  create_bundle: intent("Создать комплект", [],
    [],
    [ef("add", "bundles")],
    ["title", "discountPercent"],
    "enter", { creates: "Bundle" }),

  add_to_bundle: intent("Добавить в комплект", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.bundleId")],
    ["bundleId"],
    "click"),

  remove_from_bundle: intent("Убрать из комплекта", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.bundleId", "account", { value: null })],
    [], "click"),

  schedule_listing: intent("Запланировать публикацию", ["listing: Listing"],
    ["listing.status = 'draft'", "listing.sellerId = me.id"],
    [ef("replace", "listing.scheduledAt")],
    ["scheduledAt"],
    "click"),

  set_minimum_bid_increment: intent("Мин. шаг ставки", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.minBidIncrement")],
    ["minBidIncrement"],
    "click"),


  // ===== ДОСТАВКА И ЛОГИСТИКА (10) =====

  create_shipping_profile: intent("Создать профиль доставки", [],
    [],
    [ef("add", "shippingProfiles")],
    ["name", "cost", "estimatedDays"],
    "enter", { creates: "ShippingProfile" }),

  edit_shipping_profile: intent("Редактировать профиль", [],
    [],
    [ef("replace", "shippingProfile.name"), ef("replace", "shippingProfile.cost")],
    ["name", "cost", "estimatedDays"],
    "click", { phase: "investigation" }),

  delete_shipping_profile: intent("Удалить профиль доставки", [],
    [],
    [ef("remove", "shippingProfiles")],
    [], "click", { irreversibility: "medium" }),

  set_international_shipping: intent("Международная доставка", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.internationalShipping", "account", { value: true })],
    [], "click"),

  disable_international_shipping: intent("Только внутренняя", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.internationalShipping", "account", { value: false })],
    [], "click", { antagonist: "set_international_shipping" }),

  set_free_shipping: intent("Бесплатная доставка", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.shippingCost", "account", { value: 0 })],
    [], "click"),

  calculate_shipping: intent("Рассчитать доставку", ["order: Order"],
    [],
    [],
    ["order.shippingAddress", "weight"],
    "click", { parameters: [] }),

  request_pickup: intent("Запросить самовывоз", ["order: Order"],
    ["order.buyerId = me.id"],
    [ef("replace", "order.shippingMethod", "account", { value: "pickup" })],
    [], "click"),

  confirm_shipment: intent("Подтвердить отправку", ["order: Order"],
    ["order.sellerId = me.id"],
    [ef("replace", "order.status", "account", { value: "shipped" })],
    ["trackingNumber", "shippingProvider"],
    "click"),

  report_shipping_issue: intent("Проблема с доставкой", ["order: Order"],
    [],
    [ef("add", "shippingIssues")],
    ["description"],
    "enter", { creates: "ShippingIssue" }),


  // ===== ПЛАТЁЖНАЯ СИСТЕМА (9) =====

  add_payment_method: intent("Добавить способ оплаты", [],
    [],
    [ef("add", "paymentMethods")],
    ["type", "cardLastFour"],
    "enter", { creates: "PaymentMethod" }),

  remove_payment_method: intent("Удалить способ оплаты", [],
    [],
    [ef("remove", "paymentMethods")],
    [], "click", { irreversibility: "medium" }),

  set_default_payment: intent("Основной способ", [],
    [],
    [ef("replace", "paymentMethod.isDefault", "account", { value: true })],
    [], "click"),

  request_payout: intent("Вывести средства", [],
    [],
    [ef("add", "payouts")],
    ["amount"],
    "enter", { creates: "Payout" }),

  view_payout_history: intent("История выплат", [],
    [],
    [],
    ["results"],
    "click", { parameters: [] }),

  set_auto_payout: intent("Автовыплата", [],
    [],
    [ef("replace", "user.autoPayoutEnabled", "account", { value: true })],
    [], "click"),

  disable_auto_payout: intent("Отключить автовыплату", [],
    [],
    [ef("replace", "user.autoPayoutEnabled", "account", { value: false })],
    [], "click", { antagonist: "set_auto_payout" }),

  issue_partial_refund: intent("Частичный возврат", ["order: Order"],
    ["order.sellerId = me.id"],
    [ef("replace", "order.refundAmount")],
    ["refundAmount"],
    "click"),

  apply_store_credit: intent("Списать бонусы", ["order: Order"],
    ["order.buyerId = me.id"],
    [ef("replace", "order.creditApplied")],
    ["creditAmount"],
    "click"),


  // ===== СОЦИАЛЬНЫЕ ФУНКЦИИ (10) =====

  share_listing: intent("Поделиться лотом", ["listing: Listing"],
    [],
    [],
    ["listing.title"],
    "click", { parameters: [] }),

  invite_friend: intent("Пригласить друга", [],
    [],
    [ef("add", "invitations")],
    ["email"],
    "enter", { creates: "Invitation" }),

  create_collection: intent("Создать подборку", [],
    [],
    [ef("add", "collections")],
    ["title", "description"],
    "enter", { creates: "Collection" }),

  add_to_collection: intent("В подборку", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("add", "collectionItems")],
    ["collectionId"],
    "click"),

  remove_from_collection: intent("Убрать из подборки", ["listing: Listing"],
    [],
    [ef("remove", "collectionItems")],
    [], "click"),

  publish_collection: intent("Опубликовать подборку", [],
    [],
    [ef("replace", "collection.public", "account", { value: true })],
    [], "click"),

  like_listing: intent("Нравится", ["listing: Listing"],
    [],
    [ef("replace", "listing.likeCount")],
    [], "click", { antagonist: "unlike_listing", parameters: [] }),

  unlike_listing: intent("Не нравится", ["listing: Listing"],
    [],
    [ef("replace", "listing.likeCount")],
    [], "click", { antagonist: "like_listing", parameters: [] }),

  comment_on_listing: intent("Комментарий к лоту", ["listing: Listing"],
    ["listing.status = 'active'"],
    [ef("add", "comments")],
    ["content"],
    "enter", { creates: "Comment" }),

  delete_comment: intent("Удалить комментарий", [],
    [],
    [ef("remove", "comments")],
    [], "click"),


  // ===== ВЕРИФИКАЦИЯ И ДОВЕРИЕ (9) =====

  request_verification: intent("Запросить верификацию", [],
    [],
    [ef("add", "verificationRequests")],
    ["documentType"],
    "enter", { creates: "VerificationRequest" }),

  approve_verification: intent("Одобрить верификацию", ["user: User"],
    [],
    [ef("replace", "user.verified", "account", { value: true })],
    [], "click"),

  reject_verification: intent("Отклонить верификацию", ["user: User"],
    [],
    [ef("replace", "user.verified", "account", { value: false })],
    [], "click", { antagonist: "approve_verification" }),

  request_authenticity_check: intent("Проверка подлинности", ["listing: Listing"],
    ["listing.moderatorOnly = true"],
    [ef("add", "authenticityChecks")],
    ["listing.title"],
    "click"),

  certify_listing: intent("Сертифицировать лот", ["listing: Listing"],
    ["listing.moderatorOnly = true"],
    [ef("replace", "listing.certified", "account", { value: true })],
    [], "click"),

  report_counterfeit: intent("Подделка", ["listing: Listing"],
    ["listing.moderatorOnly = true"],
    [ef("add", "reports")],
    ["description"],
    "click"),

  leave_seller_feedback: intent("Отзыв о продавце", ["user: User"],
    [],
    [ef("add", "sellerFeedback")],
    ["rating", "text"],
    "enter", { creates: "SellerFeedback" }),

  request_return: intent("Запрос возврата товара", ["order: Order"],
    ["order.buyerId = me.id"],
    [ef("add", "returnRequests")],
    ["reason", "description"],
    "enter", { creates: "ReturnRequest" }),

  approve_return: intent("Одобрить возврат", ["order: Order"],
    ["order.sellerId = me.id"],
    [ef("replace", "order.status", "account", { value: "return_approved" })],
    [], "click", { antagonist: "reject_return" }),


  // ===== УВЕДОМЛЕНИЯ И ПОДПИСКИ (8) =====

  set_price_alert: intent("Оповещение о цене", ["listing: Listing"],
    [],
    [ef("add", "priceAlerts")],
    ["targetPrice"],
    "enter", { creates: "PriceAlert" }),

  remove_price_alert: intent("Убрать оповещение", [],
    [],
    [ef("remove", "priceAlerts")],
    [], "click"),

  subscribe_to_category: intent("Подписка на категорию", ["category: Category"],
    [],
    [ef("add", "categorySubscriptions")],
    [], "click", { parameters: [] }),

  unsubscribe_from_category: intent("Отписка от категории", ["category: Category"],
    [],
    [ef("remove", "categorySubscriptions")],
    [], "click", { antagonist: "subscribe_to_category", parameters: [] }),

  subscribe_to_seller: intent("Подписка на продавца", ["user: User"],
    [],
    [ef("add", "sellerSubscriptions")],
    [], "click", { parameters: [] }),

  unsubscribe_from_seller: intent("Отписка от продавца", ["user: User"],
    [],
    [ef("remove", "sellerSubscriptions")],
    [], "click", { antagonist: "subscribe_to_seller", parameters: [] }),

  mute_notifications: intent("Не беспокоить", [],
    [],
    [ef("replace", "user.notificationsMuted", "account", { value: true })],
    [], "click", { antagonist: "unmute_notifications" }),

  unmute_notifications: intent("Включить уведомления", [],
    [],
    [ef("replace", "user.notificationsMuted", "account", { value: false })],
    [], "click", { antagonist: "mute_notifications" }),


  // ===== НАСТРОЙКИ МАГАЗИНА (10) =====

  create_store_page: intent("Создать витрину", [],
    [],
    [ef("add", "storePages")],
    ["storeName", "storeDescription"],
    "enter", { creates: "StorePage" }),

  edit_store_page: intent("Редактировать витрину", [],
    [],
    [ef("replace", "storePage.name"), ef("replace", "storePage.description")],
    ["storeName", "storeDescription"],
    "click", { phase: "investigation" }),

  set_store_logo: intent("Логотип магазина", [],
    [],
    [ef("replace", "storePage.logo")],
    ["logo"],
    "click"),

  set_store_banner: intent("Баннер магазина", [],
    [],
    [ef("replace", "storePage.banner")],
    ["banner"],
    "click"),

  set_store_policies: intent("Правила магазина", [],
    [],
    [ef("replace", "storePage.policies")],
    ["policies"],
    "click"),

  set_vacation_mode: intent("Режим отпуска", [],
    [],
    [ef("replace", "user.vacationMode", "account", { value: true })],
    [], "click", { antagonist: "disable_vacation_mode" }),

  disable_vacation_mode: intent("Выйти из отпуска", [],
    [],
    [ef("replace", "user.vacationMode", "account", { value: false })],
    [], "click", { antagonist: "set_vacation_mode" }),

  set_auto_reply: intent("Автоответ", [],
    [],
    [ef("replace", "user.autoReply")],
    ["autoReplyText"],
    "click"),

  set_return_policy: intent("Политика возврата", [],
    [],
    [ef("replace", "storePage.returnPolicy")],
    ["returnPolicy"],
    "click"),

  set_working_hours: intent("Рабочие часы", [],
    [],
    [ef("replace", "storePage.workingHours")],
    ["workingHours"],
    "click"),


  // ===== МАССОВЫЕ ОПЕРАЦИИ (8) =====

  bulk_edit_price: intent("Массовое изменение цен", ["listing: Listing"],
    [],
    [ef("replace", "listing.startPrice")],
    [], "click", { extended: true }),

  bulk_relist_expired: intent("Перевыставить истёкшие", ["listing: Listing"],
    [],
    [ef("add", "listings")],
    [], "click", { extended: true, creates: "Listing(draft)" }),

  bulk_delete_listings: intent("Массовое удаление", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("remove", "listings")],
    [], "click", { extended: true, irreversibility: "high" }),

  bulk_update_shipping: intent("Массовая доставка", ["listing: Listing"],
    [],
    [ef("replace", "listing.shippingCost")],
    [], "click", { extended: true }),

  bulk_mark_shipped: intent("Отметить отправленными", ["order: Order"],
    [],
    [ef("replace", "order.status", "account", { value: "shipped" })],
    [], "click", { extended: true }),

  bulk_print_labels: intent("Печать наклеек", ["order: Order"],
    [],
    [],
    [], "click", { extended: true, parameters: [] }),

  bulk_export_orders: intent("Экспорт заказов", ["order: Order"],
    [],
    [],
    [], "click", { extended: true, parameters: [] }),

  bulk_send_invoices: intent("Отправить счета", ["order: Order"],
    [],
    [ef("add", "invoices")],
    [], "click", { extended: true }),


  // ===== АНАЛИТИКА ПРОДАВЦА (9) =====

  view_sales_dashboard: intent("Панель продаж", [],
    [],
    [],
    ["totalRevenue", "totalOrders", "avgOrderValue"],
    "click", { parameters: [] }),

  view_traffic_stats: intent("Статистика просмотров", [],
    [],
    [],
    ["totalViews", "uniqueVisitors", "conversionRate"],
    "click", { parameters: [] }),

  view_bid_analytics: intent("Аналитика ставок", [],
    [],
    [],
    ["avgBidCount", "avgFinalPrice", "sellThroughRate"],
    "click", { parameters: [] }),

  export_sales_report: intent("Экспорт отчёта", [],
    [],
    [],
    ["dateFrom", "dateTo"],
    "click", { parameters: [] }),

  view_buyer_demographics: intent("Демография покупателей", [],
    [],
    [],
    ["topCities", "topCategories"],
    "click", { parameters: [] }),

  view_listing_performance: intent("Эффективность лотов", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [],
    ["listing.viewCount", "listing.bidCount", "listing.watcherCount"],
    "click", { parameters: [] }),

  compare_listings: intent("Сравнить лоты", ["listing: Listing"],
    [],
    [],
    ["listing.title", "listing.currentPrice"],
    "click", { parameters: [] }),

  view_price_history: intent("История цен", ["listing: Listing"],
    [],
    [],
    ["listing.title", "listing.currentPrice"],
    "click", { parameters: [] }),

  set_sales_goal: intent("Установить цель продаж", [],
    [],
    [ef("replace", "user.salesGoal")],
    ["salesGoal"],
    "click"),


  // ===== КАТЕГОРИИ И ТЕГИ (9) =====

  add_tag: intent("Добавить тег", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("add", "tags")],
    ["tagName"],
    "enter", { creates: "Tag" }),

  remove_tag: intent("Удалить тег", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("remove", "tags")],
    [], "click"),

  create_category: intent("Создать категорию", ["category: Category"],
    [],
    [ef("add", "categories")],
    ["name", "icon"],
    "enter", { creates: "Category" }),

  edit_category: intent("Редактировать категорию", ["category: Category"],
    [],
    [ef("replace", "category.name"), ef("replace", "category.icon")],
    ["name", "icon"],
    "click", { phase: "investigation" }),

  delete_category: intent("Удалить категорию", ["category: Category"],
    [],
    [ef("remove", "categories")],
    [], "click", { irreversibility: "high" }),

  move_to_category: intent("Переместить в категорию", ["listing: Listing", "category: Category"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.categoryId")],
    ["categoryId"],
    "click"),

  suggest_category: intent("Предложить категорию", ["listing: Listing"],
    [],
    [ef("add", "categorySuggestions")],
    ["suggestedName"],
    "enter", { creates: "CategorySuggestion" }),

  set_subcategory: intent("Указать подкатегорию", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.subcategoryId")],
    ["subcategoryId"],
    "click"),

  browse_by_tag: intent("По тегу", [],
    [],
    [],
    ["tagName", "results"],
    "click"),


  // ===== БЕЗОПАСНОСТЬ АККАУНТА (9) =====

  change_password: intent("Сменить пароль", [],
    [],
    [ef("replace", "user.passwordHash")],
    ["currentPassword", "newPassword"],
    "click"),

  enable_2fa: intent("Включить 2FA", [],
    [],
    [ef("replace", "user.twoFactorEnabled", "account", { value: true })],
    ["phoneNumber"],
    "click", { antagonist: "disable_2fa" }),

  disable_2fa: intent("Отключить 2FA", [],
    [],
    [ef("replace", "user.twoFactorEnabled", "account", { value: false })],
    [], "click", { antagonist: "enable_2fa", irreversibility: "medium" }),

  view_login_history: intent("История входов", [],
    [],
    [],
    ["results"],
    "click", { parameters: [] }),

  revoke_session: intent("Завершить сессию", [],
    [],
    [ef("remove", "sessions")],
    [], "click"),

  set_privacy_settings: intent("Настройки приватности", [],
    [],
    [ef("replace", "user.privacyLevel")],
    ["privacyLevel"],
    "click"),

  download_personal_data: intent("Скачать мои данные", [],
    [],
    [],
    [], "click", { parameters: [] }),

  delete_account: intent("Удалить аккаунт", [],
    [],
    [ef("replace", "user.status", "account", { value: "deleted" })],
    [], "click", { irreversibility: "high" }),

  block_user: intent("Заблокировать пользователя", ["user: User"],
    [],
    [ef("add", "blockedUsers")],
    ["user.name"],
    "click", { antagonist: "unblock_user" }),


  // ===== ПРОЧЕЕ (10) =====

  unblock_user: intent("Разблокировать", ["user: User"],
    [],
    [ef("remove", "blockedUsers")],
    ["user.name"],
    "click", { antagonist: "block_user" }),

  submit_feedback: intent("Обратная связь", [],
    [],
    [ef("add", "feedbackMessages")],
    ["subject", "text"],
    "enter", { creates: "FeedbackMessage" }),

  rate_app: intent("Оценить приложение", [],
    [],
    [ef("add", "appRatings")],
    ["rating"],
    "click"),

  request_feature: intent("Предложить функцию", [],
    [],
    [ef("add", "featureRequests")],
    ["title", "description"],
    "enter", { creates: "FeatureRequest" }),

  set_language: intent("Сменить язык", [],
    [],
    [ef("replace", "user.language")],
    ["language"],
    "click"),

  set_currency: intent("Сменить валюту", [],
    [],
    [ef("replace", "user.currency")],
    ["currency"],
    "click"),

  toggle_dark_mode: intent("Тёмная тема", [],
    [],
    [ef("replace", "user.darkMode", "account", { value: true })],
    [], "click", { antagonist: "toggle_light_mode" }),

  toggle_light_mode: intent("Светлая тема", [],
    [],
    [ef("replace", "user.darkMode", "account", { value: false })],
    [], "click", { antagonist: "toggle_dark_mode" }),

  reject_return: intent("Отклонить возврат", ["order: Order"],
    ["order.sellerId = me.id"],
    [ef("replace", "order.status", "account", { value: "return_rejected" })],
    [], "click", { antagonist: "approve_return" }),

  archive_listing: intent("В архив", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.archived", "account", { value: true })],
    [], "click", { antagonist: "unarchive_listing" }),

  unarchive_listing: intent("Из архива", ["listing: Listing"],
    ["listing.sellerId = me.id"],
    [ef("replace", "listing.archived", "account", { value: false })],
    [], "click", { antagonist: "archive_listing" }),
};
