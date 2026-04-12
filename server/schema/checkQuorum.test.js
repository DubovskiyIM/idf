import { describe, it, expect } from "vitest";
import { checkQuorum } from "./checkQuorum.cjs";

describe("checkQuorum", () => {
  it("кворум достигнут — все проголосовали", () => {
    const world = {
      polls: [{ id: "p1", status: "open" }],
      participants: [
        { id: "part1", pollId: "p1" },
        { id: "part2", pollId: "p1" },
      ],
      votes: [
        { participantId: "part1", pollId: "p1", optionId: "o1", value: "yes" },
        { participantId: "part2", pollId: "p1", optionId: "o1", value: "no" },
      ],
    };
    const result = checkQuorum("p1", world);
    expect(result.reached).toBe(true);
    expect(result.voted).toBe(2);
    expect(result.total).toBe(2);
  });

  it("кворум не достигнут — один не проголосовал", () => {
    const world = {
      polls: [{ id: "p1", status: "open" }],
      participants: [
        { id: "part1", pollId: "p1" },
        { id: "part2", pollId: "p1" },
        { id: "part3", pollId: "p1" },
      ],
      votes: [
        { participantId: "part1", pollId: "p1", optionId: "o1", value: "yes" },
        { participantId: "part2", pollId: "p1", optionId: "o2", value: "no" },
      ],
    };
    const result = checkQuorum("p1", world);
    expect(result.reached).toBe(false);
    expect(result.voted).toBe(2);
    expect(result.total).toBe(3);
  });

  it("множественные голоса одного участника считаются один раз", () => {
    const world = {
      polls: [{ id: "p1", status: "open" }],
      participants: [{ id: "part1", pollId: "p1" }],
      votes: [
        { participantId: "part1", pollId: "p1", optionId: "o1", value: "yes" },
        { participantId: "part1", pollId: "p1", optionId: "o2", value: "no" },
      ],
    };
    const result = checkQuorum("p1", world);
    expect(result.reached).toBe(true);
    expect(result.voted).toBe(1);
    expect(result.total).toBe(1);
  });

  it("poll не open — кворум не считается", () => {
    const world = {
      polls: [{ id: "p1", status: "closed" }],
      participants: [{ id: "part1", pollId: "p1" }],
      votes: [{ participantId: "part1", pollId: "p1", optionId: "o1", value: "yes" }],
    };
    expect(checkQuorum("p1", world).reached).toBe(false);
  });

  it("poll не найден — кворум не считается", () => {
    expect(checkQuorum("nonexistent", { polls: [] }).reached).toBe(false);
  });

  it("нет участников — кворум не достигнут", () => {
    const world = {
      polls: [{ id: "p1", status: "open" }],
      participants: [],
      votes: [],
    };
    expect(checkQuorum("p1", world).reached).toBe(false);
    expect(checkQuorum("p1", world).total).toBe(0);
  });

  it("голоса от чужого poll'а не учитываются", () => {
    const world = {
      polls: [{ id: "p1", status: "open" }],
      participants: [{ id: "part1", pollId: "p1" }],
      votes: [
        { participantId: "part1", pollId: "p2", optionId: "o1", value: "yes" },
      ],
    };
    expect(checkQuorum("p1", world).reached).toBe(false);
    expect(checkQuorum("p1", world).voted).toBe(0);
  });
});
