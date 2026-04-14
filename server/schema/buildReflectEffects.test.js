import { describe, it, expect } from "vitest";
import { buildReflectEffects } from "./buildReflectEffects.cjs";

const viewer = { id: "user_1", email: "user@test.com" };

describe("buildReflectEffects", () => {
  // === quick_checkin ===
  describe("quick_checkin", () => {
    it("создаёт MoodEntry с quadrant HEP (p>=0, e>=0)", () => {
      const effects = buildReflectEffects("quick_checkin", {
        pleasantness: 2, energy: 2,
      }, viewer, {});
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].target).toBe("moodEntries");
      expect(effects[0].context.userId).toBe("user_1");
      expect(effects[0].context.quadrant).toBe("HEP");
      expect(effects[0].context.pleasantness).toBe(2);
      expect(effects[0].context.energy).toBe(2);
    });

    it("quadrant HEU (p<0, e>=0)", () => {
      const effects = buildReflectEffects("quick_checkin", {
        pleasantness: -2, energy: 2,
      }, viewer, {});
      expect(effects[0].context.quadrant).toBe("HEU");
    });

    it("quadrant LEP (p>=0, e<0)", () => {
      const effects = buildReflectEffects("quick_checkin", {
        pleasantness: 2, energy: -2,
      }, viewer, {});
      expect(effects[0].context.quadrant).toBe("LEP");
    });

    it("quadrant LEU (p<0, e<0)", () => {
      const effects = buildReflectEffects("quick_checkin", {
        pleasantness: -2, energy: -2,
      }, viewer, {});
      expect(effects[0].context.quadrant).toBe("LEU");
    });

    it("default emotion = центр квадранта", () => {
      const hep = buildReflectEffects("quick_checkin", { pleasantness: 2, energy: 2 }, viewer, {});
      expect(hep[0].context.emotion).toBe("joyful");
      const heu = buildReflectEffects("quick_checkin", { pleasantness: -2, energy: 2 }, viewer, {});
      expect(heu[0].context.emotion).toBe("stressed");
      const lep = buildReflectEffects("quick_checkin", { pleasantness: 2, energy: -2 }, viewer, {});
      expect(lep[0].context.emotion).toBe("calm");
      const leu = buildReflectEffects("quick_checkin", { pleasantness: -2, energy: -2 }, viewer, {});
      expect(leu[0].context.emotion).toBe("tired");
    });

    it("кастомная emotion передаётся", () => {
      const effects = buildReflectEffects("quick_checkin", {
        pleasantness: 2, energy: 2, emotion: "excited",
      }, viewer, {});
      expect(effects[0].context.emotion).toBe("excited");
    });
  });

  // === detailed_checkin ===
  describe("detailed_checkin", () => {
    it("создаёт MoodEntry + EntryActivity для каждой activity", () => {
      const effects = buildReflectEffects("detailed_checkin", {
        pleasantness: 1, energy: 1, emotion: "focused",
        activityIds: ["act_1", "act_2", "act_3"],
        note: "work session",
      }, viewer, {});
      expect(effects).toHaveLength(4);
      expect(effects[0].target).toBe("moodEntries");
      expect(effects[0].context.emotion).toBe("focused");
      expect(effects[0].context.note).toBe("work session");
      expect(effects[1].target).toBe("entryActivities");
      expect(effects[2].target).toBe("entryActivities");
      expect(effects[3].target).toBe("entryActivities");
      const entryId = effects[0].context.id;
      expect(effects[1].context.entryId).toBe(entryId);
      expect(effects[1].context.activityId).toBe("act_1");
      expect(effects[2].context.activityId).toBe("act_2");
      expect(effects[3].context.activityId).toBe("act_3");
    });

    it("без activityIds — только MoodEntry", () => {
      const effects = buildReflectEffects("detailed_checkin", {
        pleasantness: 0, energy: 0, emotion: "neutral",
      }, viewer, {});
      expect(effects).toHaveLength(1);
      expect(effects[0].target).toBe("moodEntries");
    });
  });

  // === create_activity ===
  describe("create_activity", () => {
    it("создаёт Activity с владельцем, archived=false", () => {
      const effects = buildReflectEffects("create_activity", {
        name: "Бег", icon: "🏃", category: "health",
      }, viewer, {});
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].target).toBe("activities");
      expect(effects[0].context.userId).toBe("user_1");
      expect(effects[0].context.name).toBe("Бег");
      expect(effects[0].context.icon).toBe("🏃");
      expect(effects[0].context.category).toBe("health");
      expect(effects[0].context.archived).toBe(false);
    });

    it("defaults: icon=📋, category=other", () => {
      const effects = buildReflectEffects("create_activity", { name: "X" }, viewer, {});
      expect(effects[0].context.icon).toBe("📋");
      expect(effects[0].context.category).toBe("other");
    });
  });

  // === propose_hypothesis ===
  describe("propose_hypothesis", () => {
    it("создаёт гипотезу со статусом testing и confidence 0", () => {
      const effects = buildReflectEffects("propose_hypothesis", {
        title: "Кофе → энергия",
        whenActivity: "act_coffee",
        expectedEffect: "energy+",
      }, viewer, {});
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].target).toBe("hypotheses");
      expect(effects[0].context.status).toBe("testing");
      expect(effects[0].context.confidence).toBe(0);
      expect(effects[0].context.resolvedAt).toBeNull();
      expect(effects[0].context.userId).toBe("user_1");
    });
  });

  // === create_tag ===
  describe("create_tag", () => {
    it("создаёт тег с дефолтным color", () => {
      const effects = buildReflectEffects("create_tag", { name: "work" }, viewer, {});
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].target).toBe("tags");
      expect(effects[0].context.name).toBe("work");
      expect(effects[0].context.color).toBe("#007aff");
      expect(effects[0].context.userId).toBe("user_1");
    });

    it("использует переданный color", () => {
      const effects = buildReflectEffects("create_tag", {
        name: "urgent", color: "#ff0000",
      }, viewer, {});
      expect(effects[0].context.color).toBe("#ff0000");
    });
  });

  // === create_reminder ===
  describe("create_reminder", () => {
    it("создаёт напоминание с дефолтным triggerKind=time", () => {
      const effects = buildReflectEffects("create_reminder", {
        text: "Check-in",
      }, viewer, {});
      expect(effects).toHaveLength(1);
      expect(effects[0].alpha).toBe("add");
      expect(effects[0].target).toBe("reminders");
      expect(effects[0].context.text).toBe("Check-in");
      expect(effects[0].context.triggerKind).toBe("time");
      expect(effects[0].context.active).toBe(true);
    });
  });

  // === compute_correlation ===
  describe("compute_correlation", () => {
    it("вычисляет correlation для активности, которая значимо связана", () => {
      const world = {
        moodEntries: [
          { id: "e1", userId: "user_1", pleasantness: 3, energy: 2 },
          { id: "e2", userId: "user_1", pleasantness: 3, energy: 2 },
          { id: "e3", userId: "user_1", pleasantness: -3, energy: -1 },
          { id: "e4", userId: "user_1", pleasantness: -3, energy: -1 },
        ],
        entryActivities: [
          { userId: "user_1", entryId: "e1", activityId: "act_run" },
          { userId: "user_1", entryId: "e2", activityId: "act_run" },
        ],
        activities: [
          { id: "act_run", userId: "user_1", name: "Бег" },
        ],
      };
      const effects = buildReflectEffects("compute_correlation", {}, viewer, world);
      expect(effects).toHaveLength(1);
      expect(effects[0].target).toBe("_meta");
      expect(effects[0].context.userId).toBe("user_1");
      expect(effects[0].context.correlation).toBeGreaterThan(0);
    });

    it("без активностей/данных → пустой массив", () => {
      const effects = buildReflectEffects("compute_correlation", {}, viewer, {
        moodEntries: [], entryActivities: [], activities: [],
      });
      expect(effects).toEqual([]);
    });
  });

  // === unknown intent ===
  it("unknown intent → null", () => {
    expect(buildReflectEffects("unknown_intent", {}, viewer, {})).toBeNull();
  });
});
