/*
 * Кристаллизованная проекция: messenger — 100 намерений
 * Категории: Чат, Беседы, Контакты, Профиль, Группы, Медиа, Звонки
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { getStyles } from "./theme.js";

const CATEGORIES = [
  { id: "chat", label: "💬 Чат", intents: ["send_message", "edit_message", "delete_message", "reply_to_message", "forward_message", "pin_message", "unpin_message", "react_to_message", "remove_reaction", "bookmark_message", "remove_bookmark", "report_message", "translate_message", "send_voice_message", "schedule_message", "bulk_delete_messages", "search_messages", "message_info", "copy_message", "select_messages", "mark_as_unread", "send_sticker", "send_gif", "send_location", "send_poll"] },
  { id: "conv", label: "📋 Беседы", intents: ["create_direct_chat", "create_group", "add_to_group", "leave_group", "remove_from_group", "mark_as_read", "mute_conversation", "unmute_conversation", "pin_conversation", "unpin_conversation", "rename_group", "set_group_avatar", "set_group_description", "archive_conversation", "unarchive_conversation", "delete_conversation", "clear_history", "export_chat", "create_channel", "set_slow_mode"] },
  { id: "contacts", label: "👤 Контакты", intents: ["add_contact", "accept_contact", "reject_contact", "block_contact", "unblock_contact", "delete_contact", "set_contact_nickname", "share_contact", "import_contacts", "search_contacts", "create_contact_group", "add_to_contact_group", "remove_from_contact_group", "invite_by_link", "revoke_invite_link"] },
  { id: "profile", label: "⚙ Профиль", intents: ["update_profile", "set_status_message", "set_avatar", "delete_avatar", "set_privacy_settings", "set_notification_settings", "set_theme", "set_language", "enable_2fa", "delete_account"] },
  { id: "admin", label: "🛡 Группы", intents: ["promote_to_admin", "demote_admin", "transfer_ownership", "set_group_permissions", "ban_user", "unban_user", "set_join_approval", "approve_join_request", "reject_join_request", "set_welcome_message", "set_auto_delete", "set_group_rules", "pin_group_message", "create_sticker_pack", "add_sticker_to_pack"] },
  { id: "media", label: "📎 Медиа", intents: ["send_image", "send_video", "send_document", "send_contact_card", "vote_poll", "close_poll", "create_album", "add_to_album", "set_chat_wallpaper", "record_voice_note"] },
  { id: "calls", label: "📞 Звонки", intents: ["start_voice_call", "start_video_call", "end_call", "mute_mic", "toggle_video"] },
];

export default function MessengerChatProjection({ world, exec, theme = "light", variant = "clean" }) {
  const s = getStyles(theme, variant);

  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("idf_token"));
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [authError, setAuthError] = useState("");

  const [activeConvId, setActiveConvId] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [sideTab, setSideTab] = useState("chats");
  const [toolsTab, setToolsTab] = useState(null); // category id or null
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [typingUsers, setTypingUsers] = useState({});
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutsRef = useRef({});

  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(u => setCurrentUser(u)).catch(() => { setToken(null); localStorage.removeItem("idf_token"); });
  }, [token]);

  useEffect(() => {
    if (!token || !currentUser) return;
    const ws = new WebSocket(`${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => { setWsStatus("connected"); ws.send(JSON.stringify({ type: "load_effects" })); };
    ws.onclose = () => setWsStatus("disconnected");
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "effect:confirmed") window.dispatchEvent(new CustomEvent("idf:reload"));
      if (msg.type === "signal" && msg.payload?.κ === "typing") {
        const { conversationId, userId, userName } = msg.payload;
        if (userId === currentUser?.id) return;
        setTypingUsers(prev => ({ ...prev, [conversationId]: { ...prev[conversationId], [userId]: userName } }));
        const key = `${conversationId}:${userId}`;
        clearTimeout(typingTimeoutsRef.current[key]);
        typingTimeoutsRef.current[key] = setTimeout(() => {
          setTypingUsers(prev => { const c = { ...prev[conversationId] }; delete c[userId]; return { ...prev, [conversationId]: c }; });
        }, 3000);
      }
    };
    return () => ws.close();
  }, [token, currentUser]);

  const conversations = world.conversations || [];
  const participants = world.participants || [];
  const messages = world.messages || [];
  const contacts = world.contacts || [];

  const myConversations = useMemo(() => {
    if (!currentUser) return [];
    const ids = new Set(participants.filter(p => p.userId === currentUser.id).map(p => p.conversationId));
    return conversations.filter(c => ids.has(c.id)).sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  }, [conversations, participants, currentUser]);

  const activeConv = conversations.find(c => c.id === activeConvId);
  const activeMessages = useMemo(() => {
    if (!activeConvId || !currentUser) return [];
    return messages.filter(m => m.conversationId === activeConvId && !(m.deletedFor || []).includes(currentUser.id) && !(m.deletedFor || []).includes("*"))
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [messages, activeConvId, currentUser]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeMessages.length]);

  const handleAuth = async () => {
    setAuthError("");
    try {
      const url = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = authMode === "register" ? { email, password, name: userName } : { email, password };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem("idf_token", data.token);
      setToken(data.token);
      setCurrentUser(data.user);
    } catch (e) { setAuthError(e.message); }
  };

  const sendMessage = () => {
    if (!messageText.trim() || !activeConvId || !currentUser) return;
    exec(replyTo ? "reply_to_message" : "send_message", {
      content: messageText, conversationId: activeConvId, userId: currentUser.id, userName: currentUser.name, replyToId: replyTo?.id
    });
    setMessageText(""); setReplyTo(null);
  };

  // Generic exec helper
  const execIntent = (intentId, extraCtx = {}) => {
    exec(intentId, { userId: currentUser?.id, userName: currentUser?.name, conversationId: activeConvId, ...extraCtx });
  };

  // === AUTH ===
  if (!currentUser) return (
    <div style={{ ...s.container, maxWidth: 380, margin: "40px auto" }}>
      <h2 style={{ ...s.heading("h1"), textAlign: "center", marginBottom: s.v.gap * 2 }}>💬 Мессенджер</h2>
      <div style={{ display: "flex", marginBottom: s.v.gap }}>
        {["login", "register"].map(m => (
          <button key={m} onClick={() => setAuthMode(m)} style={{ flex: 1, padding: s.v.padding / 2, border: "none", cursor: "pointer", fontSize: s.v.fontSize.body, background: authMode === m ? s.t.accent : s.t.surface, color: authMode === m ? "#fff" : s.t.textSecondary, borderRadius: m === "login" ? `${s.v.radius}px 0 0 ${s.v.radius}px` : `0 ${s.v.radius}px ${s.v.radius}px 0`, fontWeight: 600, fontFamily: s.v.font }}>{m === "login" ? "Вход" : "Регистрация"}</button>
        ))}
      </div>
      {authMode === "register" && <input value={userName} onChange={e => setUserName(e.target.value)} placeholder="Имя" style={{ width: "100%", padding: s.v.padding / 2, borderRadius: s.v.radius, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.body, fontFamily: s.v.font, marginBottom: s.v.gap, outline: "none", background: s.t.surface, color: s.t.text, boxSizing: "border-box" }} />}
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" style={{ width: "100%", padding: s.v.padding / 2, borderRadius: s.v.radius, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.body, fontFamily: s.v.font, marginBottom: s.v.gap, outline: "none", background: s.t.surface, color: s.t.text, boxSizing: "border-box" }} />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" type="password" onKeyDown={e => { if (e.key === "Enter") handleAuth(); }} style={{ width: "100%", padding: s.v.padding / 2, borderRadius: s.v.radius, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.body, fontFamily: s.v.font, marginBottom: s.v.gap, outline: "none", background: s.t.surface, color: s.t.text, boxSizing: "border-box" }} />
      {authError && <div style={{ color: s.t.danger, fontSize: s.v.fontSize.small, marginBottom: s.v.gap }}>{authError}</div>}
      <button onClick={handleAuth} style={{ ...s.button(), width: "100%", padding: s.v.padding * 0.7 }}>{authMode === "login" ? "Войти" : "Зарегистрироваться"}</button>
    </div>
  );

  const typingText = activeConvId && typingUsers[activeConvId] ? Object.values(typingUsers[activeConvId]).join(", ") : null;

  // === MESSENGER ===
  return (
    <div style={{ display: "flex", height: "calc(100vh - 60px)", fontFamily: s.v.font, background: s.t.bg, borderRadius: s.v.radius, overflow: "hidden", border: `${s.v.borderWidth}px solid ${s.t.border}` }}>
      {/* === SIDEBAR === */}
      <div style={{ width: 280, borderRight: `1px solid ${s.t.border}`, display: "flex", flexDirection: "column", background: s.t.surface }}>
        <div style={{ padding: s.v.padding, borderBottom: `1px solid ${s.t.border}`, display: "flex", alignItems: "center", gap: s.v.gap }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: s.t.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700 }}>{currentUser.name[0].toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ ...s.text("small"), fontWeight: 600, color: s.t.text }}>{currentUser.name}</div>
            <div style={{ fontSize: s.v.fontSize.tiny, color: wsStatus === "connected" ? s.t.success : s.t.danger }}>● {wsStatus}</div>
          </div>
          <button onClick={() => { setToken(null); setCurrentUser(null); localStorage.removeItem("idf_token"); }} style={{ background: "none", border: "none", cursor: "pointer", color: s.t.textMuted, fontSize: s.v.fontSize.tiny }}>Выход</button>
        </div>

        <div style={{ display: "flex", borderBottom: `1px solid ${s.t.border}` }}>
          {[{ id: "chats", label: "Чаты" }, { id: "contacts", label: "Контакты" }, { id: "users", label: "Люди" }].map(v => (
            <button key={v.id} onClick={() => setSideTab(v.id)} style={{ flex: 1, padding: `${s.v.gap}px 0`, border: "none", cursor: "pointer", fontSize: s.v.fontSize.tiny, background: sideTab === v.id ? s.t.accentBg : "transparent", color: sideTab === v.id ? s.t.accent : s.t.textMuted, borderBottom: sideTab === v.id ? `2px solid ${s.t.accent}` : "2px solid transparent", fontFamily: s.v.font }}>{v.label}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {sideTab === "chats" && myConversations.map(conv => {
            const lastMsg = messages.filter(m => m.conversationId === conv.id).sort((a, b) => b.createdAt - a.createdAt)[0];
            const typing = typingUsers[conv.id] ? Object.values(typingUsers[conv.id]).join(", ") : null;
            return (
              <div key={conv.id} onClick={() => { setActiveConvId(conv.id); exec("mark_as_read", { conversationId: conv.id, userId: currentUser.id }); }}
                style={{ padding: s.v.padding, cursor: "pointer", background: activeConvId === conv.id ? s.t.accentBg : "transparent", borderBottom: `1px solid ${s.t.border}` }}>
                <div style={{ ...s.text("small"), fontWeight: 600, color: s.t.text }}>{conv.title || "Чат"}</div>
                {typing && <div style={{ fontSize: s.v.fontSize.tiny, color: s.t.accent, fontStyle: "italic" }}>{typing} печатает...</div>}
                {!typing && lastMsg && <div style={{ fontSize: s.v.fontSize.tiny, color: s.t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastMsg.senderName}: {lastMsg.content?.slice(0, 35)}</div>}
              </div>
            );
          })}
          {sideTab === "chats" && myConversations.length === 0 && <div style={{ padding: 20, textAlign: "center", ...s.text("small") }}>Нет бесед</div>}

          {sideTab === "contacts" && contacts.filter(c => c.userId === currentUser.id || c.contactId === currentUser.id).map(c => (
            <div key={c.id} style={{ padding: `${s.v.gap}px ${s.v.padding}px`, borderBottom: `1px solid ${s.t.border}`, display: "flex", alignItems: "center", gap: s.v.gap }}>
              <span style={{ flex: 1, ...s.text("small"), color: s.t.text }}>{c.contactName || c.contactId}</span>
              <span style={s.badge(c.status === "accepted" ? "confirmed" : c.status === "pending" ? "draft" : "cancelled")}>{c.status}</span>
              {c.status === "pending" && c.contactId === currentUser.id && <button onClick={() => exec("accept_contact", { id: c.id })} style={s.button("success")}>✓</button>}
            </div>
          ))}

          {sideTab === "users" && <UsersPanel currentUser={currentUser} exec={exec} contacts={contacts} conversations={conversations} participants={participants} s={s} />}
        </div>
      </div>

      {/* === MAIN AREA === */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {!activeConv ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", ...s.text() }}>Выберите беседу</div>
        ) : (<>
          {/* Header */}
          <div style={{ padding: s.v.padding, borderBottom: `1px solid ${s.t.border}`, background: s.t.surface, display: "flex", alignItems: "center", gap: s.v.gap }}>
            <div style={{ flex: 1 }}>
              <div style={s.heading("h2")}>{activeConv.title || "Чат"}</div>
              <div style={s.text("tiny")}>{activeConv.type} · {activeConv.participantIds?.length || 0} уч.</div>
            </div>
            {/* Кнопка панели инструментов */}
            <button onClick={() => setToolsTab(toolsTab ? null : "chat")}
              style={{ ...s.buttonOutline(), fontSize: s.v.fontSize.tiny }}>{toolsTab ? "✕ Закрыть" : "⚡ 100 намерений"}</button>
          </div>

          {/* Tools panel — все 100 намерений по категориям */}
          {toolsTab && (
            <div style={{ borderBottom: `1px solid ${s.t.border}`, background: s.t.surface, maxHeight: 300, overflow: "auto" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2, padding: `${s.v.gap}px ${s.v.padding}px`, borderBottom: `1px solid ${s.t.border}` }}>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setToolsTab(cat.id)}
                    style={{ padding: "3px 8px", borderRadius: s.v.radius / 2, border: "none", cursor: "pointer", fontSize: s.v.fontSize.tiny, fontFamily: s.v.font,
                      background: toolsTab === cat.id ? s.t.accent : s.t.surface, color: toolsTab === cat.id ? "#fff" : s.t.textSecondary }}>
                    {cat.label} ({cat.intents.length})
                  </button>
                ))}
              </div>
              <div style={{ padding: s.v.padding, display: "flex", flexWrap: "wrap", gap: s.v.gap / 2 }}>
                {(CATEGORIES.find(c => c.id === toolsTab)?.intents || []).map(intentId => (
                  <button key={intentId} onClick={() => {
                    const ctx = { conversationId: activeConvId, userId: currentUser.id, userName: currentUser.name };
                    // Для некоторых намерений нужен prompt
                    if (["send_message", "reply_to_message", "forward_message", "send_voice_message", "send_sticker", "send_gif", "send_location", "send_poll", "send_image", "send_video", "send_document", "record_voice_note"].includes(intentId)) {
                      const content = prompt("Содержимое:", "");
                      if (content) exec(intentId, { ...ctx, content });
                    } else if (["edit_message", "delete_message", "pin_message", "unpin_message", "react_to_message", "bookmark_message", "report_message", "message_info", "copy_message"].includes(intentId)) {
                      const msgId = prompt("ID сообщения:", activeMessages[activeMessages.length - 1]?.id || "");
                      if (msgId) exec(intentId, { ...ctx, id: msgId });
                    } else if (["create_group", "rename_group", "set_group_description", "set_welcome_message", "set_group_rules"].includes(intentId)) {
                      const title = prompt("Текст:", "");
                      if (title) exec(intentId, { ...ctx, title, value: title });
                    } else if (["add_contact", "share_contact"].includes(intentId)) {
                      const contactId = prompt("ID пользователя:", "");
                      if (contactId) exec(intentId, { ...ctx, contactId, contactName: contactId });
                    } else if (["set_contact_nickname"].includes(intentId)) {
                      const nickname = prompt("Никнейм:", "");
                      if (nickname) exec(intentId, { ...ctx, value: nickname });
                    } else if (intentId === "create_direct_chat") {
                      const userId = prompt("ID пользователя:", "");
                      if (userId) exec(intentId, { ...ctx, contactUserId: userId, contactName: userId });
                    } else {
                      exec(intentId, ctx);
                    }
                  }}
                    style={{ padding: `${s.v.gap / 2}px ${s.v.gap}px`, borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, background: s.t.surface, color: s.t.text, fontSize: s.v.fontSize.tiny, cursor: "pointer", fontFamily: s.v.font }}>
                    {intentId.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflow: "auto", padding: s.v.padding }}>
            {activeMessages.map(msg => {
              const isMine = msg.senderId === currentUser.id;
              const reply = msg.replyToId ? activeMessages.find(m => m.id === msg.replyToId) : null;
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: s.v.gap }}>
                  <div onDoubleClick={() => setReplyTo(msg)} title="Двойной клик — ответить"
                    style={{ maxWidth: "70%", padding: `${s.v.padding / 2}px ${s.v.padding}px`, borderRadius: s.v.radius,
                      background: isMine ? s.t.accent : s.t.surface, color: isMine ? "#fff" : s.t.text,
                      fontSize: s.v.fontSize.body, fontFamily: s.v.font, border: isMine ? "none" : `1px solid ${s.t.border}`, boxShadow: s.v.shadow }}>
                    {!isMine && <div style={{ fontSize: s.v.fontSize.tiny, fontWeight: 600, color: isMine ? "#c7d2fe" : s.t.accent, marginBottom: 2 }}>{msg.senderName}</div>}
                    {reply && <div style={{ fontSize: s.v.fontSize.tiny, padding: "3px 6px", borderLeft: "2px solid", borderRadius: s.v.radius / 3, marginBottom: 4, opacity: 0.7 }}>↩ {reply.content?.slice(0, 50)}</div>}
                    <div>{msg.content}</div>
                    {msg.pinned && <span style={{ fontSize: s.v.fontSize.tiny, opacity: 0.6 }}>📌</span>}
                    <div style={{ fontSize: s.v.fontSize.tiny, opacity: 0.5, marginTop: 4, textAlign: "right" }}>
                      {new Date(msg.createdAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}{msg.editedAt && " ✎"}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {typingText && <div style={{ padding: `4px ${s.v.padding}px`, fontSize: s.v.fontSize.tiny, color: s.t.accent, fontStyle: "italic" }}>{typingText} печатает...</div>}
          {replyTo && (
            <div style={{ padding: `${s.v.gap}px ${s.v.padding}px`, background: s.t.surface, borderTop: `1px solid ${s.t.border}`, display: "flex", alignItems: "center", gap: s.v.gap, fontSize: s.v.fontSize.tiny, color: s.t.textMuted }}>
              ↩ {replyTo.content?.slice(0, 60)}
              <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: s.t.textMuted }}>×</button>
            </div>
          )}

          <div style={{ padding: s.v.padding, borderTop: `1px solid ${s.t.border}`, display: "flex", gap: s.v.gap, background: s.t.surface }}>
            <input value={messageText} onChange={e => {
                setMessageText(e.target.value);
                if (wsRef.current?.readyState === 1 && e.target.value.trim()) wsRef.current.send(JSON.stringify({ type: "signal", payload: { κ: "typing", conversationId: activeConvId, userName: currentUser.name } }));
              }}
              onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
              placeholder="Сообщение..." style={{ flex: 1, padding: `${s.v.padding / 2}px ${s.v.padding}px`, borderRadius: s.v.radius * 2, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.body, fontFamily: s.v.font, outline: "none", background: s.t.bg, color: s.t.text }} />
            <button onClick={sendMessage} disabled={!messageText.trim()} style={{ ...s.button(), borderRadius: s.v.radius * 2, padding: `${s.v.padding / 2}px ${s.v.padding}px` }}>↑</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

function UsersPanel({ currentUser, exec, contacts, conversations, participants, s }) {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    fetch("/api/auth/users", { headers: { Authorization: `Bearer ${localStorage.getItem("idf_token")}` } })
      .then(r => r.json()).then(setUsers).catch(() => {});
  }, []);
  return users.filter(u => u.id !== currentUser.id).map(u => {
    const existing = contacts.find(c => (c.userId === currentUser.id && c.contactId === u.id) || (c.contactId === currentUser.id && c.userId === u.id));
    const conv = conversations.find(c => c.type === "direct" && c.participantIds?.includes(currentUser.id) && c.participantIds?.includes(u.id));
    return (
      <div key={u.id} style={{ padding: `${s.v.gap}px ${s.v.padding}px`, borderBottom: `1px solid ${s.t.border}`, display: "flex", alignItems: "center", gap: s.v.gap }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: u.status === "online" ? s.t.success : s.t.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>{u.name[0].toUpperCase()}</div>
        <div style={{ flex: 1 }}><div style={{ ...s.text("small"), fontWeight: 600, color: s.t.text }}>{u.name}</div><div style={{ fontSize: s.v.fontSize.tiny, color: u.status === "online" ? s.t.success : s.t.textMuted }}>{u.status}</div></div>
        {!existing && <button onClick={() => exec("add_contact", { contactId: u.id, contactName: u.name, userId: currentUser.id })} style={s.buttonOutline()}>+</button>}
        {existing?.status === "accepted" && !conv && <button onClick={() => exec("create_direct_chat", { contactUserId: u.id, contactName: u.name, userId: currentUser.id })} style={s.button()}>💬</button>}
        {conv && <span style={{ ...s.text("tiny"), color: s.t.success }}>✓</span>}
      </div>
    );
  });
}
