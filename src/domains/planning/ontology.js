export const ONTOLOGY = {
  entities: {
    Poll: {
      fields: ["id", "organizerId", "title", "description", "status", "createdAt", "deadline"],
      statuses: ["draft", "open", "closed", "resolved", "cancelled"],
      ownerField: "organizerId",
      type: "internal"
    },
    TimeOption: {
      fields: ["id", "pollId", "date", "startTime", "endTime"],
      type: "internal"
    },
    Participant: {
      fields: ["id", "pollId", "userId", "name", "email", "status"],
      statuses: ["invited", "active", "declined"],
      ownerField: "userId",
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
  },
  roles: {
    agent: {
      label: "Агент (API)",
      canExecute: [
        "create_poll", "add_time_option", "invite_participant",
        "suggest_alternative", "set_deadline",
        "open_poll", "close_poll", "resolve_poll", "cancel_poll",
        "vote_yes", "vote_no", "vote_maybe", "change_vote",
        "accept_invitation", "decline_invitation"
      ],
      visibleFields: {
        Poll:        ["id", "title", "description", "status", "organizerId", "createdAt", "deadline"],
        TimeOption:  ["id", "pollId", "date", "startTime", "endTime"],
        Participant: ["id", "pollId", "userId", "name", "email", "status"],
        Vote:        ["id", "pollId", "optionId", "participantId", "value", "createdAt"],
        Meeting:     ["id", "pollId", "title", "date", "startTime", "endTime", "status"]
      },
      statusMapping: {}
    }
  }
};
