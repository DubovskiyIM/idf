export const PROJECTIONS = {
  poll_overview: {
    name: "Обзор опроса",
    query: "один опрос со всеми вариантами и голосами",
    witnesses: ["title", "status", "options", "votes", "participants"]
  },
  voting_matrix: {
    name: "Матрица голосов",
    query: "участники × варианты → голоса",
    witnesses: ["participant.name", "option.date", "vote.value"]
  },
  my_polls: {
    name: "Мои опросы",
    query: "все опросы где я организатор или участник",
    witnesses: ["title", "status", "role", "next_action"]
  }
};
