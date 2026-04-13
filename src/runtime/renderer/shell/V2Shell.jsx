import { useMemo, useState, useCallback, useEffect } from "react";
import { usePersonalPrefs, prefsToStyle } from "../personal/usePersonalPrefs.js";
import PrefsPanel from "../personal/PrefsPanel.jsx";
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
  onLogout,
}) {
  const rawRootProjections = domain.ROOT_PROJECTIONS || [];
  const isSectioned = rawRootProjections.length > 0 && typeof rawRootProjections[0] === "object" && rawRootProjections[0].section;
  const rootProjections = isSectioned
    ? rawRootProjections.flatMap(s => s.items)
    : rawRootProjections;
  const sections = isSectioned ? rawRootProjections : null;
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

  // Обёртка exec/execBatch: автоматически инжектируем clientId из viewer.id
  // в каждый вызов buildEffects, чтобы create_booking, create_poll и т.д.
  // устанавливали ownership (clientId/organizerId) по реальному viewer, а не
  // hardcoded "self".
  const wrappedExec = useMemo(() => {
    if (!exec) return exec;
    return (intentId, ctx = {}) => exec(intentId, { ...ctx, clientId: viewerObj.id, userId: viewerObj.id, userName: viewerObj.name });
  }, [exec, viewerObj]);

  const wrappedExecBatch = useMemo(() => {
    if (!execBatch) return execBatch;
    return (intentId, subs) => {
      const enriched = subs.map(s => ({
        ...s,
        ctx: { ...(s.ctx || {}), clientId: viewerObj.id }
      }));
      return execBatch(intentId, enriched);
    };
  }, [execBatch, viewerObj]);

  // World обогащается route params, чтобы фильтры body могли читать
  // world.conversationId / world.bookingId и т.п. (см. messenger chat_view
  // filter для образца).
  const worldWithRoute = useMemo(() => ({
    ...world,
    ...(current?.params || {}),
  }), [world, current]);

  // Personal layer (§17)
  const { prefs, setPref, resetPrefs } = usePersonalPrefs();
  const [prefsOpen, setPrefsOpen] = useState(false);

  // LLM enrichment state
  const [enrichedArtifacts, setEnrichedArtifacts] = useState({});
  const [enriching, setEnriching] = useState(false);
  const [llmAvailable, setLlmAvailable] = useState(false);

  useEffect(() => {
    fetch("/api/crystallize/status").then(r => r.json()).then(d => setLlmAvailable(d.available)).catch(() => {});
  }, []);

  const enrichCurrent = useCallback(async () => {
    if (!current || enriching) return;
    const art = artifacts[current.projectionId];
    if (!art) return;
    setEnriching(true);
    try {
      const r = await fetch("/api/crystallize/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifact: art, ontology: domain.ONTOLOGY, domain: domainId }),
      });
      if (r.ok) {
        const data = await r.json();
        setEnrichedArtifacts(prev => ({ ...prev, [current.projectionId]: data.enrichedArtifact }));
      }
    } catch { /* ignore */ }
    setEnriching(false);
  }, [current, artifacts, domain, domainId, enriching]);

  const rawArtifact = current ? artifacts[current.projectionId] : null;
  const currentArtifact = (current && enrichedArtifacts[current.projectionId]) || rawArtifact;
  const isEnriched = current && !!enrichedArtifacts[current.projectionId];
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
    // Если root-проекция — detail-вид с idParam, автоматически подставляем
    // viewer.id. Это позволяет "Профиль продавца" в sidebar работать как
    // "Мой профиль" без ручного задания params.
    const projDef = allProjections[projId];
    let params = {};
    if (projDef?.kind === "detail" && projDef.idParam && viewerObj?.id) {
      params = { [projDef.idParam]: viewerObj.id };
    }
    reset(projId, params);
  };

  const mainContent = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!isOnRoot && (
          <div style={{ flex: 1 }}>
            <Breadcrumbs
              history={history}
              current={current}
              canGoBack={canGoBack}
              onBack={back}
              projectionNames={projectionNames}
            />
          </div>
        )}
        {isOnRoot && <div style={{ flex: 1 }} />}
        {llmAvailable && currentArtifact && (
          <button
            onClick={enrichCurrent}
            disabled={enriching}
            title={isEnriched ? "Уже обогащён через LLM" : "Обогатить labels/icons через Claude"}
            style={{
              padding: "4px 10px", borderRadius: 6, border: "1px solid var(--mantine-color-default-border, #d1d5db)",
              background: isEnriched ? "var(--mantine-color-violet-light, #ede9fe)" : "transparent",
              color: "var(--mantine-color-text, #374151)", fontSize: 11, cursor: enriching ? "wait" : "pointer",
              opacity: enriching ? 0.6 : 1, whiteSpace: "nowrap",
            }}
          >
            {enriching ? "⏳ Обогащение..." : isEnriched ? "✨ Обогащён" : "✨ LLM"}
          </button>
        )}
        <button
          onClick={() => setPrefsOpen(true)}
          title="Настройки UI"
          style={{
            padding: "4px 10px", borderRadius: 6, border: "1px solid var(--mantine-color-default-border, #d1d5db)",
            background: "transparent", color: "var(--mantine-color-text, #374151)",
            fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
          }}
        >⚙</button>
        {onLogout && viewer && (
          <button
            onClick={onLogout}
            title={`${viewer.name || ""} — выйти`}
            style={{
              padding: "4px 10px", borderRadius: 6, border: "1px solid var(--mantine-color-default-border, #d1d5db)",
              background: "transparent", color: "var(--mantine-color-dimmed, #6b7280)",
              fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >{viewer.name || "Выйти"} ✕</button>
        )}
      </div>
      <div style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
        {currentArtifact ? (
          <ProjectionRendererV2
            artifact={currentArtifact}
            projection={currentProjectionDef}
            world={worldWithRoute}
            exec={wrappedExec}
            execBatch={wrappedExecBatch}
            viewer={viewerObj}
            viewerContext={viewerContext}
            routeParams={current.params}
            navigate={navigate}
            back={back}
            artifacts={artifacts}
            allProjections={allProjections}
          />
        ) : (
          <div style={{ padding: 40, color: "var(--mantine-color-dimmed)", textAlign: "center" }}>
            Проекция "{current?.projectionId}" не найдена или не поддерживается архетипом v2
          </div>
        )}
      </div>
    </>
  );

  const personalStyle = prefsToStyle(prefs);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  if (sections) {
    return (
      <div style={{ display: "flex", height: "100%", minHeight: 0, fontFamily: "system-ui, sans-serif", fontSize: "var(--idf-font-size, 14px)", ...personalStyle }}>
        {/* Mobile hamburger */}
        {isMobile && !sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              position: "fixed", top: 8, left: 8, zIndex: 50,
              width: 36, height: 36, borderRadius: 8,
              border: "1px solid var(--mantine-color-default-border)",
              background: "var(--mantine-color-body)",
              color: "var(--mantine-color-text)",
              fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >☰</button>
        )}
        {/* Sidebar: fixed overlay на mobile, static на desktop */}
        {(!isMobile || sidebarOpen) && (
          <>
            {isMobile && (
              <div
                onClick={() => setSidebarOpen(false)}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }}
              />
            )}
            <div style={isMobile ? { position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 45, width: 280 } : {}}>
              <SectionedSidebar
                sections={sections}
                active={current?.projectionId}
                onSelect={(id) => { onSelectTab(id); if (isMobile) setSidebarOpen(false); }}
                projectionNames={projectionNames}
              />
            </div>
          </>
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          {mainContent}
        </div>
        {prefsOpen && <PrefsPanel prefs={prefs} setPref={setPref} resetPrefs={resetPrefs} onClose={() => setPrefsOpen(false)} />}
      </div>
    );
  }

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
      {mainContent}
      {prefsOpen && <PrefsPanel prefs={prefs} setPref={setPref} resetPrefs={resetPrefs} onClose={() => setPrefsOpen(false)} />}
    </div>
  );
}

function SectionedSidebar({ sections, active, onSelect, projectionNames }) {
  const [collapsed, setCollapsed] = useState({});
  const toggle = (section) => setCollapsed(p => ({ ...p, [section]: !p[section] }));

  return (
    <div style={{
      width: 240, flexShrink: 0, height: "100%",
      background: "var(--mantine-color-default)",
      borderRight: "1px solid var(--mantine-color-default-border)",
      overflow: "auto",
      display: "flex", flexDirection: "column",
    }}>
      {sections.map(sec => (
        <div key={sec.section}>
          <button
            onClick={() => toggle(sec.section)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "10px 14px",
              background: "var(--mantine-color-default-hover)",
              border: "none", borderBottom: "1px solid var(--mantine-color-default-border)",
              cursor: "pointer", fontSize: 13, fontWeight: 700,
              color: "var(--mantine-color-text)",
              fontFamily: "inherit",
            }}
          >
            {sec.icon && <span>{sec.icon}</span>}
            <span style={{ flex: 1, textAlign: "left" }}>{sec.section}</span>
            <span style={{ fontSize: 10, color: "var(--mantine-color-dimmed)" }}>
              {collapsed[sec.section] ? "▸" : "▾"}
            </span>
          </button>
          {!collapsed[sec.section] && (
            <div>
              {sec.items.map(projId => {
                const isActive = active === projId;
                return (
                  <button
                    key={projId}
                    onClick={() => onSelect(projId)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "8px 14px 8px 28px",
                      background: isActive ? "var(--mantine-color-primary-light, rgba(99,102,241,0.08))" : "transparent",
                      border: "none",
                      borderLeft: isActive ? "3px solid var(--mantine-color-primary, #6366f1)" : "3px solid transparent",
                      cursor: "pointer", fontSize: 13,
                      color: isActive ? "var(--mantine-color-primary, #6366f1)" : "var(--mantine-color-text)",
                      fontWeight: isActive ? 600 : 400,
                      fontFamily: "inherit",
                    }}
                  >
                    {projectionNames[projId] || projId}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
