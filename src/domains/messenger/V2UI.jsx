import { useState, useEffect, useRef, useMemo } from "react";
import ProjectionRendererV2 from "../../runtime/renderer/index.jsx";
import { crystallizeV2 } from "../../runtime/crystallize_v2/index.js";
import * as messengerDomain from "./domain.js";

/**
 * M1: обёртка мессенджера на новом рендерере v2.
 * Реализует минимум: auth → выбор активной беседы → рендер chat_view как feed-архетипа.
 * Дублирует auth+ws логику из ManualUI.jsx — временно, до M2 (catalog + nav graph).
 */
export default function MessengerV2UI({ world, exec }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("idf_token"));
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");
  const [activeConvId, setActiveConvId] = useState(null);
  const wsRef = useRef(null);

  // === AUTH ===
  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(user => setCurrentUser(user))
      .catch(() => { setToken(null); localStorage.removeItem("idf_token"); });
  }, [token]);

  const doAuth = async () => {
    setAuthError("");
    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = authMode === "login" ? { email, password } : { email, password, name };
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      setAuthError((await r.json()).error || "Ошибка авторизации");
      return;
    }
    const data = await r.json();
    localStorage.setItem("idf_token", data.token);
    setToken(data.token);
    setCurrentUser(data.user);
  };

  // === WebSocket ===
  useEffect(() => {
    if (!token || !currentUser) return;
    const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "load_effects" }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "effect:confirmed") window.dispatchEvent(new CustomEvent("idf:reload"));
    };
    return () => ws.close();
  }, [token, currentUser]);

  // === Кристаллизация артефакта при монтировании (on-the-fly, не в БД) ===
  const artifact = useMemo(() => {
    const artifacts = crystallizeV2(
      messengerDomain.INTENTS,
      messengerDomain.PROJECTIONS,
      messengerDomain.ONTOLOGY,
      "messenger"
    );
    return artifacts.chat_view || null;
  }, []);

  // === Список бесед пользователя ===
  const conversations = world.conversations || [];
  const participants = world.participants || [];
  const myConversations = useMemo(() => {
    if (!currentUser) return [];
    const myConvIds = new Set(participants.filter(p => p.userId === currentUser.id).map(p => p.conversationId));
    return conversations.filter(c => myConvIds.has(c.id));
  }, [conversations, participants, currentUser]);

  // === viewerContext — автоматически вливается во все exec-вызовы рендерером ===
  const viewerContext = useMemo(() => ({
    conversationId: activeConvId,
    userId: currentUser?.id,
    userName: currentUser?.name,
  }), [activeConvId, currentUser]);

  // === Мир, обогащённый currentConversationId для фильтра в body.list ===
  const worldWithCurrent = useMemo(() => ({
    ...world,
    currentConversationId: activeConvId,
  }), [world, activeConvId]);

  // === Auth-экран ===
  if (!currentUser) {
    return (
      <div style={{ maxWidth: 360, margin: "40px auto", fontFamily: "system-ui, sans-serif", padding: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, textAlign: "center" }}>
          💬 Мессенджер v2
        </h2>
        <div style={{ display: "flex", marginBottom: 16 }}>
          {["login", "register"].map(m => (
            <button key={m} onClick={() => setAuthMode(m)} style={{
              flex: 1, padding: "8px 0", border: "none", cursor: "pointer", fontSize: 14,
              background: authMode === m ? "#6366f1" : "#e5e7eb",
              color: authMode === m ? "#fff" : "#6b7280",
            }}>{m === "login" ? "Вход" : "Регистрация"}</button>
          ))}
        </div>
        <input placeholder="email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
        {authMode === "register" && (
          <input placeholder="Имя" value={name} onChange={e => setName(e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
        )}
        <input type="password" placeholder="пароль" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
        <button onClick={doAuth} style={{
          width: "100%", padding: 10, background: "#6366f1", color: "#fff",
          border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600,
        }}>{authMode === "login" ? "Войти" : "Зарегистрироваться"}</button>
        {authError && <div style={{ color: "#ef4444", marginTop: 8, fontSize: 12 }}>{authError}</div>}
      </div>
    );
  }

  if (!artifact) {
    return <div style={{ padding: 40 }}>Артефакт chat_view не создан</div>;
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <aside style={{ width: 260, borderRight: "1px solid #e5e7eb", background: "#fff", overflow: "auto" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", fontWeight: 600 }}>
          {currentUser.name}
        </div>
        {myConversations.length === 0 && (
          <div style={{ padding: 16, color: "#9ca3af", fontSize: 13 }}>
            Нет бесед. Создайте через /messenger, затем вернитесь сюда.
          </div>
        )}
        {myConversations.map(c => (
          <button key={c.id} onClick={() => setActiveConvId(c.id)} style={{
            display: "block", width: "100%", textAlign: "left", padding: 12,
            border: "none", background: activeConvId === c.id ? "#eef2ff" : "transparent",
            cursor: "pointer", borderBottom: "1px solid #f3f4f6",
          }}>{c.title || c.id}</button>
        ))}
      </aside>

      <main style={{ flex: 1, overflow: "hidden" }}>
        {activeConvId ? (
          <ProjectionRendererV2
            artifact={artifact}
            world={worldWithCurrent}
            exec={exec}
            viewer={currentUser}
            viewerContext={viewerContext}
          />
        ) : (
          <div style={{ padding: 40, color: "#9ca3af", textAlign: "center" }}>
            Выберите беседу слева
          </div>
        )}
      </main>
    </div>
  );
}
