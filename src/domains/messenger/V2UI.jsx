import { useState, useEffect, useRef, useMemo } from "react";
import ProjectionRendererV2 from "../../runtime/renderer/index.jsx";
import { crystallizeV2, generateEditProjections } from "@idf/core";
import { useProjectionRoute } from "../../runtime/renderer/navigation/useProjectionRoute.js";
import Breadcrumbs from "../../runtime/renderer/navigation/Breadcrumbs.jsx";
import { useAuth } from "../../runtime/renderer/auth/useAuth.js";
import AuthGate from "../../runtime/renderer/auth/AuthGate.jsx";
import * as messengerDomain from "./domain.js";

/**
 * M2: мессенджер на multi-projection роутере.
 * conversation_list → chat_view → user_profile через useProjectionRoute.
 * Auth через shared useAuth + AuthGate (унифицирован с booking/planning).
 * WebSocket для real-time — messenger-specific.
 */
export default function MessengerV2UI({ world, exec, execBatch }) {
  const { currentUser, token, doAuth, logout, authError, isLoading } = useAuth();
  const wsRef = useRef(null);

  const { current, history, navigate, back, reset, canGoBack } = useProjectionRoute("conversation_list", {});

  // WebSocket — messenger-specific (real-time эффекты)
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

  // Обёртка exec: автоматически инжектируем userId/clientId из viewer
  // в каждый вызов buildEffects. Без этого edit_message, delete_message
  // и другие intent'ы, проверяющие ctx.userId, не работают.
  const wrappedExec = useMemo(() => {
    if (!exec) return exec;
    return (intentId, ctx = {}) => exec(intentId, {
      ...ctx,
      userId: currentUser?.id,
      clientId: currentUser?.id,
    });
  }, [exec, currentUser]);

  const wrappedExecBatch = useMemo(() => {
    if (!execBatch) return execBatch;
    return (intentId, subs) => {
      const enriched = subs.map(s => ({
        ...s,
        ctx: { ...(s.ctx || {}), userId: currentUser?.id, clientId: currentUser?.id }
      }));
      return execBatch(intentId, enriched);
    };
  }, [execBatch, currentUser]);

  // Users приходят из Φ через _user_register эффекты.
  // Enrichment: conversations (partner avatar/name), contacts (user lookup).
  const worldWithRoute = useMemo(() => {
    // Users уже в world из Φ
    const users = [...(world.users || [])];
    // Гарантировать наличие currentUser (race condition: auth ответил, effects ещё нет)
    if (currentUser && !users.find(u => u.id === currentUser.id)) {
      users.push({
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email || "",
        avatar: currentUser.avatar || "",
        statusMessage: "",
        status: "online",
        lastSeen: Date.now(),
      });
    }

    const userById = new Map(users.map(u => [u.id, u]));

    // Enrichment conversations: partner avatar/name для direct бесед
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

    // Enrichment contacts: contactId → user name/avatar
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
  }, [world, current, currentUser]);

  if (!currentUser) {
    return (
      <AuthGate
        currentUser={currentUser}
        doAuth={doAuth}
        authError={authError}
        isLoading={isLoading}
        title="💬 Мессенджер"
      />
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
                  borderBottom: isActive ? "2px solid var(--mantine-color-primary, #6366f1)" : "2px solid transparent",
                  color: isActive ? "var(--mantine-color-primary, #6366f1)" : "var(--mantine-color-dimmed)",
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
              background: "var(--mantine-color-primary, #6366f1)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700,
            }}>{userInitial}</div>
          )}
        </button>
        <button
          onClick={logout}
          title="Выйти"
          style={{
            padding: "4px 10px",
            background: "transparent",
            border: "none",
            borderLeft: "1px solid var(--mantine-color-default-border)",
            cursor: "pointer",
            fontSize: 11,
            color: "var(--mantine-color-dimmed)",
            fontFamily: "inherit",
          }}
        >Выйти</button>
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
            exec={wrappedExec}
            execBatch={wrappedExecBatch}
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
