import { describe, it, expect } from "vitest";
import { computeAlgebra, computeAlgebraWithEvidence } from "./intentAlgebra.js";

import { INTENTS as BOOKING_INTENTS } from "../domains/booking/intents.js";
import { ONTOLOGY as BOOKING_ONT } from "../domains/booking/ontology.js";
import { INTENTS as PLANNING_INTENTS } from "../domains/planning/intents.js";
import { ONTOLOGY as PLANNING_ONT } from "../domains/planning/ontology.js";
import { INTENTS as WORKFLOW_INTENTS } from "../domains/workflow/intents.js";
import { ONTOLOGY as WORKFLOW_ONT } from "../domains/workflow/ontology.js";
import { INTENTS as MESSENGER_INTENTS } from "../domains/messenger/intents.js";
import { ONTOLOGY as MESSENGER_ONT } from "../domains/messenger/ontology.js";

describe("booking domain algebra", () => {
  const alg = computeAlgebra(BOOKING_INTENTS, BOOKING_ONT);
  const algE = computeAlgebraWithEvidence(BOOKING_INTENTS, BOOKING_ONT);

  it("block_slot ⇌ unblock_slot (structural)", () => {
    expect(alg.block_slot.antagonists).toContain("unblock_slot");
    expect(algE.block_slot.antagonistsEvidence.unblock_slot.classification).toBe("structural");
  });

  it("confirm_booking/cancel_booking — declared, но heuristic-lifecycle", () => {
    expect(alg.confirm_booking.antagonists).toContain("cancel_booking");
    expect(algE.confirm_booking.antagonistsEvidence.cancel_booking.classification).toBe("heuristic-lifecycle");
  });

  it("каждый intent имеет запись в algebra", () => {
    for (const id of Object.keys(BOOKING_INTENTS)) {
      expect(alg[id]).toBeDefined();
    }
  });
});

describe("planning domain algebra", () => {
  const alg = computeAlgebra(PLANNING_INTENTS, PLANNING_ONT);

  it("open_poll ▷ vote_yes (open_poll делает poll.status='open')", () => {
    expect(alg.open_poll.sequentialOut).toContain("vote_yes");
    expect(alg.vote_yes.sequentialIn).toContain("open_poll");
  });

  it("close_poll NOT ▷ vote_yes", () => {
    expect(alg.close_poll.sequentialOut).not.toContain("vote_yes");
  });

  it("vote_yes ∥ vote_no (оба add votes, не ⊕)", () => {
    expect(alg.vote_yes.parallel).toContain("vote_no");
    expect(alg.vote_no.parallel).toContain("vote_yes");
  });

  it("каждый intent имеет запись в algebra", () => {
    for (const id of Object.keys(PLANNING_INTENTS)) {
      expect(alg[id]).toBeDefined();
    }
  });
});

describe("planning domain algebra (Session C phase transitions)", () => {
  const alg = computeAlgebra(PLANNING_INTENTS, PLANNING_ONT);
  const algE = computeAlgebraWithEvidence(PLANNING_INTENTS, PLANNING_ONT);

  it("open_poll ▷ close_poll (replace poll.status triggers condition)", () => {
    expect(alg.open_poll.sequentialOut).toContain("close_poll");
  });

  it("close_poll ▷ resolve_poll", () => {
    expect(alg.close_poll.sequentialOut).toContain("resolve_poll");
  });

  it("open_poll ⇌ close_poll structural (bistable poll.status)", () => {
    expect(alg.open_poll.antagonists).toContain("close_poll");
    expect(algE.open_poll.antagonistsEvidence.close_poll.classification).toBe("structural");
  });

  it("set_deadline sequentialIn содержит open_poll (deadline только в open phase)", () => {
    expect(alg.set_deadline.sequentialIn).toContain("open_poll");
  });

  // Wave 2: creates implied status derivation
  it("create_poll ▷ open_poll через creates: Poll(draft) → condition poll.status='draft'", () => {
    expect(alg.create_poll.sequentialOut).toContain("open_poll");
    expect(alg.open_poll.sequentialIn).toContain("create_poll");
  });

  it("create_poll ▷ add_time_option (condition poll.status='draft')", () => {
    expect(alg.create_poll.sequentialOut).toContain("add_time_option");
  });

  it("create_poll ▷ invite_participant (condition poll.status='draft')", () => {
    expect(alg.create_poll.sequentialOut).toContain("invite_participant");
  });
});

describe("messenger domain algebra", () => {
  const alg = computeAlgebra(MESSENGER_INTENTS, MESSENGER_ONT);
  const algE = computeAlgebraWithEvidence(MESSENGER_INTENTS, MESSENGER_ONT);

  it("mute_conversation ⇌ unmute_conversation (structural)", () => {
    expect(alg.mute_conversation.antagonists).toContain("unmute_conversation");
    expect(algE.mute_conversation.antagonistsEvidence.unmute_conversation.classification).toBe("structural");
  });

  it("pin_message ⇌ unpin_message (structural)", () => {
    expect(alg.pin_message.antagonists).toContain("unpin_message");
  });

  it("каждый intent имеет запись в algebra", () => {
    for (const id of Object.keys(MESSENGER_INTENTS)) {
      expect(alg[id]).toBeDefined();
    }
  });
});

describe("workflow domain algebra", () => {
  const alg = computeAlgebra(WORKFLOW_INTENTS, WORKFLOW_ONT);

  it("connect_nodes ⇌ disconnect_nodes (add+remove на edges)", () => {
    expect(alg.connect_nodes.antagonists).toContain("disconnect_nodes");
  });

  it("каждый intent имеет запись в algebra", () => {
    for (const id of Object.keys(WORKFLOW_INTENTS)) {
      expect(alg[id]).toBeDefined();
    }
  });
});
