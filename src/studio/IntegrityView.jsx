import React from "react";
import useDomainModule from "./useDomainModule.js";
import IntegrityGraph from "../components/IntegrityGraph.jsx";

/**
 * IntegrityView — Studio-tab: граф целостности намерений/проекций/онтологии
 * для текущего домена. Красные узлы — error'ы алгебры/анкеринга/и т.п.
 */
export default function IntegrityView({ domainId, onFixWithClaude }) {
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
    <div style={{ height: "100%", background: "#0b1220", position: "relative" }}>
      <IntegrityGraph domain={domain} onFixWithClaude={onFixWithClaude} />
    </div>
  );
}
