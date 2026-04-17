import { v4 as uuid } from "uuid";

export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
import { INTENTS } from "./intents.js";
import { QUOTES } from "./quotes.js";
import { BADGE_TEMPLATES } from "./badges.js";

export const DOMAIN_ID = "lifequest";
export const DOMAIN_NAME = "LifeQuest";

const ts = () => new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 2 });

// ---------------------------------------------------------------------------
// describeEffect — человекочитаемое описание эффекта
// ---------------------------------------------------------------------------
export function describeEffect(intentId, alpha, ctx, target) {
  const intent = INTENTS[intentId];
  const name = intent?.name || intentId;
  switch (intentId) {
    case "create_goal": return `🎯 Новая цель: ${(ctx.title || "").slice(0, 40)}`;
    case "complete_goal": return `✅ Цель достигнута!`;
    case "create_habit": return `🌱 Новая привычка: ${(ctx.title || "").slice(0, 40)}`;
    case "check_habit": return `✔️ Привычка выполнена`;
    case "uncheck_habit": return `↩️ Отметка снята`;
    case "log_habit_value": return `📊 Значение: ${ctx.value ?? "?"}`;
    case "create_task": return `📝 Задача: ${(ctx.title || "").slice(0, 40)}`;
    case "complete_task": return `✅ Задача выполнена`;
    case "assess_sphere": return `🧭 Оценка сферы: ${ctx.score ?? "?"}/10`;
    case "set_quote": return `💬 Цитата дня установлена`;
    case "random_quote": return `💬 Случайная цитата`;
    case "earn_xp": return `✨ +${ctx.amount || 0} XP`;
    case "earn_badge": return `🏅 Бейдж: ${ctx.badgeType || "?"}`;
    case "level_up": return `🎉 Новый уровень: ${ctx.level || "?"}`;
    case "_seed": return `seed: ${alpha} ${ctx.id || ""}`;
    default: return `${name}: ${alpha} ${target || ""}`;
  }
}

// ---------------------------------------------------------------------------
// signalForIntent — сигналы для ключевых событий
// ---------------------------------------------------------------------------
export function signalForIntent(intentId) {
  switch (intentId) {
    case "complete_goal": return { κ: "notification", desc: "Цель достигнута!" };
    case "earn_badge": return { κ: "notification", desc: "Новое достижение!" };
    case "level_up": return { κ: "notification", desc: "Новый уровень!" };
    case "streak_7": case "streak_30": case "streak_100":
      return { κ: "notification", desc: "Серия продолжается!" };
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

/** Начало текущего дня (UTC) */
function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Начало вчерашнего дня (UTC) */
function yesterdayStart() {
  return todayStart() - 86400000;
}

// ---------------------------------------------------------------------------
// buildEffects — построение эффектов по intentId
// ---------------------------------------------------------------------------
export function buildEffects(intentId, ctx, world, drafts) {
  const now = Date.now();
  const effects = [];
  const ef = (props) => effects.push({
    id: uuid(), intent_id: intentId, parent_id: null, status: "proposed",
    ttl: null, created_at: now, time: ts(), ...props,
  });

  switch (intentId) {

    // === Привычки: отметка ===
    case "check_habit": {
      const habitId = ctx.habitId || ctx.id;
      if (!habitId) return null;
      const habit = (world.habits || []).find(h => h.id === habitId);
      if (!habit) return null;

      // Создаём запись HabitLog
      const logId = `hlog_${now}_${Math.random().toString(36).slice(2, 6)}`;
      ef({ alpha: "add", target: "habitLogs", scope: "account", value: null,
        context: {
          id: logId, habitId, userId: ctx.userId || ctx.clientId,
          done: true, date: todayStart(), createdAt: now,
        },
        desc: describeEffect(intentId, "add", ctx) });

      // Вычисляем серию: есть ли лог за вчера?
      const yday = yesterdayStart();
      const hadYesterday = (world.habitLogs || []).some(
        l => l.habitId === habitId && l.done && l.date >= yday && l.date < todayStart()
      );
      const newStreak = hadYesterday ? (habit.streakCurrent || 0) + 1 : 1;
      const newBest = Math.max(newStreak, habit.streakBest || 0);

      ef({ alpha: "replace", target: "habit.streakCurrent", scope: "account",
        value: newStreak, context: { id: habitId },
        desc: `Серия: ${newStreak} дней` });
      ef({ alpha: "replace", target: "habit.streakBest", scope: "account",
        value: newBest, context: { id: habitId },
        desc: `Лучшая серия: ${newBest} дней` });
      return effects;
    }

    // === Привычки: лог значения (числовая) ===
    case "log_habit_value": {
      const habitId = ctx.habitId || ctx.id;
      if (!habitId || ctx.value === undefined) return null;
      const habit = (world.habits || []).find(h => h.id === habitId);
      if (!habit) return null;

      const logId = `hlog_${now}_${Math.random().toString(36).slice(2, 6)}`;
      ef({ alpha: "add", target: "habitLogs", scope: "account", value: null,
        context: {
          id: logId, habitId, userId: ctx.userId || ctx.clientId,
          done: true, value: ctx.value, date: todayStart(), createdAt: now,
        },
        desc: describeEffect(intentId, "add", ctx) });

      const yday = yesterdayStart();
      const hadYesterday = (world.habitLogs || []).some(
        l => l.habitId === habitId && l.done && l.date >= yday && l.date < todayStart()
      );
      const newStreak = hadYesterday ? (habit.streakCurrent || 0) + 1 : 1;
      const newBest = Math.max(newStreak, habit.streakBest || 0);

      ef({ alpha: "replace", target: "habit.streakCurrent", scope: "account",
        value: newStreak, context: { id: habitId },
        desc: `Серия: ${newStreak} дней` });
      ef({ alpha: "replace", target: "habit.streakBest", scope: "account",
        value: newBest, context: { id: habitId },
        desc: `Лучшая серия: ${newBest} дней` });
      return effects;
    }

    // === Привычки: снять отметку ===
    case "uncheck_habit": {
      const habitId = ctx.habitId || ctx.id;
      if (!habitId) return null;
      const today = todayStart();
      const todayLog = (world.habitLogs || []).find(
        l => l.habitId === habitId && l.done && l.date >= today && l.date < today + 86400000
      );
      if (!todayLog) return null;

      ef({ alpha: "replace", target: "habitLog.done", scope: "account",
        value: false, context: { id: todayLog.id },
        desc: describeEffect(intentId, "replace", ctx) });
      return effects;
    }

    // === Цели: завершить ===
    case "complete_goal": {
      const goalId = ctx.id || ctx.goalId;
      if (!goalId) return null;
      const uid = ctx.userId || ctx.clientId;
      ef({ alpha: "replace", target: "goal.status", scope: "account",
        value: "completed", context: { id: goalId, userId: uid },
        desc: "Статус: завершена" });
      ef({ alpha: "replace", target: "goal.progress", scope: "account",
        value: 100, context: { id: goalId, userId: uid },
        desc: "Прогресс: 100%" });
      return effects;
    }

    // === Задачи: завершить ===
    case "complete_task": {
      const taskId = ctx.id || ctx.taskId;
      if (!taskId) return null;
      ef({ alpha: "replace", target: "task.done", scope: "account",
        value: true, context: { id: taskId, userId: ctx.userId || ctx.clientId },
        desc: describeEffect(intentId, "replace", ctx) });
      return effects;
    }

    // === XP: начислить ===
    case "earn_xp": {
      const userId = ctx.userId || ctx.clientId;
      const amount = Number(ctx.amount) || 0;
      if (!userId || !amount) return null;
      const user = (world.users || []).find(u => u.id === userId);
      const currentXp = user?.xp || 0;
      ef({ alpha: "replace", target: "user.xp", scope: "account",
        value: currentXp + amount, context: { id: userId },
        desc: describeEffect(intentId, "replace", ctx) });
      return effects;
    }

    // === Бейдж: выдать ===
    case "earn_badge": {
      const userId = ctx.userId || ctx.clientId;
      const badgeType = ctx.badgeType;
      if (!userId || !badgeType) return null;

      // Проверяем, не выдан ли уже
      const alreadyHas = (world.badges || []).some(
        b => b.userId === userId && b.type === badgeType
      );
      if (alreadyHas) return null;

      const template = BADGE_TEMPLATES.find(t => t.type === badgeType);
      const badgeId = `badge_${now}_${Math.random().toString(36).slice(2, 6)}`;
      ef({ alpha: "add", target: "badges", scope: "account", value: null,
        context: {
          id: badgeId, userId, type: badgeType,
          title: template?.title || badgeType,
          icon: template?.icon || "🏅",
          description: template?.description || "",
          earnedAt: now,
        },
        desc: describeEffect(intentId, "add", ctx) });
      return effects;
    }

    // === Случайная цитата ===
    case "random_quote": {
      const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      const quoteId = `quote_${now}`;
      ef({ alpha: "add", target: "quotes", scope: "account", value: null,
        context: {
          id: quoteId, text: quote.text, author: quote.author,
          userId: ctx.userId || ctx.clientId, createdAt: now,
        },
        desc: describeEffect(intentId, "add", ctx) });
      return effects;
    }
  }

  // =========================================================================
  // Generic handler — механическое применение particles.effects
  // =========================================================================
  const intent = INTENTS[intentId];
  if (!intent) return null;
  const intentEffects = intent.particles.effects || [];
  if (intentEffects.length === 0) return null;

  for (const iEf of intentEffects) {
    const alpha = iEf.α;
    const target = iEf.target;
    const scope = iEf.σ || "account";

    switch (alpha) {
      case "add": {
        const entityId = ctx.id || `${target.slice(0, 4)}_${now}_${Math.random().toString(36).slice(2, 6)}`;
        ef({ alpha: "add", target, scope, value: null,
          context: { id: entityId, ...ctx, createdAt: now },
          desc: describeEffect(intentId, "add", ctx, target) });
        break;
      }
      case "replace": {
        const entityId = ctx.id || ctx.entityId;
        const field = target.includes(".") ? target.split(".").pop() : target;
        const resolvedValue =
          iEf.value !== undefined ? iEf.value
          : ctx[field] !== undefined ? ctx[field]
          : ctx.value;
        if (entityId && resolvedValue !== undefined) {
          ef({ alpha: "replace", target, scope, value: resolvedValue,
            context: { id: entityId, userId: ctx.userId || ctx.clientId },
            desc: describeEffect(intentId, "replace", ctx, target) });
        }
        break;
      }
      case "remove": {
        const entityId = ctx.id || ctx.entityId;
        if (entityId) {
          ef({ alpha: "remove", target, scope, value: null,
            context: { id: entityId, userId: ctx.userId || ctx.clientId },
            desc: describeEffect(intentId, "remove", ctx, target) });
        }
        break;
      }
    }
  }

  return effects.length > 0 ? effects : null;
}

// ---------------------------------------------------------------------------
// getSeedEffects — начальные данные для домена
// ---------------------------------------------------------------------------
export function getSeedEffects() {
  const now = Date.now();
  const effects = [];
  const add = (target, context) => effects.push({
    id: uuid(), intent_id: "_seed", alpha: "add", target, value: null,
    scope: "account", parent_id: null, status: "confirmed", ttl: null,
    context, created_at: now, resolved_at: now,
  });

  // ===== 12 сфер жизни (колесо баланса) =====
  add("spheres", { id: "sphere_health",     name: "Здоровье",           icon: "💪", color: "#4CAF50", score: 0, sortOrder: 1 });
  add("spheres", { id: "sphere_finance",    name: "Финансы",            icon: "💰", color: "#FFC107", score: 0, sortOrder: 2 });
  add("spheres", { id: "sphere_career",     name: "Карьера",            icon: "💼", color: "#2196F3", score: 0, sortOrder: 3 });
  add("spheres", { id: "sphere_relations",  name: "Отношения",          icon: "❤️", color: "#E91E63", score: 0, sortOrder: 4 });
  add("spheres", { id: "sphere_family",     name: "Семья",              icon: "👨‍👩‍👧", color: "#FF5722", score: 0, sortOrder: 5 });
  add("spheres", { id: "sphere_friends",    name: "Друзья",             icon: "🤝", color: "#9C27B0", score: 0, sortOrder: 6 });
  add("spheres", { id: "sphere_growth",     name: "Личностный рост",    icon: "📈", color: "#00BCD4", score: 0, sortOrder: 7 });
  add("spheres", { id: "sphere_spiritual",  name: "Духовность",         icon: "🧘", color: "#673AB7", score: 0, sortOrder: 8 });
  add("spheres", { id: "sphere_creativity", name: "Творчество",         icon: "🎨", color: "#FF9800", score: 0, sortOrder: 9 });
  add("spheres", { id: "sphere_leisure",    name: "Отдых",              icon: "🏖️", color: "#03A9F4", score: 0, sortOrder: 10 });
  add("spheres", { id: "sphere_environment",name: "Окружение",          icon: "🏡", color: "#8BC34A", score: 0, sortOrder: 11 });
  add("spheres", { id: "sphere_society",    name: "Вклад в общество",   icon: "🌍", color: "#607D8B", score: 0, sortOrder: 12 });

  // ===== Тестовые пользователи =====
  add("users", {
    id: "user_hero", name: "Алексей Герой", email: "hero@lifequest.ru",
    avatar: null, xp: 1250, level: 5,
    registeredAt: now - 90 * 86400000,
  });
  add("users", {
    id: "user_newbie", name: "Мария Новичок", email: "newbie@lifequest.ru",
    avatar: null, xp: 120, level: 1,
    registeredAt: now - 7 * 86400000,
  });
  add("users", {
    id: "user_master", name: "Сергей Мастеров", email: "master@lifequest.ru",
    avatar: null, xp: 8500, level: 15,
    registeredAt: now - 365 * 86400000,
  });

  // ===== Тестовые цели =====
  add("goals", {
    id: "goal_1", userId: "user_hero", sphereId: "sphere_health",
    title: "Пробежать полумарафон", description: "Подготовиться и пробежать 21.1 км",
    status: "active", progress: 60, targetDate: now + 60 * 86400000,
    createdAt: now - 30 * 86400000,
  });
  add("goals", {
    id: "goal_2", userId: "user_hero", sphereId: "sphere_career",
    title: "Выучить TypeScript", description: "Пройти курс и применить на рабочем проекте",
    status: "active", progress: 35, targetDate: now + 90 * 86400000,
    createdAt: now - 14 * 86400000,
  });
  add("goals", {
    id: "goal_3", userId: "user_hero", sphereId: "sphere_finance",
    title: "Накопить подушку безопасности", description: "Отложить 6 зарплат на непредвиденные расходы",
    status: "completed", progress: 100, targetDate: now - 10 * 86400000,
    completedAt: now - 10 * 86400000, createdAt: now - 180 * 86400000,
  });

  // ===== Тестовые привычки =====
  add("habits", {
    id: "habit_1", userId: "user_hero", sphereId: "sphere_health",
    title: "Утренняя пробежка", description: "Бег 5 км каждое утро",
    frequency: "daily", type: "boolean",
    streakCurrent: 12, streakBest: 21, xpReward: 15,
    createdAt: now - 45 * 86400000,
  });
  add("habits", {
    id: "habit_2", userId: "user_hero", sphereId: "sphere_growth",
    title: "Чтение", description: "Читать 30 минут перед сном",
    frequency: "daily", type: "boolean",
    streakCurrent: 5, streakBest: 30, xpReward: 10,
    createdAt: now - 60 * 86400000,
  });
  add("habits", {
    id: "habit_3", userId: "user_hero", sphereId: "sphere_health",
    title: "Вода", description: "Выпивать 2 литра воды в день",
    frequency: "daily", type: "numeric", unit: "л", targetValue: 2,
    streakCurrent: 3, streakBest: 14, xpReward: 5,
    createdAt: now - 30 * 86400000,
  });
  add("habits", {
    id: "habit_4", userId: "user_hero", sphereId: "sphere_spiritual",
    title: "Медитация", description: "10 минут осознанности",
    frequency: "daily", type: "boolean",
    streakCurrent: 0, streakBest: 7, xpReward: 10,
    createdAt: now - 20 * 86400000,
  });

  // ===== Тестовые задачи =====
  const todayStr = new Date().toISOString().slice(0, 10);
  add("tasks", {
    id: "task_1", userId: "user_hero", goalId: "goal_1",
    title: "Купить беговые кроссовки", done: true,
    date: todayStr, createdAt: now - 25 * 86400000,
  });
  add("tasks", {
    id: "task_2", userId: "user_hero", goalId: "goal_1",
    title: "Пробежать 10 км без остановки", done: true,
    date: todayStr, createdAt: now - 20 * 86400000,
  });
  add("tasks", {
    id: "task_3", userId: "user_hero", goalId: "goal_1",
    title: "Зарегистрироваться на забег", done: false,
    date: todayStr, createdAt: now - 10 * 86400000,
  });
  add("tasks", {
    id: "task_4", userId: "user_hero", goalId: "goal_2",
    title: "Пройти раздел Generics", done: false,
    date: todayStr, createdAt: now - 7 * 86400000,
  });
  add("tasks", {
    id: "task_5", userId: "user_hero", goalId: null,
    title: "Записаться к стоматологу", done: false,
    date: todayStr, createdAt: now - 2 * 86400000,
  });

  // ===== Тестовая цитата =====
  add("quotes", {
    id: "quote_1", text: "Путь в тысячу миль начинается с одного шага",
    author: "Лао-цзы", userId: "user_hero", createdAt: now - 86400000,
  });

  // ===== Тестовые бейджи =====
  add("badges", {
    id: "badge_1", userId: "user_hero", type: "first_habit",
    title: "Начало пути", icon: "🌱", description: "Создать первую привычку",
    earnedAt: now - 45 * 86400000,
  });
  add("badges", {
    id: "badge_2", userId: "user_hero", type: "first_goal",
    title: "Первая вершина", icon: "⛰️", description: "Завершить первую цель",
    earnedAt: now - 10 * 86400000,
  });

  return effects;
}
