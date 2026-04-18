export const ONTOLOGY = {
  systemCollections: ["options"],
  entities: {
    Poll: {
      fields: {
        id: { type: "id" },
        organizerId: { type: "entityRef", read: ["*"], label: "Организатор" },
        title: { type: "text", read: ["*"], write: ["self"], required: true, label: "Название" },
        description: { type: "textarea", read: ["*"], write: ["self"], label: "Описание" },
        status: {
          type: "enum", read: ["*"], label: "Статус",
          values: ["draft", "open", "closed", "resolved", "cancelled"],
          valueLabels: { draft: "Черновик", open: "Голосование", closed: "Закрыт", resolved: "Назначена встреча", cancelled: "Отменён" },
        },
        deadline: { type: "datetime", read: ["*"], write: ["self"], label: "Дедлайн" },
        createdAt: { type: "datetime", read: ["*"], label: "Создан" },
      },
      statuses: ["draft", "open", "closed", "resolved", "cancelled"],
      ownerField: "organizerId",
      type: "internal",
      quorum: {
        closeWhen: "all_voted",
        absentVote: "exclude",
      },
    },
    TimeOption: {
      fields: {
        id: { type: "id" },
        pollId: { type: "entityRef", read: ["*"], label: "Опрос" },
        date: { type: "text", read: ["*"], required: true, label: "Дата" },
        startTime: { type: "text", read: ["*"], required: true, label: "Начало" },
        endTime: { type: "text", read: ["*"], label: "Конец" },
      },
      type: "internal",
    },
    Participant: {
      fields: {
        id: { type: "id" },
        pollId: { type: "entityRef", read: ["*"], label: "Опрос" },
        userId: { type: "entityRef", read: ["*"], label: "Пользователь" },
        name: { type: "text", read: ["*"], required: true, label: "Имя" },
        email: { type: "email", read: ["*"], label: "Email" },
        status: {
          type: "enum", read: ["*"], label: "Статус",
          values: ["invited", "active", "declined"],
          valueLabels: { invited: "Приглашён", active: "Участвует", declined: "Отказался" },
        },
      },
      statuses: ["invited", "active", "declined"],
      ownerField: "userId",
      type: "internal",
    },
    Vote: {
      fields: {
        id: { type: "id" },
        pollId: { type: "entityRef", read: ["*"], label: "Опрос" },
        participantId: { type: "entityRef", read: ["*"], label: "Участник" },
        participantName: { type: "text", read: ["*"], label: "Имя участника" },
        optionId: { type: "entityRef", read: ["*"], label: "Вариант" },
        value: {
          type: "enum", read: ["*"], label: "Голос",
          values: ["yes", "no", "maybe"],
          valueLabels: { yes: "Да", no: "Нет", maybe: "Может быть" },
        },
        date: { type: "text", read: ["*"], label: "Дата варианта" },
        startTime: { type: "text", read: ["*"], label: "Начало варианта" },
        createdAt: { type: "datetime", read: ["*"], label: "Время голоса" },
      },
      type: "internal",
    },
    Meeting: {
      fields: {
        id: { type: "id" },
        pollId: { type: "entityRef", read: ["*"], label: "Опрос" },
        title: { type: "text", read: ["*"], label: "Название" },
        date: { type: "text", read: ["*"], label: "Дата" },
        startTime: { type: "text", read: ["*"], label: "Начало" },
        endTime: { type: "text", read: ["*"], label: "Конец" },
        participantIds: { type: "textarea", read: ["*"], label: "Участники" },
        status: {
          type: "enum", read: ["*"], label: "Статус",
          values: ["confirmed", "cancelled"],
          valueLabels: { confirmed: "Подтверждена", cancelled: "Отменена" },
        },
      },
      statuses: ["confirmed", "cancelled"],
      type: "internal",
    },
  },
  predicates: {
    "poll_is_draft": "poll.status = 'draft'",
    "poll_is_open": "poll.status = 'open'",
    "poll_is_closed": "poll.status = 'closed'",
  },
  rules: [
    {
      id: "quorum_autoclose",
      trigger: "vote_*",
      action: "close_poll",
      context: { id: "effect.pollId" }
    }
  ],
  roles: {
    agent: {
      base: "agent",
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
