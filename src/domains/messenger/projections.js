export const PROJECTIONS = {
  conversation_list: {
    name: "Беседы",
    query: "все беседы текущего пользователя, сортировка по lastMessageAt",
    witnesses: ["title", "lastMessage", "unreadCount", "status"]
  },
  chat_view: {
    name: "Чат",
    query: "сообщения одной беседы, пагинация",
    witnesses: ["content", "sender.name", "createdAt", "status", "replyTo"]
  },
  contact_list: {
    name: "Контакты",
    query: "контакты + входящие запросы",
    witnesses: ["name", "avatar", "status", "contact.status"]
  },
};
