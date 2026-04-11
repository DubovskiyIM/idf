export const PROJECTIONS = {
  conversation_list: {
    name: "Беседы",
    kind: "catalog",
    query: "все беседы текущего пользователя, сортировка по lastMessageAt",
    entities: ["Conversation", "Participant"],
    mainEntity: "Conversation",
    // Route scope: Participant доступен для per-item toggle'ов (mute, pin,
    // archive — моё участие в беседе). Admin-интенты на Participant
    // (promote_to_admin, ban_user…) всё равно отсекаются blacklist'ом.
    routeEntities: ["Participant"],
    // Filter: (1) моё участие в беседе, (2) viewState.query — inlineSearch фильтр по title
    filter: "(world.participants || []).some(p => p.conversationId === id && p.userId === (viewer && viewer.id)) && (!(viewState && viewState.query) || (title || '').toLowerCase().includes((viewState.query || '').toLowerCase()))",
    sort: "-lastMessageAt",
    witnesses: ["title", "lastMessage", "unreadCount", "status"],
  },
  chat_view: {
    name: "Чат",
    kind: "feed",
    query: "сообщения одной беседы, пагинация",
    entities: ["Message", "Conversation", "Participant"],
    mainEntity: "Message",
    // Route scope: текущий чат предоставляет Conversation и Participant
    // (моё участие в беседе). Это даёт clear_history и mute/unmute доступ
    // к правильному контексту. Админские интенты на Participant отсекаются
    // blacklist'ом в assignToSlotsShared.js.
    routeEntities: ["Conversation", "Participant"],
    witnesses: ["content", "sender.name", "createdAt", "status", "replyTo"],
  },
  contact_list: {
    name: "Контакты",
    kind: "catalog",
    query: "контакты + входящие запросы",
    entities: ["Contact", "User"],
    mainEntity: "Contact",
    // Route scope: только Contact. User доступен для чтения (имя/аватар
    // отображаются), но действия на User (update_profile, set_avatar) в
    // contact_list не место — они живут в user_profile.
    routeEntities: [],
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
    routeEntities: [],
    witnesses: ["name", "email", "avatar", "status"],
  },
};
