export const PROJECTIONS = {
  my_polls: {
    name: "Опросы",
    kind: "catalog",
    query: "все опросы где я организатор или участник",
    entities: ["Poll"],
    mainEntity: "Poll",
    routeEntities: [],
    sort: "-createdAt",
    witnesses: ["title", "status", "role", "next_action"],
  },
  poll_overview: {
    name: "Опрос",
    kind: "detail",
    query: "один опрос со всеми вариантами и голосами",
    entities: ["Poll", "TimeOption", "Vote", "Participant"],
    mainEntity: "Poll",
    idParam: "pollId",
    routeEntities: ["TimeOption", "Vote", "Participant"],
    witnesses: ["title", "status", "options", "votes", "participants"],
    // M4 Step B: декларативные sub-collection секции. Кристаллизатор собирает
    // для каждой секции inline-композер добавления + per-item кнопки из
    // intents, действующих на sub-entity. Фазы (draft/open/closed) фильтруются
    // автоматически через evalIntentCondition на уровне рантайма.
    subCollections: [
      {
        collection: "options",
        entity: "TimeOption",
        foreignKey: "pollId",
        title: "Варианты времени",
        addable: true,
      },
      {
        collection: "participants",
        entity: "Participant",
        foreignKey: "pollId",
        title: "Участники",
        addable: true,
      },
    ],
    // M4 Step E: декларативный progress-виджет (кворум). Рантайм считает
    // distinct participantId среди votes для target poll и показывает
    // прогресс-бар + список неголосовавших.
    progress: {
      type: "quorum",
      title: "Кворум",
      totalSource: "participants",
      currentSource: "votes",
      currentDistinct: "participantId",
      foreignKey: "pollId",
      waitingField: "name",
    },
    // M4 Step F: intents, которые отрендерятся как inline-setter внизу detail.
    footerIntents: ["set_deadline"],
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
