/**
 * DomainRuntime — компактный runtime-компонент доменного прототипа.
 *
 * Рендерит V2Shell (crystallize_v2 + ProjectionRendererV2) для любого домена
 * из src/domains/*. Hardcoded-набор + динамический import.meta.glob для
 * Studio-сгенерированных доменов.
 *
 * Используется:
 *   - src/studio/App.jsx — «Прототип»-tab, embedded inside Studio canvas
 *   - src/prototype.jsx — legacy full-page wrapper (будет удалён после
 *     полной миграции в Studio)
 *
 * Props:
 *   - domainId: string
 *   - embedded?: boolean — если true, не рендерим top-header (наружный
 *     контейнер обычно даёт свой chrome)
 *   - initialProjection?: string — deep-link ?projection=X
 */
import { useState, useEffect, useMemo } from "react";
import { useMantineColorScheme, MantineProvider } from "@mantine/core";
import { useEngine } from "@intent-driven/core";
import { registerUIAdapter, registerCanvas } from "@intent-driven/renderer";
import { mantineAdapter } from "@intent-driven/adapter-mantine";
import { shadcnAdapter } from "@intent-driven/adapter-shadcn";
import { appleAdapter } from "@intent-driven/adapter-apple";
import { antdAdapter } from "@intent-driven/adapter-antd";
import { ConfigProvider as AntConfigProvider, theme as antTheme } from "antd";
import ruRU from "antd/locale/ru_RU";

import * as bookingDomain from "../domains/booking/domain.js";
import * as planningDomain from "../domains/planning/domain.js";
import * as workflowDomain from "../domains/workflow/domain.js";
import * as messengerDomain from "../domains/messenger/domain.js";
import * as salesDomain from "../domains/sales/domain.js";
import * as lifequestDomain from "../domains/lifequest/domain.js";
import * as reflectDomain from "../domains/reflect/domain.js";
import * as investDomain from "../domains/invest/domain.js";
import * as deliveryDomain from "../domains/delivery/domain.js";

import V2Shell from "./renderer/shell/V2Shell.jsx";
import { useAuth } from "./renderer/auth/useAuth.js";
import AuthGate from "./renderer/auth/AuthGate.jsx";
import { usePersonalPrefs } from "./renderer/personal/usePersonalPrefs.js";

// Registry: hardcoded + dynamic. V2Shell не нуждается в .UI.jsx — рендер
// идёт через crystallize_v2, поэтому Studio-generated без manual UI работают.
const HARDCODED_DOMAINS = {
  booking: bookingDomain,
  planning: planningDomain,
  workflow: workflowDomain,
  messenger: messengerDomain,
  sales: salesDomain,
  lifequest: lifequestDomain,
  reflect: reflectDomain,
  invest: investDomain,
  delivery: deliveryDomain,
};
const DYNAMIC_LOADERS = import.meta.glob("../domains/*/domain.js");

// Register lifequest custom canvases: импортируем один раз на уровне модуля.
// Без этого lifequest проекции `canvas` не резолвятся.
import TodayCanvas from "../domains/lifequest/canvas/TodayCanvas.jsx";
import WeekProgressCanvas from "../domains/lifequest/canvas/WeekProgressCanvas.jsx";
import RadarChart from "../domains/lifequest/canvas/RadarChart.jsx";
import CalendarCanvas from "../domains/lifequest/canvas/CalendarCanvas.jsx";
import VisionBoardCanvas from "../domains/lifequest/canvas/VisionBoardCanvas.jsx";
import PointACanvas from "../domains/lifequest/canvas/PointACanvas.jsx";
import AllocationPieCanvas from "../domains/invest/canvas/AllocationPieCanvas.jsx";
import MarketLineCanvas from "../domains/invest/canvas/MarketLineCanvas.jsx";
import RegulatorReportCanvas from "../domains/invest/canvas/RegulatorReportCanvas.jsx";
import AdvisorReviewCanvas from "../domains/invest/canvas/AdvisorReviewCanvas.jsx";
import DeliveryMapCanvas from "../domains/delivery/canvas/DeliveryMapCanvas.jsx";

registerCanvas("today", TodayCanvas);
registerCanvas("week_progress", WeekProgressCanvas);
registerCanvas("life_radar", RadarChart);
registerCanvas("calendar", CalendarCanvas);
registerCanvas("vision_board", VisionBoardCanvas);
registerCanvas("point_a", PointACanvas);
registerCanvas("allocation_pie", AllocationPieCanvas);
registerCanvas("market_line", MarketLineCanvas);
registerCanvas("regulator_report", RegulatorReportCanvas);
registerCanvas("advisor_review", AdvisorReviewCanvas);
registerCanvas("order_tracker", DeliveryMapCanvas);
registerCanvas("active_delivery", DeliveryMapCanvas);
registerCanvas("dispatcher_map", DeliveryMapCanvas);

const UI_KITS = { mantine: mantineAdapter, shadcn: shadcnAdapter, apple: appleAdapter, antd: antdAdapter };
const DOMAIN_DEFAULT_KITS = { lifequest: appleAdapter, reflect: appleAdapter, invest: antdAdapter };

const MANTINE_THEMES = {
  antd: {
    primaryColor: "blue",
    colors: { blue: ["#e6f4ff","#bae0ff","#91caff","#69b1ff","#4096ff","#1677ff","#0958d9","#003eb3","#002c8c","#001d66"] },
    defaultRadius: "sm",
  },
  shadcn: {
    primaryColor: "green",
    colors: { green: ["#f0fdf4","#dcfce7","#bbf7d0","#86efac","#4ade80","#4a7c59","#3d6b4a","#2d5238","#1e3a28","#0f2117"] },
    defaultRadius: "lg",
    fontFamily: "'Caveat', 'Comic Sans MS', cursive",
  },
  apple: {
    primaryColor: "blue",
    colors: { blue: ["#eff6ff","#dbeafe","#bfdbfe","#93c5fd","#60a5fa","#007aff","#0062cc","#004a99","#003166","#001933"] },
    defaultRadius: "lg",
    fontFamily: "-apple-system, 'SF Pro Display', 'Inter', system-ui, sans-serif",
  },
};

const EMPTY_DOMAIN = {
  ONTOLOGY: { entities: {}, roles: {} },
  INTENTS: {},
  PROJECTIONS: {},
  ROOT_PROJECTIONS: [],
  DOMAIN_ID: "__loading__",
  DOMAIN_NAME: "Загрузка…",
  getSeedEffects: () => [],
  buildEffects: () => null,
  describeEffect: () => "",
  signalForIntent: () => null,
};

function CenterMessage({ icon, title, body, children }) {
  return (
    <div style={{
      height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0f172a", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif",
      padding: 24,
    }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        {icon && <div style={{ fontSize: 40, marginBottom: 14 }}>{icon}</div>}
        {title && <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</div>}
        {body && <div style={{ fontSize: 13, lineHeight: 1.6, color: "#94a3b8", marginBottom: 16 }}>{body}</div>}
        {children}
      </div>
    </div>
  );
}

export default function DomainRuntime({ domainId, embedded = false, initialProjection }) {
  const [dynamicDomain, setDynamicDomain] = useState(null);
  const [dynamicError, setDynamicError] = useState(null);
  const hardcoded = HARDCODED_DOMAINS[domainId];
  const isDynamic = !hardcoded;

  useEffect(() => {
    if (hardcoded) { setDynamicDomain(null); setDynamicError(null); return; }
    const key = `../domains/${domainId}/domain.js`;
    const loader = DYNAMIC_LOADERS[key];
    if (!loader) {
      setDynamicError(`Домен «${domainId}» не найден на диске`);
      setDynamicDomain(null);
      return;
    }
    setDynamicError(null);
    let cancelled = false;
    loader().then((mod) => {
      if (cancelled) return;
      const projections = mod.PROJECTIONS || {};
      // Studio-generated domain skeleton (domainCreator.js) экспортирует
      // только INTENTS/ONTOLOGY/PROJECTIONS — runtime-ф-ции отсутствуют.
      // Движок падает на exec() без buildEffects. Подставляем no-op
      // fallback'ы: engine-генерик применит intent.particles.effects сам.
      setDynamicDomain({
        ...mod,
        ROOT_PROJECTIONS: mod.ROOT_PROJECTIONS || Object.keys(projections),
        DOMAIN_ID: mod.DOMAIN_ID || domainId,
        DOMAIN_NAME: mod.DOMAIN_NAME || domainId,
        buildEffects: mod.buildEffects || (() => null),
        describeEffect: mod.describeEffect || ((intentId) => intentId),
        signalForIntent: mod.signalForIntent || (() => null),
        getSeedEffects: mod.getSeedEffects || (() => []),
      });
    }).catch((e) => { if (!cancelled) setDynamicError(e.message); });
    return () => { cancelled = true; };
  }, [domainId, hardcoded]);

  const domain = hardcoded || dynamicDomain || EMPTY_DOMAIN;
  const isLoadingDomain = isDynamic && !dynamicDomain && !dynamicError;

  const { prefs: uiPrefs } = usePersonalPrefs();
  const adapter = UI_KITS[uiPrefs?.uiKit] || DOMAIN_DEFAULT_KITS[domainId] || mantineAdapter;
  registerUIAdapter(adapter);
  const mantineThemeOverride = MANTINE_THEMES[adapter.name] || { primaryColor: "indigo" };

  const auth = useAuth();
  const realViewer = auth.currentUser
    ? { id: auth.currentUser.id, name: auth.currentUser.name, email: auth.currentUser.email }
    : null;

  const engine = useEngine(domain);
  const { world, exec } = engine;

  // Sync ontology/intents/seed на сервер при смене домена.
  useEffect(() => {
    if (!domain || domain.DOMAIN_ID === "__loading__") return;
    const did = domain.DOMAIN_ID;
    fetch(`/api/typemap?domain=${did}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(domain.ONTOLOGY),
    }).catch(() => {});
    fetch(`/api/intents?domain=${did}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(domain.INTENTS),
    }).catch(() => {});
    const seed = domain.getSeedEffects?.() || [];
    if (seed.length > 0) {
      fetch("/api/effects").then((r) => r.json()).then((existing) => {
        const existingIds = new Set(
          existing.filter((e) => e.intent_id === "_seed").map((e) => e.context?.id).filter(Boolean)
        );
        const missing = seed.filter((e) => e.context?.id && !existingIds.has(e.context.id));
        if (missing.length > 0) {
          return fetch("/api/effects/seed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(missing),
          });
        }
      }).catch(() => {});
    }
  }, [domain]);

  const content = useMemo(() => {
    if (isLoadingDomain) return <CenterMessage icon="⏳" title={`Загружаю «${domainId}»…`} />;
    if (dynamicError) {
      return (
        <CenterMessage icon="📐" title={`Домен «${domainId}» не найден`} body={dynamicError}>
          <a href="/studio.html" style={{ padding: "8px 16px", background: "#6366f1", color: "white", borderRadius: 6, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            Открыть Studio →
          </a>
        </CenterMessage>
      );
    }
    const hasProjections = Object.keys(domain.PROJECTIONS || {}).length > 0;
    if (!hasProjections) {
      return (
        <CenterMessage
          icon="✎"
          title="Проекции ещё не сгенерированы"
          body={`Claude пока не написал projections для «${domainId}». Открой ⌘K chat в Graph-табе и попроси сгенерировать.`}
        />
      );
    }
    return (
      <AuthGate
        currentUser={auth.currentUser}
        doAuth={auth.doAuth}
        authError={auth.authError}
        isLoading={auth.isLoading}
        title={domain.DOMAIN_NAME || domainId}
      >
        <V2Shell
          key={`${domainId}-${adapter.name}`}
          domain={domain}
          domainId={domainId}
          world={world}
          exec={exec}
          execBatch={engine.execBatch}
          viewer={realViewer || { id: "self", name: "Я" }}
          onLogout={auth.logout}
          initialProjection={initialProjection && domain.PROJECTIONS?.[initialProjection] ? initialProjection : undefined}
        />
      </AuthGate>
    );
  }, [
    isLoadingDomain, dynamicError, domain, domainId, adapter.name, world, exec,
    engine.execBatch, realViewer, auth.currentUser, auth.authError, auth.isLoading,
    initialProjection, auth.doAuth, auth.logout,
  ]);

  const wrapped = (
    <MantineProvider theme={mantineThemeOverride} inherit>
      <div
        data-adapter={adapter.name || "mantine"}
        style={{
          height: "100%", width: "100%",
          display: "flex", flexDirection: "column",
          background: embedded ? "var(--mantine-color-body, #0f172a)" : "#0f172a",
          color: "#e2e8f0",
          fontFamily: "Inter, -apple-system, system-ui, sans-serif",
        }}
      >
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          {content}
        </div>
      </div>
    </MantineProvider>
  );

  return adapter === antdAdapter
    ? <AntConfigProvider locale={ruRU} theme={{ algorithm: antTheme.defaultAlgorithm, token: { colorPrimary: "#1677ff", borderRadius: 8 } }}>{wrapped}</AntConfigProvider>
    : wrapped;
}
