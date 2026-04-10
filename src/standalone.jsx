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

const DOMAINS = {
  booking: { ...bookingDomain, UI: BookingUI },
  planning: { ...planningDomain, UI: PlanningUI },
  workflow: { ...workflowDomain, UI: WorkflowUI },
  messenger: { ...messengerDomain, UI: MessengerUI },
};

export default function StandaloneApp({ domainId }) {
  const domain = DOMAINS[domainId];
  if (!domain) return <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui" }}>Домен "{domainId}" не найден</div>;

  const engine = useEngine(domain);
  const { world, worldForIntent, drafts, effects, signals, exec,
    overlay, overlayEntityIds, startInvestigation, commitInvestigation, cancelInvestigation } = engine;

  // Отправить онтологию на сервер
  useEffect(() => {
    fetch("/api/typemap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(domain.ONTOLOGY),
    }).catch(() => {});
  }, [domain]);

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

  return (
    <div style={{ height: "100vh", background: "#fafafa", overflow: "auto" }}>
      <div style={{ maxWidth: domainId === "messenger" ? "100%" : 800, margin: "0 auto", padding: domainId === "messenger" ? 0 : 24 }}>
        <domain.UI
          world={world} worldForIntent={worldForIntent} drafts={drafts} exec={exec} effects={effects}
          viewer="client" layer="canonical"
          overlay={overlay} overlayEntityIds={overlayEntityIds}
          startInvestigation={startInvestigation} commitInvestigation={commitInvestigation} cancelInvestigation={cancelInvestigation}
        />
      </div>
    </div>
  );
}
