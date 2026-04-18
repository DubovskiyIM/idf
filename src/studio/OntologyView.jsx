import React from "react";
import useDomainModule from "./useDomainModule.js";
import OntologyInspector from "../components/OntologyInspector.jsx";

/**
 * OntologyView — Studio-tab: инспектор онтологии для текущего домена.
 * Dynamic-load domain модуля + OntologyInspector в dark-режиме.
 * World пока пустой ({}) — статистика экземпляров требует полного Φ-fold,
 * который для read-only Studio-view слишком тяжёл; показываем типы/связи.
 */
export default function OntologyView({ domainId }) {
  const { domain, loading, error } = useDomainModule(domainId);

  if (!domainId) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 14 }}>
        Выбери домен во вкладке «Граф»
      </div>
    );
  }
  if (loading) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>
        Загружаю домен…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", fontSize: 13 }}>
        {error}
      </div>
    );
  }
  return (
    <div style={{
      height: "100%", overflowY: "auto",
      background: "#0b1220", padding: "24px 28px",
      fontFamily: "Inter, -apple-system, system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <OntologyInspector world={{}} domain={domain} dark />
      </div>
    </div>
  );
}
