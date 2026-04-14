export const ONTOLOGY = {
  entities: {
    User: {
      fields: {
        id: { type: "id" },
        name: { type: "text", read: ["*"], write: ["self"], required: true, label: "Имя" },
        email: { type: "email", read: ["self"], write: ["self"], label: "Email" },
        avatar: { type: "image", read: ["*"], write: ["self"], label: "Аватар" },
        bio: { type: "textarea", read: ["*"], write: ["self"], label: "О себе" },
        rating: { type: "number", read: ["*"], label: "Рейтинг" },
        salesCount: { type: "number", read: ["*"], label: "Продаж" },
        purchasesCount: { type: "number", read: ["*"], label: "Покупок" },
        verified: { type: "boolean", read: ["*"], label: "Верифицирован" },
        balance: { type: "number", read: ["self"], label: "Баланс" },
        location: { type: "text", read: ["*"], write: ["self"], label: "Город" },
        registeredAt: { type: "datetime", read: ["*"], label: "На сайте с" },
      },
      statuses: ["active", "suspended", "banned"],
      type: "internal",
      searchConfig: {
        fields: ["name", "location"],
        returnFields: ["id", "name", "avatar", "rating", "location"],
        minQueryLength: 2,
        limit: 20,
      },
    },

    Listing: {
      fields: {
        id: { type: "id" },
        sellerId: { type: "entityRef", read: ["*"], label: "Продавец" },
        title: { type: "text", read: ["*"], write: ["self"], required: true, label: "Название" },
        description: { type: "textarea", read: ["*"], write: ["self"], label: "Описание" },
        categoryId: { type: "entityRef", read: ["*"], write: ["self"], label: "Категория" },
        condition: { type: "enum", read: ["*"], write: ["self"], label: "Состояние",
          values: ["new", "like_new", "good", "used", "for_parts"],
          valueLabels: { new: "Новое", like_new: "Как новое", good: "Хорошее", used: "Б/у", for_parts: "На запчасти" },
        },
        images: { type: "multiImage", read: ["*"], write: ["self"], label: "Фото" },
        startPrice: { type: "number", read: ["*"], write: ["self"], required: true, label: "Начальная цена" },
        currentPrice: { type: "number", read: ["*"], label: "Текущая цена" },
        buyNowPrice: { type: "number", read: ["*"], write: ["self"], label: "Купить сейчас" },
        reservePrice: { type: "number", read: ["seller"], write: ["self"], label: "Резервная цена" },
        bidCount: { type: "number", read: ["*"], label: "Ставок" },
        watcherCount: { type: "number", read: ["*"], label: "Наблюдателей" },
        auctionEnd: { type: "datetime", read: ["*"], write: ["self"], label: "Завершение" },
        shippingCost: { type: "number", read: ["*"], write: ["self"], label: "Доставка" },
        shippingFrom: { type: "text", read: ["*"], write: ["self"], label: "Откуда" },
        weight: { type: "number", read: ["*"], write: ["self"], label: "Вес (г)" },
        status: { type: "enum", read: ["*"], label: "Статус" },
        featured: { type: "boolean", read: ["*"], label: "Рекомендуемый" },
        viewCount: { type: "number", read: ["seller"], label: "Просмотров" },
        createdAt: { type: "datetime", read: ["*"], label: "Создан" },
      },
      statuses: ["draft", "active", "sold", "expired", "cancelled", "suspended"],
      ownerField: "sellerId",
      type: "internal",
      searchConfig: {
        fields: ["title", "description"],
        returnFields: ["id", "title", "currentPrice", "images", "status", "auctionEnd"],
        minQueryLength: 2,
        limit: 30,
      },
    },

    Bid: {
      fields: {
        id: { type: "id" },
        listingId: { type: "entityRef", read: ["*"], label: "Лот" },
        bidderId: { type: "entityRef", read: ["*"], label: "Участник" },
        amount: { type: "number", read: ["*"], required: true, label: "Сумма" },
        maxAmount: { type: "number", read: ["self"], label: "Автоставка до" },
        status: { type: "enum", read: ["*"], label: "Статус" },
        createdAt: { type: "datetime", read: ["*"], label: "Время" },
      },
      statuses: ["active", "outbid", "winning", "won", "cancelled", "retracted"],
      ownerField: "bidderId",
      type: "internal",
    },

    Category: {
      fields: {
        id: { type: "id" },
        name: { type: "text", read: ["*"], label: "Название" },
        parentId: { type: "entityRef", read: ["*"], label: "Родитель" },
        icon: { type: "text", read: ["*"], label: "Иконка" },
        listingCount: { type: "number", read: ["*"], label: "Лотов" },
        sortOrder: { type: "number", label: "Порядок" },
      },
      type: "internal",
    },

    Order: {
      fields: {
        id: { type: "id" },
        listingId: { type: "entityRef", read: ["*"], label: "Лот" },
        sellerId: { type: "entityRef", read: ["*"], label: "Продавец" },
        buyerId: { type: "entityRef", read: ["*"], label: "Покупатель" },
        finalPrice: { type: "number", read: ["*"], label: "Итоговая цена" },
        shippingCost: { type: "number", read: ["*"], label: "Доставка" },
        totalAmount: { type: "number", read: ["*"], label: "Итого" },
        paymentMethod: { type: "enum", read: ["*"], label: "Оплата" },
        shippingAddress: { type: "textarea", read: ["seller", "buyer"], write: ["self"], label: "Адрес" },
        trackingNumber: { type: "text", read: ["*"], write: ["self"], label: "Трек-номер" },
        status: { type: "enum", read: ["*"], label: "Статус" },
        paidAt: { type: "datetime", read: ["*"], label: "Оплачен" },
        shippedAt: { type: "datetime", read: ["*"], label: "Отправлен" },
        deliveredAt: { type: "datetime", read: ["*"], label: "Доставлен" },
        createdAt: { type: "datetime", read: ["*"], label: "Создан" },
      },
      statuses: ["pending_payment", "paid", "shipped", "delivered", "completed", "cancelled", "refunded", "disputed"],
      ownerField: "buyerId",
      type: "internal",
    },

    Review: {
      fields: {
        id: { type: "id" },
        orderId: { type: "entityRef", read: ["*"], label: "Заказ" },
        authorId: { type: "entityRef", read: ["*"], label: "Автор" },
        targetUserId: { type: "entityRef", read: ["*"], label: "Кому" },
        rating: { type: "number", read: ["*"], required: true, label: "Оценка" },
        text: { type: "textarea", read: ["*"], write: ["self"], label: "Текст" },
        response: { type: "textarea", read: ["*"], label: "Ответ" },
        createdAt: { type: "datetime", read: ["*"], label: "Дата" },
      },
      ownerField: "authorId",
      type: "internal",
    },

    Dispute: {
      fields: {
        id: { type: "id" },
        orderId: { type: "entityRef", read: ["*"], label: "Заказ" },
        openedBy: { type: "entityRef", read: ["*"], label: "Открыл" },
        reason: { type: "enum", read: ["*"], label: "Причина" },
        description: { type: "textarea", read: ["*"], label: "Описание" },
        resolution: { type: "enum", read: ["*"], label: "Решение" },
        status: { type: "enum", read: ["*"], label: "Статус" },
        createdAt: { type: "datetime", read: ["*"], label: "Открыт" },
        resolvedAt: { type: "datetime", read: ["*"], label: "Закрыт" },
      },
      statuses: ["open", "under_review", "resolved", "escalated", "closed"],
      ownerField: "openedBy",
      type: "internal",
    },

    Watchlist: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", label: "Пользователь" },
        listingId: { type: "entityRef", read: ["*"], label: "Лот" },
        createdAt: { type: "datetime", label: "Добавлен" },
      },
      ownerField: "userId",
      type: "internal",
    },

    Message: {
      fields: {
        id: { type: "id" },
        senderId: { type: "entityRef", read: ["*"], label: "Отправитель" },
        recipientId: { type: "entityRef", read: ["*"], label: "Получатель" },
        listingId: { type: "entityRef", read: ["*"], label: "Лот" },
        orderId: { type: "entityRef", read: ["*"], label: "Заказ" },
        content: { type: "textarea", read: ["*"], write: ["self"], required: true, label: "Сообщение" },
        read: { type: "boolean", read: ["*"], label: "Прочитано" },
        createdAt: { type: "datetime", read: ["*"], label: "Время" },
      },
      ownerField: "senderId",
      type: "internal",
    },

    SavedSearch: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", label: "Пользователь" },
        query: { type: "text", read: ["self"], label: "Запрос" },
        categoryId: { type: "entityRef", read: ["self"], label: "Категория" },
        minPrice: { type: "number", read: ["self"], label: "Цена от" },
        maxPrice: { type: "number", read: ["self"], label: "Цена до" },
        notifyOnNew: { type: "boolean", read: ["self"], write: ["self"], label: "Уведомлять" },
        createdAt: { type: "datetime", read: ["self"], label: "Создан" },
      },
      ownerField: "userId",
      type: "internal",
    },

    Notification: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", label: "Пользователь" },
        type: { type: "enum", read: ["self"], label: "Тип" },
        title: { type: "text", read: ["self"], label: "Заголовок" },
        body: { type: "text", read: ["self"], label: "Текст" },
        refId: { type: "text", read: ["self"], label: "Ссылка" },
        read: { type: "boolean", read: ["self"], label: "Прочитано" },
        createdAt: { type: "datetime", read: ["self"], label: "Время" },
      },
      ownerField: "userId",
      type: "internal",
    },
  },

  predicates: {
    "listing_is_active": "listing.status = 'active'",
    "listing_is_draft": "listing.status = 'draft'",
    "auction_not_ended": "listing.auctionEnd > now()",
    "order_is_paid": "order.status = 'paid'",
    "order_is_shipped": "order.status = 'shipped'",
    "order_is_delivered": "order.status = 'delivered'",
    "dispute_is_open": "dispute.status = 'open'",
    "user_is_verified": "user.verified = true",
  },

  rules: [
    {
      id: "delivery_autocomplete",
      trigger: "confirm_delivery",
      action: "complete_order",
      context: { id: "effect.id" }
    }
  ],

  roles: {
    buyer: {
      base: "owner", // §5 base role
      label: "Покупатель",
      canExecute: [
        "search_listings", "view_listing", "place_bid", "set_auto_bid",
        "retract_bid", "buy_now", "add_to_watchlist", "remove_from_watchlist",
        "pay_order", "confirm_delivery", "leave_review",
        "send_message", "open_dispute", "save_search",
        "update_profile", "add_shipping_address",
      ],
      visibleFields: {
        Listing: ["id", "sellerId", "title", "description", "categoryId", "condition", "images", "startPrice", "currentPrice", "buyNowPrice", "bidCount", "auctionEnd", "shippingCost", "shippingFrom", "status", "createdAt"],
        Bid: ["id", "listingId", "amount", "status", "createdAt"],
        Order: ["id", "listingId", "sellerId", "finalPrice", "shippingCost", "totalAmount", "trackingNumber", "status", "createdAt"],
      },
      statusMapping: { draft: null, suspended: null },
    },
    seller: {
      base: "owner",
      label: "Продавец",
      canExecute: [
        "create_listing", "edit_listing", "publish_listing", "cancel_listing",
        "relist_item", "set_buy_now_price", "set_reserve_price",
        "lower_start_price", "extend_auction", "feature_listing",
        "ship_order", "add_tracking", "cancel_order",
        "respond_to_review", "send_message", "block_bidder",
        "update_profile", "verify_identity",
      ],
      visibleFields: {
        Listing: ["id", "sellerId", "title", "description", "categoryId", "condition", "images", "startPrice", "currentPrice", "buyNowPrice", "reservePrice", "bidCount", "watcherCount", "auctionEnd", "shippingCost", "status", "viewCount", "createdAt"],
        Bid: ["id", "listingId", "bidderId", "amount", "status", "createdAt"],
        Order: ["id", "listingId", "buyerId", "finalPrice", "shippingCost", "totalAmount", "shippingAddress", "trackingNumber", "status", "createdAt"],
      },
      statusMapping: {},
    },
    moderator: {
      base: "agent", // §5 — human-agent с elevated canExecute (ban/resolve)
      label: "Модератор",
      canExecute: [
        "suspend_listing", "restore_listing", "remove_listing",
        "warn_user", "suspend_user", "ban_user", "unban_user",
        "resolve_dispute", "escalate_dispute",
        "remove_review", "feature_listing", "unfeature_listing",
      ],
      visibleFields: {
        Listing: ["id", "sellerId", "title", "description", "status", "createdAt"],
        Order: ["id", "listingId", "sellerId", "buyerId", "totalAmount", "status"],
        Dispute: ["id", "orderId", "openedBy", "reason", "description", "status"],
      },
    },
    agent: {
      base: "agent",
      label: "Агент (API)",
      canExecute: [
        "search_listings", "place_bid", "buy_now",
        "create_listing", "publish_listing",
        "pay_order", "confirm_delivery",
        "leave_review", "send_message",
      ],
      visibleFields: {
        Listing: ["id", "sellerId", "title", "description", "categoryId", "condition", "startPrice", "currentPrice", "buyNowPrice", "bidCount", "auctionEnd", "shippingCost", "status"],
        Bid: ["id", "listingId", "amount", "status", "createdAt"],
        Order: ["id", "listingId", "finalPrice", "totalAmount", "trackingNumber", "status"],
      },
      statusMapping: { draft: null, suspended: null },
    },
  },
};
