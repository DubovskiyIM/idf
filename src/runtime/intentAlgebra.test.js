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

describe("deriveAntagonisticStrict (⇌)", () => {
  const ontology = {
    entities: {
      Slot: { fields: ["id", "status"] },
      Conversation: { fields: ["id", "muted"] },
      Edge: { fields: ["id", "from", "to"] }
    }
  };

  it("bistable replace-пара на одном target → ⇌ симметрично", () => {
    const intents = {
      block_slot: {
        name: "Block",
        particles: {
          effects: [{ α: "replace", target: "slot.status", value: "blocked" }],
          conditions: []
        }
      },
      unblock_slot: {
        name: "Unblock",
        particles: {
          effects: [{ α: "replace", target: "slot.status", value: "free" }],
          conditions: []
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.block_slot.antagonists).toContain("unblock_slot");
    expect(algebra.unblock_slot.antagonists).toContain("block_slot");
  });

  it("add + remove на одной коллекции → ⇌", () => {
    const intents = {
      connect: {
        name: "Connect",
        particles: {
          effects: [{ α: "add", target: "edges" }],
          conditions: []
        }
      },
      disconnect: {
        name: "Disconnect",
        particles: {
          effects: [{ α: "remove", target: "edges" }],
          conditions: []
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.connect.antagonists).toContain("disconnect");
    expect(algebra.disconnect.antagonists).toContain("connect");
  });

  it("разные targets → no ⇌", () => {
    const intents = {
      a: {
        name: "A",
        particles: {
          effects: [{ α: "replace", target: "slot.status", value: "blocked" }],
          conditions: []
        }
      },
      b: {
        name: "B",
        particles: {
          effects: [{ α: "replace", target: "conversation.muted", value: false }],
          conditions: []
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.a.antagonists).not.toContain("b");
  });

  it("одинаковые values на replace-паре → no ⇌ (не bistable)", () => {
    const intents = {
      a: {
        name: "A",
        particles: {
          effects: [{ α: "replace", target: "slot.status", value: "free" }],
          conditions: []
        }
      },
      b: {
        name: "B",
        particles: {
          effects: [{ α: "replace", target: "slot.status", value: "free" }],
          conditions: []
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.a.antagonists).not.toContain("b");
  });

  it("асимметричный lifecycle (multi-effect, разное покрытие) → no ⇌", () => {
    const intents = {
      confirm: {
        name: "Confirm",
        particles: {
          effects: [
            { α: "add", target: "bookings" },
            { α: "replace", target: "slot.status", value: "booked" }
          ],
          conditions: []
        }
      },
      cancel: {
        name: "Cancel",
        particles: {
          effects: [
            { α: "replace", target: "booking.status", value: "cancelled" },
            { α: "replace", target: "slot.status", value: "free" }
          ],
          conditions: []
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.confirm.antagonists).not.toContain("cancel");
    expect(algebra.cancel.antagonists).not.toContain("confirm");
  });

  it("симметричное покрытие bistable → ⇌", () => {
    const intents = {
      mute: {
        name: "Mute",
        particles: {
          effects: [{ α: "replace", target: "conversation.muted", value: true }],
          conditions: []
        }
      },
      unmute: {
        name: "Unmute",
        particles: {
          effects: [{ α: "replace", target: "conversation.muted", value: false }],
          conditions: []
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.mute.antagonists).toContain("unmute");
    expect(algebra.unmute.antagonists).toContain("mute");
  });

  it("multi-effect полное покрытие: все эффекты парны → ⇌", () => {
    const intents = {
      lock: {
        name: "Lock",
        particles: {
          effects: [
            { α: "replace", target: "slot.status", value: "blocked" },
            { α: "replace", target: "conversation.muted", value: true }
          ],
          conditions: []
        }
      },
      unlock: {
        name: "Unlock",
        particles: {
          effects: [
            { α: "replace", target: "slot.status", value: "free" },
            { α: "replace", target: "conversation.muted", value: false }
          ],
          conditions: []
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.lock.antagonists).toContain("unlock");
    expect(algebra.unlock.antagonists).toContain("lock");
  });

  it("не генерирует self-loop", () => {
    const intents = {
      toggle: {
        name: "Toggle",
        particles: {
          effects: [{ α: "replace", target: "conversation.muted", value: true }],
          conditions: []
        }
      }
    };
    const algebra = computeAlgebra(intents, ontology);
    expect(algebra.toggle.antagonists).not.toContain("toggle");
  });
});
