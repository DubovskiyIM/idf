import React from "react";

const TOP_TABS = [
  { id: "spec", label: "Спек", enabled: true },
  { id: "changes", label: "Изменения", enabled: false },
  { id: "live", label: "Live", enabled: false },
  { id: "channels", label: "4 канала", enabled: false },
  { id: "audit", label: "Аудит", enabled: false },
  { id: "access", label: "Доступ", enabled: false },
  { id: "deploys", label: "Деплои", enabled: false },
  { id: "snapshots", label: "Снапшоты", enabled: false },
];

export default function StudioTabBar({ active, onChange }) {
  return (
    <div style={{
      display: "flex", gap: 0, padding: "8px 24px",
      borderBottom: "1px solid #2a2a32", flexWrap: "wrap",
    }}>
      {TOP_TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => t.enabled && onChange(t.id)}
          disabled={!t.enabled}
          style={{
            padding: "8px 18px",
            background: active === t.id ? "#1f1f26" : "transparent",
            color: active === t.id ? "#f0f0f4" : (t.enabled ? "#9f9faa" : "#5a5a64"),
            border: "1px solid",
            borderColor: active === t.id ? "#3a3a44" : "transparent",
            borderRadius: 18, fontSize: 14, cursor: t.enabled ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            marginRight: 4,
          }}
          title={t.enabled ? "" : "TODO (Level 3)"}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
