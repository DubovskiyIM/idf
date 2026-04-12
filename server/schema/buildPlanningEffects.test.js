import { describe, it, expect } from "vitest";
import { buildPlanningEffects } from "./buildPlanningEffects.cjs";

const viewer = { id: "user_me", email: "agent@local", name: "Agent" };

describe("buildPlanningEffects :: create_poll", () => {
  it("валидный title → poll с organizerId=viewer.id", () => {
    const effects = buildPlanningEffects("create_poll", { title: "Q2" }, viewer, {});
    expect(effects).toHaveLength(1);
    expect(effects[0].alpha).toBe("add");
    expect(effects[0].target).toBe("polls");
    expect(effects[0].context.organizerId).toBe("user_me");
    expect(effects[0].context.status).toBe("draft");
  });
  it("пустой title → null", () => {
    expect(buildPlanningEffects("create_poll", { title: "" }, viewer, {})).toBeNull();
  });
  it("missing title → null", () => {
    expect(buildPlanningEffects("create_poll", {}, viewer, {})).toBeNull();
  });
});

describe("buildPlanningEffects :: add_time_option", () => {
  const world = { polls: [{ id: "p1", status: "draft" }] };
  it("draft poll + все params → option", () => {
    const eff = buildPlanningEffects("add_time_option", { pollId: "p1", date: "2026-04-20", startTime: "13:00", endTime: "14:00" }, viewer, world);
    expect(eff).toHaveLength(1);
    expect(eff[0].context.pollId).toBe("p1");
  });
  it("poll в open → null", () => {
    expect(buildPlanningEffects("add_time_option", { pollId: "p1", date: "d", startTime: "s", endTime: "e" }, viewer, { polls: [{ id: "p1", status: "open" }] })).toBeNull();
  });
});

describe("buildPlanningEffects :: invite_participant", () => {
  const world = { polls: [{ id: "p1", status: "draft" }], users: [{ id: "user_me", email: "agent@local" }] };
  it("email matches world.users → userId резолвится", () => {
    const eff = buildPlanningEffects("invite_participant", { pollId: "p1", name: "Agent", email: "agent@local" }, viewer, world);
    expect(eff[0].context.userId).toBe("user_me");
  });
  it("explicit userId переопределяет email", () => {
    const eff = buildPlanningEffects("invite_participant", { pollId: "p1", name: "X", email: "x@x", userId: "u_explicit" }, viewer, world);
    expect(eff[0].context.userId).toBe("u_explicit");
  });
  it("email не матчит → userId=null", () => {
    const eff = buildPlanningEffects("invite_participant", { pollId: "p1", name: "Unknown", email: "unknown@x" }, viewer, world);
    expect(eff[0].context.userId).toBeNull();
  });
});

describe("buildPlanningEffects :: open_poll / close_poll", () => {
  const draftWorld = { polls: [{ id: "p1", status: "draft" }], options: [{ id: "o1", pollId: "p1" }], participants: [{ id: "pt1", pollId: "p1" }] };
  it("open_poll → replace status=open", () => {
    const eff = buildPlanningEffects("open_poll", { pollId: "p1" }, viewer, draftWorld);
    expect(eff).toHaveLength(1);
    expect(eff[0].value).toBe("open");
  });
  it("open без participants → null", () => {
    expect(buildPlanningEffects("open_poll", { pollId: "p1" }, viewer, { ...draftWorld, participants: [] })).toBeNull();
  });
  it("close_poll в open → closed", () => {
    const eff = buildPlanningEffects("close_poll", { pollId: "p1" }, viewer, { polls: [{ id: "p1", status: "open" }] });
    expect(eff[0].value).toBe("closed");
  });
  it("close в draft → null", () => {
    expect(buildPlanningEffects("close_poll", { pollId: "p1" }, viewer, draftWorld)).toBeNull();
  });
});

describe("buildPlanningEffects :: vote_*", () => {
  const world = {
    polls: [{ id: "p1", status: "open" }],
    options: [{ id: "o1", pollId: "p1", date: "2026-04-20", startTime: "13:00" }],
    participants: [
      { id: "pt_me", pollId: "p1", userId: "user_me", name: "Agent" },
      { id: "pt_other", pollId: "p1", userId: "user_other", name: "Other" }
    ],
    votes: []
  };
  it("vote_yes own participant → add vote value=yes", () => {
    const eff = buildPlanningEffects("vote_yes", { optionId: "o1", participantId: "pt_me" }, viewer, world);
    expect(eff).toHaveLength(1);
    expect(eff[0].context.value).toBe("yes");
  });
  it("vote_no → value=no", () => {
    const eff = buildPlanningEffects("vote_no", { optionId: "o1", participantId: "pt_me" }, viewer, world);
    expect(eff[0].context.value).toBe("no");
  });
  it("vote_maybe → value=maybe", () => {
    const eff = buildPlanningEffects("vote_maybe", { optionId: "o1", participantId: "pt_me" }, viewer, world);
    expect(eff[0].context.value).toBe("maybe");
  });
  it("чужой participantId → null (inline ownership)", () => {
    expect(buildPlanningEffects("vote_yes", { optionId: "o1", participantId: "pt_other" }, viewer, world)).toBeNull();
  });
  it("duplicate vote → null", () => {
    const w2 = { ...world, votes: [{ id: "v1", participantId: "pt_me", optionId: "o1" }] };
    expect(buildPlanningEffects("vote_yes", { optionId: "o1", participantId: "pt_me" }, viewer, w2)).toBeNull();
  });
  it("vote в draft phase → null", () => {
    const w2 = { ...world, polls: [{ id: "p1", status: "draft" }] };
    expect(buildPlanningEffects("vote_yes", { optionId: "o1", participantId: "pt_me" }, viewer, w2)).toBeNull();
  });
});

describe("buildPlanningEffects :: resolve_poll", () => {
  const world = {
    polls: [{ id: "p1", status: "closed", title: "Q2" }],
    options: [{ id: "o1", pollId: "p1", date: "2026-04-20", startTime: "13:00", endTime: "14:00" }],
    participants: [{ id: "pt1", pollId: "p1" }]
  };
  it("resolve → 2 effects (status + meeting)", () => {
    const eff = buildPlanningEffects("resolve_poll", { pollId: "p1", optionId: "o1" }, viewer, world);
    expect(eff).toHaveLength(2);
    expect(eff[0].value).toBe("resolved");
    expect(eff[1].target).toBe("meetings");
    expect(eff[1].context.status).toBe("confirmed");
  });
  it("not closed → null", () => {
    expect(buildPlanningEffects("resolve_poll", { pollId: "p1", optionId: "o1" }, viewer, { ...world, polls: [{ id: "p1", status: "open" }] })).toBeNull();
  });
});

describe("buildPlanningEffects :: cancel_poll + set_deadline + suggest_alternative + change_vote", () => {
  it("cancel draft → cancelled", () => {
    const eff = buildPlanningEffects("cancel_poll", { pollId: "p1" }, viewer, { polls: [{ id: "p1", status: "draft" }] });
    expect(eff[0].value).toBe("cancelled");
  });
  it("cancel resolved → null", () => {
    expect(buildPlanningEffects("cancel_poll", { pollId: "p1" }, viewer, { polls: [{ id: "p1", status: "resolved" }] })).toBeNull();
  });
  it("set_deadline open → replace deadline", () => {
    const eff = buildPlanningEffects("set_deadline", { pollId: "p1", deadline: "2026-04-20T18:00" }, viewer, { polls: [{ id: "p1", status: "open" }] });
    expect(eff[0].target).toBe("poll.deadline");
    expect(eff[0].value).toBe("2026-04-20T18:00");
  });
  it("suggest_alternative open → add option", () => {
    const eff = buildPlanningEffects("suggest_alternative", { pollId: "p1", date: "2026-04-21", startTime: "15:00", endTime: "16:00" }, viewer, { polls: [{ id: "p1", status: "open" }] });
    expect(eff[0].target).toBe("options");
  });
  it("change_vote → replace vote.value", () => {
    const eff = buildPlanningEffects("change_vote", { voteId: "v1", newValue: "no" }, viewer, {
      polls: [{ id: "p1", status: "open" }],
      votes: [{ id: "v1", pollId: "p1", value: "yes" }]
    });
    expect(eff[0].target).toBe("vote.value");
    expect(eff[0].value).toBe("no");
  });
});

describe("buildPlanningEffects :: accept/decline_invitation", () => {
  it("accept invited → active", () => {
    const eff = buildPlanningEffects("accept_invitation", { participantId: "pt1" }, viewer, { participants: [{ id: "pt1", userId: "user_me", status: "invited" }] });
    expect(eff[0].value).toBe("active");
  });
  it("decline active → declined", () => {
    const eff = buildPlanningEffects("decline_invitation", { participantId: "pt1" }, viewer, { participants: [{ id: "pt1", userId: "user_me", status: "active" }] });
    expect(eff[0].value).toBe("declined");
  });
  it("accept nonexistent → null", () => {
    expect(buildPlanningEffects("accept_invitation", { participantId: "ghost" }, viewer, { participants: [] })).toBeNull();
  });
});

describe("buildPlanningEffects :: unknown intent", () => {
  it("unknown → null", () => {
    expect(buildPlanningEffects("unknown", {}, viewer, {})).toBeNull();
  });
});
