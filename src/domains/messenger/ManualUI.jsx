import { useState, useMemo, useEffect, useRef, useCallback } from "react";

export default function MessengerUI({ world, drafts, exec, effects, viewer, layer }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("idf_token"));
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");

  const [activeConvId, setActiveConvId] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [view, setView] = useState("chats"); // chats | contacts | users
  const [wsStatus, setWsStatus] = useState("disconnected");
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [typingUsers, setTypingUsers] = useState({}); // convId → { userId: name, ... }
  const typingTimeoutsRef = useRef({});
  const [callState, setCallState] = useState(null); // null | { type, peerId, status, startedAt, muted }
  const [callDuration, setCallDuration] = useState(0);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callTimerRef = useRef(null);
  // Refs для signaling — обход stale closure в WebSocket onmessage
  const callHandlersRef = useRef({});

  // Auth: проверить токен при загрузке
  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(user => setCurrentUser(user))
      .catch(() => { setToken(null); localStorage.removeItem("idf_token"); });
  }, [token]);

  // WebSocket подключение
  useEffect(() => {
    if (!token || !currentUser) return;
    const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => { setWsStatus("connected"); ws.send(JSON.stringify({ type: "load_effects" })); console.log("[ws] Подключён как", currentUser.id); };
    ws.onclose = (e) => { setWsStatus("disconnected"); console.log("[ws] Отключён:", e.code); };
    ws.onerror = (e) => { setWsStatus("error"); console.error("[ws] Ошибка:", e); };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "effect:confirmed" && msg.effect) {
        // Новый эффект от другого пользователя — перезагрузить
        window.dispatchEvent(new CustomEvent("idf:reload"));
      }
      // WebRTC signaling — через ref для обхода stale closure
      if (msg.type === "call:offer") callHandlersRef.current.handleIncomingCall?.(msg.payload);
      if (msg.type === "call:answer") callHandlersRef.current.handleCallAnswer?.(msg.payload);
      if (msg.type === "call:ice") callHandlersRef.current.handleIceCandidate?.(msg.payload);
      if (msg.type === "call:end") callHandlersRef.current.endCall?.();

      if (msg.type === "signal" && msg.payload?.κ === "typing") {
        const { conversationId, userId, userName } = msg.payload;
        if (userId === currentUser?.id) return; // свой typing игнорируем
        setTypingUsers(prev => ({
          ...prev,
          [conversationId]: { ...prev[conversationId], [userId]: userName || "..." }
        }));
        // Убрать через 3с
        const key = `${conversationId}:${userId}`;
        clearTimeout(typingTimeoutsRef.current[key]);
        typingTimeoutsRef.current[key] = setTimeout(() => {
          setTypingUsers(prev => {
            const conv = { ...prev[conversationId] };
            delete conv[userId];
            return { ...prev, [conversationId]: conv };
          });
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
    const myParticipantConvIds = new Set(participants.filter(p => p.userId === currentUser.id).map(p => p.conversationId));
    return conversations.filter(c => myParticipantConvIds.has(c.id)).sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  }, [conversations, participants, currentUser]);

  const activeConv = conversations.find(c => c.id === activeConvId);
  const activeMessages = useMemo(() => {
    if (!activeConvId || !currentUser) return [];
    return messages
      .filter(m => m.conversationId === activeConvId && !(m.deletedFor || []).includes(currentUser.id) && !(m.deletedFor || []).includes("*"))
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [messages, activeConvId, currentUser]);

  // Скролл к последнему сообщению
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeMessages.length]);

  const handleAuth = async () => {
    setAuthError("");
    try {
      const url = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = authMode === "register" ? { email, password, name } : { email, password };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem("idf_token", data.token);
      setToken(data.token);
      setCurrentUser(data.user);
    } catch (e) { setAuthError(e.message); }
  };

  // === WebRTC Voice Call ===
  const startCall = async (targetUserId, callType = "voice") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && wsRef.current?.readyState === 1) {
          wsRef.current.send(JSON.stringify({ type: "call:ice", payload: { targetUserId, candidate: e.candidate } }));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      wsRef.current?.send(JSON.stringify({ type: "call:offer", payload: { targetUserId, offer, callType } }));

      setCallState({ type: callType, peerId: targetUserId, status: "calling", startedAt: Date.now(), muted: false });
    } catch (e) {
      console.error("Call error:", e);
      alert("Не удалось получить доступ к микрофону: " + e.message);
    }
  };

  const handleIncomingCall = async (payload) => {
    const { fromUserId, offer, callType } = payload;
    if (callState) return; // уже в звонке

    const accept = confirm(`Входящий ${callType === "video" ? "видео" : "голосовой"} звонок. Принять?`);
    if (!accept) {
      wsRef.current?.send(JSON.stringify({ type: "call:end", payload: { targetUserId: fromUserId } }));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && wsRef.current?.readyState === 1) {
          wsRef.current.send(JSON.stringify({ type: "call:ice", payload: { targetUserId: fromUserId, candidate: e.candidate } }));
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      wsRef.current?.send(JSON.stringify({ type: "call:answer", payload: { targetUserId: fromUserId, answer } }));

      setCallState({ type: callType, peerId: fromUserId, status: "active", startedAt: Date.now(), muted: false });
      startCallTimer();
    } catch (e) {
      console.error("Answer error:", e);
    }
  };

  const handleCallAnswer = async (payload) => {
    const { answer } = payload;
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState(prev => prev ? { ...prev, status: "active" } : null);
      startCallTimer();
    }
  };

  const handleIceCandidate = async (payload) => {
    const { candidate } = payload;
    if (peerConnectionRef.current && candidate) {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }
  };

  const endCall = () => {
    if (callState?.peerId && wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: "call:end", payload: { targetUserId: callState.peerId } }));
    }
    if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    clearInterval(callTimerRef.current);
    setCallState(null);
    setCallDuration(0);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) { audioTrack.enabled = !audioTrack.enabled; setCallState(prev => prev ? { ...prev, muted: !audioTrack.enabled } : null); }
    }
  };

  const startCallTimer = () => {
    const start = Date.now();
    callTimerRef.current = setInterval(() => setCallDuration(Math.floor((Date.now() - start) / 1000)), 1000);
  };

  const formatDuration = (sec) => `${Math.floor(sec / 60).toString().padStart(2, "0")}:${(sec % 60).toString().padStart(2, "0")}`;

  // Обновить refs для signaling handlers (обход stale closure)
  callHandlersRef.current = { handleIncomingCall, handleCallAnswer, handleIceCandidate, endCall };

  const sendMessage = () => {
    if (!messageText.trim() || !activeConvId || !currentUser) return;
    exec(replyTo ? "reply_to_message" : "send_message", {
      content: messageText, conversationId: activeConvId, userId: currentUser.id, userName: currentUser.name,
      replyToId: replyTo?.id
    });
    setMessageText("");
    setReplyTo(null);
  };

  // === AUTH SCREEN ===
  if (!currentUser) return (
    <div style={{ maxWidth: 360, margin: "40px auto", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, color: "#1a1a2e", textAlign: "center" }}>
        💬 IDF Мессенджер
      </h2>
      <div style={{ display: "flex", marginBottom: 16 }}>
        {["login", "register"].map(m => (
          <button key={m} onClick={() => setAuthMode(m)} style={{
            flex: 1, padding: "8px 0", border: "none", cursor: "pointer", fontSize: 14,
            background: authMode === m ? "#6366f1" : "#f3f4f6", color: authMode === m ? "#fff" : "#6b7280",
            borderRadius: m === "login" ? "8px 0 0 8px" : "0 8px 8px 0", fontWeight: 600
          }}>{m === "login" ? "Вход" : "Регистрация"}</button>
        ))}
      </div>
      {authMode === "register" && (
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Имя"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, marginBottom: 8, outline: "none", boxSizing: "border-box" }} />
      )}
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, marginBottom: 8, outline: "none", boxSizing: "border-box" }} />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" type="password"
        onKeyDown={e => { if (e.key === "Enter") handleAuth(); }}
        style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box" }} />
      {authError && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{authError}</div>}
      <button onClick={handleAuth} style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 15, cursor: "pointer", fontWeight: 600 }}>
        {authMode === "login" ? "Войти" : "Зарегистрироваться"}
      </button>
    </div>
  );

  // === MESSENGER ===
  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", fontFamily: "system-ui, sans-serif", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
      {/* Sidebar */}
      <div style={{ width: 280, borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }}>
        {/* User header */}
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700 }}>
            {currentUser.name[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{currentUser.name}</div>
            <div style={{ fontSize: 10, color: wsStatus === "connected" ? "#22c55e" : "#ef4444" }}>● {wsStatus}</div>
          </div>
          <button onClick={() => { setToken(null); setCurrentUser(null); localStorage.removeItem("idf_token"); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 12 }}>Выход</button>
        </div>

        {/* Nav */}
        <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
          {[{ id: "chats", label: "Чаты" }, { id: "contacts", label: "Контакты" }, { id: "users", label: "Люди" }].map(v => (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              flex: 1, padding: "8px 0", border: "none", cursor: "pointer", fontSize: 11,
              background: view === v.id ? "#eef2ff" : "transparent", color: view === v.id ? "#6366f1" : "#6b7280",
              borderBottom: view === v.id ? "2px solid #6366f1" : "2px solid transparent", fontWeight: view === v.id ? 600 : 400
            }}>{v.label}</button>
          ))}
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {view === "chats" && (
            myConversations.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Нет бесед. Найдите контакт в «Люди».</div>
            ) : myConversations.map(conv => {
              const lastMsg = messages.filter(m => m.conversationId === conv.id).sort((a, b) => b.createdAt - a.createdAt)[0];
              const isActive = activeConvId === conv.id;
              return (
                <div key={conv.id} onClick={() => { setActiveConvId(conv.id); exec("mark_as_read", { conversationId: conv.id, userId: currentUser.id }); }}
                  style={{ padding: "10px 14px", cursor: "pointer", background: isActive ? "#eef2ff" : "transparent", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{conv.title || conv.type === "direct" ? conv.title || "Чат" : conv.title}</div>
                  {lastMsg && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastMsg.senderName}: {lastMsg.content?.slice(0, 40)}</div>}
                </div>
              );
            })
          )}

          {view === "contacts" && (
            <div style={{ padding: 10 }}>
              {contacts.filter(c => c.userId === currentUser.id || c.contactId === currentUser.id).length === 0 ? (
                <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, padding: 20 }}>Нет контактов</div>
              ) : contacts.filter(c => c.userId === currentUser.id || c.contactId === currentUser.id).map(c => (
                <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 12, color: "#1a1a2e" }}>{c.contactName || c.contactId}</span>
                  <span style={{ fontSize: 10, color: c.status === "accepted" ? "#22c55e" : c.status === "pending" ? "#f59e0b" : "#ef4444" }}>{c.status}</span>
                  {c.status === "pending" && c.contactId === currentUser.id && (
                    <button onClick={() => exec("accept_contact", { id: c.id })} style={{ padding: "2px 8px", borderRadius: 4, border: "none", background: "#22c55e", color: "#fff", fontSize: 10, cursor: "pointer" }}>✓</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {view === "users" && <UserList currentUser={currentUser} exec={exec} contacts={contacts} conversations={conversations} participants={participants} />}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {!activeConv ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14 }}>
            Выберите беседу
          </div>
        ) : (
          <>
            {/* Call overlay */}
            {callState && (
              <div style={{ padding: 20, background: callState.status === "active" ? "#22c55e" : "#6366f1", color: "#fff", textAlign: "center" }}>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>{callState.status === "calling" ? "Вызов..." : callState.type === "video" ? "Видеозвонок" : "Голосовой звонок"}</div>
                {callState.status === "active" && <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, fontFamily: "ui-monospace, monospace" }}>{formatDuration(callDuration)}</div>}
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <button onClick={toggleMute} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: callState.muted ? "#ef4444" : "rgba(255,255,255,0.2)", color: "#fff", fontSize: 18, cursor: "pointer" }}>
                    {callState.muted ? "🔇" : "🎤"}
                  </button>
                  <button onClick={endCall} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 18, cursor: "pointer" }}>
                    📞
                  </button>
                </div>
              </div>
            )}
            <audio ref={remoteAudioRef} autoPlay />

            {/* Chat header */}
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{activeConv.title || "Чат"}</div>
              <span style={{ fontSize: 10, color: "#6b7280" }}>{activeConv.type} · {activeConv.participantIds?.length || 0} уч.</span>
              <div style={{ flex: 1 }} />
              {/* Кнопки звонка */}
              {activeConv.type === "direct" && !callState && (() => {
                const peerId = (activeConv.participantIds || []).find(id => id !== currentUser.id);
                return peerId && (<>
                  <button onClick={() => startCall(peerId, "voice")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#22c55e" }} title="Голосовой звонок">📞</button>
                  <button onClick={() => startCall(peerId, "video")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6366f1" }} title="Видеозвонок">📹</button>
                </>);
              })()}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>
              {activeMessages.map(msg => {
                const isMine = msg.senderId === currentUser.id;
                const replyMsg = msg.replyToId ? activeMessages.find(m => m.id === msg.replyToId) : null;
                return (
                  <div key={msg.id} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: 8 }}>
                    <div style={{
                      maxWidth: "70%", padding: "8px 12px", borderRadius: 12,
                      background: isMine ? "#6366f1" : "#f3f4f6",
                      color: isMine ? "#fff" : "#1a1a2e", fontSize: 13,
                      borderBottomRightRadius: isMine ? 4 : 12,
                      borderBottomLeftRadius: isMine ? 12 : 4,
                    }}>
                      {!isMine && <div style={{ fontSize: 10, fontWeight: 600, color: isMine ? "#c7d2fe" : "#6366f1", marginBottom: 2 }}>{msg.senderName}</div>}
                      {replyMsg && <div style={{ fontSize: 10, padding: "4px 8px", borderLeft: "2px solid", borderRadius: 4, marginBottom: 4, opacity: 0.7, background: isMine ? "#4f46e5" : "#e5e7eb" }}>↩ {replyMsg.content?.slice(0, 50)}</div>}
                      <div>{msg.content}</div>
                      <div style={{ fontSize: 9, opacity: 0.6, marginTop: 4, textAlign: "right" }}>
                        {new Date(msg.createdAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
                        {msg.editedAt && " ✎"}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing indicator */}
            {activeConvId && typingUsers[activeConvId] && Object.keys(typingUsers[activeConvId]).length > 0 && (
              <div style={{ padding: "4px 16px", fontSize: 11, color: "#6366f1", fontStyle: "italic" }}>
                {Object.values(typingUsers[activeConvId]).join(", ")} печатает...
              </div>
            )}

            {/* Reply bar */}
            {replyTo && (
              <div style={{ padding: "6px 16px", background: "#f3f4f6", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#6b7280" }}>
                <span>↩ {replyTo.content?.slice(0, 60)}</span>
                <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>×</button>
              </div>
            )}

            {/* Input */}
            <div style={{ padding: "10px 16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8 }}>
              <input value={messageText} onChange={e => {
                  setMessageText(e.target.value);
                  // Отправить typing signal
                  if (wsRef.current?.readyState === 1 && e.target.value.trim()) {
                    wsRef.current.send(JSON.stringify({ type: "signal", payload: { κ: "typing", conversationId: activeConvId, userName: currentUser.name } }));
                  }
                }}
                onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
                placeholder="Сообщение..." style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: "1px solid #d1d5db", fontSize: 14, outline: "none" }} />
              <button onClick={sendMessage} disabled={!messageText.trim()}
                style={{ padding: "10px 20px", borderRadius: 20, border: "none", background: messageText.trim() ? "#6366f1" : "#d1d5db", color: "#fff", cursor: messageText.trim() ? "pointer" : "default", fontWeight: 600 }}>
                ↑
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Компонент: список пользователей
function UserList({ currentUser, exec, contacts, conversations, participants }) {
  const [users, setUsers] = useState([]);
  const token = localStorage.getItem("idf_token");

  useEffect(() => {
    fetch("/api/auth/users", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setUsers).catch(() => {});
  }, []);

  const otherUsers = users.filter(u => u.id !== currentUser.id);

  return (
    <div style={{ padding: 10 }}>
      {otherUsers.length === 0 ? (
        <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, padding: 20 }}>Зарегистрируйте второго пользователя в другом браузере</div>
      ) : otherUsers.map(u => {
        const existingContact = contacts.find(c => (c.userId === currentUser.id && c.contactId === u.id) || (c.contactId === currentUser.id && c.userId === u.id));
        const existingConv = conversations.find(c => c.type === "direct" && c.participantIds?.includes(currentUser.id) && c.participantIds?.includes(u.id));
        return (
          <div key={u.id} style={{ padding: "8px 0", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: u.status === "online" ? "#22c55e" : "#d1d5db", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>
              {u.name[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a2e" }}>{u.name}</div>
              <div style={{ fontSize: 10, color: u.status === "online" ? "#22c55e" : "#9ca3af" }}>{u.status}</div>
            </div>
            {!existingContact && (
              <button onClick={() => exec("add_contact", { contactId: u.id, contactName: u.name, userId: currentUser.id })}
                style={{ padding: "3px 10px", borderRadius: 4, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 10, cursor: "pointer" }}>+ Контакт</button>
            )}
            {existingContact?.status === "accepted" && !existingConv && (
              <button onClick={() => exec("create_direct_chat", { contactUserId: u.id, contactName: u.name, userId: currentUser.id })}
                style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: "#6366f1", color: "#fff", fontSize: 10, cursor: "pointer" }}>💬 Чат</button>
            )}
            {existingConv && <span style={{ fontSize: 10, color: "#22c55e" }}>✓ чат</span>}
          </div>
        );
      })}
    </div>
  );
}
