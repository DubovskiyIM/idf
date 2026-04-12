import { v4 as uuid } from "uuid";

export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
import { INTENTS } from "./intents.js";

export const DOMAIN_ID = "messenger";
export const DOMAIN_NAME = "Мессенджер";

const ts = () => new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 2 });

export function describeEffect(intentId, alpha, ctx, target) {
  const intent = INTENTS[intentId];
  const name = intent?.name || intentId;
  switch (intentId) {
    case "send_message": case "reply_to_message": return `💬 ${ctx.senderName || "?"}: ${(ctx.content || "").slice(0, 30)}`;
    case "edit_message": return `✎ Сообщение отредактировано`;
    case "delete_message": return `✕ Сообщение удалено`;
    case "create_direct_chat": return `💬 Чат с ${ctx.contactName || ctx.id}`;
    case "create_group": return `👥 Группа: ${ctx.title || ctx.id}`;
    case "add_contact": return `👤 Запрос: ${ctx.contactName || ctx.id}`;
    case "accept_contact": return `✓ Контакт принят`;
    case "_seed": return `seed: ${alpha} ${ctx.id || ""}`;
    default: return `${name}: ${alpha} ${target || ""}`;
  }
}

export function signalForIntent(intentId) {
  switch (intentId) {
    case "send_message": case "reply_to_message": case "forward_message": return { κ: "notification", desc: "Новое сообщение" };
    case "add_contact": return { κ: "notification", desc: "Запрос контакта" };
    case "start_voice_call": case "start_video_call": return { κ: "notification", desc: "Входящий звонок" };
    default: return null;
  }
}

/**
 * Generic buildEffects: генерирует эффекты из определения намерения.
 * Специфичные case — для намерений со сложной логикой.
 * Остальные 85+ — generic из INTENTS[intentId].particles.effects.
 */
export function buildEffects(intentId, ctx, world, drafts) {
  const now = Date.now();
  const effects = [];
  const ef = (props) => effects.push({ id: uuid(), intent_id: intentId, parent_id: null, status: "proposed", ttl: null, created_at: now, time: ts(), ...props });

  // === Специфичные case (сложная логика) ===
  switch (intentId) {
    case "send_message": {
      if (!ctx.content?.trim() || !ctx.conversationId) return null;
      ef({ alpha: "add", target: "messages", scope: "account", value: null,
        context: { id: `msg_${now}_${Math.random().toString(36).slice(2, 6)}`, conversationId: ctx.conversationId,
          senderId: ctx.userId, senderName: ctx.userName, type: "text", content: ctx.content.trim(),
          replyToId: ctx.replyToId || null, status: "sent", createdAt: now },
        desc: describeEffect(intentId, "add", { senderName: ctx.userName, content: ctx.content }) });
      ef({ alpha: "replace", target: "conversation.lastMessageAt", scope: "account", value: now,
        context: { id: ctx.conversationId }, desc: "lastMessageAt" });
      return effects;
    }
    case "reply_to_message": {
      if (!ctx.content?.trim() || !ctx.conversationId || !ctx.replyToId) return null;
      ef({ alpha: "add", target: "messages", scope: "account", value: null,
        context: { id: `msg_${now}_${Math.random().toString(36).slice(2, 6)}`, conversationId: ctx.conversationId,
          senderId: ctx.userId, senderName: ctx.userName, type: "text", content: ctx.content.trim(),
          replyToId: ctx.replyToId, status: "sent", createdAt: now },
        desc: describeEffect(intentId, "add", { senderName: ctx.userName, content: ctx.content }) });
      ef({ alpha: "replace", target: "conversation.lastMessageAt", scope: "account", value: now,
        context: { id: ctx.conversationId }, desc: "lastMessageAt" });
      return effects;
    }
    case "edit_message": {
      const msg = (world.messages || []).find(m => m.id === ctx.id);
      if (!msg || msg.senderId !== ctx.userId) return null;
      ef({ alpha: "replace", target: "message.content", scope: "account", value: ctx.content,
        context: { id: msg.id }, desc: describeEffect(intentId, "replace", {}) });
      ef({ alpha: "replace", target: "message.editedAt", scope: "account", value: now,
        context: { id: msg.id }, desc: "editedAt" });
      return effects;
    }
    case "delete_message": {
      const msg = (world.messages || []).find(m => m.id === ctx.id);
      if (!msg) return null;
      ef({ alpha: "replace", target: "message.deletedFor", scope: "account", value: ctx.forAll ? ["*"] : [ctx.userId],
        context: { id: msg.id }, desc: describeEffect(intentId, "replace", {}) });
      return effects;
    }
    case "create_direct_chat": {
      // Источники targetUserId (в порядке приоритета):
      //  1. ctx.user — EntityPicker кладёт id под alias-ключом "user"
      //     (см. EntityPicker.pick, alias из декларации "user: User")
      //  2. ctx.id — per-item клик в catalog people_list: IntentButton
      //     передаёт id выбранного пользователя в ctx.id
      //  3. ctx.contactUserId — legacy fallback из ManualUI
      const targetUserId = ctx.user || ctx.id || ctx.contactUserId;
      if (!targetUserId || targetUserId === ctx.userId) return null;
      // Имя беседы: alias-ключ, per-item world lookup, legacy
      let targetUserName = ctx.userName || ctx.contactName || "";
      if (!targetUserName && targetUserId) {
        const u = (world.users || []).find(x => x.id === targetUserId);
        if (u) targetUserName = u.name || "";
      }
      const convId = `conv_${now}`;
      ef({ alpha: "add", target: "conversations", scope: "account", value: null,
        context: { id: convId, type: "direct", title: targetUserName, createdBy: ctx.userId, participantIds: [ctx.userId, targetUserId], lastMessageAt: now, createdAt: now },
        desc: describeEffect(intentId, "add", { contactName: targetUserName }) });
      ef({ alpha: "add", target: "participants", scope: "account", value: null,
        context: { id: `p_${now}_1`, conversationId: convId, userId: ctx.userId, role: "member", joinedAt: now, lastReadAt: now }, desc: "участник" });
      ef({ alpha: "add", target: "participants", scope: "account", value: null,
        context: { id: `p_${now}_2`, conversationId: convId, userId: targetUserId, role: "member", joinedAt: now, lastReadAt: now }, desc: "участник" });
      return effects;
    }
    case "create_group": {
      if (!ctx.title?.trim()) return null;
      const convId = `conv_${now}`;
      ef({ alpha: "add", target: "conversations", scope: "account", value: null,
        context: { id: convId, type: "group", title: ctx.title.trim(), createdBy: ctx.userId, participantIds: [ctx.userId, ...(ctx.memberIds || [])], lastMessageAt: now, createdAt: now },
        desc: describeEffect(intentId, "add", { title: ctx.title }) });
      ef({ alpha: "add", target: "participants", scope: "account", value: null,
        context: { id: `p_${now}_owner`, conversationId: convId, userId: ctx.userId, role: "owner", joinedAt: now, lastReadAt: now }, desc: "владелец" });
      for (const mId of (ctx.memberIds || [])) {
        ef({ alpha: "add", target: "participants", scope: "account", value: null,
          context: { id: `p_${now}_${Math.random().toString(36).slice(2, 6)}`, conversationId: convId, userId: mId, role: "member", joinedAt: now, lastReadAt: now }, desc: "участник" });
      }
      return effects;
    }
    case "mark_as_read": {
      const p = (world.participants || []).find(pt => pt.conversationId === ctx.conversationId && pt.userId === ctx.userId);
      if (!p) return null;
      ef({ alpha: "replace", target: "participant.lastReadAt", scope: "account", value: now,
        context: { id: p.id }, desc: "прочитано" });
      return effects;
    }
    case "add_contact": {
      const contactId = ctx.contactId || ctx.id;
      if (!contactId) return null;
      const contactName = ctx.contactName || ((world.users || []).find(u => u.id === contactId))?.name || "";
      const senderName = ctx.userName || ((world.users || []).find(u => u.id === ctx.userId))?.name || "";
      // Исходящий запрос (видит отправитель)
      ef({ alpha: "add", target: "contacts", scope: "account", value: null,
        context: { id: `c_${now}_out`, userId: ctx.userId, contactId, name: contactName, direction: "outgoing", status: "pending", createdAt: now },
        desc: describeEffect(intentId, "add", { contactName }) });
      // Входящий запрос (видит получатель)
      ef({ alpha: "add", target: "contacts", scope: "account", value: null,
        context: { id: `c_${now}_in`, userId: contactId, contactId: ctx.userId, name: senderName, direction: "incoming", status: "pending", createdAt: now },
        desc: `Входящий запрос от ${senderName}` });
      return effects;
    }
    case "accept_contact": case "reject_contact": {
      const contact = (world.contacts || []).find(c => c.id === ctx.id);
      if (!contact) return null;
      const newStatus = intentId === "accept_contact" ? "accepted" : "rejected";
      // Обновить эту запись
      ef({ alpha: "replace", target: "contact.status", scope: "account", value: newStatus,
        context: { id: contact.id }, desc: `Контакт ${newStatus}` });
      // Найти и обновить зеркальную запись
      const mirror = (world.contacts || []).find(c =>
        c.id !== contact.id && c.userId === contact.contactId && c.contactId === contact.userId
      );
      if (mirror) {
        ef({ alpha: "replace", target: "contact.status", scope: "account", value: newStatus,
          context: { id: mirror.id }, desc: `Зеркальный контакт ${newStatus}` });
      }
      return effects;
    }
    case "react_to_message": {
      if (!ctx.emoji || !ctx.id) return null;
      const reactionId = `react_${now}_${Math.random().toString(36).slice(2, 6)}`;
      ef({ alpha: "add", target: "reactions", scope: "account", value: null,
        context: { id: reactionId, messageId: ctx.id, userId: ctx.userId, emoji: ctx.emoji, createdAt: now },
        desc: `${ctx.emoji} на сообщение` });
      return effects;
    }
    case "remove_reaction": {
      const reactionId = ctx.reactionId || ctx.id;
      if (!reactionId) return null;
      ef({ alpha: "remove", target: "reactions", scope: "account", value: null,
        context: { id: reactionId }, desc: "Реакция убрана" });
      return effects;
    }
    case "forward_message": {
      const originalMsg = (world.messages || []).find(m => m.id === ctx.id);
      if (!originalMsg) return null;
      const targetConvId = ctx.conversation || ctx.conversationId;
      if (!targetConvId) return null;
      const senderName = originalMsg.senderName || ((world.users || []).find(u => u.id === originalMsg.senderId))?.name || "?";
      const msgId = `msg_${now}_${Math.random().toString(36).slice(2, 6)}`;
      ef({ alpha: "add", target: "messages", scope: "account", value: null,
        context: {
          id: msgId, conversationId: targetConvId,
          senderId: ctx.userId, senderName: ctx.userName,
          type: "forwarded", content: originalMsg.content,
          originalSenderId: originalMsg.senderId, originalSenderName: senderName,
          forwarded: true, status: "sent", createdAt: now,
        },
        desc: `↗ Пересланное от ${senderName}` });
      ef({ alpha: "replace", target: "conversation.lastMessageAt", scope: "account", value: now,
        context: { id: targetConvId }, desc: "lastMessageAt" });
      return effects;
    }
  }

  // === Generic handler для остальных 85+ намерений ===
  const intent = INTENTS[intentId];
  if (!intent) return null;

  const intentEffects = intent.particles.effects || [];
  if (intentEffects.length === 0) return null; // проекция, не намерение

  for (const iEf of intentEffects) {
    const alpha = iEf.α;
    const target = iEf.target;
    const scope = iEf.σ || "account";

    switch (alpha) {
      case "add": {
        const entityId = ctx.id || `${target.slice(0, 4)}_${now}_${Math.random().toString(36).slice(2, 6)}`;
        ef({ alpha: "add", target, scope, value: null,
          context: { id: entityId, ...ctx, createdAt: now },
          desc: describeEffect(intentId, "add", ctx, target) });
        break;
      }
      case "replace": {
        const entityId = ctx.id || ctx.entityId;
        const field = target.includes(".") ? target.split(".").pop() : target;
        // Значение: (1) preset в intent.effect.value, (2) ctx[field] из
        // формы (ArchetypeForm передаёт значение под именем поля),
        // (3) ctx.value — legacy. Первое непустое побеждает.
        const resolvedValue =
          iEf.value !== undefined ? iEf.value
          : ctx[field] !== undefined ? ctx[field]
          : ctx.value;
        if (!entityId) {
          const collBase = target.split(".")[0];
          const plural = collBase.endsWith("s") ? collBase + "es" : collBase + "s";
          const collection = world[plural] || world[collBase + "s"] || [];
          const entity = collection.find(e => e.id === ctx.id) || collection[0];
          if (entity) {
            ef({ alpha: "replace", target, scope, value: resolvedValue,
              context: { id: entity.id }, desc: describeEffect(intentId, "replace", ctx, target) });
          }
        } else {
          ef({ alpha: "replace", target, scope, value: resolvedValue,
            context: { id: entityId }, desc: describeEffect(intentId, "replace", ctx, target) });
        }
        break;
      }
      case "remove": {
        const entityId = ctx.id || ctx.entityId;
        if (entityId) {
          ef({ alpha: "remove", target, scope, value: null,
            context: { id: entityId }, desc: describeEffect(intentId, "remove", ctx, target) });
        }
        break;
      }
    }
  }

  return effects.length > 0 ? effects : null;
}

export function getSeedEffects() { return []; }
