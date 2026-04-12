import { describe, it, expect } from "vitest";
import { computeAlgebra, normalizeEntityFromTarget } from "./intentAlgebra.js";

describe("normalizeEntityFromTarget", () => {
  const ontology = {
    entities: {
      Specialist: { fields: ["id", "name"] },
      Service: { fields: ["id", "name", "price"] },
      TimeSlot: { fields: ["id", "date", "status"] },
      Booking: { fields: ["id", "status"] },
    }
  };

  it("простой target: 'bookings' → 'booking'", () => {
    expect(normalizeEntityFromTarget("bookings", ontology)).toBe("booking");
  });

  it("dotted target: 'booking.status' → 'booking'", () => {
    expect(normalizeEntityFromTarget("booking.status", ontology)).toBe("booking");
  });

  it("collection plural: 'specialists' → 'specialist'", () => {
    expect(normalizeEntityFromTarget("specialists", ontology)).toBe("specialist");
  });

  it("multi-segment entity: 'slot.status' → 'slot' (last segment of TimeSlot)", () => {
    expect(normalizeEntityFromTarget("slot.status", ontology)).toBe("slot");
  });

  it("drafts особый случай: 'drafts' → 'draft'", () => {
    expect(normalizeEntityFromTarget("drafts", ontology)).toBe("draft");
  });
});

describe("computeAlgebra skeleton", () => {
  const ontology = {
    entities: {
      Booking: { fields: ["id", "status"] }
    }
  };

  it("пустые INTENTS → пустой adjacency map", () => {
    expect(computeAlgebra({}, ontology)).toEqual({});
  });

  it("один intent → relations с пустыми массивами", () => {
    const intents = {
      create_booking: {
        name: "Создать",
        particles: { entities: [], conditions: [], effects: [], witnesses: [] }
      }
    };
    const result = computeAlgebra(intents, ontology);
    expect(result).toEqual({
      create_booking: {
        sequentialIn: [],
        sequentialOut: [],
        antagonists: [],
        excluding: [],
        parallel: []
      }
    });
  });

  it("несколько intent'ов → каждый получает пустой relations", () => {
    const intents = {
      a: { name: "A", particles: { effects: [], conditions: [] } },
      b: { name: "B", particles: { effects: [], conditions: [] } }
    };
    const result = computeAlgebra(intents, ontology);
    expect(Object.keys(result).sort()).toEqual(["a", "b"]);
    expect(result.a.sequentialOut).toEqual([]);
    expect(result.b.sequentialOut).toEqual([]);
  });
});

describe("deriveSequential (▷)", () => {
  const ontology = {
    entities: {
      Poll: { fields: ["id", "status", "title"] },
      TimeSlot: { fields: ["id", "status"] },
      Booking: { fields: ["id", "status"] }
    }
  };

  it("replace + matching equality condition → ▷", () => {
    const intents = {
      open_poll: {
        name: "Open",
        particles: {
          effects: [{ α: "replace", target: "poll.status", value: "open" }],
          conditions: []
        }
      },
      vote: {
        name: "Vote",
        particles: {
          effects: [],
          conditions: ["poll.status = 'open'"]
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.open_poll.sequentialOut).toContain("vote");
    expect(algebra.vote.sequentialIn).toContain("open_poll");
  });

  it("replace + non-matching value → no ▷", () => {
    const intents = {
      close_poll: {
        name: "Close",
        particles: {
          effects: [{ α: "replace", target: "poll.status", value: "closed" }],
          conditions: []
        }
      },
      vote: {
        name: "Vote",
        particles: {
          effects: [],
          conditions: ["poll.status = 'open'"]
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.close_poll.sequentialOut).not.toContain("vote");
    expect(algebra.vote.sequentialIn).not.toContain("close_poll");
  });

  it("replace + IN condition containing value → ▷", () => {
    const intents = {
      complete_booking: {
        name: "Complete",
        particles: {
          effects: [{ α: "replace", target: "booking.status", value: "completed" }],
          conditions: []
        }
      },
      leave_review: {
        name: "Review",
        particles: {
          effects: [],
          conditions: ["booking.status IN ('completed','cancelled')"]
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.complete_booking.sequentialOut).toContain("leave_review");
    expect(algebra.leave_review.sequentialIn).toContain("complete_booking");
  });

  it("replace + IN condition NOT containing value → no ▷", () => {
    const intents = {
      open_poll: {
        name: "Open",
        particles: {
          effects: [{ α: "replace", target: "poll.status", value: "open" }],
          conditions: []
        }
      },
      archive: {
        name: "Archive",
        particles: {
          effects: [],
          conditions: ["poll.status IN ('closed','resolved')"]
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.open_poll.sequentialOut).not.toContain("archive");
  });

  it("remove + '= null' condition → ▷", () => {
    const intents = {
      delete_slot: {
        name: "Delete",
        particles: {
          effects: [{ α: "remove", target: "slots" }],
          conditions: []
        }
      },
      cleanup: {
        name: "Cleanup",
        particles: {
          effects: [],
          conditions: ["slot.id = null"]
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.delete_slot.sequentialOut).toContain("cleanup");
  });

  it("add не генерирует ▷ в v1 (слабое соответствие)", () => {
    const intents = {
      create_draft: {
        name: "Create",
        particles: {
          effects: [{ α: "add", target: "bookings" }],
          conditions: []
        }
      },
      confirm: {
        name: "Confirm",
        particles: {
          effects: [],
          conditions: ["booking.id != null"]
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.create_draft.sequentialOut).not.toContain("confirm");
  });

  it("разные entity → no ▷", () => {
    const intents = {
      block_slot: {
        name: "Block",
        particles: {
          effects: [{ α: "replace", target: "slot.status", value: "blocked" }],
          conditions: []
        }
      },
      vote: {
        name: "Vote",
        particles: {
          effects: [],
          conditions: ["poll.status = 'open'"]
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.block_slot.sequentialOut).not.toContain("vote");
  });

  it("multi-effect intent генерирует несколько ▷", () => {
    const intents = {
      resolve_poll: {
        name: "Resolve",
        particles: {
          effects: [
            { α: "replace", target: "poll.status", value: "resolved" },
            { α: "replace", target: "booking.status", value: "confirmed" }
          ],
          conditions: []
        }
      },
      archive_poll: {
        name: "Archive poll",
        particles: {
          effects: [],
          conditions: ["poll.status = 'resolved'"]
        }
      },
      cancel_booking: {
        name: "Cancel booking",
        particles: {
          effects: [],
          conditions: ["booking.status = 'confirmed'"]
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.resolve_poll.sequentialOut).toContain("archive_poll");
    expect(algebra.resolve_poll.sequentialOut).toContain("cancel_booking");
  });

  it("не добавляет self-loop (I ▷ I)", () => {
    const intents = {
      open_poll: {
        name: "Open",
        particles: {
          effects: [{ α: "replace", target: "poll.status", value: "open" }],
          conditions: ["poll.status = 'open'"]
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.open_poll.sequentialOut).not.toContain("open_poll");
    expect(algebra.open_poll.sequentialIn).not.toContain("open_poll");
  });
});
