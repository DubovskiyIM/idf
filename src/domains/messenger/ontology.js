export const ONTOLOGY = {
  entities: {
    User: {
      // Новый типизированный формат с read/write матрицей per role.
      // read/write — массивы ролей. "*" — все, "self" — только владелец,
      // "contact" — добавленный контакт. Отсутствие read — по умолчанию
      // публично. Отсутствие write — поле неизменяемо.
      fields: {
        id: { type: "id" },
        email: { type: "email", read: ["self"], write: ["self"], label: "Email" },
        name: { type: "text", read: ["*"], write: ["self"], required: true, label: "Имя" },
        avatar: { type: "image", read: ["*"], write: ["self"], label: "Аватар" },
        statusMessage: { type: "textarea", read: ["*"], write: ["self"], label: "Статус-сообщение" },
        status: {
          type: "enum", read: ["*"], label: "Онлайн-статус",
          values: ["online", "offline", "away"],
          valueLabels: { online: "Онлайн", offline: "Оффлайн", away: "Отошёл" },
        },
        lastSeen: { type: "datetime", read: ["*"], label: "Был в сети" },
      },
      statuses: ["online", "offline", "away"],
      type: "internal",
      // searchConfig — конфигурация для серверного entity search API (M3.5a).
      // Используется EntityPicker'ом (M3.5b) и любыми клиентами, которым нужен
      // поиск по всей БД, а не по локальной world-проекции.
      searchConfig: {
        fields: ["name", "email"],
        returnFields: ["id", "name", "avatar", "email"],
        minQueryLength: 2,
        limit: 20,
      },
    },
    Contact: {
      fields: {
        id: { type: "id" },
        userId: { type: "entityRef", read: ["*"], label: "Я" },
        contactId: { type: "entityRef", read: ["*"], label: "Контакт" },
        name: { type: "text", read: ["*"], write: ["self"], label: "Имя" },
        direction: {
          type: "enum", read: ["*"], label: "Направление",
          values: ["outgoing", "incoming"],
          valueLabels: { outgoing: "Исходящий", incoming: "Входящий" },
        },
        status: {
          type: "enum", read: ["*"], label: "Статус",
          values: ["pending", "accepted", "rejected", "blocked"],
          valueLabels: { pending: "Ожидает", accepted: "Принят", rejected: "Отклонён", blocked: "Заблокирован" },
        },
      },
      statuses: ["pending", "accepted", "rejected", "blocked"],
      ownerField: "userId",
      type: "internal"
    },
    Conversation: {
      fields: {
        id: { type: "id" },
        type: {
          type: "enum", read: ["*"], required: true, label: "Тип",
          values: ["direct", "group", "channel"],
          valueLabels: { direct: "Личный", group: "Группа", channel: "Канал" },
        },
        title: { type: "text", read: ["*"], write: ["self"], label: "Название" },
        createdBy: { type: "entityRef", read: ["*"], label: "Создатель" },
        participantIds: { type: "textarea", read: ["*"], label: "Участники" },
        lastMessageAt: { type: "datetime", read: ["*"], label: "Последнее сообщение" },
        createdAt: { type: "datetime", read: ["*"], label: "Создано" },
      },
      ownerField: "createdBy",
      type: "internal",
      searchConfig: {
        fields: ["title"],
        returnFields: ["id", "type", "title", "lastMessageAt"],
        minQueryLength: 1,
        limit: 20,
      },
    },
    Participant: {
      fields: {
        id: { type: "id" },
        conversationId: { type: "entityRef", read: ["*"], label: "Беседа" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        role: {
          type: "enum", read: ["*"], label: "Роль",
          values: ["owner", "admin", "member"],
          valueLabels: { owner: "Владелец", admin: "Админ", member: "Участник" },
        },
        joinedAt: { type: "datetime", read: ["*"], label: "Присоединился" },
        lastReadAt: { type: "datetime", read: ["*"], label: "Прочитано до" },
        muted: { type: "boolean", read: ["*"], write: ["self"], label: "Заглушено" },
        pinned: { type: "boolean", read: ["*"], write: ["self"], label: "Закреплено" },
        archived: { type: "boolean", read: ["*"], write: ["self"], label: "Архивировано" },
      },
      ownerField: "userId",
      type: "internal"
    },
    Message: {
      fields: {
        id: { type: "id" },
        conversationId: { type: "entityRef", read: ["*"], label: "Беседа" },
        senderId: { type: "entityRef", read: ["*"], label: "Отправитель" },
        type: {
          type: "enum", read: ["*"], label: "Тип",
          values: ["text", "image", "voice", "sticker", "gif", "location", "poll", "file"],
          valueLabels: { text: "Текст", image: "Картинка", voice: "Голос", sticker: "Стикер", gif: "GIF", location: "Геолокация", poll: "Опрос", file: "Файл" },
        },
        content: { type: "textarea", read: ["*"], write: ["self"], label: "Текст" },
        replyToId: { type: "entityRef", read: ["*"], label: "Ответ на" },
        attachmentUrl: { type: "text", read: ["*"], label: "Вложение" },
        pinned: { type: "boolean", read: ["*"], label: "Закреплено" },
        status: {
          type: "enum", read: ["*"], label: "Статус",
          values: ["sent", "delivered", "read"],
          valueLabels: { sent: "Отправлено", delivered: "Доставлено", read: "Прочитано" },
        },
        forwarded: { type: "boolean", read: ["*"], label: "Переслано" },
        createdAt: { type: "datetime", read: ["*"], label: "Создано" },
        editedAt: { type: "datetime", read: ["*"], label: "Отредактировано" },
        deletedFor: { type: "text", read: ["*"], label: "Удалено для" },
      },
      statuses: ["sent", "delivered", "read"],
      ownerField: "senderId",
      type: "internal"
    },
    Reaction: {
      fields: {
        id: { type: "id" },
        messageId: { type: "entityRef", read: ["*"], label: "Сообщение" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        emoji: { type: "text", read: ["*"], required: true, label: "Эмодзи" },
        createdAt: { type: "datetime", read: ["*"], label: "Создано" },
      },
      ownerField: "userId",
      type: "internal"
    }
  },
  predicates: {
    "contact_is_accepted": "contact.status = 'accepted'",
    "user_is_online": "user.status = 'online'",
  },
  roles: {
    self: {
      base: "owner", // §5 base role
      label: "Я",
      canExecute: ["send_message", "edit_message", "delete_message", "reply_to_message",
        "create_direct_chat", "create_group", "leave_group", "mark_as_read",
        "add_contact", "accept_contact", "reject_contact", "block_contact",
        "update_profile", "mute_conversation", "unmute_conversation", "pin_conversation",
        "start_typing"],
      visibleFields: { Message: ["id", "conversationId", "senderId", "type", "content", "replyToId", "attachmentUrl", "status", "createdAt", "editedAt"] }
    },
    contact: {
      base: "viewer", // §5 — связанный читатель (профиль другого)
      label: "Контакт",
      visibleFields: { User: ["id", "name", "avatar", "status"] }
    },
    agent: {
      base: "agent",
      label: "Агент (API)",
      canExecute: [
        "send_message", "create_direct_chat", "create_group",
        "add_contact", "mark_as_read",
      ],
      visibleFields: {
        User: ["id", "name", "avatar", "status"],
        Conversation: ["id", "type", "title", "participantIds", "lastMessageAt"],
        Message: ["id", "conversationId", "senderId", "content", "status", "createdAt"],
        Contact: ["id", "userId", "contactId", "name", "status"],
      },
    },
  }
};
