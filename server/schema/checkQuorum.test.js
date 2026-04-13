import { describe, it, expect } from "vitest";
import { checkQuorum } from "./checkQuorum.cjs";

const openPoll = { id: "p1", status: "open" };
const twoParticipants = [{ id: "a", pollId: "p1" }, { id: "b", pollId: "p1" }];
const threeParticipants = [...twoParticipants, { id: "c", pollId: "p1" }];

describe("checkQuorum", () => {
  // === all_voted (default) ===
  it("all_voted: кворум достигнут", () => {
    const world = { polls: [openPoll], participants: twoParticipants,
      votes: [{ participantId: "a", pollId: "p1" }, { participantId: "b", pollId: "p1" }] };
    const r = checkQuorum("p1", world);
    expect(r.reached).toBe(true);
    expect(r.policy).toBe("all_voted");
  });

  it("all_voted: один не проголосовал", () => {
    const world = { polls: [openPoll], participants: threeParticipants,
      votes: [{ participantId: "a", pollId: "p1" }, { participantId: "b", pollId: "p1" }] };
    expect(checkQuorum("p1", world).reached).toBe(false);
  });

  it("множественные голоса одного участника — один раз", () => {
    const world = { polls: [openPoll], participants: [{ id: "a", pollId: "p1" }],
      votes: [{ participantId: "a", pollId: "p1" }, { participantId: "a", pollId: "p1" }] };
    expect(checkQuorum("p1", world).reached).toBe(true);
  });

  it("closed poll → false", () => {
    expect(checkQuorum("p1", { polls: [{ id: "p1", status: "closed" }] }).reached).toBe(false);
  });

  it("нет участников → false", () => {
    expect(checkQuorum("p1", { polls: [openPoll], participants: [], votes: [] }).reached).toBe(false);
  });

  it("голоса чужого poll'а не учитываются", () => {
    const world = { polls: [openPoll], participants: [{ id: "a", pollId: "p1" }],
      votes: [{ participantId: "a", pollId: "p2" }] };
    expect(checkQuorum("p1", world).reached).toBe(false);
  });

  // === quorum(N) ===
  it("quorum(0.5): 2 из 3 = 66% ≥ 50%", () => {
    const ontology = { entities: { Poll: { quorum: { closeWhen: "quorum(0.5)" } } } };
    const world = { polls: [openPoll], participants: threeParticipants,
      votes: [{ participantId: "a", pollId: "p1" }, { participantId: "b", pollId: "p1" }] };
    const r = checkQuorum("p1", world, ontology);
    expect(r.reached).toBe(true);
    expect(r.policy).toBe("quorum(0.5)");
  });

  it("quorum(0.8): 2 из 3 = 66% < 80%", () => {
    const ontology = { entities: { Poll: { quorum: { closeWhen: "quorum(0.8)" } } } };
    const world = { polls: [openPoll], participants: threeParticipants,
      votes: [{ participantId: "a", pollId: "p1" }, { participantId: "b", pollId: "p1" }] };
    expect(checkQuorum("p1", world, ontology).reached).toBe(false);
  });

  // === manual ===
  it("manual: никогда не достигается автоматически", () => {
    const ontology = { entities: { Poll: { quorum: { closeWhen: "manual" } } } };
    const world = { polls: [openPoll], participants: twoParticipants,
      votes: [{ participantId: "a", pollId: "p1" }, { participantId: "b", pollId: "p1" }] };
    const r = checkQuorum("p1", world, ontology);
    expect(r.reached).toBe(false);
    expect(r.policy).toBe("manual");
  });
});
