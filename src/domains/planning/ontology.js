export const ONTOLOGY = {
  entities: {
    Poll: {
      fields: ["id", "organizerId", "title", "description", "status", "createdAt"],
      statuses: ["draft", "open", "closed", "resolved", "cancelled"],
      type: "internal"
    },
    TimeOption: {
      fields: ["id", "pollId", "date", "startTime", "endTime"],
      type: "internal"
    },
    Participant: {
      fields: ["id", "pollId", "name", "email", "status"],
      statuses: ["invited", "active", "declined"],
      type: "internal"
    },
    Vote: {
      fields: ["id", "participantId", "optionId", "pollId", "value"],
      type: "internal"
    },
    Meeting: {
      fields: ["id", "pollId", "title", "date", "startTime", "endTime", "participantIds", "status"],
      statuses: ["confirmed", "cancelled"],
      type: "internal"
    }
  },
  predicates: {
    "poll_is_draft": "poll.status = 'draft'",
    "poll_is_open": "poll.status = 'open'",
    "poll_is_closed": "poll.status = 'closed'",
  }
};
