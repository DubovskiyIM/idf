/**
 * Standalone-режим: чистое приложение без IDF-панелей.
 * Доступно по /{domainName} — для конечных пользователей.
 *
 * JWT-аутентификация: все домены (включая booking/planning/workflow) теперь
 * требуют login через shared useAuth hook + AuthGate. Viewer — реальный
 * пользователь из auth_users, не hardcoded "client".
 */
import { useState, useEffect, useMemo } from "react";
import { useEngine, deriveProjections } from "@intent-driven/core";
import { useAuth } from "./runtime/renderer/auth/useAuth.js";
import AuthGate from "./runtime/renderer/auth/AuthGate.jsx";

import * as bookingDomain from "./domains/booking/domain.js";
import * as planningDomain from "./domains/planning/domain.js";
import * as workflowDomain from "./domains/workflow/domain.js";
import * as messengerDomain from "./domains/messenger/domain.js";
import * as salesDomain from "./domains/sales/domain.js";
import * as lifequestDomain from "./domains/lifequest/domain.js";
import * as reflectDomain from "./domains/reflect/domain.js";
import * as investDomain from "./domains/invest/domain.js";
import * as gravitinoDomain from "./domains/gravitino/domain.js";
import * as keycloakDomain from "./domains/keycloak/domain.js";
import * as argocdDomain from "./domains/argocd/domain.js";
import * as automationDomain from "./domains/automation/domain.js";
import * as notionDomain from "./domains/notion/domain.js";
import * as metaDomain from "./domains/meta/domain.js";

import BookingUI from "./domains/booking/ManualUI.jsx";
import PlanningUI from "./domains/planning/ManualUI.jsx";
import WorkflowUI from "./domains/workflow/ManualUI.jsx";
import MessengerUI from "./domains/messenger/ManualUI.jsx";
import MessengerV2UI from "./domains/messenger/V2UI.jsx";
import V2Shell from "./runtime/renderer/shell/V2Shell.jsx";
import { registerUIAdapter } from "@intent-driven/renderer";
import { mantineAdapter } from "@intent-driven/adapter-mantine";
import { shadcnAdapter } from "@intent-driven/adapter-shadcn";
import { appleAdapter } from "@intent-driven/adapter-apple";
import { antdAdapter } from "@intent-driven/adapter-antd";
import { ConfigProvider as AntConfigProvider, theme as antTheme } from "antd";
import ruRU from "antd/locale/ru_RU";
import { usePersonalPrefs } from "./runtime/renderer/personal/usePersonalPrefs.js";

const UI_KITS = { mantine: mantineAdapter, shadcn: shadcnAdapter, apple: appleAdapter, antd: antdAdapter };
import { registerCanvas } from "@intent-driven/renderer";
import { registerLifequestCanvases } from "./domains/lifequest/registerCanvases.jsx";
registerLifequestCanvases();

// Reflect canvas-компоненты
import MoodMeterCanvas from "./domains/reflect/canvas/MoodMeterCanvas.jsx";
import TimelineCanvas from "./domains/reflect/canvas/TimelineCanvas.jsx";
import CalendarHeatmapCanvas from "./domains/reflect/canvas/CalendarHeatmapCanvas.jsx";
import MoodTrendsCanvas from "./domains/reflect/canvas/MoodTrendsCanvas.jsx";
import ActivityCorrelationCanvas from "./domains/reflect/canvas/ActivityCorrelationCanvas.jsx";
import MoodMeterClusterCanvas from "./domains/reflect/canvas/MoodMeterClusterCanvas.jsx";

registerCanvas("checkin", MoodMeterCanvas);
registerCanvas("timeline", TimelineCanvas);
registerCanvas("calendar_heatmap", CalendarHeatmapCanvas);
registerCanvas("mood_trends", MoodTrendsCanvas);
registerCanvas("activity_correlation", ActivityCorrelationCanvas);
registerCanvas("mood_meter_cluster", MoodMeterClusterCanvas);

// Invest canvas-компоненты (ключ = projectionId)
import AllocationPieCanvas from "./domains/invest/canvas/AllocationPieCanvas.jsx";
import MarketLineCanvas from "./domains/invest/canvas/MarketLineCanvas.jsx";
import AdvisorReviewCanvas from "./domains/invest/canvas/AdvisorReviewCanvas.jsx";
import RegulatorReportCanvas from "./domains/invest/canvas/RegulatorReportCanvas.jsx";
registerCanvas("allocation_breakdown", AllocationPieCanvas);
registerCanvas("market_trends", MarketLineCanvas);
registerCanvas("advisor_client_dashboard", AdvisorReviewCanvas);
registerCanvas("regulator_report", RegulatorReportCanvas);

// Notion canvas (block-editor через adapter capability §12.10)
import NotionBlockCanvas from "./domains/notion/canvas/BlockCanvas.jsx";
registerCanvas("block_canvas", NotionBlockCanvas);

// Meta-домен canvas (Studio shell)
import { registerMetaCanvases } from "./domains/meta/canvas/registerCanvases.jsx";
registerMetaCanvases();

// Домены с переключением адаптера
const DOMAIN_ADAPTERS = {
  lifequest: appleAdapter,
  reflect: appleAdapter,
  invest: antdAdapter,
  gravitino: antdAdapter,
  keycloak: antdAdapter,
  argocd: antdAdapter,
  notion: antdAdapter,
  meta: antdAdapter,
};

function makeV2UI(domainId) {
  const useBottomTabs = domainId === "lifequest";
  return function V2Standalone({ world, exec, execBatch, viewer, onLogout }) {
    const domain = DOMAINS_RAW[domainId];
    return (
      <V2Shell
        domain={domain}
        domainId={domainId}
        world={world}
        exec={exec}
        execBatch={execBatch}
        viewer={viewer}
        useBottomTabs={useBottomTabs}
        onLogout={onLogout}
      />
    );
  };
}

// Экспортируется как single-source-of-truth для main.jsx и vite.config.js
// (динамическая регистрация роутов вместо ручного списка). §13.10.
export const DOMAINS_RAW = {
  booking: bookingDomain,
  planning: planningDomain,
  workflow: workflowDomain,
  messenger: messengerDomain,
  sales: salesDomain,
  lifequest: lifequestDomain,
  reflect: reflectDomain,
  invest: investDomain,
  gravitino: gravitinoDomain,
  keycloak: keycloakDomain,
  argocd: argocdDomain,
  automation: automationDomain,
  notion: notionDomain,
  meta: metaDomain,
};

const DOMAIN_TITLES = {
  booking: "📅 Бронирование",
  "booking-v2": "📅 Бронирование",
  planning: "📊 Планирование",
  "planning-v2": "📊 Планирование",
  workflow: "⚡ Workflow",
  messenger: "💬 Мессенджер",
  "messenger-v2": "💬 Мессенджер",
  sales: "🛒 Sales",
  lifequest: "📓 LifeQuest",
  reflect: "🌀 Reflect",
  invest: "💼 Invest",
  gravitino: "🗂 Gravitino",
  keycloak: "🔐 Keycloak",
  argocd: "🚀 ArgoCD",
  automation: "⚙️ Automation",
  notion: "📝 Notion",
  meta: "🪞 Meta (IDF-on-IDF)",
};

const DOMAINS = {
  booking: { ...bookingDomain, UI: BookingUI },
  "booking-v2": { ...bookingDomain, UI: makeV2UI("booking") },
  planning: { ...planningDomain, UI: PlanningUI },
  "planning-v2": { ...planningDomain, UI: makeV2UI("planning") },
  workflow: { ...workflowDomain, UI: WorkflowUI },
  messenger: { ...messengerDomain, UI: MessengerUI },
  "messenger-v2": { ...messengerDomain, UI: MessengerV2UI },
  sales: { ...salesDomain, UI: makeV2UI("sales") },
  lifequest: { ...lifequestDomain, UI: makeV2UI("lifequest") },
  reflect: { ...reflectDomain, UI: makeV2UI("reflect") },
  invest: { ...investDomain, UI: makeV2UI("invest") },
  gravitino: { ...gravitinoDomain, UI: makeV2UI("gravitino") },
  keycloak: { ...keycloakDomain, UI: makeV2UI("keycloak") },
  argocd: { ...argocdDomain, UI: makeV2UI("argocd") },
  automation: { ...automationDomain, UI: makeV2UI("automation") },
  notion: { ...notionDomain, UI: makeV2UI("notion") },
  meta: { ...metaDomain, UI: makeV2UI("meta") },
};

export default function StandaloneApp({ domainId }) {
  const domain = DOMAINS[domainId];
  if (!domain) return <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui" }}>Домен "{domainId}" не найден</div>;

  // Переключение UI-адаптера: prefs.uiKit (override) → DOMAIN_ADAPTERS → mantine
  const { prefs: prefsForKit } = usePersonalPrefs();
  const adapter = UI_KITS[prefsForKit?.uiKit]
    || DOMAIN_ADAPTERS[domainId]
    || mantineAdapter;
  registerUIAdapter(adapter);

  // Messenger v2 имеет собственный auth flow внутри V2UI — пропускаем shared
  const isMessengerV2 = domainId === "messenger-v2";

  const auth = useAuth();
  const { currentUser, doAuth, authError, isLoading, logout } = auth;

  const viewer = useMemo(() => {
    if (isMessengerV2) return null; // messenger управляет viewer сам
    if (!currentUser) return { id: "self", name: "Я" };
    return { id: currentUser.id, name: currentUser.name, email: currentUser.email };
  }, [currentUser, isMessengerV2]);

  const engine = useEngine(domain);
  const { world: rawWorld, worldForIntent, drafts, effects, signals, exec, execBatch,
    overlay, overlayEntityIds, startInvestigation, commitInvestigation, cancelInvestigation } = engine;

  // Users приходят из Φ через _user_register эффекты.
  // Гарантия currentUser — на случай race condition (auth ответил, effects ещё нет).
  const world = useMemo(() => {
    if (isMessengerV2) return rawWorld;
    const users = rawWorld.users || [];
    if (currentUser && !users.find(u => u.id === currentUser.id)) {
      return { ...rawWorld, users: [...users, { id: currentUser.id, name: currentUser.name, email: currentUser.email || "" }] };
    }
    return rawWorld;
  }, [rawWorld, currentUser, isMessengerV2]);

  useEffect(() => {
    fetch(`/api/typemap?domain=${domainId.replace("-v2", "")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // projections публикуются вместе с ontology — их читает
      // documentMaterializer (/api/document/:domain/:projection, §26.3).
      // derived (R-правила) мёрджатся с authored, authored имеют приоритет —
      // тот же подход, что в V2Shell::mergedProjections.
      body: JSON.stringify({
        ...domain.ONTOLOGY,
        projections: (() => {
          const derived = deriveProjections(domain.INTENTS, domain.ONTOLOGY);
          const merged = { ...derived, ...(domain.PROJECTIONS || {}) };
          return Object.fromEntries(
            Object.entries(merged).map(([id, p]) => [id, { id, ...p }])
          );
        })(),
      }),
    }).catch(() => {});
    fetch(`/api/intents?domain=${domainId.replace("-v2", "")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(domain.INTENTS),
    }).catch(() => {});
  }, [domain, domainId]);

  useEffect(() => {
    const seedEffects = domain.getSeedEffects();
    if (seedEffects.length > 0) {
      fetch("/api/effects")
        .then(r => r.json())
        .then(existing => {
          const existingIds = new Set(existing.map(e => e.id));
          const missing = seedEffects.filter(e => !existingIds.has(e.id));
          if (missing.length > 0) {
            fetch("/api/effects/seed", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(missing),
            });
          }
        }).catch(() => {});
    }
  }, [domain]);

  const isV2 = domainId.endsWith("-v2");
  const isFullWidth = domainId === "messenger" || isV2;

  // Messenger v2 manages own auth — render directly
  if (isMessengerV2) {
    return (
      <div style={{ height: "100vh", background: "var(--mantine-color-body)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <domain.UI world={world} exec={exec} execBatch={execBatch} />
        </div>
      </div>
    );
  }

  // All other domains: shared auth gate
  const isLifequest = domainId === "lifequest";
  const isDoodleAdapter = adapter === shadcnAdapter;
  const lifequestBg = "linear-gradient(135deg, #fdf2e9 0%, #fef3c7 25%, #fce7f3 50%, #e0f2fe 75%, #dcfce7 100%)";
  // key — заставляет React пересоздать дерево при смене UI-kit,
  // чтобы все компоненты (включая memo'д) подхватили новый адаптер.
  const adapterKey = `kit-${prefsForKit?.uiKit || domainId}`;
  // Mantine-mode override doodle CSS variables на нейтральные tokens —
  // чтобы lifequest canvas (TodayCanvas, RadarChart и др.) выглядели
  // в Mantine-стиле, а не в захардкоженной doodle-палитре.
  const mantineOverride = !isDoodleAdapter ? {
    "--color-doodle-bg": "var(--mantine-color-body, #fff)",
    "--color-doodle-ink": "var(--mantine-color-text, #1a1a2e)",
    "--color-doodle-ink-light": "var(--mantine-color-dimmed, #6b7280)",
    "--color-doodle-border": "var(--mantine-color-default-border, #e5e7eb)",
    "--color-doodle-border-soft": "var(--mantine-color-default-border, #e5e7eb)",
    "--color-doodle-highlight": "var(--mantine-color-default-hover, #f3f4f6)",
    "--color-doodle-accent": "var(--mantine-color-indigo-6, #4f46e5)",
    "--color-doodle-warn": "var(--mantine-color-red-6, #ef4444)",
    "--color-doodle-gold": "var(--mantine-color-yellow-7, #ca8a04)",
    "--font-doodle": "system-ui, sans-serif",
    "--radius-doodle": "6px",
  } : {};
  const content = (
    <div key={adapterKey} style={{
      height: "100vh",
      background: isDoodleAdapter ? lifequestBg : "var(--mantine-color-body)",
      overflow: isV2 ? "hidden" : "auto",
      display: "flex", flexDirection: "column",
      ...mantineOverride,
    }}>
      {/* Top bar with user info — скрыт для lifequest (логаут в PrefsPanel) */}
      {currentUser && !isLifequest && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 16px",
          background: "var(--mantine-color-default)",
          borderBottom: "1px solid var(--mantine-color-default-border)",
          fontSize: 13, color: "var(--mantine-color-text)",
        }}>
          <span style={{ fontWeight: 600 }}>{currentUser.name}</span>
          <span style={{ color: "var(--mantine-color-dimmed)", fontSize: 12 }}>{currentUser.email}</span>
          <div style={{ flex: 1 }} />
          <button
            onClick={logout}
            style={{
              padding: "4px 12px", borderRadius: 4, fontSize: 12,
              border: "1px solid var(--mantine-color-default-border)",
              background: "transparent", cursor: "pointer",
              color: "var(--mantine-color-dimmed)",
            }}
          >Выйти</button>
        </div>
      )}
      <div style={{
        flex: isV2 ? 1 : "none",
        maxWidth: isFullWidth ? "100%" : 800,
        margin: "0 auto",
        padding: isFullWidth ? 0 : 24,
        width: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}>
        <domain.UI
          world={world} worldForIntent={worldForIntent} drafts={drafts}
          exec={exec} execBatch={execBatch} effects={effects}
          viewer={viewer} layer="canonical"
          overlay={overlay} overlayEntityIds={overlayEntityIds}
          startInvestigation={startInvestigation} commitInvestigation={commitInvestigation} cancelInvestigation={cancelInvestigation}
          onLogout={logout}
        />
      </div>
    </div>
  );

  const wrapped = adapter === antdAdapter
    ? (
      <AntConfigProvider
        locale={ruRU}
        theme={{
          algorithm: antTheme.defaultAlgorithm,
          token: { colorPrimary: "#1677ff", borderRadius: 8 },
        }}
      >
        {content}
      </AntConfigProvider>
    )
    : content;

  return (
    <AuthGate
      currentUser={currentUser}
      doAuth={doAuth}
      authError={authError}
      isLoading={isLoading}
      title={DOMAIN_TITLES[domainId] || domainId}
    >
      {wrapped}
    </AuthGate>
  );
}
