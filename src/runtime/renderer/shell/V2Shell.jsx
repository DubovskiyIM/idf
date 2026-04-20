import { useMemo, useState, useCallback, useEffect } from "react";
import { usePersonalPrefs, prefsToStyle } from "../personal/usePersonalPrefs.js";
import { ProjectionRendererV2, useProjectionRoute, Breadcrumbs, getAdaptedComponent, ViewSwitcher } from "@intent-driven/renderer";
import { crystallizeV2, generateEditProjections, deriveProjections } from "@intent-driven/core";
import BottomTabs from "./BottomTabs.jsx";
import PatternInspector from "./PatternInspector.jsx";
import CrystallizeInspector from "./CrystallizeInspector.jsx";
import MaterializationsViewer from "./MaterializationsViewer.jsx";
import { humanizeProjectionId } from "./humanizeProjectionId.js";

const UI_KIT_OPTIONS = [
  { value: null, label: "авто" },
  { value: "mantine", label: "Mantine" },
  { value: "shadcn", label: "Doodle" },
  { value: "apple", label: "Apple" },
  { value: "antd", label: "AntD" },
];

const ROLE_LABELS = {
  customer: "Заказчик", executor: "Исполнитель",
  agent: "Агент", observer: "Наблюдатель", moderator: "Модератор",
};

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
  useBottomTabs = false,
}) {
  // Derived projections (R1..R8 / R10 / R11 / R11 v2 / R3b / R7b) сливаем с
  // authored на field-level. Если author задекларировал тот же id — его поля
  // переопределяют derived field-by-field, но derived-поля без override
  // сохраняются (включая `derivedBy` witness). Это ключ к композиционной
  // авторингу: автор пишет только override, derivation поставляет остальное.
  const mergedProjections = useMemo(() => {
    const derived = deriveProjections(domain.INTENTS, domain.ONTOLOGY);
    const merged = { ...derived };
    for (const [id, authored] of Object.entries(domain.PROJECTIONS || {})) {
      merged[id] = merged[id] ? { ...merged[id], ...authored } : authored;
    }
    return merged;
  }, [domain]);

  const artifacts = useMemo(
    () => crystallizeV2(domain.INTENTS, mergedProjections, domain.ONTOLOGY, domainId),
    [domain, domainId, mergedProjections]
  );

  // R8 (core ≥ 0.11.0): projection.absorbedBy !== null → катал абсорбирован
  // в hub-detail. Шелл убирает его из root-tabs; попасть туда можно только
  // навигацией из hub.
  const isAbsorbed = (id) => Boolean(artifacts[id]?.absorbedBy);

  const rawRootProjections = domain.ROOT_PROJECTIONS || [];
  const isSectioned = rawRootProjections.length > 0 && typeof rawRootProjections[0] === "object" && rawRootProjections[0].section;
  const rootProjections = isSectioned
    ? rawRootProjections.flatMap(s => s.items).filter(id => !isAbsorbed(id))
    : rawRootProjections.filter(id => !isAbsorbed(id));
  const sections = isSectioned
    ? rawRootProjections.map(s => ({ ...s, items: s.items.filter(id => !isAbsorbed(id)) })).filter(s => s.items.length > 0)
    : null;
  const initial = initialProjection || rootProjections[0] || Object.keys(mergedProjections)[0];

  const {
    current, history, navigate, back, reset, canGoBack,
  } = useProjectionRoute(initial, {});

  const allProjections = useMemo(() => {
    const edits = generateEditProjections(domain.INTENTS, domain.PROJECTIONS, domain.ONTOLOGY);
    return { ...mergedProjections, ...edits };
  }, [domain, mergedProjections]);

  const projectionNames = useMemo(() => {
    const names = {};
    for (const [id, proj] of Object.entries(allProjections)) {
      // Derived projections (R1/R3/R7/R7b/R3b/R11/R11 v2) не имеют
      // proj.name — humanize id по паттернам (my_*_feed → «Мои инсайты»).
      names[id] = proj.name || humanizeProjectionId(id);
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

  // Role-switcher + UI-kit («слой») switcher — dev-toolbar для работы
  // с прототипом. Role-switcher показывается, когда домен определяет
  // session_set_active_role (универсальный паттерн вне зависимости от
  // verified-флагов на viewer'е — нужно для прототипирования). Активная
  // роль живёт в sessionStorage (не в Φ) и транслируется в intent.
  const roleIntent = domain.INTENTS?.session_set_active_role;
  const hasRoleSwitch = Boolean(roleIntent);
  const roleOptions = useMemo(() => {
    const param = roleIntent?.particles?.parameters?.find(p => p.name === "role");
    const opts = Array.isArray(param?.options) && param.options.length > 0
      ? param.options
      : ["customer", "executor"];
    return opts.map(role => ({ role, label: ROLE_LABELS[role] || role }));
  }, [roleIntent]);

  const [activeRole, setActiveRole] = useState(() => {
    if (typeof window === "undefined") return roleOptions[0]?.role || "customer";
    try {
      return sessionStorage.getItem(`idf.activeRole.${domainId}`) || roleOptions[0]?.role || "customer";
    } catch { return roleOptions[0]?.role || "customer"; }
  });
  const handleRoleSwitch = useCallback((role) => {
    setActiveRole(role);
    try { sessionStorage.setItem(`idf.activeRole.${domainId}`, role); } catch {}
    if (exec) {
      exec("session_set_active_role", { role });
    }
  }, [domainId, exec]);

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
  // Prefs-panel теперь в Studio TabStrip (⚙-кнопка главного UI).

  // Toolbar: быстрые dev-переключатели для работы с прототипом.
  //   1) Активная роль — если домен объявил session_set_active_role.
  //   2) UI-kit («слой») — override адаптера. null = domain default.
  // Оба пишут в persistence: роль в sessionStorage (per-domain),
  // uiKit в localStorage через usePersonalPrefs.
  const currentKit = prefs.uiKit ?? null;
  const onChangeKit = useCallback((v) => setPref("uiKit", v), [setPref]);

  const toolbarBar = (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "6px 14px",
      background: "var(--idf-card, #f8f9fa)",
      borderBottom: "1px solid var(--idf-border, #e9ecef)",
      fontSize: 12, flexWrap: "wrap",
    }}>
      {hasRoleSwitch && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--idf-text-muted, #868e96)", fontWeight: 500 }}>Роль:</span>
          <div style={{
            display: "flex", gap: 2, padding: 2,
            borderRadius: 6, background: "var(--idf-surface, #e9ecef)",
          }}>
            {roleOptions.map(({ role, label }) => (
              <button
                key={role}
                type="button"
                onClick={() => handleRoleSwitch(role)}
                style={{
                  border: "none",
                  padding: "4px 12px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  background: activeRole === role ? "var(--idf-primary, #228be6)" : "transparent",
                  color: activeRole === role ? "white" : "var(--idf-text, #495057)",
                }}
              >{label}</button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: hasRoleSwitch ? 0 : "auto" }}>
        <span style={{ color: "var(--idf-text-muted, #868e96)", fontWeight: 500 }}>Слой:</span>
        <div style={{
          display: "flex", gap: 2, padding: 2,
          borderRadius: 6, background: "var(--idf-surface, #e9ecef)",
        }}>
          {UI_KIT_OPTIONS.map(({ value, label }) => (
            <button
              key={value ?? "auto"}
              type="button"
              onClick={() => onChangeKit(value)}
              style={{
                border: "none",
                padding: "4px 10px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                background: currentKit === value ? "var(--idf-primary, #228be6)" : "transparent",
                color: currentKit === value ? "white" : "var(--idf-text, #495057)",
              }}
            >{label}</button>
          ))}
        </div>
      </div>
    </div>
  );

  // Deep-link ?inspect=<patternId> — читается один раз при первом mount.
  // Если параметр присутствует: активируем drawer и seed'им selection
  // в PatternInspector. Не reactive (URL не слушается на изменения), чтобы
  // не конкурировать с пользовательским выбором паттерна через UI.
  const [initialInspectPattern] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      return new URLSearchParams(window.location.search).get("inspect");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (initialInspectPattern && !prefs.patternInspector) {
      setPref("patternInspector", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // one-shot

  // Hotkey Cmd+Shift+P / Ctrl+Shift+P — toggle Pattern Inspector drawer.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPref("patternInspector", !prefs.patternInspector);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs.patternInspector, setPref]);

  // Hotkey Cmd+Shift+C / Ctrl+Shift+C — toggle Crystallize Inspector drawer.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setPref("crystallizeInspector", !prefs.crystallizeInspector);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs.crystallizeInspector, setPref]);

  // Hotkey Cmd+Shift+M / Ctrl+Shift+M — toggle Materializations Viewer drawer.
  // §1 manifesto: одна projection как 4 reader'а (pixels / voice / document / agent).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key && e.key.toLowerCase() === "m") {
        e.preventDefault();
        setPref("materializationsViewer", !prefs.materializationsViewer);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs.materializationsViewer, setPref]);

  // Pattern Bank live preview (§27 authoring-env): override передаётся
  // в ProjectionRendererV2, заменяя currentArtifact на artifactAfter
  // из /api/patterns/explain?previewPatternId=...
  const [artifactOverride, setArtifactOverride] = useState(null);
  const [previewPatternId, setPreviewPatternId] = useState(null);
  const [xrayState, setXrayState] = useState({
    active: false, attribution: null, witnesses: null, domain: null,
  });
  const [pinnedPatternId, setPinnedPatternId] = useState(null);
  useEffect(() => {
    setArtifactOverride(null);
    setPreviewPatternId(null);
    setXrayState({ active: false, attribution: null, witnesses: null, domain: null });
    setPinnedPatternId(null);
  }, [current?.projectionId]);
  const handlePreviewChange = useCallback((artifact, patternId) => {
    setArtifactOverride(artifact);
    setPreviewPatternId(patternId || null);
  }, []);
  const handleXrayChange = useCallback((next) => {
    setXrayState(next || { active: false, attribution: null, witnesses: null, domain: null });
  }, []);

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

  // v0.13 Multi-archetype views — активная view per projection.
  // Источник: URL `?view=<id>` → state → artifact.defaultView.
  const [activeViewByProj, setActiveViewByProj] = useState(() => {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    return v && current?.projectionId ? { [current.projectionId]: v } : {};
  });
  const currentActiveView = currentArtifact?.views
    ? (activeViewByProj[current.projectionId] || currentArtifact.defaultView)
    : null;

  useEffect(() => {
    if (typeof window === "undefined" || !current) return;
    const params = new URLSearchParams(window.location.search);
    if (currentActiveView && currentArtifact?.defaultView && currentActiveView !== currentArtifact.defaultView) {
      params.set("view", currentActiveView);
    } else {
      params.delete("view");
    }
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [current, currentActiveView, currentArtifact]);

  const onChangeView = useCallback((projId, viewId) => {
    setActiveViewByProj(prev => ({ ...prev, [projId]: viewId }));
  }, []);

  const isOnRoot = rootProjections.includes(current?.projectionId);

  // Адаптированная реализация root-табов (Mantine Tabs через адаптер).
  // Если адаптер не предоставляет shell.tabs — fallback на inline-версию.
  const AdaptedTabs = getAdaptedComponent("shell", "tabs");
  // shell.sidebar — опциональная adapter-surface. Если адаптер реализует
  // свой sidebar — делегируем ему (у каждого UI-kit может быть своя
  // визуальная логика). Иначе fallback на inline SectionedSidebar.
  const AdaptedSidebar = getAdaptedComponent("shell", "sidebar");
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
              padding: "4px 10px", borderRadius: 6, border: "1px solid var(--idf-border, #d1d5db)",
              background: isEnriched ? "var(--idf-accent-light, #ede9fe)" : "transparent",
              color: "var(--idf-text, #374151)", fontSize: 11, cursor: enriching ? "wait" : "pointer",
              opacity: enriching ? 0.6 : 1, whiteSpace: "nowrap",
            }}
          >
            {enriching ? "⏳ Обогащение..." : isEnriched ? "✨ Обогащён" : "✨ LLM"}
          </button>
        )}
        {/* Кнопка ⚙ перенесена в Studio TabStrip — единая точка настроек
            workspace'а на уровне Studio App. Внутри прототипа больше не
            дублируется. */}
      </div>
      {currentArtifact?.viewSwitcher && currentArtifact.views && currentArtifact.views.length > 1 && (
        <div style={{
          padding: "8px 16px",
          borderBottom: "1px solid var(--idf-border, #e5e7eb)",
          background: "var(--idf-bg-subtle, #fafafa)",
        }}>
          <ViewSwitcher
            views={currentArtifact.viewSwitcher.views}
            activeId={currentActiveView}
            onChange={(id) => onChangeView(current.projectionId, id)}
          />
        </div>
      )}
      <div style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
        {currentArtifact ? (
          <ProjectionRendererV2
            artifact={currentArtifact}
            artifactOverride={artifactOverride}
            previewPatternId={previewPatternId}
            xrayMode={xrayState.active}
            slotAttribution={xrayState.attribution}
            patternWitnesses={xrayState.witnesses}
            xrayDomain={xrayState.domain}
            onExpandPattern={setPinnedPatternId}
            activeView={currentActiveView}
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
          <div style={{ padding: 40, color: "var(--idf-text-muted)", textAlign: "center" }}>
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
    // Mobile + BottomTabs: контент сверху, bottom tabs снизу
    if (isMobile && useBottomTabs) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", height: "100%", minHeight: 0,
          fontFamily: "var(--idf-font, -apple-system, system-ui, sans-serif)",
          fontSize: "var(--idf-font-size, 14px)",
          ...personalStyle,
        }}>
          {toolbarBar}
          <div style={{ flex: 1, overflow: "auto", padding: 0, paddingBottom: 120 }}>
            {mainContent}
          </div>
          <BottomTabs
            sections={sections}
            active={current?.projectionId}
            onSelect={(id) => onSelectTab(id)}
            projectionNames={projectionNames}
          />
          {prefs.patternInspector && (
            <PatternInspector
              domain={domainId}
              projectionId={current?.projectionId}
              onClose={() => setPref("patternInspector", false)}
              onPreviewChange={handlePreviewChange}
              onXrayChange={handleXrayChange}
              initialSelectedPatternId={pinnedPatternId || initialInspectPattern}
            />
          )}
          {prefs.crystallizeInspector && (
            <CrystallizeInspector
              artifact={currentArtifact}
              onClose={() => setPref("crystallizeInspector", false)}
            />
          )}
          {prefs.materializationsViewer && (
            <MaterializationsViewer
              domainId={domainId}
              projectionId={current?.projectionId}
              artifact={currentArtifact}
              role={activeRole || "owner"}
              onClose={() => setPref("materializationsViewer", false)}
            />
          )}
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, fontFamily: "system-ui, sans-serif", fontSize: "var(--idf-font-size, 14px)", ...personalStyle }}>
        {toolbarBar}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Mobile hamburger */}
        {isMobile && !sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              position: "fixed", top: 8, left: 8, zIndex: 50,
              width: 36, height: 36, borderRadius: 8,
              border: "1px solid var(--idf-border)",
              background: "var(--idf-surface)",
              color: "var(--idf-text)",
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
              {AdaptedSidebar ? (
                <AdaptedSidebar
                  sections={sections}
                  active={current?.projectionId}
                  onSelect={(id) => { onSelectTab(id); if (isMobile) setSidebarOpen(false); }}
                  projectionNames={projectionNames}
                />
              ) : (
                <SectionedSidebar
                  sections={sections}
                  active={current?.projectionId}
                  onSelect={(id) => { onSelectTab(id); if (isMobile) setSidebarOpen(false); }}
                  projectionNames={projectionNames}
                />
              )}
            </div>
          </>
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          {mainContent}
        </div>
        {prefs.patternInspector && (
          <PatternInspector
            domain={domainId}
            projectionId={current?.projectionId}
            onClose={() => setPref("patternInspector", false)}
            onPreviewChange={handlePreviewChange}
            onXrayChange={handleXrayChange}
            initialSelectedPatternId={pinnedPatternId}
          />
        )}
        {prefs.crystallizeInspector && (
          <CrystallizeInspector
            artifact={currentArtifact}
            onClose={() => setPref("crystallizeInspector", false)}
          />
        )}
        {prefs.materializationsViewer && (
          <MaterializationsViewer
            domainId={domainId}
            projectionId={current?.projectionId}
            artifact={currentArtifact}
            role={activeRole || "owner"}
            onClose={() => setPref("materializationsViewer", false)}
          />
        )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", minHeight: 0,
      fontFamily: "system-ui, sans-serif",
    }}>
      {toolbarBar}
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
            background: "var(--idf-card)", borderBottom: "1px solid var(--idf-border)",
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
                      borderBottom: isActive ? "2px solid var(--idf-primary, #6366f1)" : "2px solid transparent",
                      color: isActive ? "var(--idf-primary, #6366f1)" : "var(--idf-text-muted)",
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
      {prefs.patternInspector && (
        <PatternInspector
          domain={domainId}
          projectionId={current?.projectionId}
          onClose={() => setPref("patternInspector", false)}
          onPreviewChange={handlePreviewChange}
          onXrayChange={handleXrayChange}
          initialSelectedPatternId={pinnedPatternId}
        />
      )}
      {prefs.crystallizeInspector && (
        <CrystallizeInspector
          artifact={currentArtifact}
          onClose={() => setPref("crystallizeInspector", false)}
        />
      )}
      {prefs.materializationsViewer && (
        <MaterializationsViewer
          domainId={domainId}
          projectionId={current?.projectionId}
          artifact={currentArtifact}
          role={activeRole || "owner"}
          onClose={() => setPref("materializationsViewer", false)}
        />
      )}
    </div>
  );
}

function SectionedSidebar({ sections, active, onSelect, projectionNames }) {
  const [collapsed, setCollapsed] = useState({});
  const toggle = (section) => setCollapsed(p => ({ ...p, [section]: !p[section] }));

  return (
    <div style={{
      width: 240, flexShrink: 0, height: "100%",
      background: "var(--idf-card)",
      borderRight: "1px solid var(--idf-border)",
      overflow: "auto",
      display: "flex", flexDirection: "column",
      fontFamily: "var(--idf-font, inherit)",
    }}>
      {sections.map(sec => (
        <div key={sec.section}>
          <button
            onClick={() => toggle(sec.section)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "10px 14px",
              background: "var(--idf-hover)",
              border: "none", borderBottom: "1px solid var(--idf-border)",
              cursor: "pointer", fontSize: 13, fontWeight: 700,
              color: "var(--idf-text)",
              fontFamily: "inherit",
            }}
          >
            {sec.icon && <span>{sec.icon}</span>}
            <span style={{ flex: 1, textAlign: "left" }}>{sec.section}</span>
            <span style={{ fontSize: 10, color: "var(--idf-text-muted)" }}>
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
                      background: isActive ? "var(--idf-primary-light, rgba(99,102,241,0.08))" : "transparent",
                      border: "none",
                      borderLeft: isActive ? "3px solid var(--idf-primary, #6366f1)" : "3px solid transparent",
                      cursor: "pointer", fontSize: 13,
                      color: isActive ? "var(--idf-primary, #6366f1)" : "var(--idf-text)",
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
