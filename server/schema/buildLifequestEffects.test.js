import { describe, it, expect } from "vitest";
import { buildLifequestEffects } from "./buildLifequestEffects.cjs";

const viewer = { id: "user_1", email: "user@test.com" };

const baseGoal = {
  id: "goal_1", userId: "user_1", title: "Выучить Go",
  status: "active", progress: 40, sphereId: "career",
};

const baseHabit = {
  id: "habit_1", userId: "user_1", title: "Бег",
  type: "binary", frequency: "daily", status: "active",
  streakCurrent: 3, streakBest: 5,
  targetValue: null, unit: null,
};

const baseTask = {
  id: "task_1", userId: "user_1", title: "Прочитать главу",
  done: false, priority: false, goalId: "goal_1",
};

function yesterdayStr() {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

describe("buildLifequestEffects", () => {
  // === create_goal ===
  describe("create_goal", () => {
    it("создаёт цель с active статусом и progress 0", () => {
      const effects = buildLifequestEffects("create_goal", {
        title: "Выучить Go", sphereId: "career", deadline: 1700000000000,
      }, viewer, {});
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].target).toBe("goals");
      expect(effects[0].context.userId).toBe("user_1");
      expect(effects[0].context.title).toBe("Выучить Go");
      expect(effects[0].context.status).toBe("active");
      expect(effects[0].context.progress).toBe(0);
      expect(effects[0].context.sphereId).toBe("career");
    });

    it("отклоняет пустой title", () => {
      expect(buildLifequestEffects("create_goal", { title: "" }, viewer, {})).toBeNull();
      expect(buildLifequestEffects("create_goal", {}, viewer, {})).toBeNull();
    });
  });

  // === complete_goal ===
  describe("complete_goal", () => {
    it("ставит status completed и progress 100", () => {
      const world = { goals: [baseGoal] };
      const effects = buildLifequestEffects("complete_goal", { id: "goal_1" }, viewer, world);
      expect(effects).toHaveLength(2);
      expect(effects[0].alpha).toBe("replace");
      expect(effects[0].target).toBe("goal.status");
      expect(effects[0].value).toBe("completed");
      expect(effects[1].alpha).toBe("replace");
      expect(effects[1].target).toBe("goal.progress");
      expect(effects[1].value).toBe(100);
    });

    it("отклоняет несуществующую цель", () => {
      expect(buildLifequestEffects("complete_goal", { id: "no" }, viewer, { goals: [] })).toBeNull();
    });
  });

  // === update_goal_progress ===
  describe("update_goal_progress", () => {
    it("обновляет прогресс цели", () => {
      const world = { goals: [baseGoal] };
      const effects = buildLifequestEffects("update_goal_progress", { id: "goal_1", progress: 75 }, viewer, world);
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("replace");
      expect(effects[0].target).toBe("goal.progress");
      expect(effects[0].value).toBe(75);
    });

    it("ограничивает прогресс диапазоном 0-100", () => {
      const world = { goals: [baseGoal] };
      const e1 = buildLifequestEffects("update_goal_progress", { id: "goal_1", progress: 150 }, viewer, world);
      expect(e1[0].value).toBe(100);
      const e2 = buildLifequestEffects("update_goal_progress", { id: "goal_1", progress: -10 }, viewer, world);
      expect(e2[0].value).toBe(0);
    });
  });

  // === create_habit ===
  describe("create_habit", () => {
    it("создаёт привычку, type по умолчанию binary", () => {
      const effects = buildLifequestEffects("create_habit", {
        title: "Медитация", sphereId: "health",
      }, viewer, {});
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].target).toBe("habits");
      expect(effects[0].context.type).toBe("binary");
      expect(effects[0].context.frequency).toBe("daily");
      expect(effects[0].context.streakCurrent).toBe(0);
      expect(effects[0].context.streakBest).toBe(0);
      expect(effects[0].context.userId).toBe("user_1");
    });

    it("создаёт привычку с явным type quantitative", () => {
      const effects = buildLifequestEffects("create_habit", {
        title: "Вода", type: "quantitative", targetValue: 2000, unit: "мл",
      }, viewer, {});
      expect(effects[0].context.type).toBe("quantitative");
      expect(effects[0].context.targetValue).toBe(2000);
      expect(effects[0].context.unit).toBe("мл");
    });

    it("отклоняет пустой title", () => {
      expect(buildLifequestEffects("create_habit", { title: "  " }, viewer, {})).toBeNull();
    });
  });

  // === check_habit ===
  describe("check_habit", () => {
    it("создаёт лог и увеличивает streak (есть вчерашний лог)", () => {
      const world = {
        habits: [baseHabit],
        habitLogs: [{ habitId: "habit_1", done: true, date: yesterdayStr() }],
      };
      const effects = buildLifequestEffects("check_habit", { id: "habit_1" }, viewer, world);
      // add log + replace streakCurrent (no streakBest because 4 < 5)
      expect(effects).toHaveLength(2);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].target).toBe("habitLogs");
      expect(effects[0].context.done).toBe(true);
      expect(effects[0].context.date).toBe(todayStr());
      expect(effects[0].context.xpEarned).toBe(10);
      expect(effects[1].alpha).toBe("replace");
      expect(effects[1].target).toBe("habit.streakCurrent");
      expect(effects[1].value).toBe(4); // 3 + 1
    });

    it("сбрасывает streak на 1 (нет вчерашнего лога)", () => {
      const world = { habits: [baseHabit], habitLogs: [] };
      const effects = buildLifequestEffects("check_habit", { id: "habit_1" }, viewer, world);
      expect(effects).toHaveLength(2);
      expect(effects[1].value).toBe(1); // streak reset
    });

    it("обновляет streakBest если текущий превысил", () => {
      const habit = { ...baseHabit, streakCurrent: 5, streakBest: 5 };
      const world = {
        habits: [habit],
        habitLogs: [{ habitId: "habit_1", done: true, date: yesterdayStr() }],
      };
      const effects = buildLifequestEffects("check_habit", { id: "habit_1" }, viewer, world);
      expect(effects).toHaveLength(3); // add + streakCurrent + streakBest
      expect(effects[2].target).toBe("habit.streakBest");
      expect(effects[2].value).toBe(6);
    });

    it("отклоняет несуществующую привычку", () => {
      expect(buildLifequestEffects("check_habit", { id: "no" }, viewer, { habits: [] })).toBeNull();
    });
  });

  // === log_habit_value ===
  describe("log_habit_value", () => {
    it("логирует значение, done=true если value >= targetValue", () => {
      const habit = { ...baseHabit, type: "quantitative", targetValue: 2000, unit: "мл" };
      const world = { habits: [habit], habitLogs: [] };
      const effects = buildLifequestEffects("log_habit_value", { id: "habit_1", value: 2500 }, viewer, world);
      expect(effects.length).toBeGreaterThanOrEqual(2);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].context.value).toBe(2500);
      expect(effects[0].context.done).toBe(true);
      expect(effects[0].context.xpEarned).toBe(10);
    });

    it("done=false если value < targetValue", () => {
      const habit = { ...baseHabit, type: "quantitative", targetValue: 2000 };
      const world = { habits: [habit], habitLogs: [] };
      const effects = buildLifequestEffects("log_habit_value", { id: "habit_1", value: 500 }, viewer, world);
      expect(effects).toHaveLength(1); // только add, без streak-обновлений
      expect(effects[0].context.done).toBe(false);
      expect(effects[0].context.xpEarned).toBe(0);
    });
  });

  // === create_task ===
  describe("create_task", () => {
    it("создаёт задачу с сегодняшней датой по умолчанию", () => {
      const effects = buildLifequestEffects("create_task", { title: "Купить молоко" }, viewer, {});
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].target).toBe("tasks");
      expect(effects[0].context.date).toBe(todayStr());
      expect(effects[0].context.done).toBe(false);
      expect(effects[0].context.priority).toBe(false);
      expect(effects[0].context.goalId).toBeNull();
    });

    it("использует переданную дату и goalId", () => {
      const effects = buildLifequestEffects("create_task", {
        title: "Доклад", date: "2026-05-01", goalId: "goal_1",
      }, viewer, {});
      expect(effects[0].context.date).toBe("2026-05-01");
      expect(effects[0].context.goalId).toBe("goal_1");
    });

    it("отклоняет пустой title", () => {
      expect(buildLifequestEffects("create_task", { title: "" }, viewer, {})).toBeNull();
    });
  });

  // === complete_task ===
  describe("complete_task", () => {
    it("ставит done=true", () => {
      const world = { tasks: [baseTask] };
      const effects = buildLifequestEffects("complete_task", { id: "task_1" }, viewer, world);
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("replace");
      expect(effects[0].target).toBe("task.done");
      expect(effects[0].value).toBe(true);
    });

    it("отклоняет несуществующую задачу", () => {
      expect(buildLifequestEffects("complete_task", { id: "no" }, viewer, { tasks: [] })).toBeNull();
    });
  });

  // === assess_sphere ===
  describe("assess_sphere", () => {
    it("создаёт оценку сферы", () => {
      const effects = buildLifequestEffects("assess_sphere", {
        sphereId: "health", score: 7, description: "Нормально", targetScore: 9,
      }, viewer, {});
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].target).toBe("sphereAssessments");
      expect(effects[0].context.sphereId).toBe("health");
      expect(effects[0].context.score).toBe(7);
      expect(effects[0].context.targetScore).toBe(9);
      expect(effects[0].context.userId).toBe("user_1");
    });

    it("отклоняет без sphereId", () => {
      expect(buildLifequestEffects("assess_sphere", { score: 5 }, viewer, {})).toBeNull();
    });
  });

  // === set_quote ===
  describe("set_quote", () => {
    it("создаёт цитату", () => {
      const effects = buildLifequestEffects("set_quote", {
        text: "Будь собой", author: "Оскар Уайльд",
      }, viewer, {});
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].target).toBe("quotes");
      expect(effects[0].context.text).toBe("Будь собой");
      expect(effects[0].context.author).toBe("Оскар Уайльд");
      expect(effects[0].context.userId).toBe("user_1");
    });

    it("отклоняет пустой text", () => {
      expect(buildLifequestEffects("set_quote", { text: "" }, viewer, {})).toBeNull();
      expect(buildLifequestEffects("set_quote", {}, viewer, {})).toBeNull();
    });
  });

  // === unknown intent ===
  it("unknown intent → null", () => {
    expect(buildLifequestEffects("unknown_intent", {}, viewer, {})).toBeNull();
  });
});
