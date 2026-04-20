export const INTENTS = {
  create_poll: {
    name: "Создать опрос",
    parameters: [
      { name: "title", type: "text", required: true, placeholder: "Название опроса" },
      { name: "description", type: "textarea", required: false, placeholder: "Описание" },
    ],
    particles: {
      entities: ["poll: Poll"],
      conditions: [],
      effects: [{ α: "add", target: "polls", σ: "account" }],
      witnesses: ["poll.title"],
      confirmation: "form"
    }, antagonist: null, creates: "Poll(draft)"
  },
  add_time_option: {
    name: "Добавить вариант",
    parameters: [
      { name: "date", type: "text", required: true, placeholder: "Дата" },
      { name: "startTime", type: "text", required: true, placeholder: "Начало" },
      { name: "endTime", type: "text", required: false, placeholder: "Конец" },
    ],
    particles: {
      entities: ["poll: Poll", "option: TimeOption"],
      conditions: ["poll.status = 'draft'"],
      effects: [{ α: "add", target: "options", σ: "account" }],
      witnesses: ["poll.title"],
      confirmation: "form"
    }, antagonist: null, creates: "TimeOption"
  },
  invite_participant: {
    name: "Пригласить участника",
    parameters: [
      { name: "name", type: "text", required: true, placeholder: "Имя" },
      { name: "email", type: "email", required: false, placeholder: "Email" },
    ],
    particles: {
      entities: ["poll: Poll", "participant: Participant"],
      conditions: ["poll.status = 'draft'"],
      effects: [{ α: "add", target: "participants", σ: "account" }],
      witnesses: ["poll.title"],
      confirmation: "form"
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
    name: "Доступен",
    parameters: [
      { name: "optionId", type: "entityRef", entity: "TimeOption", required: true },
      { name: "participantId", type: "entityRef", entity: "Participant", required: true }
    ],
    particles: {
      entities: ["option: TimeOption", "participant: Participant"],
      conditions: ["poll.status = 'open'", "participant.userId = me.id"],
      effects: [{ α: "add", target: "votes", σ: "account" }],
      witnesses: ["option.date", "option.startTime"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  vote_no: {
    name: "Недоступен",
    parameters: [
      { name: "optionId", type: "entityRef", entity: "TimeOption", required: true },
      { name: "participantId", type: "entityRef", entity: "Participant", required: true }
    ],
    particles: {
      entities: ["option: TimeOption", "participant: Participant"],
      conditions: ["poll.status = 'open'", "participant.userId = me.id"],
      effects: [{ α: "add", target: "votes", σ: "account" }],
      witnesses: ["option.date", "option.startTime"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  close_poll: {
    salience: "primary",
    name: "Закрыть голосование",
    parameters: [
      { name: "pollId", type: "entityRef", entity: "Poll", required: true }
    ],
    particles: {
      entities: ["poll: Poll"],
      conditions: ["poll.status = 'open'", "ratio(votes.participantId, participants, pollId=target.id) >= 1.0"],
      effects: [{ α: "replace", target: "poll.status", value: "closed", σ: "account" }],
      witnesses: ["poll.title"],
      confirmation: "click"
    }, antagonist: null, creates: null, irreversibility: "medium"
  },
  resolve_poll: {
    name: "Выбрать время",
    parameters: [
      { name: "pollId", type: "entityRef", entity: "Poll", required: true },
      { name: "optionId", type: "entityRef", entity: "TimeOption", required: true }
    ],
    particles: {
      entities: ["poll: Poll", "option: TimeOption"],
      conditions: ["poll.status = 'closed'"],
      effects: [
        { α: "replace", target: "poll.status", value: "resolved", σ: "account" },
        { α: "add", target: "meetings", σ: "account" }
      ],
      witnesses: ["option.date", "option.startTime"],
      confirmation: "form"
    }, antagonist: "cancel_meeting", creates: "Meeting"
  },
  cancel_poll: {
    name: "Отменить опрос", particles: {
      entities: ["poll: Poll"],
      conditions: ["poll.status IN ('draft','open','closed')"],
      effects: [{ α: "replace", target: "poll.status", value: "cancelled", σ: "account" }],
      witnesses: ["poll.title", "participants.count"],
      confirmation: "click"
    }, antagonist: null, creates: null, irreversibility: "high"
  },
  cancel_meeting: {
    name: "Отменить встречу", particles: {
      entities: ["meeting: Meeting"],
      conditions: ["meeting.status = 'confirmed'"],
      effects: [{ α: "replace", target: "meeting.status", value: "cancelled", σ: "account" }],
      witnesses: ["meeting.title", "meeting.date"],
      confirmation: "click"
    }, antagonist: "resolve_poll", creates: null, irreversibility: "high"
  },
  decline_invitation: {
    name: "Отклонить приглашение", particles: {
      entities: ["participant: Participant"],
      conditions: ["participant.status = 'active'", "participant.userId = me.id"],
      effects: [{ α: "replace", target: "participant.status", value: "declined", σ: "account" }],
      witnesses: ["poll.title"],
      confirmation: "click"
    }, antagonist: "accept_invitation", creates: null
  },
  vote_maybe: {
    name: "Возможно",
    parameters: [
      { name: "optionId", type: "entityRef", entity: "TimeOption", required: true },
      { name: "participantId", type: "entityRef", entity: "Participant", required: true }
    ],
    particles: {
      entities: ["option: TimeOption", "participant: Participant"],
      conditions: ["poll.status = 'open'", "participant.userId = me.id"],
      effects: [{ α: "add", target: "votes", σ: "account" }],
      witnesses: ["option.date", "option.startTime"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  suggest_alternative: {
    name: "Предложить время",
    parameters: [
      { name: "pollId", type: "entityRef", entity: "Poll", required: true },
      { name: "date", type: "datetime", required: true },
      { name: "startTime", type: "datetime", required: true },
      { name: "endTime", type: "datetime", required: true }
    ],
    particles: {
      entities: ["poll: Poll", "option: TimeOption"],
      conditions: ["poll.status = 'open'"],
      effects: [{ α: "add", target: "options", σ: "account" }],
      witnesses: ["poll.title"],
      confirmation: "form"
    }, antagonist: null, creates: "TimeOption"
  },
  set_deadline: {
    name: "Установить дедлайн",
    parameters: [
      { name: "pollId", type: "entityRef", entity: "Poll", required: true },
      { name: "deadline", type: "datetime", required: true }
    ],
    particles: {
      entities: ["poll: Poll"],
      conditions: ["poll.status = 'open'"],
      effects: [{ α: "replace", target: "poll.deadline", σ: "account" }],
      witnesses: ["poll.current_deadline", "votes.count"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  accept_invitation: {
    name: "Принять приглашение", particles: {
      entities: ["participant: Participant"],
      conditions: ["participant.status = 'invited'"],
      effects: [{ α: "replace", target: "participant.status", value: "active", σ: "account" }],
      witnesses: ["poll.title", "poll.organizer"],
      confirmation: "click"
    }, antagonist: "decline_invitation", creates: null
  },
  change_vote: {
    name: "Изменить голос",
    parameters: [
      { name: "voteId", type: "entityRef", entity: "Vote", required: true },
      { name: "newValue", type: "text", required: true }
    ],
    particles: {
      entities: ["vote: Vote"],
      conditions: ["poll.status = 'open'"],
      effects: [{ α: "replace", target: "vote.value", σ: "account" }],
      witnesses: ["option.date", "vote.value (текущий)"],
      confirmation: "click"
    }, antagonist: null, creates: null
  },
  send_reminder: {
    name: "Напомнить", particles: {
      entities: ["poll: Poll"],
      conditions: ["poll.status = 'open'"],
      effects: [],
      witnesses: ["participants_without_votes"],
      confirmation: "click"
    }, antagonist: null, creates: null
  }
};
