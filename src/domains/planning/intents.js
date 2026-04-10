export const INTENTS = {
  create_poll: {
    name: "Создать опрос", particles: {
      entities: ["poll: Poll"],
      conditions: [],
      effects: [{ α: "add", target: "polls", σ: "account" }],
      witnesses: [],
      confirmation: "click"
    }, antagonist: null, creates: "Poll(draft)"
  },
  add_time_option: {
    name: "Добавить вариант", particles: {
      entities: ["poll: Poll", "option: TimeOption"],
      conditions: ["poll.status = 'draft'"],
      effects: [{ α: "add", target: "options", σ: "account" }],
      witnesses: ["poll.title", "options.count"],
      confirmation: "click"
    }, antagonist: null, creates: "TimeOption"
  },
  invite_participant: {
    name: "Пригласить участника", particles: {
      entities: ["poll: Poll", "participant: Participant"],
      conditions: ["poll.status = 'draft'"],
      effects: [{ α: "add", target: "participants", σ: "account" }],
      witnesses: ["poll.title", "participants.count"],
      confirmation: "click"
    }, antagonist: null, creates: "Participant"
  },
  open_poll: {
    name: "Открыть голосование", particles: {
      entities: ["poll: Poll"],
      conditions: ["poll.status = 'draft'"],
      effects: [{ α: "replace", target: "poll.status", value: "open", σ: "account" }],
      witnesses: ["options.count", "participants.count"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  vote_yes: {
    name: "Доступен", particles: {
      entities: ["option: TimeOption", "participant: Participant"],
      conditions: ["poll.status = 'open'"],
      effects: [{ α: "add", target: "votes", σ: "account" }],
      witnesses: ["option.date", "option.startTime"],
      confirmation: "click"
    }, antagonist: null, creates: "Vote(yes)"
  },
  vote_no: {
    name: "Недоступен", particles: {
      entities: ["option: TimeOption", "participant: Participant"],
      conditions: ["poll.status = 'open'"],
      effects: [{ α: "add", target: "votes", σ: "account" }],
      witnesses: ["option.date", "option.startTime"],
      confirmation: "click"
    }, antagonist: null, creates: "Vote(no)"
  },
  close_poll: {
    name: "Закрыть голосование", particles: {
      entities: ["poll: Poll"],
      conditions: ["poll.status = 'open'"],
      effects: [{ α: "replace", target: "poll.status", value: "closed", σ: "account" }],
      witnesses: ["votes.count", "participation_rate"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  resolve_poll: {
    name: "Выбрать время", particles: {
      entities: ["poll: Poll", "option: TimeOption"],
      conditions: ["poll.status = 'closed'"],
      effects: [
        { α: "replace", target: "poll.status", value: "resolved", σ: "account" },
        { α: "add", target: "meetings", σ: "account" }
      ],
      witnesses: ["winning_option.date", "votes_yes.count", "votes_no.count"],
      confirmation: "click"
    }, antagonist: null, creates: "Meeting"
  }
};
