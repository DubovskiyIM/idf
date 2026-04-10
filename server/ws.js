const { WebSocketServer } = require("ws");
const { verifyToken, getUser } = require("./auth.js");
const db = require("./db.js");
const { validate, cascadeReject } = require("./validator.js");
const { v4: uuid } = require("uuid");

/**
 * WebSocket сервер для real-time мессенджера.
 * Заменяет SSE для домена messenger.
 * Протокол:
 *   Клиент → Сервер: { type: "effect", payload: {...} }
 *   Сервер → Клиент: { type: "effect:confirmed", id }
 *                     { type: "effect:rejected", id, reason }
 *                     { type: "signal", payload: {...} }
 */

// userId → Set<WebSocket>
const connections = new Map();

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    // Авторизация через query parameter
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token");
    const payload = verifyToken(token);

    if (!payload) {
      ws.close(4001, "Unauthorized");
      return;
    }

    const userId = payload.userId;
    ws.userId = userId;

    // Зарегистрировать подключение
    if (!connections.has(userId)) connections.set(userId, new Set());
    connections.get(userId).add(ws);
    console.log(`  [ws] Подключён: ${userId} (${connections.get(userId).size} сокетов)`);

    // Бродкаст: пользователь онлайн
    broadcastToAll({ type: "signal", payload: { κ: "presence", userId, status: "online" } }, userId);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleMessage(ws, userId, msg);
      } catch (e) {
        ws.send(JSON.stringify({ type: "error", message: e.message }));
      }
    });

    ws.on("close", () => {
      const userConns = connections.get(userId);
      if (userConns) {
        userConns.delete(ws);
        if (userConns.size === 0) {
          connections.delete(userId);
          broadcastToAll({ type: "signal", payload: { κ: "presence", userId, status: "offline" } }, userId);
          console.log(`  [ws] Отключён: ${userId}`);
        }
      }
    });

    // Отправить начальные данные
    ws.send(JSON.stringify({ type: "connected", userId }));
  });

  return wss;
}

function handleMessage(ws, userId, msg) {
  switch (msg.type) {
    case "effect": {
      const ef = msg.payload;
      ef.senderId = userId; // привязать к отправителю

      // Записать в БД как proposed
      db.prepare(`
        INSERT INTO effects (id, intent_id, alpha, target, value, scope, parent_id, status, ttl, context, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'proposed', ?, ?, ?)
      `).run(
        ef.id, ef.intent_id, ef.alpha, ef.target,
        ef.value != null ? JSON.stringify(ef.value) : null,
        ef.scope || "account", ef.parent_id || null,
        ef.ttl || null,
        ef.context ? JSON.stringify(ef.context) : null,
        ef.created_at
      );

      // Валидация
      const stored = db.prepare("SELECT * FROM effects WHERE id = ?").get(ef.id);
      const result = validate(stored);
      const now = Date.now();

      if (result.valid) {
        db.prepare("UPDATE effects SET status = 'confirmed', resolved_at = ? WHERE id = ?").run(now, ef.id);

        // Определить кому отправить
        const ctx = ef.context || {};
        const conversationId = ctx.conversationId;

        if (conversationId) {
          // Отправить всем участникам беседы
          broadcastToConversation(conversationId, { type: "effect:confirmed", id: ef.id, effect: ef });
        } else {
          // Отправить отправителю
          sendToUser(userId, { type: "effect:confirmed", id: ef.id });
        }

        // TTL
        if (ef.ttl) {
          setTimeout(() => {
            const current = db.prepare("SELECT status FROM effects WHERE id = ?").get(ef.id);
            if (current && current.status === "confirmed") {
              db.prepare("UPDATE effects SET status = 'rejected', resolved_at = ? WHERE id = ?").run(Date.now(), ef.id);
              const cascaded = cascadeReject(ef.id);
              sendToUser(userId, { type: "effect:rejected", id: ef.id, reason: "TTL expired", cascaded });
            }
          }, ef.ttl);
        }
      } else {
        db.prepare("UPDATE effects SET status = 'rejected', resolved_at = ? WHERE id = ?").run(now, ef.id);
        sendToUser(userId, { type: "effect:rejected", id: ef.id, reason: result.reason });
      }
      break;
    }

    case "signal": {
      const sig = msg.payload;
      // Typing indicator
      if (sig.κ === "typing") {
        const conversationId = sig.conversationId;
        if (conversationId) {
          broadcastToConversation(conversationId, { type: "signal", payload: { ...sig, userId } }, userId);
        }
      }
      break;
    }

    // === WebRTC Signaling ===
    case "call:offer": {
      // Relay offer to target user
      const { targetUserId, offer, callType } = msg.payload;
      sendToUser(targetUserId, { type: "call:offer", payload: { fromUserId: userId, offer, callType } });
      console.log(`  [webrtc] Offer: ${userId} → ${targetUserId} (${callType})`);
      break;
    }
    case "call:answer": {
      const { targetUserId, answer } = msg.payload;
      sendToUser(targetUserId, { type: "call:answer", payload: { fromUserId: userId, answer } });
      console.log(`  [webrtc] Answer: ${userId} → ${targetUserId}`);
      break;
    }
    case "call:ice": {
      const { targetUserId, candidate } = msg.payload;
      sendToUser(targetUserId, { type: "call:ice", payload: { fromUserId: userId, candidate } });
      break;
    }
    case "call:end": {
      const { targetUserId } = msg.payload;
      sendToUser(targetUserId, { type: "call:end", payload: { fromUserId: userId } });
      console.log(`  [webrtc] End: ${userId} → ${targetUserId}`);
      break;
    }

    case "load_effects": {
      // Загрузить эффекты для пользователя
      const effects = db.prepare("SELECT * FROM effects ORDER BY created_at ASC").all();
      ws.send(JSON.stringify({
        type: "effects_loaded",
        effects: effects.map(e => ({
          ...e,
          value: e.value ? JSON.parse(e.value) : null,
          context: e.context ? JSON.parse(e.context) : null,
        }))
      }));
      break;
    }
  }
}

function sendToUser(userId, msg) {
  const conns = connections.get(userId);
  if (!conns) return;
  const data = JSON.stringify(msg);
  for (const ws of conns) {
    if (ws.readyState === 1) ws.send(data);
  }
}

function broadcastToConversation(conversationId, msg, excludeUserId) {
  // Найти участников беседы из Φ
  const { foldWorld } = require("./validator.js");
  const world = foldWorld();
  const participants = (world.participants || []).filter(p => p.conversationId === conversationId);
  const data = JSON.stringify(msg);

  for (const p of participants) {
    if (p.userId === excludeUserId) continue;
    const conns = connections.get(p.userId);
    if (!conns) continue;
    for (const ws of conns) {
      if (ws.readyState === 1) ws.send(data);
    }
  }

  // Также отправить отправителю (если не исключён)
  if (excludeUserId) {
    sendToUser(excludeUserId, msg);
  }
}

function broadcastToAll(msg, excludeUserId) {
  const data = JSON.stringify(msg);
  for (const [userId, conns] of connections) {
    if (userId === excludeUserId) continue;
    for (const ws of conns) {
      if (ws.readyState === 1) ws.send(data);
    }
  }
}

function getOnlineUsers() {
  return [...connections.keys()];
}

module.exports = { setupWebSocket, sendToUser, broadcastToConversation, broadcastToAll, getOnlineUsers };
