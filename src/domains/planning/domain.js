/**
 * Домен: Совместное планирование встреч
 */
import { v4 as uuid } from "uuid";

export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";

export const DOMAIN_ID = "planning";
export const DOMAIN_NAME = "Планирование";

const ts = () => new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 2 });

export function describeEffect(intentId, alpha, ctx, target) {
  switch (intentId) {
    case "create_poll": return `📊 Опрос создан: ${ctx.title || ctx.id}`;
    case "add_time_option": return `+ Вариант: ${ctx.date} ${ctx.startTime}–${ctx.endTime}`;
    case "invite_participant": return `👤 Приглашён: ${ctx.name}`;
    case "open_poll": return `▶ Голосование открыто`;
    case "vote_yes": return `✓ ${ctx.participantName || "?"}: доступен ${ctx.date} ${ctx.startTime}`;
    case "vote_no": return `✕ ${ctx.participantName || "?"}: недоступен ${ctx.date} ${ctx.startTime}`;
    case "close_poll": return `⏹ Голосование закрыто`;
    case "resolve_poll": return `✓ Встреча назначена: ${ctx.date} ${ctx.startTime}`;
    case "cancel_poll": return `✕ Опрос отменён: ${ctx.title || ctx.id}`;
    case "cancel_meeting": return `✕ Встреча отменена: ${ctx.title || ctx.id}`;
    case "accept_invitation": return `👤 ${ctx.name || "?"} принял`;
    case "decline_invitation": return `👤 ${ctx.name || "?"} отклонил`;
    case "change_vote": return `↔ ${ctx.participantName || "?"}: ${ctx.oldValue} → ${ctx.newValue}`;
    case "send_reminder": return `🔔 Напоминание отправлено`;
    case "vote_maybe": return `? ${ctx.participantName || "?"}: возможно ${ctx.date} ${ctx.startTime}`;
    case "suggest_alternative": return `💡 Предложение: ${ctx.date} ${ctx.startTime}–${ctx.endTime}`;
    case "set_deadline": return `⏰ Дедлайн: ${ctx.deadline || ctx.value}`;
    case "_seed": return `seed: ${alpha} ${ctx.id || ""}`;
    default: return `${alpha} ${intentId}`;
  }
}

export function signalForIntent(intentId) {
  switch (intentId) {
    case "open_poll": return { κ: "notification", desc: "Голосование открыто" };
    case "resolve_poll": return { κ: "notification", desc: "Встреча назначена" };
    case "cancel_poll": return { κ: "notification", desc: "Опрос отменён" };
    case "cancel_meeting": return { κ: "notification", desc: "Встреча отменена" };
    case "decline_invitation": return { κ: "notification", desc: "Приглашение отклонено" };
    default: return null;
  }
}

export function buildEffects(intentId, ctx, world, drafts) {
  const now = Date.now();
  const effects = [];
  const ef = (props) => effects.push({ id: uuid(), intent_id: intentId, parent_id: null, status: "proposed", ttl: null, created_at: now, time: ts(), ...props });

  switch (intentId) {
    case "create_poll": {
      if (!ctx.title?.trim()) return null;
      ef({ alpha: "add", target: "polls", scope: "account", value: null,
        context: { id: `poll_${now}`, title: ctx.title.trim(), status: "draft", createdAt: now },
        desc: describeEffect(intentId, "add", { title: ctx.title }) });
      break;
    }
    case "add_time_option": {
      const poll = (world.polls || []).find(p => p.id === ctx.pollId);
      if (!poll || poll.status !== "draft") return null;
      if (!ctx.date || !ctx.startTime || !ctx.endTime) return null;
      ef({ alpha: "add", target: "options", scope: "account", value: null,
        context: { id: `opt_${now}_${Math.random().toString(36).slice(2, 6)}`, pollId: ctx.pollId, date: ctx.date, startTime: ctx.startTime, endTime: ctx.endTime },
        desc: describeEffect(intentId, "add", { date: ctx.date, startTime: ctx.startTime, endTime: ctx.endTime }) });
      break;
    }
    case "invite_participant": {
      const poll = (world.polls || []).find(p => p.id === ctx.pollId);
      if (!poll || poll.status !== "draft") return null;
      if (!ctx.name?.trim()) return null;
      ef({ alpha: "add", target: "participants", scope: "account", value: null,
        context: { id: `part_${now}_${Math.random().toString(36).slice(2, 6)}`, pollId: ctx.pollId, name: ctx.name.trim(), email: ctx.email || "", status: "active" },
        desc: describeEffect(intentId, "add", { name: ctx.name }) });
      break;
    }
    case "open_poll": {
      const poll = (world.polls || []).find(p => p.id === ctx.pollId);
      if (!poll || poll.status !== "draft") return null;
      const options = (world.options || []).filter(o => o.pollId === ctx.pollId);
      const participants = (world.participants || []).filter(p => p.pollId === ctx.pollId);
      if (options.length === 0 || participants.length === 0) return null;
      ef({ alpha: "replace", target: "poll.status", scope: "account", value: "open",
        context: { id: poll.id },
        desc: describeEffect(intentId, "replace", {}) });
      break;
    }
    case "vote_yes":
    case "vote_no": {
      const option = (world.options || []).find(o => o.id === ctx.optionId);
      if (!option) return null;
      const poll = (world.polls || []).find(p => p.id === option.pollId);
      if (!poll || poll.status !== "open") return null;
      const participant = (world.participants || []).find(p => p.id === ctx.participantId);
      if (!participant) return null;
      // Проверить что этот участник ещё не голосовал за этот вариант
      const existing = (world.votes || []).find(v => v.participantId === ctx.participantId && v.optionId === ctx.optionId);
      if (existing) return null; // уже голосовал
      const value = intentId === "vote_yes" ? "yes" : "no";
      ef({ alpha: "add", target: "votes", scope: "account", value: null,
        context: { id: `vote_${now}_${Math.random().toString(36).slice(2, 6)}`, participantId: participant.id, participantName: participant.name, optionId: option.id, pollId: poll.id, value, date: option.date, startTime: option.startTime },
        desc: describeEffect(intentId, "add", { participantName: participant.name, date: option.date, startTime: option.startTime }) });
      break;
    }
    case "close_poll": {
      const poll = (world.polls || []).find(p => p.id === ctx.pollId);
      if (!poll || poll.status !== "open") return null;
      ef({ alpha: "replace", target: "poll.status", scope: "account", value: "closed",
        context: { id: poll.id },
        desc: describeEffect(intentId, "replace", {}) });
      break;
    }
    case "resolve_poll": {
      const poll = (world.polls || []).find(p => p.id === ctx.pollId);
      if (!poll || poll.status !== "closed") return null;
      const option = (world.options || []).find(o => o.id === ctx.optionId);
      if (!option) return null;
      const participants = (world.participants || []).filter(p => p.pollId === poll.id);
      // Перевести poll в resolved
      ef({ alpha: "replace", target: "poll.status", scope: "account", value: "resolved",
        context: { id: poll.id },
        desc: `📊 Опрос разрешён` });
      // Создать встречу
      ef({ alpha: "add", target: "meetings", scope: "account", value: null,
        context: { id: `mtg_${now}`, pollId: poll.id, title: poll.title, date: option.date, startTime: option.startTime, endTime: option.endTime, participantIds: participants.map(p => p.id), status: "confirmed", createdAt: now },
        desc: describeEffect(intentId, "add", { date: option.date, startTime: option.startTime }) });
      break;
    }
    case "cancel_poll": {
      const poll = (world.polls || []).find(p => p.id === ctx.pollId);
      if (!poll || poll.status === "resolved" || poll.status === "cancelled") return null;
      ef({ alpha: "replace", target: "poll.status", scope: "account", value: "cancelled",
        context: { id: poll.id },
        desc: `✕ Опрос отменён: ${poll.title}` });
      break;
    }
    case "cancel_meeting": {
      const meeting = (world.meetings || []).find(m => m.id === ctx.id);
      if (!meeting || meeting.status !== "confirmed") return null;
      ef({ alpha: "replace", target: "meeting.status", scope: "account", value: "cancelled",
        context: { id: meeting.id },
        desc: `✕ Встреча отменена: ${meeting.title}` });
      break;
    }
    case "decline_invitation": {
      const participant = (world.participants || []).find(p => p.id === ctx.participantId);
      if (!participant || participant.status === "declined") return null;
      ef({ alpha: "replace", target: "participant.status", scope: "account", value: "declined",
        context: { id: participant.id, name: participant.name },
        desc: `👤 ${participant.name} отклонил приглашение` });
      break;
    }
    case "vote_maybe": {
      const option = (world.options || []).find(o => o.id === ctx.optionId);
      if (!option) return null;
      const poll = (world.polls || []).find(p => p.id === option.pollId);
      if (!poll || poll.status !== "open") return null;
      const participant = (world.participants || []).find(p => p.id === ctx.participantId);
      if (!participant) return null;
      const existing = (world.votes || []).find(v => v.participantId === ctx.participantId && v.optionId === ctx.optionId);
      if (existing) return null;
      ef({ alpha: "add", target: "votes", scope: "account", value: null,
        context: { id: `vote_${now}_${Math.random().toString(36).slice(2, 6)}`, participantId: participant.id, participantName: participant.name, optionId: option.id, pollId: poll.id, value: "maybe", date: option.date, startTime: option.startTime },
        desc: `? ${participant.name}: возможно ${option.date} ${option.startTime}` });
      break;
    }
    case "suggest_alternative": {
      const poll = (world.polls || []).find(p => p.id === ctx.pollId);
      if (!poll || poll.status !== "open") return null;
      if (!ctx.date || !ctx.startTime || !ctx.endTime) return null;
      ef({ alpha: "add", target: "options", scope: "account", value: null,
        context: { id: `opt_${now}_${Math.random().toString(36).slice(2, 6)}`, pollId: ctx.pollId, date: ctx.date, startTime: ctx.startTime, endTime: ctx.endTime, suggestedBy: ctx.participantId || null },
        desc: `💡 Предложен вариант: ${ctx.date} ${ctx.startTime}–${ctx.endTime}` });
      break;
    }
    case "set_deadline": {
      const poll = (world.polls || []).find(p => p.id === ctx.pollId);
      if (!poll || poll.status !== "open") return null;
      if (!ctx.deadline) return null;
      ef({ alpha: "replace", target: "poll.deadline", scope: "account", value: ctx.deadline,
        context: { id: poll.id, deadline: ctx.deadline },
        desc: `⏰ Дедлайн: ${ctx.deadline}` });
      break;
    }
    case "accept_invitation": {
      const participant = (world.participants || []).find(p => p.id === ctx.participantId);
      if (!participant || participant.status !== "invited") return null;
      ef({ alpha: "replace", target: "participant.status", scope: "account", value: "active",
        context: { id: participant.id, name: participant.name },
        desc: `👤 ${participant.name} принял приглашение` });
      break;
    }
    case "change_vote": {
      const vote = (world.votes || []).find(v => v.id === ctx.voteId);
      if (!vote) return null;
      const poll = (world.polls || []).find(p => p.id === vote.pollId);
      if (!poll || poll.status !== "open") return null;
      if (!ctx.newValue) return null;
      ef({ alpha: "replace", target: "vote.value", scope: "account", value: ctx.newValue,
        context: { id: vote.id, participantName: vote.participantName, oldValue: vote.value, newValue: ctx.newValue },
        desc: `↔ ${vote.participantName}: ${vote.value} → ${ctx.newValue}` });
      break;
    }
    case "send_reminder": {
      const poll = (world.polls || []).find(p => p.id === ctx.pollId);
      if (!poll || poll.status !== "open") return null;
      // Только сигнал, без эффектов
      return null; // сигнал эмитируется отдельно
    }
    default: return null;
  }
  return effects.length > 0 ? effects : null;
}

// Нет seed-данных — пустой домен
export function getSeedEffects() { return []; }
