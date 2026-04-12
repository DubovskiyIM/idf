import { useMemo } from "react";
import ProjectionRendererV2 from "../index.jsx";
import { crystallizeV2 } from "../../crystallize_v2/index.js";
import { generateEditProjections } from "../../crystallize_v2/formGrouping.js";
import { useProjectionRoute } from "../navigation/useProjectionRoute.js";
import Breadcrumbs from "../navigation/Breadcrumbs.jsx";
import { getAdaptedComponent } from "../adapters/registry.js";

/**
 * V2Shell — доменонезависимый рендерер проекций через кристаллизатор v2.
 *
 * Отвечает за:
 *   - crystallizeV2 + generateEditProjections
 *   - useProjectionRoute (стек + back/reset)
 *   - top-bar с табами root-проекций (domain.ROOT_PROJECTIONS)
 *   - Breadcrumbs на deep-навигации
 *   - worldWithRoute = world + route params (для фильтров, которые читают
 *     world.{idParam})
 *
 * НЕ отвечает за аутентификацию и лайфцикл WebSocket — если домену это нужно
 * (messenger), создать специализированный shell над V2Shell или inline
 * логику в собственный V2UI.
 *
 * Используется в standalone.jsx для booking-v2 / planning-v2 и в
 * prototype.jsx для режима "v2" у каждого домена.
 */
export default function V2Shell({
  domain,
  domainId,
  world,
  exec,
  execBatch,
  viewer,
  initialProjection,
}) {
  const rootProjections = domain.ROOT_PROJECTIONS || [];
  const initial = initialProjection || rootProjections[0] || Object.keys(domain.PROJECTIONS)[0];

  const {
    current, history, navigate, back, reset, canGoBack,
  } = useProjectionRoute(initial, {});

  const artifacts = useMemo(
    () => crystallizeV2(domain.INTENTS, domain.PROJECTIONS, domain.ONTOLOGY, domainId),
    [domain, domainId]
  );

  const allProjections = useMemo(() => {
    const edits = generateEditProjections(domain.INTENTS, domain.PROJECTIONS, domain.ONTOLOGY);
    return { ...domain.PROJECTIONS, ...edits };
  }, [domain]);

  const projectionNames = useMemo(() => {
    const names = {};
    for (const [id, proj] of Object.entries(allProjections)) {
      names[id] = proj.name || id;
    }
    return names;
  }, [allProjections]);

  // Viewer context для wrappedExec в ProjectionRendererV2 — подставляется
  // в ctx каждого exec-вызова. Виртуальный viewer: domain-runtime сами
  // решают, что такое «я» (booking — client, planning — participant и т.д.).
  const viewerContext = useMemo(() => {
    if (!viewer) return { userId: "self", userName: "Я" };
    if (typeof viewer === "string") return { userId: viewer, userName: viewer };
    return { userId: viewer.id || "self", userName: viewer.name || "Я" };
  }, [viewer]);

  const viewerObj = useMemo(() => {
    if (!viewer) return { id: "self", name: "Я" };
    if (typeof viewer === "string") return { id: viewer, name: viewer };
    return viewer;
  }, [viewer]);

  // World обогащается route params, чтобы фильтры body могли читать
  // world.conversationId / world.bookingId и т.п. (см. messenger chat_view
  // filter для образца).
  const worldWithRoute = useMemo(() => ({
    ...world,
    ...(current?.params || {}),
  }), [world, current]);

  const currentArtifact = current ? artifacts[current.projectionId] : null;
  const currentProjectionDef = current ? allProjections[current.projectionId] : null;

  const isOnRoot = rootProjections.includes(current?.projectionId);

  // Адаптированная реализация root-табов (Mantine Tabs через адаптер).
  // Если адаптер не предоставляет shell.tabs — fallback на inline-версию.
  const AdaptedTabs = getAdaptedComponent("shell", "tabs");
  const tabItems = rootProjections.map(projId => ({
    value: projId,
    label: projectionNames[projId] || projId,
  }));
  const onSelectTab = (projId) => {
    if (projId === current?.projectionId) return;
    reset(projId, {});
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", minHeight: 0,
      fontFamily: "system-ui, sans-serif",
    }}>
      {rootProjections.length > 0 && (
        AdaptedTabs ? (
          <AdaptedTabs
            items={tabItems}
            active={current?.projectionId}
            onSelect={onSelectTab}
          />
        ) : (
          // Fallback: inline-стилизованные табы
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
                    onClick={() => onSelectTab(projId)}
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
          </div>
        )
      )}

      {/* Breadcrumbs — только на deep-навигации */}
      {!isOnRoot && (
        <Breadcrumbs
          history={history}
          current={current}
          canGoBack={canGoBack}
          onBack={back}
          projectionNames={projectionNames}
        />
      )}

      <div style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
        {currentArtifact ? (
          <ProjectionRendererV2
            artifact={currentArtifact}
            projection={currentProjectionDef}
            world={worldWithRoute}
            exec={exec}
            execBatch={execBatch}
            viewer={viewerObj}
            viewerContext={viewerContext}
            routeParams={current.params}
            navigate={navigate}
            back={back}
          />
        ) : (
          <div style={{ padding: 40, color: "var(--mantine-color-dimmed)", textAlign: "center" }}>
            Проекция "{current?.projectionId}" не найдена или не поддерживается архетипом v2
          </div>
        )}
      </div>
    </div>
  );
}
