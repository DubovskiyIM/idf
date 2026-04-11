/**
 * Standalone-режим: чистое приложение без IDF-панелей.
 * Доступно по /{domainName} — для конечных пользователей.
 */
import { useState, useEffect, useCallback } from "react";
import { useEngine } from "./runtime/engine.js";

import * as bookingDomain from "./domains/booking/domain.js";
import * as planningDomain from "./domains/planning/domain.js";
import * as workflowDomain from "./domains/workflow/domain.js";
import * as messengerDomain from "./domains/messenger/domain.js";

import BookingUI from "./domains/booking/ManualUI.jsx";
import PlanningUI from "./domains/planning/ManualUI.jsx";
import WorkflowUI from "./domains/workflow/ManualUI.jsx";
import MessengerUI from "./domains/messenger/ManualUI.jsx";
import MessengerV2UI from "./domains/messenger/V2UI.jsx";
import V2Shell from "./runtime/renderer/shell/V2Shell.jsx";

// Обёртка над V2Shell для standalone: booking/planning используют универсальный
// shell (без auth/WS, viewer — hardcoded). messenger имеет собственный V2UI
// со своим auth-флоу поверх V2Shell.
function makeV2UI(domainId) {
  return function V2Standalone({ world, exec, execBatch }) {
    const domain = DOMAINS_RAW[domainId];
    return (
      <V2Shell
        domain={domain}
        domainId={domainId}
        world={world}
        exec={exec}
        execBatch={execBatch}
        viewer={{ id: "client", name: "Я" }}
      />
    );
  };
}

const DOMAINS_RAW = {
  booking: bookingDomain,
  planning: planningDomain,
  workflow: workflowDomain,
  messenger: messengerDomain,
};

const DOMAINS = {
  booking: { ...bookingDomain, UI: BookingUI },
  "booking-v2": { ...bookingDomain, UI: makeV2UI("booking") },
  planning: { ...planningDomain, UI: PlanningUI },
  "planning-v2": { ...planningDomain, UI: makeV2UI("planning") },
  workflow: { ...workflowDomain, UI: WorkflowUI },
  messenger: { ...messengerDomain, UI: MessengerUI },
  "messenger-v2": { ...messengerDomain, UI: MessengerV2UI },
};

export default function StandaloneApp({ domainId }) {
  const domain = DOMAINS[domainId];
  if (!domain) return <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui" }}>Домен "{domainId}" не найден</div>;

  const engine = useEngine(domain);
  const { world, worldForIntent, drafts, effects, signals, exec, execBatch,
    overlay, overlayEntityIds, startInvestigation, commitInvestigation, cancelInvestigation } = engine;

  // Отправить онтологию и намерения домена на сервер.
  // Intents нужны для серверной валидации условий (server/intents.js) —
  // без них мессенджер и прочие новые домены проходили валидацию без
  // проверки условий типа "message.senderId = me.id".
  useEffect(() => {
    fetch(`/api/typemap?domain=${domainId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(domain.ONTOLOGY),
    }).catch(() => {});
    fetch("/api/intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: domainId, intents: domain.INTENTS }),
    }).catch(() => {});
  }, [domain, domainId]);

  // Seed при первом запуске
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

  // v2-варианты рендерятся на всю высоту без max-width ограничений
  const isV2 = domainId.endsWith("-v2");
  const isFullWidth = domainId === "messenger" || isV2;

  return (
    <div style={{ height: "100vh", background: "var(--mantine-color-body)", overflow: isV2 ? "hidden" : "auto", display: "flex", flexDirection: "column" }}>
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
          world={world} worldForIntent={worldForIntent} drafts={drafts} exec={exec} execBatch={execBatch} effects={effects}
          viewer="client" layer="canonical"
          overlay={overlay} overlayEntityIds={overlayEntityIds}
          startInvestigation={startInvestigation} commitInvestigation={commitInvestigation} cancelInvestigation={cancelInvestigation}
        />
      </div>
    </div>
  );
}
