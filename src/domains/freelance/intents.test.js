import { describe, it, expect } from "vitest";
import { INTENTS } from "./intents.js";

const GROUPS = {
  auth: ["register_by_email", "verify_email", "login", "logout", "reset_password"],
  system: ["schedule_timer", "revoke_timer", "session_set_active_role"],
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
