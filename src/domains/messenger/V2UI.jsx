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
  const [authUsers, setAuthUsers] = useState([]);
  const [token, setToken] = useState(() => localStorage.getItem("idf_token"));
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");
  const wsRef = useRef(null);

  const { current, history, navigate, back, reset, canGoBack } = useProjectionRoute("conversation_list", {});

  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(user => setCurrentUser(user))
      .catch(() => { setToken(null); localStorage.removeItem("idf_token"); });
  }, [token]);

  // Загрузить полный список auth-пользователей. Они живут в auth_users
  // (не в Φ) — fold их не видит. Нужны для: (1) people_list каталога,
  // (2) enrichment conversations/contacts аватарами и именами партнёра/
  // контакта. Перезагружается при idf:reload (после confirm любого эффекта).
  useEffect(() => {
    if (!token || !currentUser) return;
    const loadUsers = () => {
      fetch("/api/auth/users", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : [])
        .then(list => setAuthUsers(Array.isArray(list) ? list : []))
        .catch(() => {});
    };
    loadUsers();
    window.addEventListener("idf:reload", loadUsers);
    return () => window.removeEventListener("idf:reload", loadUsers);
  }, [token, currentUser]);

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

  // Мир обогащается тремя слоями:
  //  1) Базовый слой — все auth_users из /api/auth/users (они не в Φ и fold
  //     их не видит). Нужны для people_list и для lookup'ов avatar/name
  //     при enrichment conversations/contacts.
  //  2) Folded поля из replace-эффектов — наложение поверх auth-base, так
  //     редактирование аватара через user_profile_edit побеждает.
  //  3) Enrichment conversations: для direct беседы вычисляем partner →
  //     инжектим partner.avatar и partner.name в запись беседы (для catalog
  //     primitive Avatar — он читает item.avatar / item.title).
  //  4) Enrichment contacts: contact.contactId → user → contact.name/avatar.
  //
  // В M4+ синхронизация auth_users ↔ Φ должна быть сделана через эффекты
  // регистрации (_user_register или аналог).
  const worldWithRoute = useMemo(() => {
    // Слой 1: auth users как база
    const baseUsers = authUsers.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email || "",
      avatar: u.avatar || "",
      statusMessage: u.statusMessage || "",
      status: u.status || "offline",
      lastSeen: u.created_at || Date.now(),
    }));
    // Слой 2: merge с folded users (folded побеждает по полям)
    const foldedById = new Map((world.users || []).map(u => [u.id, u]));
    let users = baseUsers.map(base => {
      const folded = foldedById.get(base.id);
      return folded ? { ...base, ...folded } : base;
    });
    // Добавить folded users, которых не было в auth
    for (const f of (world.users || [])) {
      if (!users.find(u => u.id === f.id)) users.push(f);
    }
    // Гарантировать наличие currentUser (если auth/users ещё не успел загрузиться)
    if (currentUser && !users.find(u => u.id === currentUser.id)) {
      users.push({
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email || "",
        avatar: currentUser.avatar || "",
        statusMessage: currentUser.statusMessage || "",
        status: "online",
        lastSeen: Date.now(),
      });
    }

    const userById = new Map(users.map(u => [u.id, u]));

    // Слой 3: enrichment conversations
    const conversations = (world.conversations || []).map(c => {
      if (c.type === "direct" && Array.isArray(c.participantIds)) {
        const partnerId = c.participantIds.find(id => id !== currentUser?.id);
        const partner = partnerId ? userById.get(partnerId) : null;
        if (partner) {
          return {
            ...c,
            avatar: partner.avatar || "",
            title: c.title || partner.name || "",
            _partnerId: partner.id,
          };
        }
      }
      return c;
    });

    // Слой 4: enrichment contacts
    const contacts = (world.contacts || []).map(c => {
      const u = userById.get(c.contactId);
      if (u) {
        return {
          ...c,
          name: c.contactName || u.name || "",
          avatar: u.avatar || "",
          email: u.email || "",
          userStatus: u.status || "offline",
        };
      }
      return c;
    });

    return {
      ...world,
      users,
      conversations,
      contacts,
      ...(current?.params || {}),
    };
  }, [world, current, currentUser, authUsers]);

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

  // Root-проекции для верхних табов. Определяются доменом, shell их только
  // отображает. Клик по табу навигирует в соответствующий root (navigate
  // push'ит в history — пользователь может вернуться через back).
  const rootProjections = messengerDomain.ROOT_PROJECTIONS || [];
  const isOnRoot = rootProjections.includes(current?.projectionId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "system-ui, sans-serif", position: "relative" }}>
      {/* Верхняя шапка: табы root-проекций + viewer */}
      <div style={{
        display: "flex", alignItems: "stretch",
        background: "var(--mantine-color-default)", borderBottom: "1px solid var(--mantine-color-default-border)",
      }}>
        <div style={{ display: "flex", flex: 1 }}>
          {rootProjections.map(projId => {
            const isActive = current?.projectionId === projId;
            return (
              <button
                key={projId}
                // reset, а не navigate: переход между корневыми табами
                // сбрасывает стек до единственной записи — иначе history
                // копит каждый клик и breadcrumbs превращаются в мусор.
                onClick={() => {
                  if (isActive) return;
                  reset(projId, {});
                }}
                style={{
                  padding: "10px 18px",
                  background: "transparent",
                  border: "none",
                  borderBottom: isActive ? "2px solid #6366f1" : "2px solid transparent",
                  color: isActive ? "#6366f1" : "#6b7280",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {projectionNames[projId] || projId}
              </button>
            );
          })}
        </div>
        <button
          onClick={goToSelfProfile}
          title={`Профиль: ${currentUser.name}`}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 14px", background: "transparent",
            border: "none", borderLeft: "1px solid var(--mantine-color-default-border)",
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--mantine-color-text)" }}>{viewerUser?.name || currentUser.name}</span>
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

      {/* Breadcrumbs — показываем только когда не на root-проекции.
          На корневых табы уже достаточны как контекст. */}
      {!isOnRoot && (
        <Breadcrumbs
          history={history}
          current={current}
          canGoBack={canGoBack}
          onBack={back}
          projectionNames={projectionNames}
        />
      )}

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
