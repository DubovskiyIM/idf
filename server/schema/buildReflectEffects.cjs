/**
 * Серверный builder эффектов для agent-разрешённых reflect-intent'ов.
 *
 * Обрабатывает 7 intent'ов из roles.agent.canExecute:
 * quick_checkin, detailed_checkin, create_activity,
 * propose_hypothesis, create_tag, create_reminder, compute_correlation.
 *
 * Принимает (intentId, params, viewer, world),
 * возвращает массив effect-объектов или null.
 */

const { v4: uuid } = require("uuid");

function makeEffect(intentId, alpha, target, context, value = null, scope = "account") {
  return {
    id: uuid(),
    intent_id: intentId,
    alpha,
    target,
    value,
    scope,
    context,
    created_at: Date.now(),
  };
}

function computeQuadrant(p, e) {
  if (e >= 0) return p >= 0 ? "HEP" : "HEU";
  return p >= 0 ? "LEP" : "LEU";
}

function defaultEmotionForQuadrant(q) {
  return { HEP: "joyful", HEU: "stressed", LEP: "calm", LEU: "tired" }[q] || "calm";
}

function buildReflectEffects(intentId, params, viewer, world) {
  const now = Date.now();

  switch (intentId) {
    case "quick_checkin": {
      const p = Number(params.pleasantness ?? 0);
      const e = Number(params.energy ?? 0);
      const quadrant = computeQuadrant(p, e);
      const emotion = params.emotion || defaultEmotionForQuadrant(quadrant);
      return [makeEffect("quick_checkin", "add", "moodEntries", {
        id: `entry_${now}`,
        userId: viewer.id,
        pleasantness: p,
        energy: e,
        quadrant,
        emotion,
        note: params.note || "",
        loggedAt: now,
      })];
    }

    case "detailed_checkin": {
      const p = Number(params.pleasantness ?? 0);
      const e = Number(params.energy ?? 0);
      const quadrant = computeQuadrant(p, e);
      const entryId = `entry_${now}`;
      const effects = [makeEffect("detailed_checkin", "add", "moodEntries", {
        id: entryId,
        userId: viewer.id,
        pleasantness: p,
        energy: e,
        quadrant,
        emotion: params.emotion,
        note: params.note || "",
        loggedAt: now,
      })];
      for (const activityId of (params.activityIds || [])) {
        effects.push(makeEffect("detailed_checkin", "add", "entryActivities", {
          id: `ea_${uuid()}`,
          userId: viewer.id,
          entryId,
          activityId,
        }));
      }
      return effects;
    }

    case "create_activity": {
      return [makeEffect("create_activity", "add", "activities", {
        id: `act_${now}`,
        userId: viewer.id,
        name: params.name,
        icon: params.icon || "📋",
        category: params.category || "other",
        archived: false,
      })];
    }

    case "propose_hypothesis": {
      return [makeEffect("propose_hypothesis", "add", "hypotheses", {
        id: `hyp_${now}`,
        userId: viewer.id,
        title: params.title,
        whenActivity: params.whenActivity,
        expectedEffect: params.expectedEffect,
        status: "testing",
        confidence: 0,
        createdAt: now,
        resolvedAt: null,
      })];
    }

    case "create_tag": {
      return [makeEffect("create_tag", "add", "tags", {
        id: `tag_${now}`,
        userId: viewer.id,
        name: params.name,
        color: params.color || "#007aff",
      })];
    }

    case "create_reminder": {
      return [makeEffect("create_reminder", "add", "reminders", {
        id: `rem_${now}`,
        userId: viewer.id,
        text: params.text,
        triggerKind: params.triggerKind || "time",
        active: true,
      })];
    }

    case "compute_correlation": {
      const userId = params.userId || viewer.id;
      const entries = (world.moodEntries || []).filter(e => e.userId === userId);
      const links = (world.entryActivities || []).filter(ea => ea.userId === userId);
      const activities = (world.activities || []).filter(a => a.userId === userId || a.userId === null);
      const correlations = [];
      for (const activity of activities) {
        const presentEntryIds = new Set(
          links.filter(l => l.activityId === activity.id).map(l => l.entryId)
        );
        const present = entries.filter(e => presentEntryIds.has(e.id));
        const absent = entries.filter(e => !presentEntryIds.has(e.id));
        if (present.length < 2 || absent.length < 2) continue;
        const avgP = arr => arr.reduce((s, e) => s + e.pleasantness, 0) / arr.length;
        const delta = avgP(present) - avgP(absent);
        const allP = entries.map(e => e.pleasantness);
        const meanAll = avgP(entries);
        const sd = Math.sqrt(allP.reduce((s, x) => s + (x - meanAll) ** 2, 0) / allP.length) || 1;
        const correlation = delta / sd;
        if (Math.abs(correlation) > 0.6) {
          correlations.push({ activity: activity.id, correlation, delta });
        }
      }
      if (correlations.length === 0) return [];
      const top = correlations[0];
      return [makeEffect("compute_correlation", "add", "_meta", {
        userId,
        correlation: top.correlation,
        data: JSON.stringify(top),
      })];
    }

    default:
      return null;
  }
}

module.exports = { buildReflectEffects };
module.exports.default = buildReflectEffects;
