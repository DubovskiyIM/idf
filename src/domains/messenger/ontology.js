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
        status: { type: "enum", read: ["*"], label: "Онлайн-статус" },
        lastSeen: { type: "datetime", read: ["*"], label: "Был в сети" },
      },
      statuses: ["online", "offline", "away"],
      type: "internal"
    },
    Contact: {
      fields: ["id", "userId", "contactId", "status"],
      statuses: ["pending", "accepted", "rejected", "blocked"],
      type: "internal"
    },
    Conversation: {
      fields: ["id", "type", "title", "createdBy", "participantIds", "lastMessageAt", "createdAt"],
      type: "internal"
    },
    Participant: {
      fields: ["id", "conversationId", "userId", "role", "joinedAt", "lastReadAt", "muted", "pinned"],
      type: "internal"
    },
    Message: {
      fields: ["id", "conversationId", "senderId", "type", "content", "replyToId", "attachmentUrl", "status", "createdAt", "editedAt", "deletedFor"],
      statuses: ["sent", "delivered", "read"],
      type: "internal"
    }
  },
  predicates: {
    "contact_is_accepted": "contact.status = 'accepted'",
    "user_is_online": "user.status = 'online'",
  },
  roles: {
    self: {
      label: "Я",
      canExecute: ["send_message", "edit_message", "delete_message", "reply_to_message",
        "create_direct_chat", "create_group", "leave_group", "mark_as_read",
        "add_contact", "accept_contact", "reject_contact", "block_contact",
        "update_profile", "mute_conversation", "unmute_conversation", "pin_conversation",
        "start_typing"],
      visibleFields: { Message: ["id", "conversationId", "senderId", "type", "content", "replyToId", "attachmentUrl", "status", "createdAt", "editedAt"] }
    },
    contact: {
      label: "Контакт",
      visibleFields: { User: ["id", "name", "avatar", "status"] }
    }
  }
};
