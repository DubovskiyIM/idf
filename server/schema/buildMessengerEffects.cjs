/**
 * Серверный builder эффектов для agent-разрешённых messenger-intent'ов.
 * 5 intents: send_message, create_direct_chat, create_group, add_contact, mark_as_read.
 */

const { v4: uuid } = require("uuid");

function ts() {
  return new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function makeEffect(intentId, props) {
  return { id: uuid(), intent_id: intentId, parent_id: null, status: "proposed", ttl: null, created_at: Date.now(), time: ts(), ...props };
}

function buildMessengerEffects(intentId, params, viewer, world) {
  const now = Date.now();

  switch (intentId) {
    case "send_message": {
      if (!params.content?.trim() || !params.conversationId) return null;
      return [
        makeEffect(intentId, {
          alpha: "add", target: "messages", scope: "account", value: null,
          context: {
            id: `msg_${now}_${Math.random().toString(36).slice(2, 6)}`,
            conversationId: params.conversationId,
            senderId: viewer.id, senderName: viewer.name || "",
            type: "text", content: params.content.trim(),
            replyToId: params.replyToId || null, status: "sent", createdAt: now,
          },
          desc: `💬 ${params.content.trim().slice(0, 30)}`
        }),
        makeEffect(intentId, {
          alpha: "replace", target: "conversation.lastMessageAt", scope: "account",
          value: now, context: { id: params.conversationId },
          desc: "lastMessageAt"
        }),
      ];
    }

    case "create_direct_chat": {
      const targetUserId = params.targetUserId || params.user;
      if (!targetUserId || targetUserId === viewer.id) return null;
      const target = (world.users || []).find(u => u.id === targetUserId);
      const targetName = target?.name || "";
      const convId = `conv_${now}`;
      return [
        makeEffect(intentId, {
          alpha: "add", target: "conversations", scope: "account", value: null,
          context: {
            id: convId, type: "direct", title: targetName,
            createdBy: viewer.id, participantIds: [viewer.id, targetUserId],
            lastMessageAt: now, createdAt: now,
          },
          desc: `💬 Чат с ${targetName}`
        }),
        makeEffect(intentId, {
          alpha: "add", target: "participants", scope: "account", value: null,
          context: { id: `p_${now}_1`, conversationId: convId, userId: viewer.id, role: "member", joinedAt: now, lastReadAt: now },
          desc: "участник"
        }),
        makeEffect(intentId, {
          alpha: "add", target: "participants", scope: "account", value: null,
          context: { id: `p_${now}_2`, conversationId: convId, userId: targetUserId, role: "member", joinedAt: now, lastReadAt: now },
          desc: "участник"
        }),
      ];
    }

    case "create_group": {
      if (!params.title?.trim()) return null;
      const convId = `conv_${now}`;
      const effects = [
        makeEffect(intentId, {
          alpha: "add", target: "conversations", scope: "account", value: null,
          context: {
            id: convId, type: "group", title: params.title.trim(),
            createdBy: viewer.id,
            participantIds: [viewer.id, ...(params.memberIds || [])],
            lastMessageAt: now, createdAt: now,
          },
          desc: `👥 Группа: ${params.title.trim().slice(0, 30)}`
        }),
        makeEffect(intentId, {
          alpha: "add", target: "participants", scope: "account", value: null,
          context: { id: `p_${now}_owner`, conversationId: convId, userId: viewer.id, role: "owner", joinedAt: now, lastReadAt: now },
          desc: "владелец"
        }),
      ];
      for (const mId of (params.memberIds || [])) {
        effects.push(makeEffect(intentId, {
          alpha: "add", target: "participants", scope: "account", value: null,
          context: { id: `p_${now}_${Math.random().toString(36).slice(2, 6)}`, conversationId: convId, userId: mId, role: "member", joinedAt: now, lastReadAt: now },
          desc: "участник"
        }));
      }
      return effects;
    }

    case "add_contact": {
      const targetId = params.contactId || params.user;
      if (!targetId || targetId === viewer.id) return null;
      return [makeEffect(intentId, {
        alpha: "add", target: "contacts", scope: "account", value: null,
        context: {
          id: `contact_${now}_${Math.random().toString(36).slice(2, 6)}`,
          userId: viewer.id, contactId: targetId,
          name: params.name || "", direction: "outgoing", status: "pending", createdAt: now,
        },
        desc: `👤 Контакт добавлен`
      })];
    }

    case "mark_as_read": {
      if (!params.conversationId) return null;
      const participant = (world.participants || []).find(
        p => p.conversationId === params.conversationId && p.userId === viewer.id
      );
      if (!participant) return null;
      return [makeEffect(intentId, {
        alpha: "replace", target: "participant.lastReadAt", scope: "account",
        value: now, context: { id: participant.id },
        desc: "прочитано"
      })];
    }

    default:
      return null;
  }
}

module.exports = { buildMessengerEffects };
