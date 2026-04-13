/**
 * Серверный builder эффектов для agent-разрешённых lifequest-intent'ов.
 *
 * Обрабатывает 10 intent'ов из roles.agent.canExecute:
 * create_goal, complete_goal, update_goal_progress,
 * create_habit, check_habit, log_habit_value,
 * create_task, complete_task, assess_sphere, set_quote.
 *
 * Принимает (intentId, params, viewer, world),
 * возвращает массив effect-объектов или null.
 */

const { v4: uuid } = require("uuid");

function ts() {
  return new Date().toLocaleTimeString("ru", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function makeEffect(intentId, props) {
  return {
    id: uuid(),
    intent_id: intentId,
    parent_id: null,
    status: "proposed",
    ttl: null,
    created_at: Date.now(),
    time: ts(),
    ...props
  };
}

function buildLifequestEffects(intentId, params, viewer, world) {
  const now = Date.now();

  switch (intentId) {
    case "create_goal": {
      if (!params.title?.trim()) return null;
      const id = `goal_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [makeEffect(intentId, {
        alpha: "add", target: "goals", scope: "account", value: null,
        context: {
          id, userId: viewer.id, title: params.title.trim(),
          description: params.description || "",
          sphereId: params.sphereId || null,
          deadline: params.deadline || null,
          status: "active", progress: 0,
          createdAt: now,
        },
        desc: `🎯 Новая цель: ${params.title.trim().slice(0, 30)}`
      })];
    }

    case "complete_goal": {
      const goal = (world.goals || []).find(g => g.id === params.id);
      if (!goal) return null;
      return [
        makeEffect(intentId, {
          alpha: "replace", target: "goal.status", scope: "account",
          value: "completed", context: { id: goal.id },
          desc: `✓ Цель завершена`
        }),
        makeEffect(intentId, {
          alpha: "replace", target: "goal.progress", scope: "account",
          value: 100, context: { id: goal.id },
          desc: `Прогресс → 100%`
        }),
      ];
    }

    case "update_goal_progress": {
      const goal = (world.goals || []).find(g => g.id === params.id);
      if (!goal) return null;
      const progress = Math.max(0, Math.min(100, params.progress || 0));
      return [makeEffect(intentId, {
        alpha: "replace", target: "goal.progress", scope: "account",
        value: progress, context: { id: goal.id },
        desc: `📊 Прогресс → ${progress}%`
      })];
    }

    case "create_habit": {
      if (!params.title?.trim()) return null;
      const id = `habit_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [makeEffect(intentId, {
        alpha: "add", target: "habits", scope: "account", value: null,
        context: {
          id, userId: viewer.id, title: params.title.trim(),
          sphereId: params.sphereId || null,
          type: params.type || "binary",
          targetValue: params.targetValue || null,
          unit: params.unit || null,
          frequency: params.frequency || "daily",
          status: "active",
          streakCurrent: 0, streakBest: 0,
          createdAt: now,
        },
        desc: `🔄 Новая привычка: ${params.title.trim().slice(0, 30)}`
      })];
    }

    case "check_habit": {
      const habit = (world.habits || []).find(h => h.id === params.id);
      if (!habit) return null;
      const todayStr = today();
      const logId = `hlog_${now}_${Math.random().toString(36).slice(2, 6)}`;

      const effects = [
        makeEffect(intentId, {
          alpha: "add", target: "habitLogs", scope: "account", value: null,
          context: {
            id: logId, habitId: habit.id, userId: viewer.id,
            done: true, date: todayStr, xpEarned: 10, createdAt: now,
          },
          desc: `✅ Привычка выполнена`
        }),
      ];

      // Вычисляем streak
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const logs = (world.habitLogs || []).filter(l => l.habitId === habit.id && l.done);
      const hadYesterday = logs.some(l => l.date === yesterday);
      const newStreak = hadYesterday ? (habit.streakCurrent || 0) + 1 : 1;

      effects.push(makeEffect(intentId, {
        alpha: "replace", target: "habit.streakCurrent", scope: "account",
        value: newStreak, context: { id: habit.id },
        desc: `🔥 Streak → ${newStreak}`
      }));

      if (newStreak > (habit.streakBest || 0)) {
        effects.push(makeEffect(intentId, {
          alpha: "replace", target: "habit.streakBest", scope: "account",
          value: newStreak, context: { id: habit.id },
          desc: `🏆 Лучший streak → ${newStreak}`
        }));
      }

      return effects;
    }

    case "log_habit_value": {
      const habit = (world.habits || []).find(h => h.id === params.id);
      if (!habit) return null;
      const todayStr = today();
      const logId = `hlog_${now}_${Math.random().toString(36).slice(2, 6)}`;
      const value = params.value || 0;
      const done = habit.targetValue ? value >= habit.targetValue : value > 0;

      const effects = [
        makeEffect(intentId, {
          alpha: "add", target: "habitLogs", scope: "account", value: null,
          context: {
            id: logId, habitId: habit.id, userId: viewer.id,
            value, done, date: todayStr, xpEarned: done ? 10 : 0, createdAt: now,
          },
          desc: `📝 Значение: ${value}${habit.unit ? " " + habit.unit : ""}`
        }),
      ];

      if (done) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const logs = (world.habitLogs || []).filter(l => l.habitId === habit.id && l.done);
        const hadYesterday = logs.some(l => l.date === yesterday);
        const newStreak = hadYesterday ? (habit.streakCurrent || 0) + 1 : 1;

        effects.push(makeEffect(intentId, {
          alpha: "replace", target: "habit.streakCurrent", scope: "account",
          value: newStreak, context: { id: habit.id },
          desc: `🔥 Streak → ${newStreak}`
        }));

        if (newStreak > (habit.streakBest || 0)) {
          effects.push(makeEffect(intentId, {
            alpha: "replace", target: "habit.streakBest", scope: "account",
            value: newStreak, context: { id: habit.id },
            desc: `🏆 Лучший streak → ${newStreak}`
          }));
        }
      }

      return effects;
    }

    case "create_task": {
      if (!params.title?.trim()) return null;
      const id = `task_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [makeEffect(intentId, {
        alpha: "add", target: "tasks", scope: "account", value: null,
        context: {
          id, userId: viewer.id, title: params.title.trim(),
          date: params.date || today(),
          goalId: params.goalId || null,
          done: false, priority: false,
          createdAt: now,
        },
        desc: `📋 Новая задача: ${params.title.trim().slice(0, 30)}`
      })];
    }

    case "complete_task": {
      const task = (world.tasks || []).find(t => t.id === params.id);
      if (!task) return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "task.done", scope: "account",
        value: true, context: { id: task.id },
        desc: `✓ Задача выполнена`
      })];
    }

    case "assess_sphere": {
      if (!params.sphereId) return null;
      const id = `sa_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [makeEffect(intentId, {
        alpha: "add", target: "sphereAssessments", scope: "account", value: null,
        context: {
          id, userId: viewer.id,
          sphereId: params.sphereId,
          score: params.score || 0,
          description: params.description || "",
          targetScore: params.targetScore || null,
          assessedAt: now,
        },
        desc: `📊 Оценка сферы: ${params.score || 0}/10`
      })];
    }

    case "set_quote": {
      if (!params.text?.trim()) return null;
      const id = `quote_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [makeEffect(intentId, {
        alpha: "add", target: "quotes", scope: "account", value: null,
        context: {
          id, userId: viewer.id,
          text: params.text.trim(),
          author: params.author || "",
          setAt: now,
        },
        desc: `💬 Цитата: "${params.text.trim().slice(0, 30)}"`
      })];
    }

    default:
      return null;
  }
}

module.exports = { buildLifequestEffects };
