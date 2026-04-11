import { useState, useEffect, useRef, useMemo } from "react";
import ProjectionRendererV2 from "../../runtime/renderer/index.jsx";
import { crystallizeV2 } from "../../runtime/crystallize_v2/index.js";
import { generateEditProjections } from "../../runtime/crystallize_v2/formGrouping.js";
import { useProjectionRoute } from "../../runtime/renderer/navigation/useProjectionRoute.js";
import Breadcrumbs from "../../runtime/renderer/navigation/Breadcrumbs.jsx";
import * as messengerDomain from "./domain.js";

/**
 * M2: мессенджер на multi-projection роутере.
 * conversation_list → chat_view → user_profile через useProjectionRoute.
 * Auth + WebSocket — минимум, временно; в M5 уйдут в общий модуль.
 */
export default function MessengerV2UI({ world, exec, execBatch }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("idf_token"));
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");
  const wsRef = useRef(null);

  const { current, history, navigate, back, canGoBack } = useProjectionRoute("conversation_list", {});

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

  const artifacts = useMemo(() => crystallizeV2(
    messengerDomain.INTENTS,
    messengerDomain.PROJECTIONS,
    messengerDomain.ONTOLOGY,
    "messenger"
  ), []);

  // Объединённый набор проекций: исходные + автогенерированные edit-проекции.
  // V2UI должен знать про синтетические проекции для корректного projection
  // lookup (их нет в messengerDomain.PROJECTIONS напрямую).
  const allProjections = useMemo(() => {
    const edits = generateEditProjections(
      messengerDomain.INTENTS,
      messengerDomain.PROJECTIONS,
      messengerDomain.ONTOLOGY
    );
    return { ...messengerDomain.PROJECTIONS, ...edits };
  }, []);

  const projectionNames = useMemo(() => {
    const names = {};
    for (const [id, proj] of Object.entries(allProjections)) {
      names[id] = proj.name || id;
    }
    return names;
  }, [allProjections]);

  const viewerContext = useMemo(() => ({
    userId: currentUser?.id,
    userName: currentUser?.name,
  }), [currentUser]);

  // Мир обогащается route params + auth-user'ами. Auth-пользователи живут в
  // отдельной таблице (не в Φ), поэтому fold их не знает напрямую. Инжектим
  // currentUser как базовый слой, а fold-produced partials (из replace-
  // эффектов, upsert'ящихся в коллекцию user) накладываются поверх. Так
  // аватар, отредактированный через user_profile_edit, побеждает auth-базу.
  // В M4+ синхронизация auth_users ↔ Φ должна быть сделана через эффекты
  // регистрации (_user_register или аналог).
  const worldWithRoute = useMemo(() => {
    const users = [...(world.users || [])];
    if (currentUser) {
      const base = {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email || "",
        avatar: currentUser.avatar || "",
        statusMessage: currentUser.statusMessage || "",
        status: "online",
        lastSeen: Date.now(),
      };
      const idx = users.findIndex(u => u.id === currentUser.id);
      if (idx >= 0) {
        // Folded partial поверх auth-base — folded поля побеждают
        users[idx] = { ...base, ...users[idx] };
      } else {
        users.push(base);
      }
    }
    return {
      ...world,
      users,
      ...(current?.params || {}),
    };
  }, [world, current, currentUser]);

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

  const currentArtifact = current ? artifacts[current.projectionId] : null;
  const currentProjectionDef = current ? allProjections[current.projectionId] : null;

  // «Self-navigation» — клик по аватару/имени viewer'а ведёт на собственный
  // профиль. Если viewer уже на user_profile или user_profile_edit с
  // правильным id — no-op (предотвращает дубли в стеке при многократных
  // кликах).
  const goToSelfProfile = () => {
    if (!currentUser?.id) return;
    // Уже на своём профиле? Ничего не делаем.
    if (current?.projectionId === "user_profile" &&
        current.params?.userId === currentUser.id) return;
    if (current?.projectionId === "user_profile_edit" &&
        current.params?.userId === currentUser.id) return;
    navigate("user_profile", { userId: currentUser.id });
  };

  // Данные для top-bar берём из worldWithRoute (там merge'нут folded аватар
  // поверх auth-базы), а не напрямую из currentUser — иначе после редактирования
  // аватар в шапке не обновится (currentUser приходит из /api/auth/me один раз).
  const viewerUser = worldWithRoute.users?.find(u => u.id === currentUser?.id) || currentUser;
  const viewerAvatar = viewerUser?.avatar;
  const viewerHasImage = typeof viewerAvatar === "string" &&
    (viewerAvatar.startsWith("data:") || viewerAvatar.startsWith("http") || viewerAvatar.startsWith("/"));
  const userInitial = (viewerUser?.name || "?")[0]?.toUpperCase() || "?";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ flex: 1 }}>
          <Breadcrumbs
            history={history}
            current={current}
            canGoBack={canGoBack}
            onBack={back}
            projectionNames={projectionNames}
          />
        </div>
        <button
          onClick={goToSelfProfile}
          title={`Профиль: ${currentUser.name}`}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 12px", background: "#f9fafb",
            borderBottom: "1px solid #e5e7eb", borderLeft: "1px solid #e5e7eb",
            borderTop: "none", borderRight: "none",
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 13, color: "#374151" }}>{viewerUser?.name || currentUser.name}</span>
          {viewerHasImage ? (
            <img
              src={viewerAvatar}
              alt=""
              style={{
                width: 28, height: 28, borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#6366f1", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700,
            }}>{userInitial}</div>
          )}
        </button>
      </div>

      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {currentArtifact ? (
          <ProjectionRendererV2
            artifact={currentArtifact}
            projection={currentProjectionDef}
            world={worldWithRoute}
            exec={exec}
            execBatch={execBatch}
            viewer={currentUser}
            viewerContext={viewerContext}
            routeParams={current.params}
            navigate={navigate}
            back={back}
          />
        ) : (
          <div style={{ padding: 40, color: "#9ca3af" }}>
            Проекция "{current?.projectionId}" не найдена
          </div>
        )}
      </div>
    </div>
  );
}
