export const PROJECTIONS = {
  conversation_list: {
    name: "Беседы",
    kind: "catalog",
    query: "все беседы текущего пользователя, сортировка по lastMessageAt",
    entities: ["Conversation", "Participant"],
    mainEntity: "Conversation",
    // Фильтр: показывать только беседы, в которых viewer является участником.
    filter: "(world.participants || []).some(p => p.conversationId === id && p.userId === (viewer && viewer.id))",
    sort: "-lastMessageAt",
    witnesses: ["title", "lastMessage", "unreadCount", "status"],
  },
  chat_view: {
    name: "Чат",
    kind: "feed",
    query: "сообщения одной беседы, пагинация",
    entities: ["Message", "Conversation", "Participant"],
    mainEntity: "Message",
    witnesses: ["content", "sender.name", "createdAt", "status", "replyTo"],
  },
  contact_list: {
    name: "Контакты",
    kind: "catalog",
    query: "контакты + входящие запросы",
    entities: ["Contact", "User"],
    mainEntity: "Contact",
    filter: "userId === (viewer && viewer.id)",
    witnesses: ["name", "avatar", "status", "contact.status"],
  },
  user_profile: {
    name: "Профиль",
    kind: "detail",
    query: "профиль одного пользователя",
    entities: ["User"],
    mainEntity: "User",
    idParam: "userId",
    witnesses: ["name", "email", "avatar", "status"],
  },
};
