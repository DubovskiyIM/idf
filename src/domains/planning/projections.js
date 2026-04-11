export const PROJECTIONS = {
  my_polls: {
    name: "Мои опросы",
    kind: "catalog",
    query: "все опросы где я организатор или участник",
    entities: ["Poll"],
    mainEntity: "Poll",
    routeEntities: [],
    sort: "-createdAt",
    witnesses: ["title", "status", "role", "next_action"],
  },
  poll_overview: {
    name: "Обзор опроса",
    kind: "detail",
    query: "один опрос со всеми вариантами и голосами",
    entities: ["Poll", "TimeOption", "Vote", "Participant"],
    mainEntity: "Poll",
    idParam: "pollId",
    routeEntities: ["TimeOption", "Vote", "Participant"],
    witnesses: ["title", "status", "options", "votes", "participants"],
  },
  // voting_matrix — требует canvas-архетип (матрица участники × опции),
  // который пока не реализован. kind: "canvas" → кристаллизатор v2 пропустит
  // проекцию через SUPPORTED_ARCHETYPES-фильтр. Переедет в отдельный canvas
  // milestone.
  voting_matrix: {
    name: "Матрица голосов",
    kind: "canvas",
    query: "участники × варианты → голоса",
    witnesses: ["participant.name", "option.date", "vote.value"],
  },
};

export const ROOT_PROJECTIONS = ["my_polls"];
