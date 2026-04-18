import { describe, it, expect } from "vitest";
import { INTENTS } from "./intents.js";

const GROUPS = {
  auth: ["register_by_email", "verify_email", "login", "logout", "reset_password"],
  system: ["schedule_timer", "revoke_timer", "session_set_active_role"],
  profile: [
    "update_profile", "update_bio", "add_skill", "remove_skill",
    "add_portfolio_item", "update_rates", "toggle_availability",
    "activate_executor_profile",
  ],
  task: [
    "create_task_draft", "submit_task_for_moderation", "edit_task",
    "publish_task", "cancel_task_before_deal",
    "search_tasks", "filter_by_category", "sort_tasks",
  ],
};

describe("freelance intents — auth + system", () => {
  for (const [group, ids] of Object.entries(GROUPS)) {
    for (const id of ids) {
      it(`${group}: ${id} зарегистрирован с α и particles`, () => {
        const intent = INTENTS[id];
        expect(intent, `intent ${id}`).toBeDefined();
        expect(intent.α).toMatch(/^(add|replace|remove)$/);
        expect(intent.particles).toBeDefined();
      });
    }
  }

  it("session_set_active_role имеет σ: 'session' (не пишет в Φ)", () => {
    const effs = INTENTS.session_set_active_role.particles.effects;
    expect(effs.every(e => e.σ === "session")).toBe(true);
  });

  it("register_by_email создаёт User", () => {
    expect(INTENTS.register_by_email.creates).toBe("User");
  });
});

describe("freelance intents — profile details", () => {
  it("activate_executor_profile создаёт ExecutorProfile", () => {
    expect(INTENTS.activate_executor_profile.creates).toBe("ExecutorProfile");
  });

  it("add_skill создаёт ExecutorSkill (assignment)", () => {
    expect(INTENTS.add_skill.creates).toBe("ExecutorSkill");
  });

  it("toggle_availability — replace на ExecutorProfile.availability", () => {
    expect(INTENTS.toggle_availability.α).toBe("replace");
    const target = INTENTS.toggle_availability.particles.effects[0].target;
    expect(target).toMatch(/availability/);
  });
});

describe("freelance intents — task details", () => {
  it("create_task_draft создаёт Task", () => {
    expect(INTENTS.create_task_draft.creates).toBe("Task");
  });

  it("submit_task_for_moderation — replace task.status на moderation", () => {
    const e = INTENTS.submit_task_for_moderation.particles.effects[0];
    expect(e.α).toBe("replace");
    expect(e.target).toBe("task.status");
    expect(e.value).toBe("moderation");
  });

  it("publish_task — replace task.status на published", () => {
    const e = INTENTS.publish_task.particles.effects[0];
    expect(e.α).toBe("replace");
    expect(e.target).toBe("task.status");
    expect(e.value).toBe("published");
  });

  it("search_tasks / filter_by_category / sort_tasks — read-only, effects пустые", () => {
    expect(INTENTS.search_tasks.particles.effects).toEqual([]);
    expect(INTENTS.filter_by_category.particles.effects).toEqual([]);
    expect(INTENTS.sort_tasks.particles.effects).toEqual([]);
  });
});
