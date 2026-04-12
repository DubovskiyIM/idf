/**
 * Standalone-режим: чистое приложение без IDF-панелей.
 * Доступно по /{domainName} — для конечных пользователей.
 *
 * JWT-аутентификация: все домены (включая booking/planning/workflow) теперь
 * требуют login через shared useAuth hook + AuthGate. Viewer — реальный
 * пользователь из auth_users, не hardcoded "client".
 */
import { useState, useEffect, useMemo } from "react";
import { useEngine } from "./runtime/engine.js";
import { useAuth } from "./runtime/renderer/auth/useAuth.js";
import AuthGate from "./runtime/renderer/auth/AuthGate.jsx";

import * as bookingDomain from "./domains/booking/domain.js";
import * as planningDomain from "./domains/planning/domain.js";
import * as workflowDomain from "./domains/workflow/domain.js";
import * as messengerDomain from "./domains/messenger/domain.js";
import * as meshokDomain from "./domains/meshok/domain.js";

import BookingUI from "./domains/booking/ManualUI.jsx";
import PlanningUI from "./domains/planning/ManualUI.jsx";
import WorkflowUI from "./domains/workflow/ManualUI.jsx";
import MessengerUI from "./domains/messenger/ManualUI.jsx";
import MessengerV2UI from "./domains/messenger/V2UI.jsx";
import V2Shell from "./runtime/renderer/shell/V2Shell.jsx";

function makeV2UI(domainId) {
  return function V2Standalone({ world, exec, execBatch, viewer }) {
    const domain = DOMAINS_RAW[domainId];
    return (
      <V2Shell
        domain={domain}
        domainId={domainId}
        world={world}
        exec={exec}
        execBatch={execBatch}
        viewer={viewer}
      />
    );
  };
}

const DOMAINS_RAW = {
  booking: bookingDomain,
  planning: planningDomain,
  workflow: workflowDomain,
  messenger: messengerDomain,
  meshok: meshokDomain,
};

const DOMAIN_TITLES = {
  booking: "📅 Бронирование",
  "booking-v2": "📅 Бронирование",
  planning: "📊 Планирование",
  "planning-v2": "📊 Планирование",
  workflow: "⚡ Workflow",
  messenger: "💬 Мессенджер",
  "messenger-v2": "💬 Мессенджер",
  meshok: "🎒 Мешок",
};

const DOMAINS = {
  booking: { ...bookingDomain, UI: BookingUI },
  "booking-v2": { ...bookingDomain, UI: makeV2UI("booking") },
  planning: { ...planningDomain, UI: PlanningUI },
  "planning-v2": { ...planningDomain, UI: makeV2UI("planning") },
  workflow: { ...workflowDomain, UI: WorkflowUI },
  messenger: { ...messengerDomain, UI: MessengerUI },
  "messenger-v2": { ...messengerDomain, UI: MessengerV2UI },
  meshok: { ...meshokDomain, UI: makeV2UI("meshok") },
};

export default function StandaloneApp({ domainId }) {
  const domain = DOMAINS[domainId];
  if (!domain) return <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui" }}>Домен "{domainId}" не найден</div>;

  // Messenger v2 имеет собственный auth flow внутри V2UI — пропускаем shared
  const isMessengerV2 = domainId === "messenger-v2";

  const auth = useAuth();
  const { currentUser, doAuth, authError, isLoading, logout, authUsers } = auth;

  const viewer = useMemo(() => {
    if (isMessengerV2) return null; // messenger управляет viewer сам
    if (!currentUser) return { id: "self", name: "Я" };
    return { id: currentUser.id, name: currentUser.name, email: currentUser.email };
  }, [currentUser, isMessengerV2]);

  const engine = useEngine(domain);
  const { world: rawWorld, worldForIntent, drafts, effects, signals, exec, execBatch,
    overlay, overlayEntityIds, startInvestigation, commitInvestigation, cancelInvestigation } = engine;

  // Подмешиваем auth_users в world.users — они не в Φ и fold их не видит.
  // Аналогично messenger/V2UI.jsx, но доменонезависимо.
  const world = useMemo(() => {
    if (isMessengerV2) return rawWorld; // messenger управляет world сам
    const foldedUsers = rawWorld.users || [];
    const merged = {};
    // auth_users как база
    for (const u of authUsers) {
      merged[u.id] = { id: u.id, name: u.name, email: u.email || "" };
    }
    // folded replace-эффекты поверх базы
    for (const u of foldedUsers) {
      merged[u.id] = { ...(merged[u.id] || {}), ...u };
    }
    // Гарантировать currentUser
    if (currentUser && !merged[currentUser.id]) {
      merged[currentUser.id] = { id: currentUser.id, name: currentUser.name, email: currentUser.email || "" };
    }
    return { ...rawWorld, users: Object.values(merged) };
  }, [rawWorld, authUsers, currentUser, isMessengerV2]);

  useEffect(() => {
    fetch(`/api/typemap?domain=${domainId.replace("-v2", "")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(domain.ONTOLOGY),
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
          const hasSeed = existing.some(e => e.intent_id === "_seed");
          if (!hasSeed) {
            fetch("/api/effects/seed", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(seedEffects),
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
  const content = (
    <div style={{ height: "100vh", background: "var(--mantine-color-body)", overflow: isV2 ? "hidden" : "auto", display: "flex", flexDirection: "column" }}>
      {/* Top bar with user info */}
      {currentUser && (
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
        />
      </div>
    </div>
  );

  return (
    <AuthGate
      currentUser={currentUser}
      doAuth={doAuth}
      authError={authError}
      isLoading={isLoading}
      title={DOMAIN_TITLES[domainId] || domainId}
    >
      {content}
    </AuthGate>
  );
}
