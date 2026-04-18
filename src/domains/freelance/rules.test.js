import { describe, it, expect } from "vitest";
import { RULES } from "./rules.js";

describe("freelance rules", () => {
  const byId = (id) => RULES.find(r => r.id === id);

  it("содержит 2 rules в Cycle 2", () => {
    expect(RULES).toHaveLength(2);
  });

  it("auto_accept_after_3d — schedule-rule с trigger submit_work_result, after 72h", () => {
    const r = byId("auto_accept_after_3d");
    expect(r).toBeDefined();
    expect(r.extension).toBe("schedule");
    expect(r.trigger).toBe("submit_work_result");
    expect(r.after).toBe("72h");
    expect(r.revokeOn).toEqual(expect.arrayContaining(["accept_result", "request_revision", "cancel_deal_mutual"]));
    expect(r.fireIntent).toBe("auto_accept_result");
    expect(r.warnAt).toBe("48h");
  });

  it("recalc_rating — aggregation weighted avg Review", () => {
    const r = byId("recalc_rating");
    expect(r).toBeDefined();
    expect(r.extension).toBe("aggregation");
    expect(r.trigger).toBe("leave_review");
    expect(r.target).toBe("ExecutorProfile.rating");
    expect(r.formula).toBeDefined();
  });
});
