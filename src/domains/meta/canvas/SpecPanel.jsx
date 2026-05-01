import React, { useState } from "react";
import SummaryCard from "./SummaryCard.jsx";
import EntitiesList from "./EntitiesList.jsx";
import ActionsList from "./ActionsList.jsx";
import RolesList from "./RolesList.jsx";
import JsonPanel from "./JsonPanel.jsx";

const SUB_TABS = [
  { id: "summary", label: "Сводка" },
  { id: "entities", label: "Сущности" },
  { id: "actions", label: "Действия" },
  { id: "roles", label: "Роли" },
  { id: "json", label: "JSON" },
];

export default function SpecPanel({ domain, ontology, intents }) {
  const [active, setActive] = useState("summary");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        display: "flex", gap: 4, padding: "12px 24px",
        borderBottom: "1px solid #2a2a32",
      }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{
              padding: "6px 14px",
              background: active === t.id ? "#1f1f26" : "transparent",
              color: active === t.id ? "#f0f0f4" : "#9f9faa",
              border: "1px solid",
              borderColor: active === t.id ? "#3a3a44" : "transparent",
              borderRadius: 18, fontSize: 13, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {active === "summary" && <SummaryCard domain={domain} />}
        {active === "entities" && <EntitiesList ontology={ontology} />}
        {active === "actions" && <ActionsList intents={intents} />}
        {active === "roles" && <RolesList ontology={ontology} />}
        {active === "json" && <JsonPanel ontology={ontology} />}
      </div>
    </div>
  );
}
