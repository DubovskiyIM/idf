import { v4 as uuid } from "uuid";

/* INTENT_SALIENCE merge (idf-sdk #434 tier-driven routing pilot) */
import { INTENTS as RAW_INTENTS } from "./intents.js";
import { INTENT_SALIENCE } from "./intent-salience.js";
export const INTENTS = Object.fromEntries(
  Object.entries(RAW_INTENTS).map(([id, intent]) =>
    INTENT_SALIENCE[id] !== undefined && intent.salience === undefined
      ? [id, { ...intent, salience: INTENT_SALIENCE[id] }]
      : [id, intent]
  )
);

export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
import { computeQuadrant, defaultEmotionForQuadrant } from "./emotions.js";

export const DOMAIN_ID = "reflect";
export const DOMAIN_NAME = "Reflect";

export function describeEffect(intentId, alpha, ctx, target) {
  switch (intentId) {
    case "quick_checkin": return `✨ Чек-ин: ${ctx.emotion || "?"}`;
    case "detailed_checkin": return `📝 Подробный чек-ин: ${ctx.emotion || "?"}`;
    case "delete_entry": return `🗑 Удалена запись`;
    case "create_activity": return `➕ Активность: ${ctx.name || "?"}`;
    case "propose_hypothesis": return `🔬 Гипотеза: ${(ctx.title || "").slice(0, 30)}`;
    case "confirm_hypothesis": return `✓ Гипотеза подтверждена`;
    case "reject_hypothesis": return `✗ Гипотеза опровергнута`;
    case "generate_insight": return `💡 Открытие: ${(ctx.title || "").slice(0, 30)}`;
    case "award_milestone": return `🏆 Майлстоун: ${ctx.milestone || "?"}`;
    case "_seed": return `seed: ${alpha} ${ctx.id || ""}`;
    default:
      const intent = INTENTS[intentId];
      return `${intent?.name || intentId}: ${alpha} ${target || ""}`;
  }
}

export function signalForIntent(intentId) {
  switch (intentId) {
    case "generate_insight": return { κ: "notification", desc: "Новое открытие" };
    case "award_milestone": return { κ: "notification", desc: "Майлстоун!" };
    case "mood_drift_alert": return { κ: "notification", desc: "Заметная смена настроения" };
    default: return null;
  }
}

export function buildEffects(intentId, ctx, world, drafts) {
  const now = Date.now();
  const effects = [];
  const ef = (props) => effects.push({
    id: uuid(), intent_id: intentId, parent_id: null, status: "proposed",
    ttl: null, created_at: now, ...props,
  });

  switch (intentId) {
    case "quick_checkin": {
      const p = Number(ctx.pleasantness ?? 0);
      const e = Number(ctx.energy ?? 0);
      const quadrant = computeQuadrant(p, e);
      const emotion = ctx.emotion || defaultEmotionForQuadrant(quadrant);
      const id = `entry_${now}`;
      ef({
        alpha: "add", target: "moodEntries", scope: "account", value: null,
        context: {
          id,
          userId: ctx.userId || ctx.clientId,
          pleasantness: p, energy: e, quadrant,
          emotion, note: ctx.note || "",
          loggedAt: now,
        },
        desc: describeEffect(intentId, "add", { emotion }),
      });
      return effects;
    }

    case "detailed_checkin": {
      const p = Number(ctx.pleasantness ?? 0);
      const e = Number(ctx.energy ?? 0);
      const quadrant = computeQuadrant(p, e);
      const entryId = `entry_${now}`;
      ef({
        alpha: "add", target: "moodEntries", scope: "account", value: null,
        context: {
          id: entryId,
          userId: ctx.userId || ctx.clientId,
          pleasantness: p, energy: e, quadrant,
          emotion: ctx.emotion, note: ctx.note || "",
          loggedAt: now,
        },
        desc: describeEffect(intentId, "add", ctx),
      });
      const activityIds = ctx.activityIds || [];
      for (const activityId of activityIds) {
        ef({
          alpha: "add", target: "entryActivities", scope: "account", value: null,
          context: {
            id: `ea_${uuid()}`,
            userId: ctx.userId || ctx.clientId,
            entryId, activityId,
          },
        });
      }
      return effects;
    }

    case "duplicate_entry": {
      const orig = (world.moodEntries || []).find(e => e.id === ctx.id);
      if (!orig) return null;
      ef({
        alpha: "add", target: "moodEntries", scope: "account", value: null,
        context: { ...orig, id: `entry_${now}`, loggedAt: now },
      });
      return effects;
    }

    case "merge_activities": {
      const sourceId = ctx.sourceId;
      const targetId = ctx.targetId;
      const links = (world.entryActivities || []).filter(ea => ea.activityId === sourceId);
      for (const link of links) {
        ef({
          alpha: "replace", target: "entryActivity.activityId", scope: "account",
          value: targetId, context: { id: link.id },
        });
      }
      ef({
        alpha: "remove", target: "activities", scope: "account", value: null,
        context: { id: sourceId },
      });
      return effects;
    }

    case "update_streak": {
      const userId = ctx.userId;
      const user = (world.users || []).find(u => u.id === userId);
      if (!user) return null;
      const yesterday = now - 24 * 60 * 60 * 1000;
      const recentEntry = (world.moodEntries || []).find(e =>
        e.userId === userId && e.loggedAt > yesterday && e.loggedAt < now - 60 * 1000
      );
      const newStreak = recentEntry ? (user.streakCurrent || 0) + 1 : 1;
      ef({
        alpha: "replace", target: "user.streakCurrent", scope: "account",
        value: newStreak, context: { id: userId },
      });
      ef({
        alpha: "replace", target: "user.entryCount", scope: "account",
        value: (user.entryCount || 0) + 1, context: { id: userId },
      });
      return effects;
    }

    case "compute_correlation": return null; // server-side

    case "generate_insight": {
      ef({
        alpha: "add", target: "insights", scope: "account", value: null,
        context: {
          id: `insight_${now}_${Math.random().toString(36).slice(2, 6)}`,
          userId: ctx.userId,
          title: ctx.title || "Новое открытие",
          description: ctx.description || "",
          kind: ctx.kind || "correlation",
          data: typeof ctx.data === "string" ? ctx.data : JSON.stringify(ctx.data || {}),
          pinned: false, seenAt: null, createdAt: now,
        },
      });
      return effects;
    }

    case "award_milestone": {
      ef({
        alpha: "add", target: "insights", scope: "account", value: null,
        context: {
          id: `milestone_${now}`,
          userId: ctx.userId,
          title: ctx.milestone === "first_week" ? "Неделя осознанности" :
                 ctx.milestone === "first_month" ? "Месяц практики" : "Майлстоун",
          description: `Ты сделал ${ctx.milestone === "first_week" ? "7" : ctx.milestone === "first_month" ? "30" : "много"} чек-инов!`,
          kind: "milestone",
          data: JSON.stringify({ milestone: ctx.milestone }),
          pinned: false, seenAt: null, createdAt: now,
        },
      });
      return effects;
    }

    case "mood_drift_alert": {
      ef({
        alpha: "add", target: "insights", scope: "account", value: null,
        context: {
          id: `drift_${now}`,
          userId: ctx.userId,
          title: "Заметная смена настроения",
          description: "Последние 5 чек-инов в зоне 'спокойно + неприятно'. Это может быть сигналом — возможно стоит уделить внимание себе.",
          kind: "drift_alert",
          data: JSON.stringify({}),
          pinned: true, seenAt: null, createdAt: now,
        },
      });
      return effects;
    }
  }

  // Generic handler
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
        const id = ctx.id || `${target.slice(0, 4)}_${now}_${Math.random().toString(36).slice(2, 6)}`;
        ef({ alpha: "add", target, scope, value: null,
          context: { id, ...ctx, createdAt: now } });
        break;
      }
      case "replace": {
        const eid = ctx.id || ctx.entityId;
        const field = target.includes(".") ? target.split(".").pop() : target;
        const val = iEf.value !== undefined ? iEf.value
                  : ctx[field] !== undefined ? ctx[field]
                  : ctx.value;
        if (eid && val !== undefined) {
          ef({ alpha: "replace", target, scope, value: val,
            context: { id: eid, userId: ctx.userId || ctx.clientId } });
        }
        break;
      }
      case "remove": {
        const eid = ctx.id || ctx.entityId;
        if (eid) {
          ef({ alpha: "remove", target, scope, value: null,
            context: { id: eid, userId: ctx.userId || ctx.clientId } });
        }
        break;
      }
    }
  }
  return effects.length > 0 ? effects : null;
}

export function getSeedEffects() {
  const now = Date.now();
  const effects = [];
  const add = (target, context) => effects.push({
    id: uuid(), intent_id: "_seed", alpha: "add", target, value: null,
    scope: "account", parent_id: null, status: "confirmed", ttl: null,
    context, created_at: now, resolved_at: now,
  });

  const seedActivities = [
    { id: "act_work", name: "Работа", icon: "💼", category: "work" },
    { id: "act_exercise", name: "Спорт", icon: "🏃", category: "health" },
    { id: "act_sleep", name: "Сон", icon: "😴", category: "health" },
    { id: "act_food", name: "Еда", icon: "🍽", category: "health" },
    { id: "act_family", name: "Семья", icon: "👨‍👩‍👧", category: "social" },
    { id: "act_friends", name: "Друзья", icon: "🤝", category: "social" },
    { id: "act_alone", name: "Один", icon: "🧘", category: "mind" },
    { id: "act_meditation", name: "Медитация", icon: "🧘‍♂️", category: "mind" },
    { id: "act_hobby", name: "Хобби", icon: "🎨", category: "leisure" },
    { id: "act_walk", name: "Прогулка", icon: "🚶", category: "leisure" },
    { id: "act_study", name: "Учёба", icon: "📚", category: "mind" },
    { id: "act_relax", name: "Отдых", icon: "🛋", category: "leisure" },
  ];
  for (const a of seedActivities) {
    add("activities", { ...a, userId: null, archived: false });
  }
  return effects;
}
