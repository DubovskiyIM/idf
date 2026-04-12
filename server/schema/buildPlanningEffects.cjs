/**
 * Серверный effect builder для planning-домена (Session C).
 *
 * Зеркалит client-side src/domains/planning/domain.js::buildEffects, но
 * только для 15 intent'ов в roles.agent.canExecute. Принимает
 * (intentId, params, viewer, world), возвращает массив effect-объектов
 * или null если сборка невозможна.
 */

const { v4: uuid } = require("uuid");

function ts() {
  return new Date().toLocaleTimeString("ru", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function makeEffect(intentId, props) {
  return {
    id: uuid(),
    intent_id: intentId,
    parent_id: null,
    status: "proposed",
    ttl: null,
    created_at: Date.now(),
    time: ts(),
    ...props
  };
}

function rand() {
  return Math.random().toString(36).slice(2, 6);
}

function buildPlanningEffects(intentId, params, viewer, world) {
  const now = Date.now();

  switch (intentId) {
    case "create_poll": {
      if (!params.title?.trim()) return null;
      return [makeEffect(intentId, {
        alpha: "add", target: "polls", scope: "account", value: null,
        context: {
          id: `poll_${now}_${rand()}`,
          organizerId: viewer.id,
          title: params.title.trim(),
          description: params.description || "",
          status: "draft",
          createdAt: now
        },
        desc: `📊 Опрос создан: ${params.title.trim()}`
      })];
    }

    case "add_time_option": {
      const poll = (world.polls || []).find(p => p.id === params.pollId);
      if (!poll || poll.status !== "draft") return null;
      if (!params.date || !params.startTime || !params.endTime) return null;
      return [makeEffect(intentId, {
        alpha: "add", target: "options", scope: "account", value: null,
        context: {
          id: `opt_${now}_${rand()}`,
          pollId: params.pollId,
          date: params.date,
          startTime: params.startTime,
          endTime: params.endTime
        },
        desc: `+ Вариант: ${params.date} ${params.startTime}–${params.endTime}`
      })];
    }

    case "invite_participant": {
      const poll = (world.polls || []).find(p => p.id === params.pollId);
      if (!poll || poll.status !== "draft") return null;
      if (!params.name?.trim()) return null;

      let userId = params.userId || null;
      if (!userId && params.email) {
        const user = (world.users || []).find(u => u.email === params.email);
        userId = user?.id || null;
      }

      return [makeEffect(intentId, {
        alpha: "add", target: "participants", scope: "account", value: null,
        context: {
          id: `part_${now}_${rand()}`,
          pollId: params.pollId,
          userId,
          name: params.name.trim(),
          email: params.email || "",
          status: "active"
        },
        desc: `👤 Приглашён: ${params.name.trim()}`
      })];
    }

    case "open_poll": {
      const poll = (world.polls || []).find(p => p.id === params.pollId);
      if (!poll || poll.status !== "draft") return null;
      const options = (world.options || []).filter(o => o.pollId === params.pollId);
      const parts = (world.participants || []).filter(p => p.pollId === params.pollId);
      if (options.length === 0 || parts.length === 0) return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "poll.status", scope: "account", value: "open",
        context: { id: poll.id },
        desc: `▶ Голосование открыто`
      })];
    }

    case "vote_yes":
    case "vote_no":
    case "vote_maybe": {
      const option = (world.options || []).find(o => o.id === params.optionId);
      if (!option) return null;
      const poll = (world.polls || []).find(p => p.id === option.pollId);
      if (!poll || poll.status !== "open") return null;
      const participant = (world.participants || []).find(p => p.id === params.participantId);
      if (!participant) return null;
      // Inline voter ownership: participant должен принадлежать viewer
      if (participant.userId !== viewer.id) return null;
      // Uniqueness: один голос на (participantId, optionId)
      const existing = (world.votes || []).find(v =>
        v.participantId === params.participantId && v.optionId === params.optionId
      );
      if (existing) return null;

      const value = intentId === "vote_yes" ? "yes"
                  : intentId === "vote_no" ? "no" : "maybe";
      return [makeEffect(intentId, {
        alpha: "add", target: "votes", scope: "account", value: null,
        context: {
          id: `vote_${now}_${rand()}`,
          participantId: participant.id,
          participantName: participant.name,
          optionId: option.id,
          pollId: poll.id,
          value,
          date: option.date,
          startTime: option.startTime
        },
        desc: `${value === "yes" ? "✓" : value === "no" ? "✕" : "?"} ${participant.name}: ${value}`
      })];
    }

    case "close_poll": {
      const poll = (world.polls || []).find(p => p.id === params.pollId);
      if (!poll || poll.status !== "open") return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "poll.status", scope: "account", value: "closed",
        context: { id: poll.id },
        desc: `⏹ Голосование закрыто`
      })];
    }

    case "resolve_poll": {
      const poll = (world.polls || []).find(p => p.id === params.pollId);
      if (!poll || poll.status !== "closed") return null;
      const option = (world.options || []).find(o => o.id === params.optionId);
      if (!option) return null;
      const participants = (world.participants || []).filter(p => p.pollId === poll.id);

      return [
        makeEffect(intentId, {
          alpha: "replace", target: "poll.status", scope: "account", value: "resolved",
          context: { id: poll.id },
          desc: `📊 Опрос разрешён`
        }),
        makeEffect(intentId, {
          alpha: "add", target: "meetings", scope: "account", value: null,
          context: {
            id: `mtg_${now}_${rand()}`,
            pollId: poll.id,
            title: poll.title,
            date: option.date,
            startTime: option.startTime,
            endTime: option.endTime,
            participantIds: participants.map(p => p.id),
            status: "confirmed",
            createdAt: now
          },
          desc: `✓ Встреча: ${option.date} ${option.startTime}`
        })
      ];
    }

    case "cancel_poll": {
      const poll = (world.polls || []).find(p => p.id === params.pollId);
      if (!poll) return null;
      if (poll.status === "resolved" || poll.status === "cancelled") return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "poll.status", scope: "account", value: "cancelled",
        context: { id: poll.id },
        desc: `✕ Опрос отменён`
      })];
    }

    case "set_deadline": {
      const poll = (world.polls || []).find(p => p.id === params.pollId);
      if (!poll || poll.status !== "open") return null;
      if (!params.deadline) return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "poll.deadline", scope: "account", value: params.deadline,
        context: { id: poll.id, deadline: params.deadline },
        desc: `⏰ Дедлайн: ${params.deadline}`
      })];
    }

    case "suggest_alternative": {
      const poll = (world.polls || []).find(p => p.id === params.pollId);
      if (!poll || poll.status !== "open") return null;
      if (!params.date || !params.startTime || !params.endTime) return null;
      return [makeEffect(intentId, {
        alpha: "add", target: "options", scope: "account", value: null,
        context: {
          id: `opt_${now}_${rand()}`,
          pollId: params.pollId,
          date: params.date,
          startTime: params.startTime,
          endTime: params.endTime,
          suggestedBy: viewer.id
        },
        desc: `💡 Предложение: ${params.date} ${params.startTime}–${params.endTime}`
      })];
    }

    case "change_vote": {
      const vote = (world.votes || []).find(v => v.id === params.voteId);
      if (!vote) return null;
      const poll = (world.polls || []).find(p => p.id === vote.pollId);
      if (!poll || poll.status !== "open") return null;
      if (!params.newValue) return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "vote.value", scope: "account", value: params.newValue,
        context: { id: vote.id, oldValue: vote.value, newValue: params.newValue },
        desc: `↔ ${vote.participantName || "?"}: ${vote.value} → ${params.newValue}`
      })];
    }

    case "accept_invitation": {
      const participant = (world.participants || []).find(p => p.id === params.participantId);
      if (!participant) return null;
      if (participant.status !== "invited") return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "participant.status", scope: "account", value: "active",
        context: { id: participant.id, name: participant.name },
        desc: `👤 ${participant.name} принял`
      })];
    }

    case "decline_invitation": {
      const participant = (world.participants || []).find(p => p.id === params.participantId);
      if (!participant) return null;
      if (participant.status === "declined") return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "participant.status", scope: "account", value: "declined",
        context: { id: participant.id, name: participant.name },
        desc: `👤 ${participant.name} отклонил`
      })];
    }

    default:
      return null;
  }
}

module.exports = { buildPlanningEffects };
