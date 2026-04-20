export const PROJECTIONS = {
  // CANVAS — все 6 рендерятся через registerCanvas
  checkin: {
    name: "Сейчас", kind: "canvas",
    query: "Mood Meter — отметить эмоцию точкой на 2D-плоскости",
    entities: ["MoodEntry", "Activity"],
  },
  timeline: {
    name: "Дневник", kind: "canvas",
    query: "лента всех чек-инов по дням",
    entities: ["MoodEntry", "Activity", "EntryActivity"],
  },
  calendar_heatmap: {
    name: "Календарь", kind: "canvas",
    query: "месячный heatmap эмоций по дням",
    entities: ["MoodEntry"],
  },
  mood_trends: {
    name: "Тренды", kind: "canvas",
    query: "графики pleasantness и energy за период",
    entities: ["MoodEntry"],
  },
  activity_correlation: {
    name: "Корреляции", kind: "canvas",
    query: "влияние активностей на mood",
    entities: ["MoodEntry", "Activity", "EntryActivity"],
  },
  mood_meter_cluster: {
    name: "Кластеры", kind: "canvas",
    query: "scatter plot всех точек на Mood Meter",
    entities: ["MoodEntry"],
  },

  // DETAIL
  entry_detail: {
    name: "Запись", kind: "detail", mainEntity: "MoodEntry",
    idParam: "entryId",
    entities: ["MoodEntry", "Activity", "EntryActivity", "Tag", "EntryTag"],
    witnesses: ["pleasantness", "energy", "quadrant", "emotion", "note", "loggedAt"],
    subCollections: [
      { collection: "entryActivities", entity: "EntryActivity", foreignKey: "entryId", title: "Активности", addable: true },
      { collection: "entryTags", entity: "EntryTag", foreignKey: "entryId", title: "Теги", addable: true },
    ],
  },
  weekly_summary: {
    name: "Итоги недели", kind: "detail", mainEntity: "User",
    idParam: "userId",
    entities: ["MoodEntry", "Activity", "Insight"],
    witnesses: ["streakCurrent", "entryCount"],
  },
  hypothesis_detail: {
    name: "Гипотеза", kind: "detail", mainEntity: "Hypothesis",
    idParam: "hypothesisId",
    entities: ["Hypothesis", "HypothesisEvidence", "Activity"],
    witnesses: ["title", "whenActivity", "expectedEffect", "status", "confidence"],
    subCollections: [
      { collection: "hypothesisEvidences", entity: "HypothesisEvidence", foreignKey: "hypothesisId", title: "Свидетельства", addable: false },
    ],
  },

  // CATALOG
  hypothesis_list: {
    name: "Гипотезы", kind: "catalog", mainEntity: "Hypothesis",
    entities: ["Hypothesis", "Activity"],
    witnesses: ["title", "status", "confidence", "whenActivity"],
    filter: "userId === viewer.id && status !== 'archived'",
  },
  activity_list: {
    name: "Активности", kind: "catalog", mainEntity: "Activity",
    entities: ["Activity"],
    witnesses: ["name", "icon", "category", "archived"],
    filter: "userId === viewer.id || userId === null",
  },
  tag_list: {
    name: "Теги", kind: "catalog", mainEntity: "Tag",
    entities: ["Tag"],
    witnesses: ["name", "color"],
    filter: "userId === viewer.id",
  },

  // FEED
  insights_feed: {
    name: "Открытия", kind: "feed", mainEntity: "Insight",
    entities: ["Insight"],
    witnesses: ["title", "description", "kind", "createdAt", "pinned", "seenAt"],
    filter: "userId === viewer.id",
    sort: "createdAt:desc",
  },
};

export const ROOT_PROJECTIONS = [
  { section: "Сейчас", icon: "✨", items: ["checkin"] },
  { section: "Дневник", icon: "📖", items: ["timeline", "calendar_heatmap"] },
  { section: "Аналитика", icon: "📊", items: ["mood_trends", "activity_correlation", "mood_meter_cluster", "weekly_summary"] },
  { section: "Гипотезы", icon: "🔬", items: ["hypothesis_list"] },
  // my_insight_feed — derived R11 v2 owner-scoped temporal feed (idf-sdk
  // core ≥ 0.28). Появляется рядом с authored insights_feed как прямое
  // доказательство работы структурированного filter+sort в рендерере.
  { section: "Открытия", icon: "💡", items: ["insights_feed", "my_insight_feed"] },
  { section: "Настройки", icon: "⚙️", items: ["activity_list", "tag_list"] },
];
